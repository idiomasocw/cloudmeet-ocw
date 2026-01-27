# Quick Start Guide

## Current Issues Fixed ✅

1. ✅ LiveKit API secret updated to 32+ characters
2. ✅ Egress Redis configuration added
3. ✅ Frontend build configuration verified

## Fix and Test Local Development

### Windows (PowerShell)

```powershell
.\fix-local-dev.ps1
```

### Linux/Mac (Bash)

```bash
chmod +x fix-local-dev.sh
./fix-local-dev.sh
```

### Manual Steps

If the scripts don't work, run these commands:

```bash
# 1. Stop everything
docker-compose down

# 2. Rebuild frontend
docker-compose build --no-cache frontend

# 3. Start services
docker-compose up -d postgres redis localstack
sleep 30
docker-compose up -d livekit
sleep 15
docker-compose up -d egress backend
sleep 15
docker-compose up -d frontend

# 4. Check status
docker-compose ps

# 5. View logs
docker-compose logs -f
```

## Access Your Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **LocalStack S3**: http://localhost:4566

## Git Strategy Decision Needed

Please review `GIT_STRATEGY.md` and decide:

### Option A: Monorepo (Simpler)

- One repository for everything
- Easier to manage
- Simpler deployment

### Option B: Submodules (Modular)

- Separate repos for each service
- Independent versioning
- More complex but flexible

## Deployment Strategy Decision Needed

### Option 1: All-in-One Oracle Cloud ⭐ RECOMMENDED

- Deploy everything to your Oracle Cloud server
- Simpler architecture
- Lower latency
- Free tier covers everything

### Option 2: Hybrid (Frontend on AWS Amplify)

- Frontend on AWS Amplify
- Backend on Oracle Cloud
- More complex
- Additional costs

## Next Steps

1. ✅ Fix local development issues (run fix script)
2. ⏳ Test local development (access http://localhost:3000)
3. ⏳ Choose Git strategy (monorepo vs submodules)
4. ⏳ Initialize Git repository
5. ⏳ Push to remote
6. ⏳ Deploy to Oracle Cloud

## Troubleshooting

### Frontend keeps restarting

```bash
# Check logs
docker-compose logs frontend

# Rebuild without cache
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### Egress crashing

```bash
# Check if Redis is running
docker-compose ps redis

# Check egress logs
docker-compose logs egress

# Verify egress.yaml has redis configuration
cat egress.yaml | grep -A 2 redis
```

### LiveKit API key error

```bash
# Verify .env has 32+ character secret
cat .env | grep LIVEKIT_API_SECRET

# Should show: dev-secret-key-at-least-32-chars-long-for-security
```

### Database connection issues

```bash
# Check if postgres is healthy
docker-compose ps postgres

# Check backend logs
docker-compose logs backend

# Verify database is accessible
docker-compose exec postgres psql -U livekit -d livekit_conference -c "SELECT 1;"
```

## Questions?

1. **What's your Oracle Cloud server IP/domain?**
2. **Do you want a custom domain?**
3. **Which Git strategy do you prefer?**
4. **Where do you want to host your Git repos?** (GitHub, GitLab, Bitbucket)
