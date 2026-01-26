# Implementation Plan: Infrastructure & Local Development Setup

## Overview

This implementation plan establishes the foundation for local development and Oracle Cloud deployment. The approach prioritizes getting a working local environment first, then adding production deployment capabilities. Each task builds incrementally, ensuring the system remains functional at every step.

## Tasks

- [x] 1. Set up PostgreSQL database schema and migrations

  - Create database migration tooling setup (using node-pg-migrate or similar)
  - Create initial migration with tables: meetings, participants, recordings, analytics
  - Add indexes for performance
  - Create seed data script for local development
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

- [ ]\* 1.1 Write property test for database migrations

  - **Property 8: Automatic Migration Execution**
  - **Validates: Requirements 2.7**

- [x] 2. Create Docker Compose configuration for local development

  - Create docker-compose.yml with all services (PostgreSQL, Redis, LocalStack, LiveKit, Egress)
  - Add named volumes for data persistence
  - Configure health checks for all services
  - Add service dependencies to ensure proper startup order
  - _Requirements: 1.1, 1.4, 1.5, 1.6_

- [ ]\* 2.1 Write property test for service orchestration

  - **Property 1: Service Orchestration**
  - **Validates: Requirements 1.1**

- [ ]\* 2.2 Write property test for data persistence

  - **Property 4: Data Persistence Round-Trip**
  - **Validates: Requirements 1.4**

- [ ]\* 2.3 Write property test for service health recovery

  - **Property 5: Service Health Recovery**
  - **Validates: Requirements 1.7**

- [x] 3. Configure LocalStack for S3-compatible local storage

  - Add LocalStack service to docker-compose.yml
  - Create initialization script to create buckets on startup
  - Configure LocalStack with S3 service enabled
  - _Requirements: 1.3, 3.6_

- [ ]\* 3.1 Write property test for S3 API compatibility

  - **Property 3: S3 API Compatibility**
  - **Validates: Requirements 1.3, 3.1, 3.2**

- [ ]\* 3.2 Write property test for automatic bucket creation

  - **Property 10: Automatic Bucket Creation**
  - **Validates: Requirements 3.6**

- [ ] 4. Update Backend API with environment configuration

  - Create comprehensive .env.example file with all required variables
  - Add environment variable validation on startup
  - Implement fail-fast behavior for missing configuration
  - Add configuration loading utility with clear error messages
  - _Requirements: 5.1, 5.2, 5.3, 5.7_

- [ ]\* 4.1 Write property test for missing configuration detection

  - **Property 18: Missing Configuration Detection**
  - **Validates: Requirements 5.3**

- [ ]\* 4.2 Write property test for configuration validation

  - **Property 20: Configuration Validation**
  - **Validates: Requirements 5.7**

- [ ] 5. Implement PostgreSQL client and connection management

  - Add pg library to Backend API dependencies
  - Create database client with connection pooling
  - Implement automatic migration runner on startup
  - Add database health check
  - _Requirements: 2.5, 2.7_

- [ ]\* 5.1 Write property test for database connectivity

  - **Property 7: Database Connectivity**
  - **Validates: Requirements 2.5**

- [ ] 6. Implement S3-compatible storage client

  - Add AWS SDK S3 client to Backend API
  - Create storage service abstraction supporting both LocalStack and Oracle Object Storage
  - Implement storage connectivity validation on startup
  - Add storage operations: upload, download, list, delete
  - _Requirements: 3.1, 3.2, 3.5, 3.7_

- [ ]\* 6.1 Write property test for environment-based storage configuration

  - **Property 9: Environment-Based Storage Configuration**
  - **Validates: Requirements 3.5**

- [ ]\* 6.2 Write property test for storage connectivity validation

  - **Property 11: Storage Connectivity Validation**
  - **Validates: Requirements 3.7**

- [ ] 7. Implement Redis client and session management

  - Add Redis client to Backend API
  - Configure Redis connection with retry logic
  - Implement session storage using Redis
  - Add graceful degradation when Redis is unavailable
  - _Requirements: 8.2, 8.4, 8.5_

- [ ]\* 7.1 Write property test for Redis connectivity

  - **Property 22: Redis Connectivity**
  - **Validates: Requirements 8.2**

- [ ]\* 7.2 Write property test for Redis session storage

  - **Property 23: Redis Session Storage**
  - **Validates: Requirements 8.4**

- [ ]\* 7.3 Write property test for Redis graceful degradation

  - **Property 24: Redis Graceful Degradation**
  - **Validates: Requirements 8.5**

- [ ] 8. Add Backend API health check endpoint

  - Create /health endpoint that checks all services
  - Return JSON with status of database, Redis, LiveKit, and storage
  - Include version information and uptime
  - _Requirements: 6.7, 10.4_

- [ ]\* 8.1 Write property test for health check endpoint

  - **Property 17: Health Check Endpoint**
  - **Validates: Requirements 6.7, 10.4**

- [ ] 9. Configure LiveKit and Egress services

  - Create livekit.yaml configuration template
  - Create egress.yaml configuration template
  - Add LiveKit and Egress services to docker-compose.yml
  - Configure Egress to upload to LocalStack
  - _Requirements: 7.1, 7.2, 7.5, 7.6_

- [ ]\* 9.1 Write property test for LiveKit startup validation

  - **Property 21: LiveKit Startup Validation**
  - **Validates: Requirements 7.7**

- [ ] 10. Add Backend API Dockerfile with ARM64 support

  - Update Dockerfile to support multi-architecture builds
  - Use ARM64-compatible base images
  - Add build arguments for architecture detection
  - Test build on both AMD64 and ARM64
  - _Requirements: 4.2, 12.1, 12.2, 12.4_

- [ ]\* 10.1 Write property test for multi-architecture compatibility

  - **Property 12: Multi-Architecture Image Compatibility**
  - **Validates: Requirements 4.2, 12.1**

- [ ] 11. Add Frontend Dockerfile for development

  - Create Dockerfile.dev for hot-reloading
  - Configure volume mounts for source code
  - Add Frontend service to docker-compose.yml
  - Update Frontend .env.example with required variables
  - _Requirements: 1.8, 12.3_

- [ ]\* 11.1 Write property test for hot-reload functionality

  - **Property 6: Hot-Reload Functionality**
  - **Validates: Requirements 1.8**

- [ ] 12. Implement comprehensive logging

  - Configure all services to log to stdout/stderr
  - Add request logging middleware to Backend API
  - Implement structured logging with timestamps
  - Add error logging with stack traces
  - Configure Docker Compose log drivers
  - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6_

- [ ]\* 12.1 Write property test for service logging

  - **Property 28: Service Logging**
  - **Validates: Requirements 10.1**

- [ ]\* 12.2 Write property test for API request logging

  - **Property 29: API Request Logging**
  - **Validates: Requirements 10.2**

- [ ]\* 12.3 Write property test for error logging

  - **Property 30: Error Logging**
  - **Validates: Requirements 10.5**

- [ ] 13. Add CORS and security middleware

  - Configure CORS to allow Frontend access to Backend
  - Implement rate limiting middleware
  - Add security headers
  - _Requirements: 9.4, 9.5_

- [ ]\* 13.1 Write property test for CORS configuration

  - **Property 26: CORS Configuration**
  - **Validates: Requirements 9.4**

- [ ]\* 13.2 Write property test for rate limiting

  - **Property 27: Rate Limiting**
  - **Validates: Requirements 9.5**

- [ ] 14. Checkpoint - Verify local development environment

  - Ensure all tests pass
  - Verify docker-compose up starts all services
  - Verify Frontend accessible at localhost:3000
  - Verify Backend accessible at localhost:3001
  - Verify health check endpoint returns correct status
  - Ask the user if questions arise

- [ ] 15. Create Oracle Object Storage setup documentation

  - Document how to create Customer Secret Keys in OCI Console
  - Document how to create Object Storage bucket
  - Document how to find S3-compatible endpoint
  - Provide example configuration for production
  - _Requirements: 3.3, 3.4, 11.2, 11.3_

- [ ] 16. Create Oracle Cloud deployment script

  - Create deploy-oracle.sh script
  - Add prerequisite checks (OCI CLI, Docker, environment variables)
  - Implement instance provisioning logic
  - Add service configuration and startup
  - Implement health check verification
  - _Requirements: 4.3, 6.1, 6.2, 6.3_

- [ ]\* 16.1 Write property test for deployment idempotence

  - **Property 14: Deployment Idempotence**
  - **Validates: Requirements 6.4**

- [ ]\* 16.2 Write property test for prerequisite validation

  - **Property 15: Prerequisite Validation**
  - **Validates: Requirements 6.5**

- [ ]\* 16.3 Write property test for deployment error handling

  - **Property 16: Deployment Error Handling**
  - **Validates: Requirements 6.6**

- [ ] 17. Add SSL/TLS configuration for production

  - Create Caddyfile for automatic HTTPS
  - Add Caddy service to production docker-compose
  - Configure Caddy to proxy to Backend and Frontend
  - Add HTTPS enforcement
  - _Requirements: 4.5, 9.2, 9.3_

- [ ]\* 17.1 Write property test for HTTPS enforcement

  - **Property 25: HTTPS Enforcement**
  - **Validates: Requirements 9.2**

- [ ] 18. Configure production firewall and security

  - Add firewall rules to deployment script
  - Restrict database and Redis to internal access only
  - Open only necessary ports (443, 7881, 50000-60000)
  - Configure secure WebSocket connections
  - _Requirements: 4.6, 4.7, 9.6, 9.7_

- [ ]\* 18.1 Write property test for port exposure security

  - **Property 13: Port Exposure Security**
  - **Validates: Requirements 4.6, 9.6**

- [ ] 19. Add automatic service restart configuration

  - Configure Docker restart policies
  - Add systemd service for Docker Compose (if needed)
  - Ensure services restart on instance reboot
  - _Requirements: 6.8_

- [ ] 20. Create comprehensive README documentation

  - Write quick start guide for local development
  - Document all prerequisites
  - Provide step-by-step setup instructions
  - Add troubleshooting section
  - Document architecture and component interactions
  - Include production deployment instructions
  - _Requirements: 11.1, 11.4, 11.5, 11.6, 11.7, 11.8_

- [ ] 21. Create production deployment guide

  - Document Oracle Cloud account setup
  - Provide detailed Oracle Object Storage setup steps
  - Document deployment script usage
  - Add post-deployment verification steps
  - Include monitoring and maintenance instructions
  - _Requirements: 11.2, 11.3, 11.6_

- [ ] 22. Final checkpoint - End-to-end verification
  - Run full test suite (unit, property, integration)
  - Verify local development workflow
  - Test deployment script on clean Oracle Cloud instance
  - Verify production deployment works end-to-end
  - Verify recordings upload to Oracle Object Storage
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation prioritizes local development first, then production deployment
- All Docker images must support ARM64 for Oracle Ampere A1 compatibility
