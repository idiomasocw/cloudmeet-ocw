# Fix Backend and Redeploy
# Usage: .\fix-backend.ps1

$PROFILE = "intellectif"
$REGION = "us-east-1"

Write-Host "🔧 Step 1: Rebuilding backend API..." -ForegroundColor Yellow
Set-Location "livekit-backend-api"

# Build the backend
pnpm install
pnpm run build

# Get ECR URI with validation
Write-Host "📋 Getting AWS account ID..." -ForegroundColor Cyan
$ACCOUNT_ID = aws sts get-caller-identity --profile $PROFILE --query Account --output text
if (-not $ACCOUNT_ID -or $ACCOUNT_ID -eq "None") {
    Write-Host "❌ Failed to get AWS account ID" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Account ID: $ACCOUNT_ID" -ForegroundColor Green

$ECR_URI = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/livekit-token-server"
Write-Host "📦 ECR URI: $ECR_URI" -ForegroundColor Cyan

Write-Host "🐳 Step 2: Building and pushing Docker image..." -ForegroundColor Yellow

# Login to ECR
Write-Host "🔐 Logging into ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $REGION --profile $PROFILE | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# Build and push with error checking
Write-Host "🏗️ Building Docker image..." -ForegroundColor Cyan
docker build -t livekit-token-server .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "🏷️ Tagging image..." -ForegroundColor Cyan
docker tag livekit-token-server:latest "$ECR_URI:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker tag failed" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Pushing to ECR..." -ForegroundColor Cyan
docker push "$ECR_URI:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed" -ForegroundColor Red
    exit 1
}

Write-Host "🔍 Step 3: Finding and restarting ECS service..." -ForegroundColor Yellow
$SERVICE_ARN = aws ecs list-services --profile $PROFILE --region $REGION --cluster "livekit-cluster" --query "serviceArns[0]" --output text 2>$null

if ($SERVICE_ARN -and $SERVICE_ARN -ne "None") {
    $SERVICE_NAME = $SERVICE_ARN.Split("/")[-1]
    Write-Host "✅ Found service: $SERVICE_NAME" -ForegroundColor Green
    Write-Host "🔄 Restarting service..." -ForegroundColor Cyan
    aws ecs update-service --profile $PROFILE --region $REGION --cluster "livekit-cluster" --service $SERVICE_NAME --force-new-deployment
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Service restart initiated successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to restart service" -ForegroundColor Red
    }
} else {
    Write-Host "❌ No ECS service found in cluster" -ForegroundColor Red
}

Write-Host "✅ Backend build and push completed!" -ForegroundColor Green
Write-Host "💡 Monitor logs: aws logs tail /ecs/livekit-token-server --follow --profile $PROFILE --region $REGION" -ForegroundColor Cyan

Set-Location ".."