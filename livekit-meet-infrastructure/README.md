# LiveKit Meet Infrastructure

Complete AWS CDK infrastructure for a scalable LiveKit videoconferencing system with recording capabilities.

## Prerequisites

1. **AWS CLI configured** with 'intellectif' profile
2. **Node.js >= 18** installed
3. **AWS CDK CLI** installed: `npm install -g aws-cdk`
4. **Docker** installed for building containers
5. **GitHub token** stored in AWS Secrets Manager as 'github-token'

## Complete System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │  LiveKit Server │
│ (AWS Amplify)   │────│   (Fargate)      │────│     (EC2)       │
│ cloumeet.       │    │ api.intellectif  │    │ livekit.        │
│ intellectif.com │    │ .com             │    │ intellectif.com │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                        │
        │              ┌──────────────────┐    ┌─────────────────┐
        │              │ API Gateway +    │    │   S3 Bucket     │
        │              │ Lambda Kicker    │    │  (Recordings)   │
        │              └──────────────────┘    └─────────────────┘
        │                       │                        │
        └───────────────┌──────────────────┐─────────────────────┘
                        │     Redis        │
                        │  (ElastiCache)   │
                        └──────────────────┘
```

## Deployment Guide

### Step 1: Deploy Infrastructure

1. **Install CDK dependencies:**
   ```bash
   cd livekit-meet-infrastructure
   npm install
   ```

2. **Bootstrap CDK (first time only):**
   ```bash
   npx cdk bootstrap --profile intellectif
   ```

3. **Deploy the complete stack:**
   ```bash
   npx cdk deploy --profile intellectif
   ```

4. **Note the outputs** - you'll need these for DNS configuration

### Step 2: Build and Deploy Backend API

1. **Build the enhanced backend:**
   ```bash
   cd ../livekit-backend-api
   npm install
   npm run build
   ```

2. **Build and push Docker image to ECR:**
   ```bash
   # Get ECR login token (replace with your account ID and region)
   aws ecr get-login-password --region us-east-1 --profile intellectif | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
   
   # Build and tag image
   docker build -t livekit-token-server .
   docker tag livekit-token-server:latest <ECR_REPOSITORY_URI>:latest
   
   # Push to ECR
   docker push <ECR_REPOSITORY_URI>:latest
   ```

### Step 3: Configure DNS

Point these domains to the CDK outputs:
- `livekit.intellectif.com` → LiveKit server public IP (A record)
- `api.intellectif.com` → API Gateway URL (CNAME)
- `cloumeet.intellectif.com` → Amplify app URL (CNAME)

### Step 4: Configure LiveKit Credentials

1. **Wait for EC2 to generate credentials** (check `/opt/livekit/livekit.yaml`)
2. **Update AWS Secrets Manager:**
   ```json
   {
     "LIVEKIT_API_KEY": "<from-ec2-livekit.yaml>",
     "LIVEKIT_API_SECRET": "<from-ec2-livekit.yaml>",
     "LIVEKIT_URL": "wss://livekit.intellectif.com"
   }
   ```

### Step 5: Test the System

1. **Test LiveKit server:** `https://livekit.intellectif.com`
2. **Test API health:** `https://api.intellectif.com/health`
3. **Test frontend:** `https://cloumeet.intellectif.com`

## API Endpoints

The enhanced backend provides:

- `GET /health` - Health check
- `GET /connection-details` - Legacy endpoint (backward compatibility)
- `POST /get-token` - Generate LiveKit access token
- `POST /start-recording` - Start room recording
- `POST /stop-recording` - Stop recording by egressId
- `GET /list-recordings` - List recordings for a room

## Cost Optimization Features

- **Fargate Spot** for backend API (scale-to-zero)
- **Single NAT Gateway** for cost efficiency
- **t3.micro Redis** instance
- **t3.medium EC2** with Savings Plan recommendation
- **90-day S3 lifecycle** policy
- **Auto-scaling** with 15-minute scale-down

## Security Features

- **Private subnets** for Redis and Fargate
- **Security groups** with minimal required ports
- **IAM roles** with least privilege
- **AWS Secrets Manager** for credentials
- **S3 bucket** with blocked public access
- **VPC isolation** for all services

## Monitoring & Logging

- **CloudWatch Logs** for Fargate containers
- **ECS Service** auto-scaling metrics
- **Application Load Balancer** health checks
- **S3 access** logging

## Troubleshooting

1. **Fargate not starting:** Check ECR image exists and secrets are configured
2. **LiveKit connection issues:** Verify DNS points to correct IP and SSL is working
3. **Recording failures:** Check S3 permissions and bucket configuration
4. **API Gateway timeouts:** Lambda kicker may need more time to start Fargate