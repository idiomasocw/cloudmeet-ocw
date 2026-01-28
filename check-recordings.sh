#!/bin/bash
echo "=== Checking Local Recordings ==="
echo "Host recordings directory:"
ls -la recordings/ 2>/dev/null || echo "No recordings directory found on host"

echo ""
echo "=== Checking Egress Container Recordings ==="
docker exec livekit-egress ls -la /recordings/ 2>/dev/null || echo "No recordings directory found in egress container"

echo ""
echo "=== Checking Backend Container Recordings ==="
docker exec livekit-backend ls -la /app/recordings/ 2>/dev/null || echo "No recordings directory found in backend container"

echo ""
echo "=== Recent Egress Logs ==="
docker logs livekit-egress --tail 10