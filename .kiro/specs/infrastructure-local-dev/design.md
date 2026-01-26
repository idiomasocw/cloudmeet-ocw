# Design Document: Infrastructure & Local Development Setup

## Overview

This design establishes a production-ready infrastructure for a LiveKit-based videoconferencing system that can be developed locally using Docker and deployed to Oracle Cloud Infrastructure (OCI). The architecture prioritizes developer experience through comprehensive local testing capabilities while maintaining production quality through automated deployment and proper security practices.

The system uses a microservices architecture with five core components: Frontend (Next.js), Backend API (Node.js/Express), Media Server (LiveKit + Egress), Database (PostgreSQL), and Cache (Redis). Storage is handled by S3-compatible object storage (Oracle Object Storage in production, LocalStack locally).

A key design principle is environment parity: the local development environment mirrors production as closely as possible, reducing deployment surprises and enabling confident local testing of all features including recording, real-time collaboration, and analytics.

## Architecture

### System Components

```mermaid
graph TB
    subgraph "Local Development (Docker Compose)"
        FE[Frontend<br/>Next.js:3000]
        BE[Backend API<br/>Express:3001]
        LK[LiveKit Server<br/>:7880]
        EG[Egress<br/>Recording]
        PG[(PostgreSQL<br/>:5432)]
        RD[(Redis<br/>:6379)]
        LS[LocalStack<br/>S3:4566]
    end

    subgraph "Production (Oracle Cloud)"
        FE_P[Frontend<br/>Next.js]
        BE_P[Backend API<br/>Express]
        LK_P[LiveKit Server]
        EG_P[Egress]
        PG_P[(PostgreSQL)]
        RD_P[(Redis)]
        OS[Oracle Object<br/>Storage]
        CD[Caddy<br/>SSL/TLS]
    end

    FE --> BE
    BE --> LK
    BE --> PG
    BE --> RD
    BE --> LS
    EG --> LS
    LK --> EG

    FE_P --> CD
    CD --> BE_P
    BE_P --> LK_P
    BE_P --> PG_P
    BE_P --> RD_P
    BE_P --> OS
    EG_P --> OS
    LK_P --> EG_P
```

### Component Responsibilities

**Frontend (Next.js)**

- User interface for video conferencing
- Client-side LiveKit integration
- Real-time UI updates
- Responsive design for desktop and mobile

**Backend API (Node.js/Express)**

- Authentication and authorization
- LiveKit token generation
- Recording management (start, stop, list)
- Meeting metadata and analytics storage
- WebSocket connections for real-time features
- S3-compatible storage operations

**Media Server (LiveKit)**

- Real-time video/audio streaming
- WebRTC connection management
- Participant management
- Track publishing and subscription

**Egress (LiveKit Egress)**

- Recording composition
- Upload to object storage
- Multiple output formats support

**Database (PostgreSQL)**

- Meeting metadata
- Participant information
- Recording references
- Analytics data
- Whiteboard states (future)
- Gamification content (future)

**Cache (Redis)**

- Session management
- Real-time participant tracking
- Rate limiting
- Temporary state storage

**Object Storage (Oracle/LocalStack)**

- Recording file storage
- Static asset storage
- S3-compatible API

### Deployment Environments

**Local Development**

- All services run in Docker containers
- Hot-reloading for code changes
- LocalStack for S3-compatible storage
- HTTP for simplicity
- Accessible at localhost ports

**Production (Oracle Cloud)**

- Oracle Ampere A1 compute instance (ARM64)
- Docker Compose for service orchestration
- Oracle Object Storage for recordings
- Caddy for automatic HTTPS
- Firewall rules for security

## Components and Interfaces

### Docker Compose Configuration

The local development environment uses Docker Compose to orchestrate all services. The configuration includes:

**Services:**

- `postgres`: PostgreSQL 15 with persistent volume
- `redis`: Redis 7 with AOF persistence
- `localstack`: S3-compatible storage for local testing
- `livekit`: LiveKit server with WebRTC ports exposed
- `egress`: LiveKit Egress for recording
- `backend`: Backend API with hot-reloading
- `frontend`: Next.js development server

**Networks:**

- `livekit-network`: Bridge network connecting all services

**Volumes:**

- `postgres-data`: PostgreSQL data persistence
- `redis-data`: Redis data persistence
- `localstack-data`: LocalStack data persistence
- `recordings`: Shared volume for recording files

**Health Checks:**
Each service includes health check configuration to ensure proper startup order and automatic recovery.

### Backend API Interfaces

**Environment Variables:**

```typescript
interface BackendConfig {
  // Server
  PORT: number;
  NODE_ENV: "development" | "production";

  // LiveKit
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_URL: string;

  // Database
  DATABASE_URL: string;

  // Redis
  REDIS_URL: string;

  // Object Storage (S3-compatible)
  S3_ENDPOINT: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_BUCKET: string;
  S3_REGION: string;
  S3_FORCE_PATH_STYLE: boolean; // true for LocalStack
}
```

**API Endpoints:**

- `GET /health` - Health check endpoint
- `POST /token` - Generate LiveKit access token
- `POST /recordings/start` - Start recording
- `POST /recordings/stop` - Stop recording
- `GET /recordings` - List recordings
- `GET /recordings/:id` - Get recording details

### Frontend Configuration

**Environment Variables:**

```typescript
interface FrontendConfig {
  NEXT_PUBLIC_BACKEND_URL: string;
  NEXT_PUBLIC_LIVEKIT_URL: string;
}
```

### PostgreSQL Schema

**Initial Tables:**

```sql
-- Meetings table
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  metadata JSONB
);

-- Participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  identity VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  metadata JSONB
);

-- Recordings table
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  egress_id VARCHAR(255) UNIQUE NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  file_size BIGINT,
  duration INTEGER,
  metadata JSONB
);

-- Analytics table (for future meeting insights)
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_meetings_room_name ON meetings(room_name);
CREATE INDEX idx_participants_meeting_id ON participants(meeting_id);
CREATE INDEX idx_recordings_meeting_id ON recordings(meeting_id);
CREATE INDEX idx_analytics_meeting_id ON analytics(meeting_id);
CREATE INDEX idx_analytics_participant_id ON analytics(participant_id);
```

### Oracle Object Storage Setup

Oracle Object Storage is S3-compatible, allowing us to use the AWS SDK with minimal configuration changes.

**Setup Steps:**

1. **Create Object Storage Bucket:**

   - Navigate to OCI Console → Storage → Buckets
   - Create new bucket (e.g., `livekit-recordings`)
   - Set visibility to Private
   - Enable versioning (optional)

2. **Generate Customer Secret Keys:**

   - Navigate to User Settings → Customer Secret Keys
   - Click "Generate Secret Key"
   - Provide a name (e.g., `livekit-storage-key`)
   - Save the Access Key and Secret Key (shown only once)

3. **Get S3-Compatible Endpoint:**

   - Format: `https://{namespace}.compat.objectstorage.{region}.oraclecloud.com`
   - Find namespace: OCI Console → Tenancy Details
   - Example: `https://mytenancy.compat.objectstorage.us-ashburn-1.oraclecloud.com`

4. **Configure Backend API:**
   ```bash
   S3_ENDPOINT=https://mytenancy.compat.objectstorage.us-ashburn-1.oraclecloud.com
   S3_ACCESS_KEY=<your-access-key>
   S3_SECRET_KEY=<your-secret-key>
   S3_BUCKET=livekit-recordings
   S3_REGION=us-ashburn-1
   S3_FORCE_PATH_STYLE=false
   ```

**Storage Client Implementation:**

```typescript
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});
```

### LiveKit Configuration

**livekit.yaml (generated):**

```yaml
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
```

**egress.yaml:**

```yaml
api_key: ${LIVEKIT_API_KEY}
api_secret: ${LIVEKIT_API_SECRET}
ws_url: ${LIVEKIT_URL}
health_port: 9090
s3:
  endpoint: ${S3_ENDPOINT}
  access_key: ${S3_ACCESS_KEY}
  secret: ${S3_SECRET_KEY}
  region: ${S3_REGION}
  bucket: ${S3_BUCKET}
```

### Deployment Script Architecture

The deployment script automates Oracle Cloud setup:

**Script Phases:**

1. **Prerequisites Check:**

   - Verify OCI CLI installed
   - Verify Docker installed
   - Check required environment variables

2. **Instance Provisioning:**

   - Create Ampere A1 compute instance
   - Configure security lists (firewall rules)
   - Assign public IP

3. **Instance Configuration:**

   - Install Docker and Docker Compose
   - Copy configuration files
   - Set up environment variables
   - Initialize database

4. **Service Deployment:**

   - Pull Docker images (ARM64)
   - Start services via Docker Compose
   - Run database migrations
   - Verify health checks

5. **SSL Configuration:**
   - Configure Caddy for automatic HTTPS
   - Set up domain DNS (if provided)

**Deployment Script Interface:**

```bash
#!/bin/bash
# deploy-oracle.sh

# Usage: ./deploy-oracle.sh [options]
# Options:
#   --instance-name    Name for the compute instance
#   --domain          Domain name for SSL (optional)
#   --ssh-key         Path to SSH public key
#   --compartment-id  OCI compartment ID
```

## Data Models

### Configuration Models

**DockerComposeConfig:**

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: livekit_conference
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  localstack:
    image: localstack/localstack:latest
    environment:
      SERVICES: s3
      DEFAULT_REGION: us-east-1
      DATA_DIR: /tmp/localstack/data
    volumes:
      - localstack-data:/tmp/localstack
      - ./localstack-init.sh:/etc/localstack/init/ready.d/init.sh
    ports:
      - "4566:4566"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml --node-ip ${LIVEKIT_NODE_IP:-127.0.0.1}
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml
    ports:
      - "7880:7880"
      - "7881:7881"
      - "50000-50100:50000-50100/udp"
    environment:
      LIVEKIT_API_KEY: ${LIVEKIT_API_KEY}
      LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET}
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:7880"]
      interval: 10s
      timeout: 5s
      retries: 5

  egress:
    image: livekit/egress:latest
    environment:
      EGRESS_CONFIG_FILE: /etc/egress.yaml
      LIVEKIT_API_KEY: ${LIVEKIT_API_KEY}
      LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET}
      LIVEKIT_URL: ${LIVEKIT_URL}
      S3_ENDPOINT: ${S3_ENDPOINT}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_REGION: ${S3_REGION}
      S3_BUCKET: ${S3_BUCKET}
    volumes:
      - ./egress.yaml:/etc/egress.yaml
    depends_on:
      livekit:
        condition: service_healthy
      localstack:
        condition: service_healthy
    cap_add:
      - SYS_ADMIN

  backend:
    build:
      context: ./livekit-backend-api
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      NODE_ENV: development
      LIVEKIT_API_KEY: ${LIVEKIT_API_KEY}
      LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET}
      LIVEKIT_URL: ${LIVEKIT_URL}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/livekit_conference
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: ${S3_ENDPOINT}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_BUCKET: ${S3_BUCKET}
      S3_REGION: ${S3_REGION}
      S3_FORCE_PATH_STYLE: ${S3_FORCE_PATH_STYLE}
    volumes:
      - ./livekit-backend-api/src:/app/src
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      livekit:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    build:
      context: ./livekit-meet-frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_BACKEND_URL: http://localhost:3001
      NEXT_PUBLIC_LIVEKIT_URL: ws://localhost:7880
    volumes:
      - ./livekit-meet-frontend/app:/app/app
      - ./livekit-meet-frontend/lib:/app/lib
      - ./livekit-meet-frontend/styles:/app/styles
    depends_on:
      backend:
        condition: service_healthy

volumes:
  postgres-data:
  redis-data:
  localstack-data:

networks:
  default:
    name: livekit-network
```

### Environment Configuration Models

**.env.example:**

```bash
# PostgreSQL
POSTGRES_USER=livekit
POSTGRES_PASSWORD=changeme_local_dev_only

# LiveKit
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_NODE_IP=127.0.0.1

# Object Storage (LocalStack for local dev)
S3_ENDPOINT=http://localstack:4566
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
S3_BUCKET=livekit-recordings
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# Production Oracle Object Storage (comment out for local dev)
# S3_ENDPOINT=https://namespace.compat.objectstorage.region.oraclecloud.com
# S3_ACCESS_KEY=<your-access-key>
# S3_SECRET_KEY=<your-secret-key>
# S3_BUCKET=livekit-recordings
# S3_REGION=us-ashburn-1
# S3_FORCE_PATH_STYLE=false
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Core Infrastructure Properties

**Property 1: Service Orchestration**
_For any_ Docker Compose configuration, when `docker-compose up` is executed, all defined services (PostgreSQL, Redis, LiveKit, Backend_API, Frontend, LocalStack) should reach a healthy state within a reasonable timeout period.
**Validates: Requirements 1.1**

**Property 2: Service Accessibility**
_For any_ running system instance, HTTP requests to `http://localhost:3000` should return valid Frontend responses and requests to `http://localhost:3001` should return valid Backend_API responses.
**Validates: Requirements 1.2**

**Property 3: S3 API Compatibility**
_For any_ S3-compatible storage backend (LocalStack or Oracle Object Storage), standard S3 operations (createBucket, putObject, getObject, listObjects, deleteObject) should succeed and return expected results.
**Validates: Requirements 1.3, 3.1, 3.2**

**Property 4: Data Persistence Round-Trip**
_For any_ data written to PostgreSQL, Redis, or LocalStack, stopping and restarting containers should preserve that data (round-trip property).
**Validates: Requirements 1.4**

**Property 5: Service Health Recovery**
_For any_ service that fails its health check, Docker should automatically restart that service and it should eventually return to a healthy state.
**Validates: Requirements 1.7**

**Property 6: Hot-Reload Functionality**
_For any_ code change in Backend_API or Frontend source files, the respective service should detect the change and reload without requiring manual restart.
**Validates: Requirements 1.8**

### Database Properties

**Property 7: Database Connectivity**
_For any_ valid database credentials provided via environment variables, the Backend_API should successfully connect to PostgreSQL at `localhost:5432`.
**Validates: Requirements 2.5**

**Property 8: Automatic Migration Execution**
_For any_ pending database migrations, when the database container starts, all migrations should execute successfully before the application accepts requests.
**Validates: Requirements 2.7**

### Storage Properties

**Property 9: Environment-Based Storage Configuration**
_For any_ set of storage environment variables (endpoint, access key, secret key, bucket, region), the Backend_API should use those values for all storage operations.
**Validates: Requirements 3.5**

**Property 10: Automatic Bucket Creation**
_For any_ LocalStack instance starting up, the required S3 buckets should be automatically created and available for use.
**Validates: Requirements 3.6**

**Property 11: Storage Connectivity Validation**
_For any_ Backend_API startup, the system should attempt to connect to the configured storage backend and log the connection status (success or failure with details).
**Validates: Requirements 3.7**

### Deployment Properties

**Property 12: Multi-Architecture Image Compatibility**
_For any_ Docker image built for the system, it should successfully build and run on both AMD64 and ARM64 architectures.
**Validates: Requirements 4.2, 12.1**

**Property 13: Port Exposure Security**
_For any_ production deployment, only the specified ports (443, 7881, 50000-60000) should be accessible from external networks, while database and Redis ports should be restricted to internal services.
**Validates: Requirements 4.6, 9.6**

**Property 14: Deployment Idempotence**
_For any_ deployment script execution, running the script multiple times on the same instance should result in the same final system state without errors.
**Validates: Requirements 6.4**

**Property 15: Prerequisite Validation**
_For any_ deployment script execution, if required prerequisites (Docker, environment variables, network connectivity) are missing, the script should fail early with clear error messages before making any system changes.
**Validates: Requirements 6.5**

**Property 16: Deployment Error Handling**
_For any_ deployment failure, the deployment script should provide clear error messages indicating what failed and provide rollback instructions.
**Validates: Requirements 6.6**

**Property 17: Health Check Endpoint**
_For any_ running system instance, the `/health` endpoint should return a JSON response containing the status of all critical services (database, Redis, LiveKit, storage).
**Validates: Requirements 6.7, 10.4**

### Configuration Properties

**Property 18: Missing Configuration Detection**
_For any_ required environment variable that is missing, the system should fail to start and provide a clear error message indicating which variable is required and its purpose.
**Validates: Requirements 5.3**

**Property 19: Multi-Environment Support**
_For any_ valid environment configuration (local, staging, production), the system should successfully start and operate with the appropriate settings for that environment.
**Validates: Requirements 5.4**

**Property 20: Configuration Validation**
_For any_ environment switch, the system should validate that all required variables are present and have valid values before starting services.
**Validates: Requirements 5.7**

### LiveKit Properties

**Property 21: LiveKit Startup Validation**
_For any_ LiveKit server startup, the system should validate that API keys are configured correctly and log the connection status.
**Validates: Requirements 7.7**

### Redis Properties

**Property 22: Redis Connectivity**
_For any_ valid Redis URL provided via environment variables, the Backend_API should successfully connect to Redis at the specified host and port.
**Validates: Requirements 8.2**

**Property 23: Redis Session Storage**
_For any_ user session created, the Backend_API should store session data in Redis and be able to retrieve it on subsequent requests.
**Validates: Requirements 8.4**

**Property 24: Redis Graceful Degradation**
_For any_ Redis connection failure, the Backend_API should log appropriate errors and continue operating with degraded functionality rather than crashing.
**Validates: Requirements 8.5**

### Security Properties

**Property 25: HTTPS Enforcement**
_For any_ production deployment, all HTTP requests to web endpoints should be redirected to HTTPS.
**Validates: Requirements 9.2**

**Property 26: CORS Configuration**
_For any_ cross-origin request from the Frontend to the Backend_API, the request should succeed when the origin is whitelisted and fail when it is not.
**Validates: Requirements 9.4**

**Property 27: Rate Limiting**
_For any_ API endpoint with rate limiting enabled, requests exceeding the configured rate limit should receive 429 (Too Many Requests) responses.
**Validates: Requirements 9.5**

### Logging Properties

**Property 28: Service Logging**
_For any_ service running in Docker, all log output should be written to stdout/stderr and be accessible via `docker logs`.
**Validates: Requirements 10.1**

**Property 29: API Request Logging**
_For any_ API request to the Backend_API, the system should log the request with timestamp, HTTP method, endpoint, and response code.
**Validates: Requirements 10.2**

**Property 30: Error Logging**
_For any_ critical service failure, the system should log detailed error information including error type, message, stack trace, and relevant context.
**Validates: Requirements 10.5**

## Error Handling

### Configuration Errors

**Missing Environment Variables:**

- Detect missing required variables at startup
- Fail fast with clear error messages
- List all missing variables in a single error message
- Provide example values or documentation links

**Invalid Configuration Values:**

- Validate configuration values before use
- Provide specific error messages for invalid values
- Suggest correct formats or valid ranges

### Service Startup Errors

**Database Connection Failures:**

- Retry connection with exponential backoff
- Log connection attempts and failures
- Fail after maximum retry attempts with clear error
- Provide troubleshooting steps in error message

**Storage Connection Failures:**

- Validate storage configuration at startup
- Test connectivity with a simple operation
- Log detailed error information
- Continue startup but mark storage as unavailable

**LiveKit Connection Failures:**

- Validate API keys at startup
- Test connectivity to LiveKit server
- Log connection status
- Fail startup if LiveKit is unreachable

### Runtime Errors

**Storage Operation Failures:**

- Retry failed operations with exponential backoff
- Log all retry attempts
- Return appropriate error responses to clients
- Implement circuit breaker for repeated failures

**Database Query Failures:**

- Wrap all queries in try-catch blocks
- Log query errors with context
- Return appropriate HTTP error codes
- Implement connection pool recovery

**Redis Failures:**

- Detect Redis unavailability
- Gracefully degrade functionality
- Log degraded mode operation
- Attempt reconnection in background

### Deployment Errors

**Prerequisite Check Failures:**

- Check for Docker installation
- Verify Docker Compose version
- Validate network connectivity
- Check disk space availability
- Fail with actionable error messages

**Service Health Check Failures:**

- Monitor health check status
- Restart unhealthy services automatically
- Log health check failures
- Alert after repeated failures

**Migration Failures:**

- Detect migration errors
- Rollback failed migrations
- Log detailed migration errors
- Prevent application startup with failed migrations

## Testing Strategy

### Unit Testing

Unit tests will verify specific examples and edge cases for:

**Configuration Loading:**

- Test loading valid .env files
- Test handling missing .env files
- Test environment variable precedence
- Test configuration validation logic

**Storage Client:**

- Test S3 client initialization
- Test bucket creation
- Test object upload/download
- Test error handling for invalid credentials

**Database Client:**

- Test connection establishment
- Test query execution
- Test transaction handling
- Test connection pool management

**Health Check Endpoint:**

- Test health check response format
- Test individual service status checks
- Test overall health determination

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using a PBT library appropriate for Node.js/TypeScript (fast-check). Each test will run a minimum of 100 iterations.

**Test Configuration:**

- Use fast-check for TypeScript/Node.js
- Minimum 100 iterations per property test
- Tag each test with feature name and property number
- Tag format: `Feature: infrastructure-local-dev, Property N: [property text]`

**Property Test Coverage:**

1. **Service Orchestration** (Property 1)

   - Generate various Docker Compose configurations
   - Verify all services start successfully
   - Verify health checks pass

2. **Data Persistence** (Property 4)

   - Generate random data for each storage type
   - Write data, restart services, verify data persists
   - Test with various data types and sizes

3. **S3 API Compatibility** (Property 3)

   - Generate random S3 operations
   - Execute against both LocalStack and Oracle Object Storage
   - Verify operations succeed with both backends

4. **Multi-Architecture Compatibility** (Property 12)

   - Build images for AMD64 and ARM64
   - Verify images run successfully on both architectures
   - Test with various base images

5. **Configuration Validation** (Property 18, 20)

   - Generate various configuration sets (valid and invalid)
   - Verify system detects missing/invalid configuration
   - Verify error messages are clear and actionable

6. **Health Check** (Property 17)

   - Generate various service states (healthy, unhealthy, mixed)
   - Verify health endpoint accurately reports status
   - Verify response format is consistent

7. **Rate Limiting** (Property 27)

   - Generate request patterns exceeding rate limits
   - Verify rate limiting triggers correctly
   - Verify 429 responses are returned

8. **CORS Configuration** (Property 26)

   - Generate requests from various origins
   - Verify whitelisted origins succeed
   - Verify non-whitelisted origins fail

9. **Logging** (Property 28, 29, 30)

   - Generate various API requests and service events
   - Verify all events are logged correctly
   - Verify log format is consistent

10. **Deployment Idempotence** (Property 14)
    - Run deployment script multiple times
    - Verify final state is consistent
    - Verify no errors on subsequent runs

### Integration Testing

Integration tests will verify component interactions:

**Full Stack Integration:**

- Start all services via Docker Compose
- Verify Frontend can communicate with Backend
- Verify Backend can communicate with LiveKit
- Verify Backend can store data in PostgreSQL
- Verify Backend can store files in object storage
- Verify recordings are saved correctly

**Storage Integration:**

- Test Backend uploading files to storage
- Test Egress uploading recordings to storage
- Test Backend listing and retrieving files
- Test with both LocalStack and Oracle Object Storage

**Database Integration:**

- Test Backend writing to PostgreSQL
- Test migrations running automatically
- Test seed data loading
- Test concurrent access

**LiveKit Integration:**

- Test Backend generating tokens
- Test Frontend connecting to LiveKit
- Test recording start/stop
- Test Egress uploading to storage

### End-to-End Testing

E2E tests will verify complete user workflows:

**Local Development Setup:**

1. Clone repository
2. Copy .env.example to .env
3. Run `docker-compose up`
4. Verify all services start
5. Access Frontend at localhost:3000
6. Create a meeting
7. Join meeting
8. Start recording
9. Stop recording
10. Verify recording in storage

**Production Deployment:**

1. Run deployment script
2. Verify instance provisioned
3. Verify services running
4. Verify HTTPS working
5. Verify recordings upload to Oracle Object Storage
6. Verify database persistence across reboots

### Manual Testing Checklist

**Local Development:**

- [ ] Docker Compose starts all services
- [ ] Frontend accessible at localhost:3000
- [ ] Backend accessible at localhost:3001
- [ ] Can create and join meetings
- [ ] Can start and stop recordings
- [ ] Recordings saved to LocalStack
- [ ] Database data persists across restarts
- [ ] Hot-reload works for code changes

**Oracle Cloud Deployment:**

- [ ] Deployment script completes successfully
- [ ] All services running on instance
- [ ] HTTPS working with valid certificate
- [ ] Can access Frontend via public URL
- [ ] Can create and join meetings
- [ ] Recordings upload to Oracle Object Storage
- [ ] Database persists across instance reboots
- [ ] Firewall rules configured correctly

**Oracle Object Storage:**

- [ ] Customer Secret Keys created
- [ ] Bucket created and configured
- [ ] Backend can connect to storage
- [ ] Egress can upload recordings
- [ ] Recordings accessible via signed URLs

### Testing Tools

**Unit Testing:**

- Jest or Vitest for test runner
- Supertest for API testing
- Mock libraries for external dependencies

**Property-Based Testing:**

- fast-check for TypeScript/Node.js
- Custom generators for domain-specific data

**Integration Testing:**

- Docker Compose for service orchestration
- Testcontainers for isolated testing
- Supertest for API integration tests

**E2E Testing:**

- Playwright or Cypress for browser automation
- Docker Compose for full stack testing
- Shell scripts for deployment testing

**Monitoring:**

- Docker logs for service output
- Health check endpoints for service status
- Custom logging for application events
