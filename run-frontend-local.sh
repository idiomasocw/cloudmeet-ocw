#!/bin/bash
# Run frontend locally (outside Docker)

echo "🚀 Starting Frontend Locally..."
echo ""

# Check if we're in the right directory
if [ ! -d "livekit-meet-frontend" ]; then
    echo "❌ Error: livekit-meet-frontend directory not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Navigate to frontend directory
cd livekit-meet-frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Set environment variables
export NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
export NEXT_PUBLIC_LIVEKIT_URL="ws://localhost:7880"

echo ""
echo "✅ Starting Next.js development server..."
echo "🌐 Frontend will be available at: http://localhost:3000"
echo ""

# Start the development server
pnpm dev
