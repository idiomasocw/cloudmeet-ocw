/**
 * Initial database schema migration
 * Creates tables for meetings, participants, recordings, and analytics
 * Includes indexes for performance optimization
 */

exports.up = (pgm) => {
  // Enable UUID extension
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  // Meetings table
  pgm.createTable("meetings", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    room_name: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    ended_at: {
      type: "timestamp",
      notNull: false,
    },
    metadata: {
      type: "jsonb",
      notNull: false,
    },
  });

  // Add index on room_name for fast lookups
  pgm.createIndex("meetings", "room_name", {
    name: "idx_meetings_room_name",
  });

  // Add index on created_at for time-based queries
  pgm.createIndex("meetings", "created_at", {
    name: "idx_meetings_created_at",
  });

  // Participants table
  pgm.createTable("participants", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    meeting_id: {
      type: "uuid",
      notNull: true,
      references: "meetings",
      onDelete: "CASCADE",
    },
    identity: {
      type: "varchar(255)",
      notNull: true,
    },
    joined_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    left_at: {
      type: "timestamp",
      notNull: false,
    },
    metadata: {
      type: "jsonb",
      notNull: false,
    },
  });

  // Add index on meeting_id for fast participant lookups
  pgm.createIndex("participants", "meeting_id", {
    name: "idx_participants_meeting_id",
  });

  // Add composite index for active participants
  pgm.createIndex("participants", ["meeting_id", "left_at"], {
    name: "idx_participants_active",
  });

  // Recordings table
  pgm.createTable("recordings", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    meeting_id: {
      type: "uuid",
      notNull: true,
      references: "meetings",
      onDelete: "CASCADE",
    },
    egress_id: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },
    storage_path: {
      type: "varchar(500)",
      notNull: true,
    },
    status: {
      type: "varchar(50)",
      notNull: true,
    },
    started_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    completed_at: {
      type: "timestamp",
      notNull: false,
    },
    file_size: {
      type: "bigint",
      notNull: false,
    },
    duration: {
      type: "integer",
      notNull: false,
    },
    metadata: {
      type: "jsonb",
      notNull: false,
    },
  });

  // Add index on meeting_id for fast recording lookups
  pgm.createIndex("recordings", "meeting_id", {
    name: "idx_recordings_meeting_id",
  });

  // Add index on egress_id for status updates
  pgm.createIndex("recordings", "egress_id", {
    name: "idx_recordings_egress_id",
  });

  // Add index on status for filtering
  pgm.createIndex("recordings", "status", {
    name: "idx_recordings_status",
  });

  // Analytics table
  pgm.createTable("analytics", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    meeting_id: {
      type: "uuid",
      notNull: true,
      references: "meetings",
      onDelete: "CASCADE",
    },
    participant_id: {
      type: "uuid",
      notNull: false,
      references: "participants",
      onDelete: "CASCADE",
    },
    event_type: {
      type: "varchar(100)",
      notNull: true,
    },
    event_data: {
      type: "jsonb",
      notNull: false,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  // Add index on meeting_id for analytics queries
  pgm.createIndex("analytics", "meeting_id", {
    name: "idx_analytics_meeting_id",
  });

  // Add index on participant_id for participant analytics
  pgm.createIndex("analytics", "participant_id", {
    name: "idx_analytics_participant_id",
  });

  // Add index on event_type for filtering by event
  pgm.createIndex("analytics", "event_type", {
    name: "idx_analytics_event_type",
  });

  // Add composite index for time-based analytics queries
  pgm.createIndex("analytics", ["meeting_id", "created_at"], {
    name: "idx_analytics_meeting_time",
  });
};

exports.down = (pgm) => {
  // Drop tables in reverse order (respecting foreign key constraints)
  pgm.dropTable("analytics", { ifExists: true, cascade: true });
  pgm.dropTable("recordings", { ifExists: true, cascade: true });
  pgm.dropTable("participants", { ifExists: true, cascade: true });
  pgm.dropTable("meetings", { ifExists: true, cascade: true });

  // Drop extension
  pgm.dropExtension("pgcrypto", { ifExists: true });
};
