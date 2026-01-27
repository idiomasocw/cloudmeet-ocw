#!/usr/bin/env pwsh
# Fix script for local development issues

Write-Host "🔧 Fixing LiveKit Video Conference Local Development Issues..." -ForegroundColor Cyan
Write-Host ""

# Stop all containers
Write-Host "1. Stopping all containers..." -ForegroundColor Yellow
docker-compose down

# Remove frontend container and volumes to force rebuild
Write-Host "2. Removing frontend container and volumes..." -ForegroundColor Yellow
docker rm -f livekit-frontend 2>$null
docker volume rm livekit-videoconference_frontend-node-modules 2>$null

# Rebuild frontend without cache
Write-Host "3. Rebuilding frontend image..." -ForegroundColor Yellow
docker-compose build --no-cache frontend

# Start services in order
Write-Host "4. Starting infrastructure services..." -ForegroundColor Yellow
docker-compose up -d postgres redis localstack

Write-Host "5. Waiting for infrastructure to be ready (30 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "6. Starting LiveKit server..." -ForegroundColor Yellow
docker-compose up -d livekit

Write-Host "7. Waiting for LiveKit to be ready (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "8. Starting Egress service..." -ForegroundColor Yellow
docker-compose up -d egress

Write-Host "9. Starting Backend API..." -ForegroundColor Yellow
docker-compose up -d backend

Write-Host "10. Waiting for Backend to be ready (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "11. Starting Frontend..." -ForegroundColor Yellow
docker-compose up -d frontend

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Checking service status..." -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor White
Write-Host "  Health:    http://localhost:3001/health" -ForegroundColor White
Write-Host ""
Write-Host "📝 To view logs:" -ForegroundColor Cyan
Write-Host "  docker-compose logs -f" -ForegroundColor White
Write-Host ""
Write-Host "🛑 To stop all services:" -ForegroundColor Cyan
Write-Host "  docker-compose down" -ForegroundColor White
Write-Host ""
