/**
 * Database migration runner
 * Automatically runs pending migrations on application startup
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import runner from "node-pg-migrate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationOptions {
  databaseUrl: string;
  direction?: "up" | "down";
  count?: number;
  dryRun?: boolean;
}

/**
 * Run database migrations
 */
export async function runMigrations(options: MigrationOptions): Promise<void> {
  const {
    databaseUrl,
    direction = "up",
    count = Infinity,
    dryRun = false,
  } = options;

  if (!databaseUrl) {
    throw new Error("Database URL is required for migrations");
  }

  console.log("Running database migrations...");
  console.log(`Direction: ${direction}`);
  console.log(`Dry run: ${dryRun}`);

  try {
    const migrationsDir = join(__dirname, "../../migrations");

    const migrations = await runner({
      databaseUrl,
      dir: migrationsDir,
      direction,
      count,
      migrationsTable: "pgmigrations",
      checkOrder: true,
      verbose: true,
      dryRun,
      decamelize: true,
      createSchema: true,
      createMigrationsSchema: false,
      noLock: false,
    });

    if (migrations.length === 0) {
      console.log("✅ No pending migrations");
    } else {
      console.log(`✅ Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`  - ${migration.name}`);
      });
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

/**
 * Run migrations automatically on startup
 */
export async function autoMigrate(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn("⚠️  DATABASE_URL not set, skipping migrations");
    return;
  }

  try {
    await runMigrations({
      databaseUrl,
      direction: "up",
      dryRun: false,
    });
  } catch (error) {
    console.error("Failed to run migrations on startup");
    throw error;
  }
}
