# Update LiveKit Secrets Manager
# Usage: .\update-secrets.ps1 "YOUR_API_KEY" "YOUR_API_SECRET"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    
    [Parameter(Mandatory=$true)]
    [string]$ApiSecret
)

$PROFILE = "intellectif"
$REGION = "us-east-1"

Write-Host "🔐 Updating LiveKit credentials in Secrets Manager..." -ForegroundColor Yellow

$secretJson = @{
    "LIVEKIT_API_KEY" = $ApiKey
    "LIVEKIT_API_SECRET" = $ApiSecret
    "LIVEKIT_URL" = "wss://livekit.intellectif.com"
} | ConvertTo-Json -Compress

try {
    aws secretsmanager update-secret --profile $PROFILE --region $REGION --secret-id "livekit-credentials" --secret-string $secretJson
    Write-Host "✅ Secrets updated successfully!" -ForegroundColor Green
    
    Write-Host "🔄 Restarting Fargate service to pick up new credentials..." -ForegroundColor Yellow
    aws ecs update-service --profile $PROFILE --region $REGION --cluster "livekit-cluster" --service "TokenServerService" --force-new-deployment
    
    Write-Host "✅ Service restart initiated. Wait 2-3 minutes for deployment." -ForegroundColor Green
    Write-Host "💡 Check logs with: aws logs tail /ecs/livekit-token-server --follow --profile $PROFILE --region $REGION" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Failed to update secrets: $_" -ForegroundColor Red
    exit 1
}