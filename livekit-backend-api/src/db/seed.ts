/**
 * Database seed script for local development
 * Populates the database with sample data for testing
 */

import dotenv from "dotenv";
import { pool, query, checkConnection, closePool } from "./client.js";

// Load environment variables
dotenv.config();

interface Meeting {
  id: string;
  room_name: string;
  created_at: Date;
  ended_at: Date | null;
  metadata: any;
}

interface Participant {
  id: string;
  meeting_id: string;
  identity: string;
  joined_at: Date;
  left_at: Date | null;
  metadata: any;
}

interface Recording {
  id: string;
  meeting_id: string;
  egress_id: string;
  storage_path: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  file_size: number | null;
  duration: number | null;
  metadata: any;
}

async function seedDatabase() {
  console.log("Starting database seed...");

  try {
    // Check database connection
    const connected = await checkConnection();
    if (!connected) {
      throw new Error("Failed to connect to database");
    }

    // Clear existing data (in reverse order of dependencies)
    console.log("Clearing existing data...");
    await query("DELETE FROM analytics");
    await query("DELETE FROM recordings");
    await query("DELETE FROM participants");
    await query("DELETE FROM meetings");

    // Seed meetings
    console.log("Seeding meetings...");
    const meetingsResult = await query<Meeting>(
      `INSERT INTO meetings (room_name, created_at, ended_at, metadata)
       VALUES 
         ($1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', $2),
         ($3, NOW() - INTERVAL '1 hour', NULL, $4),
         ($5, NOW() - INTERVAL '30 minutes', NULL, $6)
       RETURNING *`,
      [
        "daily-standup-2024-01-17",
        JSON.stringify({ topic: "Daily Standup", team: "Engineering" }),
        "product-review-session",
        JSON.stringify({ topic: "Product Review", team: "Product" }),
        "customer-demo",
        JSON.stringify({ topic: "Customer Demo", customer: "Acme Corp" }),
      ]
    );

    const meetings = meetingsResult.rows;
    console.log(`Created ${meetings.length} meetings`);

    // Seed participants for first meeting (ended)
    console.log("Seeding participants...");
    const participants1Result = await query<Participant>(
      `INSERT INTO participants (meeting_id, identity, joined_at, left_at, metadata)
       VALUES 
         ($1, $2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', $3),
         ($1, $4, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', $5),
         ($1, $6, NOW() - INTERVAL '115 minutes', NOW() - INTERVAL '1 hour', $7)
       RETURNING *`,
      [
        meetings[0].id,
        "alice@example.com",
        JSON.stringify({ name: "Alice Johnson", role: "Engineer" }),
        "bob@example.com",
        JSON.stringify({ name: "Bob Smith", role: "Engineer" }),
        "charlie@example.com",
        JSON.stringify({ name: "Charlie Brown", role: "Manager" }),
      ]
    );

    // Seed participants for second meeting (active)
    const participants2Result = await query<Participant>(
      `INSERT INTO participants (meeting_id, identity, joined_at, left_at, metadata)
       VALUES 
         ($1, $2, NOW() - INTERVAL '1 hour', NULL, $3),
         ($1, $4, NOW() - INTERVAL '55 minutes', NULL, $5)
       RETURNING *`,
      [
        meetings[1].id,
        "david@example.com",
        JSON.stringify({ name: "David Lee", role: "Product Manager" }),
        "eve@example.com",
        JSON.stringify({ name: "Eve Martinez", role: "Designer" }),
      ]
    );

    // Seed participants for third meeting (active)
    const participants3Result = await query<Participant>(
      `INSERT INTO participants (meeting_id, identity, joined_at, left_at, metadata)
       VALUES 
         ($1, $2, NOW() - INTERVAL '30 minutes', NULL, $3),
         ($1, $4, NOW() - INTERVAL '28 minutes', NULL, $5),
         ($1, $6, NOW() - INTERVAL '25 minutes', NULL, $7)
       RETURNING *`,
      [
        meetings[2].id,
        "frank@example.com",
        JSON.stringify({ name: "Frank Wilson", role: "Sales" }),
        "grace@example.com",
        JSON.stringify({ name: "Grace Taylor", role: "Engineer" }),
        "henry@acme.com",
        JSON.stringify({ name: "Henry Davis", role: "Customer" }),
      ]
    );

    const totalParticipants =
      participants1Result.rowCount! +
      participants2Result.rowCount! +
      participants3Result.rowCount!;
    console.log(`Created ${totalParticipants} participants`);

    // Seed recordings for first meeting
    console.log("Seeding recordings...");
    const recordingsResult = await query<Recording>(
      `INSERT INTO recordings (meeting_id, egress_id, storage_path, status, started_at, completed_at, file_size, duration, metadata)
       VALUES 
         ($1, $2, $3, $4, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', $5, $6, $7)
       RETURNING *`,
      [
        meetings[0].id,
        "egress_daily_standup_20240117",
        "recordings/daily-standup-2024-01-17.mp4",
        "completed",
        125829120, // ~120 MB
        3600, // 1 hour in seconds
        JSON.stringify({
          format: "mp4",
          resolution: "1920x1080",
          codec: "h264",
        }),
      ]
    );

    console.log(`Created ${recordingsResult.rowCount} recordings`);

    // Seed analytics events
    console.log("Seeding analytics events...");
    const allParticipants = [
      ...participants1Result.rows,
      ...participants2Result.rows,
      ...participants3Result.rows,
    ];

    // Create various analytics events
    const analyticsEvents = [];

    // Meeting started events
    for (const meeting of meetings) {
      analyticsEvents.push([
        meeting.id,
        null,
        "meeting_started",
        JSON.stringify({ room_name: meeting.room_name }),
      ]);
    }

    // Participant joined events
    for (const participant of allParticipants) {
      analyticsEvents.push([
        participant.meeting_id,
        participant.id,
        "participant_joined",
        JSON.stringify({ identity: participant.identity }),
      ]);
    }

    // Participant left events (for ended meeting)
    for (const participant of participants1Result.rows) {
      analyticsEvents.push([
        participant.meeting_id,
        participant.id,
        "participant_left",
        JSON.stringify({ identity: participant.identity, duration: 3600 }),
      ]);
    }

    // Recording started event
    analyticsEvents.push([
      meetings[0].id,
      null,
      "recording_started",
      JSON.stringify({ egress_id: "egress_daily_standup_20240117" }),
    ]);

    // Recording completed event
    analyticsEvents.push([
      meetings[0].id,
      null,
      "recording_completed",
      JSON.stringify({
        egress_id: "egress_daily_standup_20240117",
        file_size: 125829120,
        duration: 3600,
      }),
    ]);

    // Insert all analytics events
    for (const event of analyticsEvents) {
      await query(
        `INSERT INTO analytics (meeting_id, participant_id, event_type, event_data)
         VALUES ($1, $2, $3, $4)`,
        event
      );
    }

    console.log(`Created ${analyticsEvents.length} analytics events`);

    console.log("\n✅ Database seeding completed successfully!");
    console.log("\nSummary:");
    console.log(`  - Meetings: ${meetings.length}`);
    console.log(`  - Participants: ${totalParticipants}`);
    console.log(`  - Recordings: ${recordingsResult.rowCount}`);
    console.log(`  - Analytics Events: ${analyticsEvents.length}`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run seed if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export { seedDatabase };
