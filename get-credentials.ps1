# LiveKit Credentials Retrieval Script
# Usage: .\get-credentials.ps1

$PROFILE = "intellectif"
$REGION = "us-east-1"

Write-Host "🔧 Step 1: Deploying updated CDK infrastructure..." -ForegroundColor Yellow
Set-Location "livekit-meet-infrastructure"
pnpm install
npx cdk deploy --profile $PROFILE --require-approval never

Write-Host "📋 Step 2: Getting EC2 instance ID..." -ForegroundColor Yellow
$INSTANCE_ID = aws ec2 describe-instances --profile $PROFILE --region $REGION --filters "Name=tag:Name,Values=*LivekitServer*" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].InstanceId" --output text

if ($INSTANCE_ID -eq "None" -or $INSTANCE_ID -eq "") {
    Write-Host "❌ No running LiveKit EC2 instance found!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found EC2 instance: $INSTANCE_ID" -ForegroundColor Green

Write-Host "🔑 Step 3: Retrieving LiveKit credentials..." -ForegroundColor Yellow
Write-Host "Connecting to EC2 instance via Session Manager..." -ForegroundColor Cyan

# Wait a moment for the instance to be ready
Start-Sleep -Seconds 5

# Try to get credentials
$CREDENTIALS = aws ssm send-command --profile $PROFILE --region $REGION --instance-ids $INSTANCE_ID --document-name "AWS-RunShellScript" --parameters 'commands=["cat /home/ec2-user/livekit-credentials.txt 2>/dev/null || echo \"Credentials not ready yet\""]' --query "Command.CommandId" --output text

if ($CREDENTIALS) {
    Start-Sleep -Seconds 3
    $OUTPUT = aws ssm get-command-invocation --profile $PROFILE --region $REGION --command-id $CREDENTIALS --instance-id $INSTANCE_ID --query "StandardOutputContent" --output text
    
    Write-Host "`n🎉 LiveKit Credentials Retrieved:" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host $OUTPUT -ForegroundColor White
    Write-Host "================================" -ForegroundColor Green
    
    # Save to local file
    $OUTPUT | Out-File -FilePath "../livekit-credentials.txt" -Encoding UTF8
    Write-Host "✅ Credentials saved to: livekit-credentials.txt" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to retrieve credentials via SSM" -ForegroundColor Red
    Write-Host "💡 Try connecting manually with:" -ForegroundColor Yellow
    Write-Host "aws ssm start-session --target $INSTANCE_ID --profile $PROFILE" -ForegroundColor Cyan
    Write-Host "Then run: cat /home/ec2-user/livekit-credentials.txt" -ForegroundColor Cyan
}

Set-Location ".."