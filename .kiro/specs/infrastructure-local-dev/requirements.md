# Requirements Document

## Introduction

This specification defines the infrastructure and local development setup for a LiveKit-based videoconferencing system. The system must support deployment on Oracle Cloud Infrastructure (OCI) using Oracle Ampere A1 compute instances while maintaining full local development capabilities using Docker. The infrastructure must be production-ready, cost-optimized, and support both S3-compatible object storage (Oracle Object Storage in production, LocalStack for local development) and PostgreSQL for persistent data storage.

## Glossary

- **System**: The complete LiveKit videoconferencing infrastructure including frontend, backend API, media server, database, and storage components
- **Local_Environment**: Docker-based development environment running on developer workstation
- **Production_Environment**: Oracle Cloud Infrastructure deployment using Ampere A1 instances
- **Object_Storage**: S3-compatible storage service (Oracle Object Storage in production, LocalStack in local development)
- **Backend_API**: Node.js/TypeScript Express server handling authentication, recording, and business logic
- **Frontend**: Next.js React application providing the user interface
- **Media_Server**: LiveKit server and Egress services handling real-time video/audio
- **Database**: PostgreSQL database storing meeting metadata, analytics, and application data
- **Cache**: Redis instance for session management and real-time state
- **Docker_Compose**: Orchestration tool for managing multi-container local development environment
- **OCI**: Oracle Cloud Infrastructure
- **Ampere_A1**: ARM-based compute instance available in Oracle Cloud free tier
- **Customer_Secret_Key**: Oracle Cloud credential pair (Access Key + Secret Key) for S3-compatible API access
- **Deployment_Script**: Automated script for provisioning and configuring production infrastructure

## Requirements

### Requirement 1: Local Development Environment

**User Story:** As a developer, I want to run the entire system locally using Docker, so that I can develop and test features without requiring cloud resources.

#### Acceptance Criteria

1. WHEN a developer runs `docker-compose up`, THE System SHALL start all required services (PostgreSQL, Redis, LiveKit, Backend_API, Frontend, LocalStack)
2. WHEN all services are running, THE System SHALL be accessible at `http://localhost:3000` for the Frontend and `http://localhost:3001` for the Backend_API
3. WHEN LocalStack is running, THE System SHALL provide S3-compatible object storage at `http://localhost:4566`
4. WHEN the developer stops the containers, THE System SHALL persist database data and configuration across restarts
5. THE Docker_Compose configuration SHALL use named volumes for PostgreSQL data, Redis data, and LocalStack data
6. THE Docker_Compose configuration SHALL include health checks for all critical services
7. WHEN a service fails its health check, THE System SHALL restart that service automatically
8. THE Local_Environment SHALL support hot-reloading for Backend_API and Frontend code changes

### Requirement 2: PostgreSQL Database Setup

**User Story:** As a developer, I want PostgreSQL configured with proper schemas and migrations, so that the application has a reliable data persistence layer.

#### Acceptance Criteria

1. THE System SHALL use PostgreSQL version 18.1 or higher stable version
2. WHEN the database initializes, THE System SHALL create a database named `livekit_conference`
3. THE System SHALL include database migration tooling for schema version management
4. THE Database SHALL include tables for meetings, participants, recordings, analytics, and whiteboard states
5. WHEN running locally, THE Database SHALL be accessible at `localhost:5432` with credentials defined in environment variables
6. THE System SHALL include seed data scripts for local development testing
7. WHEN the database container starts, THE System SHALL automatically run pending migrations

### Requirement 3: Oracle Object Storage Integration

**User Story:** As a system administrator, I want clear instructions for setting up Oracle Object Storage, so that I can configure production storage without prior Oracle Cloud experience.

#### Acceptance Criteria

1. THE System SHALL support S3-compatible API for object storage operations
2. THE System SHALL work with both Oracle Object Storage (production) and LocalStack (local development)
3. WHEN configuring Oracle Object Storage, THE Documentation SHALL provide step-by-step instructions for creating Customer_Secret_Key credentials
4. WHEN configuring Oracle Object Storage, THE Documentation SHALL explain how to create and configure an Object Storage bucket
5. THE System SHALL use environment variables for storage endpoint, access key, secret key, bucket name, and region
6. WHEN using LocalStack, THE System SHALL automatically create required buckets on startup
7. THE Backend_API SHALL validate storage connectivity on startup and log connection status

### Requirement 4: Oracle Cloud Deployment Architecture

**User Story:** As a system administrator, I want a deployment architecture optimized for Oracle Cloud Ampere A1 instances, so that I can leverage the free tier while maintaining production quality.

#### Acceptance Criteria

1. THE Production_Environment SHALL run on Oracle Ampere A1 compute instances (ARM64 architecture)
2. THE System SHALL provide Docker images compatible with ARM64 architecture
3. THE Deployment_Script SHALL provision and configure an Ampere A1 instance with all required services
4. THE Production_Environment SHALL use Oracle Object Storage for recording storage
5. THE Production_Environment SHALL include SSL/TLS termination using Caddy or Nginx
6. THE System SHALL expose only necessary ports (443 for HTTPS, 7881 for LiveKit, 50000-60000 for WebRTC)
7. WHEN deploying to production, THE Deployment_Script SHALL configure firewall rules and security lists
8. THE Production_Environment SHALL use managed PostgreSQL (Oracle Autonomous Database) or containerized PostgreSQL with persistent volumes

### Requirement 5: Environment Configuration Management

**User Story:** As a developer, I want environment-specific configuration files, so that I can easily switch between local and production environments.

#### Acceptance Criteria

1. THE System SHALL use `.env` files for environment-specific configuration
2. THE System SHALL provide `.env.example` templates for all components (Backend_API, Frontend, Docker_Compose)
3. WHEN environment variables are missing, THE System SHALL fail fast with clear error messages indicating which variables are required
4. THE System SHALL support separate configuration for local development, staging, and production environments
5. THE System SHALL never commit sensitive credentials to version control
6. THE Documentation SHALL list all required environment variables with descriptions and example values
7. WHEN switching environments, THE System SHALL validate that all required variables are present before starting services

### Requirement 6: Deployment Automation

**User Story:** As a system administrator, I want automated deployment scripts, so that I can provision production infrastructure consistently and reliably.

#### Acceptance Criteria

1. THE System SHALL provide a deployment script for Oracle Cloud Infrastructure
2. WHEN the Deployment_Script runs, THE System SHALL install Docker and Docker Compose on the target instance
3. WHEN the Deployment_Script runs, THE System SHALL configure and start all required services
4. THE Deployment_Script SHALL support idempotent execution (safe to run multiple times)
5. THE Deployment_Script SHALL validate prerequisites before attempting deployment
6. WHEN deployment fails, THE Deployment_Script SHALL provide clear error messages and rollback instructions
7. THE System SHALL include a health check endpoint that reports the status of all services
8. THE Deployment_Script SHALL configure automatic service restart on instance reboot

### Requirement 7: LiveKit Server Configuration

**User Story:** As a system administrator, I want LiveKit server properly configured for both local and production environments, so that video conferencing works reliably.

#### Acceptance Criteria

1. THE System SHALL use LiveKit server version 1.5.0 or higher
2. THE System SHALL configure LiveKit with API keys stored in environment variables
3. WHEN running locally, THE Media_Server SHALL use localhost for WebRTC connections
4. WHEN running in production, THE Media_Server SHALL use the public IP or domain name for WebRTC connections
5. THE System SHALL enable LiveKit Egress for recording functionality
6. THE System SHALL configure Egress to upload recordings to Object_Storage
7. WHEN LiveKit starts, THE System SHALL validate API key configuration and log connection status

### Requirement 8: Redis Cache Configuration

**User Story:** As a developer, I want Redis configured for session management, so that the application can handle real-time state efficiently.

#### Acceptance Criteria

1. THE System SHALL use Redis version 7.0 or higher
2. WHEN running locally, THE Cache SHALL be accessible at `localhost:6379`
3. THE System SHALL configure Redis with persistence enabled (AOF or RDB)
4. THE Backend_API SHALL use Redis for session storage and real-time participant tracking
5. WHEN Redis is unavailable, THE Backend_API SHALL log errors and gracefully degrade functionality
6. THE System SHALL configure Redis with appropriate memory limits for the deployment environment

### Requirement 9: Network and Security Configuration

**User Story:** As a system administrator, I want proper network and security configuration, so that the system is secure in production while remaining accessible for development.

#### Acceptance Criteria

1. WHEN running locally, THE System SHALL use HTTP for simplicity
2. WHEN running in production, THE System SHALL enforce HTTPS for all web traffic
3. THE Production_Environment SHALL use Caddy or Nginx for automatic SSL certificate management
4. THE System SHALL configure CORS policies to allow Frontend access to Backend_API
5. THE System SHALL implement rate limiting on API endpoints to prevent abuse
6. WHEN running in production, THE System SHALL configure firewall rules to restrict database and Redis access to internal services only
7. THE System SHALL use secure WebSocket connections (WSS) for LiveKit in production

### Requirement 10: Monitoring and Logging

**User Story:** As a system administrator, I want centralized logging and monitoring, so that I can troubleshoot issues and monitor system health.

#### Acceptance Criteria

1. THE System SHALL log all service output to stdout/stderr for Docker log collection
2. THE Backend_API SHALL log all API requests with timestamps, endpoints, and response codes
3. THE System SHALL include log rotation configuration to prevent disk space exhaustion
4. THE System SHALL provide a health check endpoint at `/health` that returns service status
5. WHEN a critical service fails, THE System SHALL log detailed error information
6. THE System SHALL include Docker Compose logging configuration with appropriate log drivers
7. THE Documentation SHALL explain how to access and analyze logs for each service

### Requirement 11: Documentation and Setup Instructions

**User Story:** As a new developer or administrator, I want comprehensive setup documentation, so that I can get the system running without prior knowledge.

#### Acceptance Criteria

1. THE System SHALL include a `README.md` with quick start instructions for local development
2. THE Documentation SHALL include step-by-step Oracle Cloud setup instructions with screenshots or detailed descriptions
3. THE Documentation SHALL explain how to obtain and configure Oracle Object Storage Customer_Secret_Key credentials
4. THE Documentation SHALL include troubleshooting guides for common setup issues
5. THE Documentation SHALL explain the architecture and how components interact
6. THE Documentation SHALL include instructions for both local development and production deployment
7. THE Documentation SHALL list all prerequisites (Docker, Docker Compose, Node.js versions, etc.)
8. THE Documentation SHALL include instructions for database migrations and seeding test data

### Requirement 12: ARM64 Architecture Support

**User Story:** As a system administrator, I want all Docker images to support ARM64 architecture, so that the system runs efficiently on Oracle Ampere A1 instances.

#### Acceptance Criteria

1. THE System SHALL build multi-architecture Docker images (AMD64 and ARM64)
2. THE Backend_API Dockerfile SHALL use ARM64-compatible base images
3. THE Frontend Dockerfile SHALL use ARM64-compatible base images
4. WHEN building images, THE System SHALL detect the target architecture and use appropriate base images
5. THE System SHALL test all images on ARM64 architecture before production deployment
6. THE Documentation SHALL explain any architecture-specific considerations or limitations
