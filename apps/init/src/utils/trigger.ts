import Knex from "knex";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./env.js";
import { spinner, note, log } from "@clack/prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns a PostgreSQL database URL for the given database name.
 * Throws if required environment variables are missing.
 */
export function getDatabaseUrl(dbName: string): string {
  const { POSTGRES_USER, POSTGRES_PASSWORD, DB_HOST, DB_PORT } = env;

  if (!POSTGRES_USER || !POSTGRES_PASSWORD || !DB_HOST || !DB_PORT || !dbName) {
    throw new Error(
      "One or more required environment variables are missing: POSTGRES_USER, POSTGRES_PASSWORD, DB_HOST, DB_PORT, dbName"
    );
  }

  return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:${DB_PORT}/${dbName}`;
}

/**
 * Checks if the database specified by TRIGGER_DB exists, and creates it if it does not.
 * Returns { exists: boolean, created: boolean } - exists indicates success, created indicates if database was newly created.
 */
export async function ensureDatabaseExists(): Promise<{ exists: boolean; created: boolean }> {
  const { TRIGGER_DB } = env;

  if (!TRIGGER_DB) {
    throw new Error("TRIGGER_DB environment variable is missing");
  }

  // Build a connection string to the default 'postgres' database
  const adminDbUrl = getDatabaseUrl("postgres");

  // Create a Knex instance for the admin connection
  const adminKnex = Knex({
    client: "pg",
    connection: adminDbUrl,
  });

  const s = spinner();
  s.start("Checking for Trigger.dev database...");

  try {
    // Check if the database exists
    const result = await adminKnex.select(1).from("pg_database").where("datname", TRIGGER_DB);

    if (result.length === 0) {
      s.message("Database not found. Creating...");
      // Database does not exist, create it
      await adminKnex.raw(`CREATE DATABASE "${TRIGGER_DB}"`);
      s.stop("Database created.");
      return { exists: true, created: true };
    } else {
      s.stop("Database exists.");
      return { exists: true, created: false };
    }
  } catch (err) {
    s.stop("Failed to ensure database exists.");
    log.warning("Failed to ensure database exists: " + (err as Error).message);
    return { exists: false, created: false };
  } finally {
    await adminKnex.destroy();
  }
}

// Main initialization function
export async function initTriggerDatabase() {
  const { TRIGGER_DB } = env;

  if (!TRIGGER_DB) {
    throw new Error("TRIGGER_DB environment variable is missing");
  }

  // Ensure the database exists
  const { exists, created } = await ensureDatabaseExists();
  if (!exists) {
    throw new Error("Failed to create or verify database exists");
  }

  // Only run pg_restore if the database was newly created
  if (!created) {
    note("Database already exists, skipping restore from trigger.dump");
    return;
  }

  // Run pg_restore with the trigger.dump file
  const dumpFilePath = path.join(__dirname, "../../../trigger.dump");
  const connectionString = getDatabaseUrl(TRIGGER_DB);

  const s = spinner();
  s.start("Restoring database from trigger.dump...");

  try {
    // Use execSync and capture stdout/stderr, send to spinner.log
    const { spawn } = await import("child_process");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "pg_restore",
        ["--verbose", "--no-acl", "--no-owner", "-d", connectionString, dumpFilePath],
        { stdio: ["ignore", "pipe", "pipe"] }
      );

      child.stdout.on("data", (data) => {
        s.message(data.toString());
      });

      child.stderr.on("data", (data) => {
        s.message(data.toString());
      });

      child.on("close", (code) => {
        if (code === 0) {
          s.stop("Database restored successfully from trigger.dump");
          resolve();
        } else {
          s.stop("Failed to restore database.");
          log.warning(`Failed to restore database: pg_restore exited with code ${code}`);
          reject(new Error(`Database restore failed: pg_restore exited with code ${code}`));
        }
      });

      child.on("error", (err) => {
        s.stop("Failed to restore database.");
        log.warning("Failed to restore database: " + err.message);
        reject(new Error(`Database restore failed: ${err.message}`));
      });
    });
  } catch (error: any) {
    s.stop("Failed to restore database.");
    log.warning("Failed to restore database: " + error.message);
    throw new Error(`Database restore failed: ${error.message}`);
  }
}

export async function updateWorkerImage() {
  const { TRIGGER_DB, TRIGGER_TASKS_IMAGE } = env;

  if (!TRIGGER_DB) {
    throw new Error("TRIGGER_DB environment variable is missing");
  }

  const connectionString = getDatabaseUrl(TRIGGER_DB);

  const knex = Knex({
    client: "pg",
    connection: connectionString,
  });

  const s = spinner();
  s.start("Updating worker image reference...");

  try {
    // Get the first record from WorkerDeployment table
    const firstWorkerDeployment = await knex("WorkerDeployment").select("id").first();

    if (!firstWorkerDeployment) {
      s.stop("No WorkerDeployment records found, skipping image update");
      note("No WorkerDeployment records found, skipping image update");
      return;
    }

    // Update the imageReference column with the TRIGGER_TASKS_IMAGE value
    await knex("WorkerDeployment").where("id", firstWorkerDeployment.id).update({
      imageReference: TRIGGER_TASKS_IMAGE,
      updatedAt: new Date(),
    });

    s.stop(`Successfully updated worker image reference to: ${TRIGGER_TASKS_IMAGE}`);
  } catch (error: any) {
    s.stop("Failed to update worker image.");
    log.warning("Failed to update worker image: " + error.message);
    throw new Error(`Worker image update failed: ${error.message}`);
  } finally {
    await knex.destroy();
  }
}
