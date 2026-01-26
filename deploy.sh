#!/bin/bash

# LiveKit Meet Infrastructure Deployment Script
# Usage: ./deploy.sh [--profile intellectif]

set -e

PROFILE=${1:-intellectif}
REGION="us-east-1"

echo "🚀 Starting LiveKit Meet Infrastructure Deployment"
echo "Profile: $PROFILE"
echo "Region: $REGION"

# Step 1: Deploy CDK Infrastructure
echo "📦 Step 1: Deploying CDK Infrastructure..."
cd livekit-meet-infrastructure
pnpm install
npx cdk bootstrap --profile $PROFILE
npx cdk deploy --profile $PROFILE --require-approval never

# Get outputs
echo "📋 Getting deployment outputs..."
ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/livekit-token-server"

echo "ECR Repository URI: $ECR_URI"

# Step 2: Build and Deploy Backend API
echo "🐳 Step 2: Building and deploying backend API..."
cd ../livekit-backend-api

# Install dependencies and build
pnpm install
pnpm run build

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $REGION --profile $PROFILE | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build and push Docker image
echo "🏗️ Building Docker image..."
docker build -t livekit-token-server .
docker tag livekit-token-server:latest $ECR_URI:latest

echo "📤 Pushing to ECR..."
docker push $ECR_URI:latest

echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Configure DNS records for your domains"
echo "2. Update LiveKit credentials in AWS Secrets Manager"
echo "3. Test the system endpoints"
echo ""
echo "🔗 Useful commands:"
echo "  Check CDK outputs: npx cdk list --profile $PROFILE"
echo "  View logs: aws logs tail /ecs/livekit-token-server --follow --profile $PROFILE"
echo "  Test API: curl https://api.intellectif.com/health"