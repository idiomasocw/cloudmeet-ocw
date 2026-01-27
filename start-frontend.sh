#!/bin/bash
# Simple frontend starter for Git Bash

echo "🚀 Starting Frontend..."
echo ""

# Navigate to frontend directory
cd livekit-meet-frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (first time only)..."
    pnpm install
    echo ""
fi

# Set environment variables
export NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
export NEXT_PUBLIC_LIVEKIT_URL="ws://localhost:7880"

echo "✅ Starting Next.js development server..."
echo "🌐 Frontend will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the development server
pnpm dev
