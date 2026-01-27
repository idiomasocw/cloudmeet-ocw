#!/bin/bash
# Fix script for local development issues

echo "🔧 Fixing LiveKit Video Conference Local Development Issues..."
echo ""

# Stop all containers
echo "1. Stopping all containers..."
docker-compose down

# Remove frontend container and volumes to force rebuild
echo "2. Removing frontend container and volumes..."
docker rm -f livekit-frontend 2>/dev/null || true
docker volume rm livekit-videoconference_frontend-node-modules 2>/dev/null || true

# Rebuild frontend without cache
echo "3. Rebuilding frontend image..."
docker-compose build --no-cache frontend

# Start services in order
echo "4. Starting infrastructure services..."
docker-compose up -d postgres redis localstack

echo "5. Waiting for infrastructure to be ready (30 seconds)..."
sleep 30

echo "6. Starting LiveKit server..."
docker-compose up -d livekit

echo "7. Waiting for LiveKit to be ready (15 seconds)..."
sleep 15

echo "8. Starting Egress service..."
docker-compose up -d egress

echo "9. Starting Backend API..."
docker-compose up -d backend

echo "10. Waiting for Backend to be ready (15 seconds)..."
sleep 15

echo "11. Starting Frontend..."
docker-compose up -d frontend

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Checking service status..."
docker-compose ps

echo ""
echo "🌐 Access URLs:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo "  Health:    http://localhost:3001/health"
echo ""
echo "📝 To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "🛑 To stop all services:"
echo "  docker-compose down"
echo ""
