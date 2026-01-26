# LiveKit Video Conference System

A production-ready video conferencing system built with LiveKit, deployed on Oracle Cloud Infrastructure with local development support.

## 🏗️ Architecture

This monorepo contains:

- **livekit-backend-api**: Node.js/Express backend API
- **livekit-meet-frontend**: Next.js frontend application
- **livekit-meet-infrastructure**: AWS CDK infrastructure code (Oracle Cloud deployment)
- **Docker Compose**: Local development orchestration

## 🚀 Quick Start (Local Development)

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development without Docker)
- Git

### Setup

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd livekit-videoconference
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration (defaults work for local dev)
   ```

3. **Start all services**

   ```bash
   docker-compose up
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Backend Health: http://localhost:3001/health

### Services

The Docker Compose setup includes:

- **PostgreSQL** (port 5432): Database for meetings, participants, recordings
- **Redis** (port 6379): Session management and caching
- **LocalStack** (port 4566): S3-compatible storage for local development
- **LiveKit Server** (ports 7880, 7881): Media server for video/audio
- **LiveKit Egress**: Recording service
- **Backend API** (port 3001): REST API and business logic
- **Frontend** (port 3000): User interface

## 📦 Project Structure

```
.
├── livekit-backend-api/          # Backend API service
│   ├── src/                      # Source code
│   ├── migrations/               # Database migrations
│   ├── Dockerfile               # Production Docker image
│   └── package.json
├── livekit-meet-frontend/        # Frontend application
│   ├── app/                      # Next.js app directory
│   ├── lib/                      # Shared utilities
│   ├── Dockerfile.dev           # Development Docker image
│   └── package.json
├── livekit-meet-infrastructure/  # Infrastructure as Code
│   ├── lib/                      # CDK stack definitions
│   └── assets/                   # Configuration templates
├── .kiro/                        # Kiro AI specs and documentation
│   └── specs/                    # Feature specifications
├── docker-compose.yml            # Local development orchestration
├── .env.example                  # Environment variable template
├── livekit.yaml                  # LiveKit server configuration
├── egress.yaml                   # Egress service configuration
└── localstack-init.sh           # LocalStack initialization script
```

## 🔧 Development

### Backend Development

```bash
cd livekit-backend-api
pnpm install
pnpm run dev
```

### Frontend Development

```bash
cd livekit-meet-frontend
pnpm install
pnpm run dev
```

### Database Migrations

```bash
cd livekit-backend-api
pnpm run migrate up
```

### Running Tests

```bash
# Backend tests
cd livekit-backend-api
pnpm test

# Frontend tests
cd livekit-meet-frontend
pnpm test
```

## 🌐 Deployment

### Oracle Cloud Deployment

The system is designed to run on Oracle Cloud's free tier using Ampere A1 (ARM64) instances.

#### Prerequisites

- Oracle Cloud account
- OCI CLI configured
- Docker images built for ARM64

#### Deployment Options

**Option A: All-in-One Oracle Cloud (Recommended)**
Deploy everything (frontend + backend + LiveKit) on a single Oracle Cloud instance:

- Cost: Free tier eligible (Ampere A1)
- Simplicity: Single server to manage
- Performance: 4 OCPUs, 24GB RAM available on free tier
- SSL: Automatic via Caddy

**Option B: Hybrid (Frontend on AWS Amplify)**

- Frontend: AWS Amplify (separate deployment)
- Backend + LiveKit: Oracle Cloud
- Complexity: Higher (two platforms)
- Cost: AWS Amplify costs + Oracle free tier

**Recommendation**: Use Option A (All-in-One) because:

1. Oracle's free tier is powerful enough (4 OCPUs, 24GB RAM)
2. Simpler deployment and maintenance
3. Lower latency (everything in one location)
4. No cross-platform networking complexity
5. Automatic HTTPS with Caddy

#### Deploy to Oracle Cloud

```bash
# Build ARM64 images (if not using CI/CD)
docker buildx build --platform linux/arm64 -t your-registry/backend:latest ./livekit-backend-api
docker buildx build --platform linux/arm64 -t your-registry/frontend:latest ./livekit-meet-frontend

# Run deployment script
./deploy.sh --instance-name livekit-prod --domain yourdomain.com
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 📝 Environment Variables

Key environment variables (see `.env.example` for complete list):

### Required for Local Development

- `LIVEKIT_API_KEY`: LiveKit API key (default: devkey)
- `LIVEKIT_API_SECRET`: LiveKit API secret (default: secret)
- `POSTGRES_USER`: Database user (default: livekit)
- `POSTGRES_PASSWORD`: Database password

### Required for Production

- `S3_ENDPOINT`: Oracle Object Storage endpoint
- `S3_ACCESS_KEY`: Oracle Customer Secret Key (access key)
- `S3_SECRET_KEY`: Oracle Customer Secret Key (secret)
- `S3_BUCKET`: Object storage bucket name
- `LIVEKIT_URL`: Public LiveKit WebSocket URL

## 🔒 Security

- All secrets should be stored in `.env` (never commit to Git)
- Production uses HTTPS with automatic SSL certificates
- Database and Redis are internal-only in production
- Rate limiting enabled on API endpoints
- CORS configured for frontend access only

## 📊 Monitoring

- Health check endpoint: `GET /health`
- Docker logs: `docker-compose logs -f [service-name]`
- LiveKit dashboard: Available on port 7880

## 🐛 Troubleshooting

### Services won't start

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]
```

### Database connection issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U livekit -d livekit_conference
```

### LocalStack S3 issues

```bash
# Check bucket exists
docker-compose exec localstack awslocal s3 ls

# Recreate bucket
docker-compose exec localstack awslocal s3 mb s3://livekit-recordings
```

## 📚 Documentation

- [Docker Setup Guide](./DOCKER_SETUP.md)
- [Database Setup](./livekit-backend-api/DATABASE_SETUP.md)
- [Migration Guide](./livekit-backend-api/MIGRATION_SETUP_SUMMARY.md)
- [Frontend Recording Guide](./FRONTEND_RECORDING_GUIDE.md)
- [Infrastructure Specs](./.kiro/specs/infrastructure-local-dev/)

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test locally with `docker-compose up`
4. Submit a pull request

## 📄 License

[Your License Here]

## 🆘 Support

For issues and questions:

- Create an issue in this repository
- Check existing documentation in `.kiro/specs/`
- Review troubleshooting section above
