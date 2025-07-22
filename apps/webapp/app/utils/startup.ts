import { logger } from "~/services/logger.service";
import { fetchAndSaveStdioIntegrations } from "~/trigger/utils/mcp";
import { initNeo4jSchemaOnce } from "~/lib/neo4j.server";

// Global flag to ensure startup only runs once per server process
let startupInitialized = false;

/**
 * Initialize all startup services once per server process
 * Safe to call multiple times - will only run initialization once
 */
export async function initializeStartupServices() {
  if (startupInitialized) {
    return;
  }

  try {
    logger.info("Starting application initialization...");

    // Initialize Neo4j schema
    await initNeo4jSchemaOnce();
    logger.info("Neo4j schema initialization completed");

    await fetchAndSaveStdioIntegrations();
    logger.info("Stdio integrations initialization completed");

    startupInitialized = true;
    logger.info("Application initialization completed successfully");
  } catch (error) {
    logger.error("Failed to initialize startup services:", { error });
    // Don't mark as initialized if there was an error, allow retry
    throw error;
  }
}
