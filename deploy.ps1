# LiveKit Meet Infrastructure Deployment Script (PowerShell)
param(
    [string]$Profile = "intellectif",
    [string]$Region = "us-east-1"
)

Write-Host "🚀 Starting LiveKit Meet Infrastructure Deployment" -ForegroundColor Green
Write-Host "Profile: $Profile" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow

# Step 1: Deploy CDK Infrastructure
Write-Host "📦 Step 1: Deploying CDK Infrastructure..." -ForegroundColor Cyan
Set-Location livekit-meet-infrastructure
npm install
npx cdk bootstrap --profile $Profile
npx cdk deploy --profile $Profile --require-approval never

# Get outputs
Write-Host "📋 Getting deployment outputs..." -ForegroundColor Cyan
$AccountId = aws sts get-caller-identity --profile $Profile --query Account --output text
$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/livekit-token-server"

Write-Host "ECR Repository URI: $EcrUri" -ForegroundColor Yellow

# Step 2: Build and Deploy Backend API
Write-Host "🐳 Step 2: Building and deploying backend API..." -ForegroundColor Cyan
Set-Location ..\livekit-backend-api

# Install dependencies and build
npm install
npm run build

# Login to ECR
Write-Host "🔐 Logging into ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $Region --profile $Profile | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com"

# Build and push Docker image
Write-Host "🏗️ Building Docker image..." -ForegroundColor Cyan
docker build -t livekit-token-server .
docker tag livekit-token-server:latest "$EcrUri:latest"

Write-Host "📤 Pushing to ECR..." -ForegroundColor Cyan
docker push "$EcrUri:latest"

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure DNS records for your domains"
Write-Host "2. Update LiveKit credentials in AWS Secrets Manager"
Write-Host "3. Test the system endpoints"