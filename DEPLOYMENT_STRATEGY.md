# Deployment Strategy

## Overview

This document outlines the recommended deployment strategy for the LiveKit video conference system.

## Deployment Architecture Decision

### ✅ Recommended: All-in-One Oracle Cloud Deployment

Deploy the entire stack (Frontend + Backend + LiveKit + Database) on a single Oracle Cloud Ampere A1 instance.

#### Why This Approach?

1. **Cost Efficiency**
   - Oracle Cloud free tier: 4 OCPUs + 24GB RAM (Ampere A1)
   - More than sufficient for small-to-medium deployments
   - No additional AWS costs

2. **Simplicity**
   - Single server to manage
   - No cross-platform networking
   - Unified logging and monitoring
   - Easier SSL/TLS setup with Caddy

3. **Performance**
   - Lower latency (all services co-located)
   - No cross-region API calls
   - Efficient resource sharing

4. **Maintenance**
   - Single deployment pipeline
   - Unified backup strategy
   - Simpler security configuration

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│           Oracle Cloud Ampere A1 Instance               │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Caddy (HTTPS/SSL)                   │  │
│  │         Port 443 → Frontend & Backend            │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                              │
│         ┌────────────────┴────────────────┐            │
│         ▼                                  ▼            │
│  ┌─────────────┐                   ┌─────────────┐    │
│  │  Frontend   │                   │   Backend   │    │
│  │  (Next.js)  │◄─────────────────►│   (Node.js) │    │
│  │  Port 3000  │                   │  Port 3001  │    │
│  └─────────────┘                   └─────────────┘    │
│                                            │            │
│                    ┌───────────────────────┼───────┐   │
│                    ▼                       ▼       ▼   │
│            ┌──────────────┐      ┌──────────┐  ┌────┐ │
│            │   LiveKit    │      │PostgreSQL│  │Redis│ │
│            │   + Egress   │      │          │  │    │ │
│            │ Ports 7880-1 │      │Port 5432 │  │6379│ │
│            └──────────────┘      └──────────┘  └────┘ │
│                    │                                    │
│                    ▼                                    │
│            ┌──────────────┐                            │
│            │Oracle Object │                            │
│            │   Storage    │                            │
│            │  (Recordings)│                            │
│            └──────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

### Alternative: Hybrid Deployment (Not Recommended)

Frontend on AWS Amplify + Backend on Oracle Cloud

#### Why Not Recommended?

1. **Additional Costs**: AWS Amplify charges for hosting and bandwidth
2. **Complexity**: Managing two platforms, two deployment pipelines
3. **Latency**: Cross-platform API calls add latency
4. **CORS Complexity**: More complex CORS configuration
5. **Unnecessary**: Oracle free tier is powerful enough

#### When to Consider Hybrid?

- You need global CDN distribution for frontend
- You expect very high frontend traffic
- You already have AWS infrastructure
- You need AWS-specific features (Cognito, etc.)

## Git Repository Strategy

### Monorepo Structure (Implemented)

```
livekit-videoconference/
├── .git/                          # Root repository
├── livekit-backend-api/           # Backend (no separate .git)
├── livekit-meet-frontend/         # Frontend (no separate .git)
├── livekit-meet-infrastructure/   # Infrastructure (no separate .git)
├── docker-compose.yml             # Orchestration
├── .env.example                   # Configuration template
└── README.md                      # Documentation
```

### Branch Strategy

```
main (production)
  ├── develop (integration)
  │   ├── feature/user-authentication
  │   ├── feature/recording-ui
  │   └── feature/analytics
  └── hotfix/critical-bug
```

### Workflow

1. **Feature Development**

   ```bash
   git checkout develop
   git checkout -b feature/your-feature
   # Make changes
   git add .
   git commit -m "feat: add your feature"
   git push origin feature/your-feature
   # Create PR to develop
   ```

2. **Testing on Develop**

   ```bash
   # Merge PR to develop
   # Test on staging environment
   ```

3. **Release to Production**
   ```bash
   git checkout main
   git merge develop
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin main --tags
   ```

## Deployment Process

### Initial Setup

1. **Prepare Oracle Cloud Instance**

   ```bash
   # Create Ampere A1 instance (4 OCPUs, 24GB RAM)
   # Configure security lists (ports 22, 80, 443, 7881, 50000-60000)
   # Assign public IP
   ```

2. **Install Docker on Instance**

   ```bash
   ssh ubuntu@your-instance-ip
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker ubuntu
   ```

3. **Setup Oracle Object Storage**
   - Create bucket: `livekit-recordings`
   - Generate Customer Secret Keys
   - Note the S3-compatible endpoint

4. **Clone Repository on Instance**

   ```bash
   git clone https://github.com/your-org/livekit-videoconference.git
   cd livekit-videoconference
   ```

5. **Configure Environment**

   ```bash
   cp .env.example .env
   nano .env
   # Update with production values:
   # - S3_ENDPOINT (Oracle Object Storage)
   # - S3_ACCESS_KEY, S3_SECRET_KEY
   # - LIVEKIT_URL (wss://yourdomain.com)
   # - Strong passwords for POSTGRES_PASSWORD
   ```

6. **Setup SSL with Caddy**

   ```bash
   # Create Caddyfile (see below)
   # Caddy will automatically get Let's Encrypt certificates
   ```

7. **Deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Continuous Deployment

#### Option 1: Manual Deployment

```bash
# On your local machine
git push origin main

# On Oracle Cloud instance
ssh ubuntu@your-instance-ip
cd livekit-videoconference
git pull origin main
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

#### Option 2: GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Oracle Cloud

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Oracle Cloud
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.ORACLE_HOST }}
          username: ubuntu
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd livekit-videoconference
            git pull origin main
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d
```

## Production Configuration Files

### docker-compose.prod.yml

Create a production-specific compose file:

```yaml
version: "3.8"

services:
  caddy:
    image: caddy:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - livekit-network
    restart: unless-stopped

  # ... rest of services (similar to docker-compose.yml)
  # but with production configurations

volumes:
  caddy-data:
  caddy-config:
  # ... other volumes
```

### Caddyfile

```
yourdomain.com {
    # Frontend
    handle /api/* {
        reverse_proxy backend:3001
    }

    handle {
        reverse_proxy frontend:3000
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "no-referrer-when-downgrade"
    }
}

# LiveKit WebSocket
wss.yourdomain.com {
    reverse_proxy livekit:7881
}
```

## Monitoring & Maintenance

### Health Checks

```bash
# Check all services
curl https://yourdomain.com/api/health

# Check individual containers
docker-compose ps
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
```

### Backups

```bash
# Database backup
docker-compose exec postgres pg_dump -U livekit livekit_conference > backup.sql

# Restore
docker-compose exec -T postgres psql -U livekit livekit_conference < backup.sql
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

## Scaling Considerations

### When to Scale Beyond Single Instance?

- **Concurrent users > 100**: Consider load balancing
- **Storage > 500GB**: Separate database instance
- **Global users**: Add regional instances

### Scaling Options

1. **Vertical Scaling**: Upgrade to larger Oracle instance
2. **Horizontal Scaling**: Multiple instances with load balancer
3. **Service Separation**: Dedicated database, Redis, LiveKit instances

## Security Checklist

- [ ] Strong passwords in `.env`
- [ ] Firewall rules configured (only necessary ports open)
- [ ] SSL/TLS enabled (Caddy automatic)
- [ ] Database not exposed to internet
- [ ] Redis not exposed to internet
- [ ] Regular security updates
- [ ] Backup strategy in place
- [ ] Monitoring and alerting configured

## Cost Estimate

### All-in-One Oracle Cloud (Recommended)

- **Compute**: $0/month (free tier: 4 OCPUs, 24GB RAM)
- **Storage**: ~$0.0255/GB/month (first 10GB free)
- **Bandwidth**: First 10TB/month free
- **Total**: ~$0-5/month for small deployments

### Hybrid (AWS Amplify + Oracle)

- **Oracle Compute**: $0/month (free tier)
- **AWS Amplify**: ~$15-50/month (hosting + bandwidth)
- **Total**: ~$15-50/month

**Savings with All-in-One: $15-50/month**
