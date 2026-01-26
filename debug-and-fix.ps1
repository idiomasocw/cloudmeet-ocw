# Debug and Fix Backend
# Usage: .\debug-and-fix.ps1

$ErrorActionPreference = "Stop"
$PROFILE = "intellectif"
$REGION = "us-east-1"

Write-Host "🔧 Step 1: Building backend..." -ForegroundColor Yellow
Set-Location "livekit-backend-api"

pnpm install
pnpm run build

Write-Host "📋 Step 2: Getting AWS info..." -ForegroundColor Yellow

# Get account ID and debug
Write-Host "Getting account ID..." -ForegroundColor Cyan
$ACCOUNT_ID_RAW = aws sts get-caller-identity --profile $PROFILE --query Account --output text
Write-Host "Raw account ID: '$ACCOUNT_ID_RAW'" -ForegroundColor White

# Clean the account ID (remove any whitespace/newlines)
$ACCOUNT_ID = $ACCOUNT_ID_RAW.Trim()
Write-Host "Cleaned account ID: '$ACCOUNT_ID'" -ForegroundColor White

if ([string]::IsNullOrEmpty($ACCOUNT_ID)) {
    Write-Host "❌ Account ID is empty!" -ForegroundColor Red
    exit 1
}

# Construct ECR URI
$ECR_REGISTRY = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
$ECR_URI = "$ECR_REGISTRY/livekit-token-server"

Write-Host "ECR Registry: '$ECR_REGISTRY'" -ForegroundColor White
Write-Host "ECR URI: '$ECR_URI'" -ForegroundColor White

Write-Host "🐳 Step 3: Docker operations..." -ForegroundColor Yellow

# ECR Login
Write-Host "Logging into ECR..." -ForegroundColor Cyan
$LOGIN_CMD = "aws ecr get-login-password --region $REGION --profile $PROFILE"
$LOGIN_RESULT = Invoke-Expression $LOGIN_CMD
if ([string]::IsNullOrEmpty($LOGIN_RESULT)) {
    Write-Host "❌ ECR login failed - no password returned" -ForegroundColor Red
    exit 1
}

$LOGIN_RESULT | docker login --username AWS --password-stdin $ECR_REGISTRY
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker login failed" -ForegroundColor Red
    exit 1
}

# Build image
Write-Host "Building Docker image..." -ForegroundColor Cyan
docker build -t livekit-token-server .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

# Tag image - using separate variables to debug
Write-Host "Tagging image..." -ForegroundColor Cyan
$SOURCE_TAG = "livekit-token-server:latest"
$TARGET_TAG = "$ECR_URI`:latest"

Write-Host "Source tag: '$SOURCE_TAG'" -ForegroundColor White
Write-Host "Target tag: '$TARGET_TAG'" -ForegroundColor White

docker tag $SOURCE_TAG $TARGET_TAG
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker tag failed" -ForegroundColor Red
    exit 1
}

# Push image
Write-Host "Pushing to ECR..." -ForegroundColor Cyan
docker push $TARGET_TAG
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker operations completed!" -ForegroundColor Green

# Restart ECS service
Write-Host "🔄 Step 4: Restarting ECS service..." -ForegroundColor Yellow
$SERVICE_ARN = aws ecs list-services --profile $PROFILE --region $REGION --cluster "livekit-cluster" --query "serviceArns[0]" --output text

if ($SERVICE_ARN -and $SERVICE_ARN -ne "None") {
    $SERVICE_NAME = $SERVICE_ARN.Split("/")[-1]
    Write-Host "Restarting service: $SERVICE_NAME" -ForegroundColor Cyan
    aws ecs update-service --profile $PROFILE --region $REGION --cluster "livekit-cluster" --service $SERVICE_NAME --force-new-deployment
    Write-Host "✅ Service restart initiated!" -ForegroundColor Green
} else {
    Write-Host "⚠️ No service found to restart" -ForegroundColor Yellow
}

Set-Location ".."
Write-Host "✅ All done!" -ForegroundColor Green