#!/usr/bin/env pwsh
# Complete development environment startup script

Write-Host "🚀 Starting LiveKit Video Conference Development Environment" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop any running containers
Write-Host "1️⃣  Stopping any running containers..." -ForegroundColor Yellow
docker-compose down 2>$null
docker-compose -f docker-compose.backend-only.yml down 2>$null

# Step 2: Start backend services
Write-Host "2️⃣  Starting backend services (Docker)..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend-only.yml up -d

# Step 3: Wait for services to be ready
Write-Host "3️⃣  Waiting for services to initialize..." -ForegroundColor Yellow
Write-Host "   ⏳ This may take 30-60 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 45

# Step 4: Check service status
Write-Host "4️⃣  Checking service status..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend-only.yml ps

Write-Host ""
Write-Host "✅ Backend services are running!" -ForegroundColor Green
Write-Host ""

# Step 5: Ask about frontend
Write-Host "5️⃣  Frontend Setup" -ForegroundColor Yellow
Write-Host ""
Write-Host "Would you like to start the frontend now?" -ForegroundColor Cyan
Write-Host "  [Y] Yes, start frontend in a new window" -ForegroundColor White
Write-Host "  [N] No, I'll start it manually later" -ForegroundColor White
Write-Host ""
$response = Read-Host "Your choice (Y/N)"

if ($response -eq "Y" -or $response -eq "y" -or $response -eq "") {
    Write-Host ""
    Write-Host "🎨 Starting frontend in a new PowerShell window..." -ForegroundColor Yellow
    
    # Check if pnpm is installed
    $pnpmInstalled = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpmInstalled) {
        Write-Host "⚠️  Warning: pnpm is not installed!" -ForegroundColor Red
        Write-Host "   Install it with: npm install -g pnpm" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Or use npm instead by editing run-frontend-local.ps1" -ForegroundColor Yellow
    } else {
        # Start frontend in new window
        Start-Process powershell -ArgumentList "-NoExit", "-File", ".\run-frontend-local.ps1"
        Write-Host "✅ Frontend starting in new window..." -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "ℹ️  To start frontend later, run:" -ForegroundColor Cyan
    Write-Host "   .\run-frontend-local.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🎉 Development Environment Ready!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Access URLs:" -ForegroundColor Cyan
Write-Host "   Frontend:    http://localhost:3000" -ForegroundColor White
Write-Host "   Backend:     http://localhost:3001" -ForegroundColor White
Write-Host "   Health:      http://localhost:3001/health" -ForegroundColor White
Write-Host ""
Write-Host "📝 Useful Commands:" -ForegroundColor Cyan
Write-Host "   View logs:   docker-compose -f docker-compose.backend-only.yml logs -f" -ForegroundColor White
Write-Host "   Stop all:    docker-compose -f docker-compose.backend-only.yml down" -ForegroundColor White
Write-Host "   Restart:     docker-compose -f docker-compose.backend-only.yml restart [service]" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Keep this window open to see backend logs" -ForegroundColor Yellow
Write-Host ""

# Offer to show logs
Write-Host "Would you like to view backend logs now? (Y/N)" -ForegroundColor Cyan
$logResponse = Read-Host

if ($logResponse -eq "Y" -or $logResponse -eq "y") {
    Write-Host ""
    Write-Host "📋 Showing backend logs (Ctrl+C to exit)..." -ForegroundColor Yellow
    Write-Host ""
    docker-compose -f docker-compose.backend-only.yml logs -f
}
