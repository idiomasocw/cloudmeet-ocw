#!/usr/bin/env pwsh
# Run frontend locally (outside Docker)

Write-Host "🚀 Starting Frontend Locally..." -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "livekit-meet-frontend")) {
    Write-Host "❌ Error: livekit-meet-frontend directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

# Navigate to frontend directory
Set-Location livekit-meet-frontend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    pnpm install
}

# Set environment variables
$env:NEXT_PUBLIC_BACKEND_URL = "http://localhost:3001"
$env:NEXT_PUBLIC_LIVEKIT_URL = "ws://localhost:7880"

Write-Host ""
Write-Host "✅ Starting Next.js development server..." -ForegroundColor Green
Write-Host "🌐 Frontend will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# Start the development server
pnpm dev
