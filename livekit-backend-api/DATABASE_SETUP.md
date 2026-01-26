# Database Setup Guide

This guide explains how to set up and manage the PostgreSQL database for the LiveKit backend API.

## Quick Start

### 1. Prerequisites

- PostgreSQL 15 or higher installed and running
- Node.js 18+ and pnpm installed
- Environment variables configured (see `.env.example`)

### 2. Configure Environment

Copy the example environment file and update with your database credentials:

```bash
cp .env.example .env
```

Edit `.env` and ensure `DATABASE_URL` is set:

```
DATABASE_URL=postgresql://livekit:changeme_local_dev_only@localhost:5432/livekit_conference
```

### 3. Create Database

Create the PostgreSQL database (if it doesn't exist):

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE livekit_conference;"

# Or using createdb
createdb -U postgres livekit_conference
```

### 4. Run Migrations

Install dependencies and run migrations:

```bash
pnpm install
pnpm run migrate:up
```

This will create all required tables:

- `meetings` - Meeting metadata
- `participants` - Participant information
- `recordings` - Recording metadata and storage paths
- `analytics` - Event tracking and analytics data

### 5. Seed Development Data (Optional)

Populate the database with sample data for testing:

```bash
pnpm run seed
```

This creates:

- 3 sample meetings (1 ended, 2 active)
- 8 participants across meetings
- 1 completed recording
- Multiple analytics events

## Migration Commands

### Run All Pending Migrations

```bash
pnpm run migrate:up
```

### Rollback Last Migration

```bash
pnpm run migrate:down
```

### Create New Migration

```bash
pnpm run migrate:create <migration-name>
```

Example:

```bash
pnpm run migrate:create add-whiteboard-table
```

This creates a new migration file in the `migrations/` directory.

### Check Migration Status

```bash
pnpm run migrate -- list
```

## Database Schema

### Tables Overview

**meetings**

```sql
- id (uuid, primary key)
- room_name (varchar, unique, indexed)
- created_at (timestamp, indexed)
- ended_at (timestamp, nullable)
- metadata (jsonb)
```

**participants**

```sql
- id (uuid, primary key)
- meeting_id (uuid, foreign key → meetings)
- identity (varchar)
- joined_at (timestamp)
- left_at (timestamp, nullable)
- metadata (jsonb)
```

**recordings**

```sql
- id (uuid, primary key)
- meeting_id (uuid, foreign key → meetings)
- egress_id (varchar, unique, indexed)
- storage_path (varchar)
- status (varchar, indexed)
- started_at (timestamp)
- completed_at (timestamp, nullable)
- file_size (bigint, nullable)
- duration (integer, nullable)
- metadata (jsonb)
```

**analytics**

```sql
- id (uuid, primary key)
- meeting_id (uuid, foreign key → meetings)
- participant_id (uuid, foreign key → participants, nullable)
- event_type (varchar, indexed)
- event_data (jsonb)
- created_at (timestamp)
```

### Indexes

All tables include optimized indexes for common query patterns:

- Primary key lookups (UUID)
- Foreign key relationships
- Time-based queries (`created_at`, `joined_at`)
- Status filtering (`status`, `event_type`)
- Composite indexes for complex queries

## Using the Database Client

### Import the Client

```typescript
import { query, getClient, checkConnection } from "./db/index.js";
```

### Simple Query

```typescript
const result = await query("SELECT * FROM meetings WHERE room_name = $1", [
  "my-room",
]);
console.log(result.rows);
```

### Transaction Example

```typescript
const client = await getClient();
try {
  await client.query("BEGIN");

  const meeting = await client.query(
    "INSERT INTO meetings (room_name) VALUES ($1) RETURNING *",
    ["new-room"]
  );

  await client.query(
    "INSERT INTO participants (meeting_id, identity) VALUES ($1, $2)",
    [meeting.rows[0].id, "user@example.com"]
  );

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

### Check Connection

```typescript
const isConnected = await checkConnection();
if (!isConnected) {
  console.error("Database connection failed");
}
```

## Automatic Migrations on Startup

In production, migrations run automatically when the application starts. This is handled by the `autoMigrate()` function in `src/db/migrate.ts`.

To integrate with your application startup:

```typescript
import { autoMigrate } from "./db/index.js";

async function startServer() {
  // Run migrations first
  await autoMigrate();

  // Then start your server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
```

## Troubleshooting

### Connection Refused

**Problem:** Cannot connect to PostgreSQL

**Solutions:**

1. Verify PostgreSQL is running: `pg_isready`
2. Check `DATABASE_URL` in `.env`
3. Verify PostgreSQL is listening on the correct port
4. Check firewall settings

### Migration Fails

**Problem:** Migration fails with "relation already exists"

**Solutions:**

1. Check which migrations have run: `pnpm run migrate -- list`
2. Manually inspect the `pgmigrations` table
3. If needed, rollback: `pnpm run migrate:down`
4. Re-run: `pnpm run migrate:up`

### Permission Denied

**Problem:** Database user lacks permissions

**Solutions:**

1. Grant necessary privileges:

```sql
GRANT ALL PRIVILEGES ON DATABASE livekit_conference TO livekit;
GRANT ALL ON SCHEMA public TO livekit;
```

### Seed Data Fails

**Problem:** Seed script fails with constraint violations

**Solutions:**

1. Clear existing data first (seed script does this automatically)
2. Ensure migrations have run successfully
3. Check for foreign key constraint issues

## Docker Compose Integration

When using Docker Compose, the database setup is automated:

```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: livekit_conference
    POSTGRES_USER: livekit
    POSTGRES_PASSWORD: changeme_local_dev_only
  volumes:
    - postgres-data:/var/lib/postgresql/data
  ports:
    - "5432:5432"
```

The backend service will automatically run migrations on startup.

## Production Considerations

1. **Backup Strategy:** Implement regular database backups
2. **Connection Pooling:** Configured with max 20 connections
3. **Migration Testing:** Always test migrations in staging first
4. **Monitoring:** Monitor query performance and connection pool usage
5. **Security:** Use strong passwords and restrict network access
6. **SSL/TLS:** Enable SSL for production database connections

## Additional Resources

- [node-pg-migrate Documentation](https://salsita.github.io/node-pg-migrate/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres (pg) Documentation](https://node-postgres.com/)
