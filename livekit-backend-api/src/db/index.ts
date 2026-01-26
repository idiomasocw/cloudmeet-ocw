/**
 * Database module exports
 * Provides database client, migrations, and seed utilities
 */

export {
  pool,
  query,
  getClient,
  checkConnection,
  closePool,
} from "./client.js";
export { runMigrations, autoMigrate } from "./migrate.js";
export { seedDatabase } from "./seed.js";
