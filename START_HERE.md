# 🚀 Start Here - Quick Setup Guide

## Current Status

✅ **Backend Services**: Working (Postgres, Redis, LocalStack, LiveKit, Egress, Backend API)  
⚠️ **Frontend**: Needs to run separately due to Docker volume issues on Windows

## Recommended Setup (Hybrid Approach)

Run backend services in Docker + Frontend locally for best development experience.

### Step 1: Start Backend Services

```powershell
# Stop any running containers
docker-compose down

# Start backend services only (without frontend)
docker-compose -f docker-compose.backend-only.yml up -d

# Check status
docker-compose -f docker-compose.backend-only.yml ps
```

### Step 2: Start Frontend Locally

**Option A: Using PowerShell Script (Windows)**

```powershell
.\run-frontend-local.ps1
```

**Option B: Manual Start**

```powershell
cd livekit-meet-frontend
pnpm install  # First time only
pnpm dev
```

### Step 3: Access Your Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Why This Approach?

### Benefits of Running Frontend Locally:

1. ✅ **Faster hot-reload** - Changes reflect instantly
2. ✅ **Better debugging** - Direct access to browser dev tools
3. ✅ **No Docker volume issues** - Avoids Windows path problems
4. ✅ **Native performance** - No virtualization overhead
5. ✅ **Easier development** - Standard Next.js workflow

### Backend in Docker:

1. ✅ **Consistent environment** - Same as production
2. ✅ **Easy setup** - No manual service installation
3. ✅ **Isolated services** - Clean separation
4. ✅ **Production parity** - Test deployment scenarios

## Troubleshooting

### Frontend Won't Start

```powershell
# Clean install
cd livekit-meet-frontend
Remove-Item -Recurse -Force node_modules
Remove-Item -Force pnpm-lock.yaml
pnpm install
pnpm dev
```

### Backend Services Not Running

```powershell
# Check logs
docker-compose -f docker-compose.backend-only.yml logs -f

# Restart specific service
docker-compose -f docker-compose.backend-only.yml restart backend

# Full restart
docker-compose -f docker-compose.backend-only.yml down
docker-compose -f docker-compose.backend-only.yml up -d
```

### Port Already in Use

```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

## Alternative: Full Docker Setup (If You Want to Try)

If you want everything in Docker, we need to fix the volume issue:

```powershell
# Remove frontend from docker-compose.yml volumes section
# Then rebuild
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## Next Steps

Once everything is running:

1. ✅ Test the application at http://localhost:3000
2. ✅ Create a test meeting
3. ✅ Verify backend connectivity
4. ⏳ Set up Git repository
5. ⏳ Deploy to Oracle Cloud

## Quick Commands Reference

```powershell
# Start backend services
docker-compose -f docker-compose.backend-only.yml up -d

# Start frontend
.\run-frontend-local.ps1

# Stop backend services
docker-compose -f docker-compose.backend-only.yml down

# View logs
docker-compose -f docker-compose.backend-only.yml logs -f

# Restart a service
docker-compose -f docker-compose.backend-only.yml restart backend

# Check service health
docker-compose -f docker-compose.backend-only.yml ps
```

## Port Reference

| Service       | Port        | URL                   |
| ------------- | ----------- | --------------------- |
| Frontend      | 3000        | http://localhost:3000 |
| Backend API   | 3001        | http://localhost:3001 |
| LiveKit       | 7880        | ws://localhost:7880   |
| LiveKit TCP   | 7881        | -                     |
| PostgreSQL    | 5432        | localhost:5432        |
| Redis         | 6379        | localhost:6379        |
| LocalStack S3 | 4566        | http://localhost:4566 |
| WebRTC UDP    | 50000-50100 | -                     |

## Need Help?

1. Check logs: `docker-compose -f docker-compose.backend-only.yml logs -f [service-name]`
2. Verify .env file has correct values
3. Ensure all ports are available
4. Check Docker Desktop is running

## What's Working Now?

✅ PostgreSQL - Database ready  
✅ Redis - Cache ready  
✅ LocalStack - S3 storage ready (bucket created)  
✅ LiveKit Server - Media server running  
✅ Egress - Recording service ready  
✅ Backend API - Token server running  
⏳ Frontend - Run separately with script above

Your backend is fully operational! Just start the frontend locally and you're good to go.
