# Database Migrations

This directory contains database migrations managed by `node-pg-migrate`.

## Overview

The migration system uses `node-pg-migrate` to manage PostgreSQL schema changes. Migrations are executed automatically on application startup in production, or can be run manually during development.

## Migration Files

- `1737158400000_initial-schema.js` - Initial database schema with tables for meetings, participants, recordings, and analytics

## Running Migrations

### Prerequisites

Ensure the `DATABASE_URL` environment variable is set:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/livekit_conference"
```

Or add it to your `.env` file:

```
DATABASE_URL=postgresql://livekit:changeme_local_dev_only@localhost:5432/livekit_conference
```

### Commands

**Run all pending migrations:**

```bash
npm run migrate:up
```

**Rollback the last migration:**

```bash
npm run migrate:down
```

**Create a new migration:**

```bash
npm run migrate:create <migration-name>
```

Example:

```bash
npm run migrate:create add-whiteboard-table
```

### Seed Data

To populate the database with sample data for local development:

```bash
npm run seed
```

This will:

- Clear existing data
- Create sample meetings (active and completed)
- Add participants to meetings
- Create recording entries
- Generate analytics events

## Schema Overview

### Tables

**meetings**

- Stores meeting metadata
- Indexed on `room_name` and `created_at`

**participants**

- Tracks participants in meetings
- Foreign key to `meetings` with CASCADE delete
- Indexed on `meeting_id` and composite index on `meeting_id, left_at`

**recordings**

- Stores recording metadata and storage paths
- Foreign key to `meetings` with CASCADE delete
- Indexed on `meeting_id`, `egress_id`, and `status`

**analytics**

- Stores event data for analytics
- Foreign keys to `meetings` and `participants` with CASCADE delete
- Indexed on `meeting_id`, `participant_id`, `event_type`, and composite index on `meeting_id, created_at`

### Indexes

All tables include appropriate indexes for common query patterns:

- Primary key lookups (UUID)
- Foreign key relationships
- Time-based queries
- Status filtering
- Composite indexes for complex queries

## Migration Best Practices

1. **Always test migrations locally first** before deploying to production
2. **Create reversible migrations** - implement both `up` and `down` functions
3. **Use transactions** - migrations run in transactions by default
4. **Add indexes carefully** - consider the impact on write performance
5. **Document breaking changes** - add comments explaining significant schema changes
6. **Keep migrations small** - one logical change per migration
7. **Never modify existing migrations** - create new migrations to fix issues

## Troubleshooting

**Migration fails with "relation already exists":**

- Check if the migration was partially applied
- Review the `pgmigrations` table to see which migrations have run
- Consider rolling back and re-running

**Connection timeout:**

- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check network connectivity

**Permission denied:**

- Ensure the database user has CREATE, ALTER, and DROP privileges
- Check that the database exists

## Automatic Migration on Startup

In production, migrations are automatically executed when the application starts. This ensures the database schema is always up to date. The application will fail to start if migrations fail, preventing the application from running with an incorrect schema.

See `src/db/client.ts` for the migration runner implementation.
