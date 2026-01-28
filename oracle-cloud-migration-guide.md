# Oracle Cloud Migration Guide

## Current vs Oracle Cloud Architecture

### Current (AWS)

- S3 for recordings
- ElastiCache Redis
- ECS Fargate
- RDS PostgreSQL

### Oracle Cloud Target

- Object Storage (S3-compatible)
- Redis on Compute Instance
- Container Instances
- Autonomous Database or PostgreSQL on Compute

## Code Changes Required

### 1. Object Storage (Replace S3)

```typescript
// Current S3 client (livekit-backend-api/src/index.ts)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "test",
    secretAccessKey: process.env.S3_SECRET_KEY || "test",
  },
});

// Oracle Cloud Object Storage (S3-compatible)
const s3Client = new S3Client({
  region: process.env.OCI_REGION || "us-ashburn-1",
  endpoint: `https://${process.env.OCI_NAMESPACE}.compat.objectstorage.${process.env.OCI_REGION}.oraclecloud.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.OCI_ACCESS_KEY,
    secretAccessKey: process.env.OCI_SECRET_KEY,
  },
});
```

### 2. Environment Variables for Oracle Cloud

```bash
# Oracle Cloud specific
OCI_REGION=us-ashburn-1
OCI_NAMESPACE=your-tenancy-namespace
OCI_ACCESS_KEY=your-customer-secret-key
OCI_SECRET_KEY=your-customer-secret-value
OCI_BUCKET=livekit-recordings

# Database (if using Autonomous Database)
DATABASE_URL=postgresql://username:password@hostname:1521/servicename
```

### 3. Docker Deployment on Oracle Cloud

```yaml
# docker-compose.oracle.yml
version: "3.8"
services:
  backend:
    build: ./livekit-backend-api
    ports:
      - "3001:3001"
    environment:
      - OCI_REGION=${OCI_REGION}
      - OCI_NAMESPACE=${OCI_NAMESPACE}
      - OCI_ACCESS_KEY=${OCI_ACCESS_KEY}
      - OCI_SECRET_KEY=${OCI_SECRET_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: livekit_conference
      POSTGRES_USER: livekit
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"

  livekit:
    image: livekit/livekit-server:latest
    ports:
      - "7880:7880"
      - "7881:7881"
      - "50000-50100:50000-50100/udp"
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml

  egress:
    image: livekit/egress:latest
    environment:
      - EGRESS_CONFIG_FILE=/etc/egress.yaml
    volumes:
      - ./egress.yaml:/etc/egress.yaml
    cap_add:
      - SYS_ADMIN
```

## Cost Comparison (Monthly)

### AWS Full Stack

- EC2 t3.medium: ~$30
- ECS Fargate: ~$20-50
- ElastiCache: ~$15
- S3: ~$5
- **Total: ~$70-100/month**

### Oracle Cloud + AWS Amplify

- Compute Instance (2 OCPU): ~$10-15
- Object Storage: ~$2
- AWS Amplify: ~$5
- **Total: ~$17-22/month**

### Savings: ~$50-80/month (70-80% reduction)

## Migration Steps

1. **Set up Oracle Cloud tenancy**
2. **Create Object Storage bucket**
3. **Generate Customer Secret Keys (S3-compatible)**
4. **Deploy compute instance with Docker**
5. **Update environment variables**
6. **Test recording functionality**
7. **Update frontend to point to Oracle Cloud backend**

## Minimal Changes Approach

Your current code is already well-architected for this migration:

- S3Client is already configurable via environment variables
- Docker-based deployment works on Oracle Cloud
- Frontend can easily point to different backend URL

The main changes are:

1. Environment variables (endpoints, credentials)
2. Deployment target (Oracle Cloud vs AWS)
3. Object storage configuration

Your application logic remains the same!
