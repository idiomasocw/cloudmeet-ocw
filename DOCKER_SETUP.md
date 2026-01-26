# Docker Compose Local Development Setup

This guide explains how to run the entire LiveKit videoconferencing system locally using Docker Compose.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- At least 4GB of available RAM
- Ports 3000, 3001, 4566, 5432, 6379, 7880, 7881, and 50000-50100 available

## Quick Start

1. **Copy environment variables:**

   ```bash
   cp .env.example .env
   ```

2. **Start all services:**

   ```bash
   docker-compose up -d
   ```

3. **View logs:**

   ```bash
   docker-compose logs -f
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Backend Health Check: http://localhost:3001/health

## Services

The Docker Compose configuration includes the following services:

### Core Services

- **PostgreSQL** (port 5432): Database for meetings, participants, recordings, and analytics
- **Redis** (port 6379): Cache for session management and real-time state
- **LocalStack** (port 4566): S3-compatible storage for local development

### Media Services

- **LiveKit Server** (ports 7880, 7881, 50000-50100): Real-time video/audio streaming
- **LiveKit Egress**: Recording composition and upload to storage

### Application Services

- **Backend API** (port 3001): Node.js/Express server
- **Frontend** (port 3000): Next.js React application

## Data Persistence

The following data is persisted across container restarts using named volumes:

- `livekit-postgres-data`: PostgreSQL database files
- `livekit-redis-data`: Redis data files
- `livekit-localstack-data`: LocalStack S3 data

## Health Checks

All services include health checks to ensure proper startup order:

- PostgreSQL: Checks database readiness
- Redis: Pings Redis server
- LocalStack: Checks LocalStack health endpoint
- LiveKit: Checks LiveKit HTTP endpoint
- Backend: Checks /health endpoint

Services will automatically restart if health checks fail.

## Development Workflow

### Hot Reloading

Both the Backend API and Frontend support hot-reloading:

- **Backend**: Changes to `livekit-backend-api/src/**` are automatically detected
- **Frontend**: Changes to `livekit-meet-frontend/app/**`, `lib/**`, and `styles/**` are automatically detected

### Database Migrations

Database migrations run automatically when the backend starts. To run migrations manually:

```bash
docker-compose exec backend pnpm run migrate
```

### Viewing Logs

View logs for all services:

```bash
docker-compose logs -f
```

View logs for a specific service:

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f livekit
```

### Stopping Services

Stop all services:

```bash
docker-compose down
```

Stop and remove volumes (WARNING: deletes all data):

```bash
docker-compose down -v
```

## Troubleshooting

### Services won't start

1. Check if ports are already in use:

   ```bash
   netstat -an | findstr "3000 3001 5432 6379 7880"
   ```

2. Check Docker logs:

   ```bash
   docker-compose logs
   ```

3. Restart services:
   ```bash
   docker-compose restart
   ```

### Database connection errors

1. Ensure PostgreSQL is healthy:

   ```bash
   docker-compose ps postgres
   ```

2. Check database logs:

   ```bash
   docker-compose logs postgres
   ```

3. Verify DATABASE_URL in .env file

### LocalStack S3 errors

1. Check LocalStack health:

   ```bash
   curl http://localhost:4566/_localstack/health
   ```

2. Verify bucket was created:

   ```bash
   docker-compose exec localstack awslocal s3 ls
   ```

3. Manually create bucket if needed:
   ```bash
   docker-compose exec localstack awslocal s3 mb s3://livekit-recordings
   ```

### Frontend can't connect to backend

1. Verify backend is running:

   ```bash
   curl http://localhost:3001/health
   ```

2. Check NEXT_PUBLIC_BACKEND_URL in .env file

3. Ensure backend service is healthy:
   ```bash
   docker-compose ps backend
   ```

## Configuration

### Environment Variables

All configuration is managed through the `.env` file. Key variables:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`: Database credentials
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: LiveKit authentication
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`: Storage configuration
- `NEXT_PUBLIC_BACKEND_URL`: Frontend → Backend connection
- `NEXT_PUBLIC_LIVEKIT_URL`: Frontend → LiveKit connection

### Switching to Production Storage

To use Oracle Object Storage instead of LocalStack:

1. Create an Oracle Object Storage bucket
2. Generate Customer Secret Keys in OCI Console
3. Update `.env` with production values:
   ```bash
   S3_ENDPOINT=https://namespace.compat.objectstorage.region.oraclecloud.com
   S3_ACCESS_KEY=<your-access-key>
   S3_SECRET_KEY=<your-secret-key>
   S3_BUCKET=livekit-recordings
   S3_REGION=us-ashburn-1
   S3_FORCE_PATH_STYLE=false
   ```
4. Restart services:
   ```bash
   docker-compose restart backend egress
   ```

## Network Architecture

All services communicate through the `livekit-network` bridge network:

```
Frontend (3000) → Backend (3001) → LiveKit (7880)
                                 → PostgreSQL (5432)
                                 → Redis (6379)
                                 → LocalStack (4566)
Egress → LiveKit (7880)
      → LocalStack (4566)
```

## Next Steps

- Review the [Backend API documentation](livekit-backend-api/README.md)
- Review the [Frontend documentation](livekit-meet-frontend/README.md)
- Learn about [database migrations](livekit-backend-api/DATABASE_SETUP.md)
- Explore [production deployment](DEPLOYMENT.md)
