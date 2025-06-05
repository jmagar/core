import neo4j from "neo4j-driver";
import { env } from "~/env.server";
import { logger } from "~/services/logger.service";

// Create a driver instance
const driver = neo4j.driver(
  env.NEO4J_URI,
  neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD),
  {
    maxConnectionPoolSize: 50,
    logging: {
      level: "info",
      logger: (level, message) => {
        logger.info(message);
      },
    },
  },
);

// Test the connection
const verifyConnectivity = async () => {
  try {
    await driver.verifyConnectivity();
    logger.info("Connected to Neo4j database");
    return true;
  } catch (error) {
    logger.error("Failed to connect to Neo4j database");
    return false;
  }
};

// Run a Cypher query
const runQuery = async (cypher: string, params = {}) => {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } catch (error) {
    logger.error(`Error running Cypher query: ${cypher} ${error}`);
    throw error;
  } finally {
    await session.close();
  }
};

// Initialize the database schema
const initializeSchema = async () => {
  try {
    // Run schema setup queries
    await runQuery(`
      // Create constraints for unique IDs
      CREATE CONSTRAINT episode_uuid IF NOT EXISTS FOR (n:Episode) REQUIRE n.uuid IS UNIQUE;
      CREATE CONSTRAINT entity_uuid IF NOT EXISTS FOR (n:Entity) REQUIRE n.uuid IS UNIQUE;
      CREATE CONSTRAINT statement_uuid IF NOT EXISTS FOR (n:Statement) REQUIRE n.uuid IS UNIQUE;
      
      // Create indexes for better query performance
      CREATE INDEX episode_valid_at IF NOT EXISTS FOR (n:Episode) ON (n.validAt);
      CREATE INDEX statement_valid_at IF NOT EXISTS FOR (n:Statement) ON (n.validAt);
      CREATE INDEX statement_invalid_at IF NOT EXISTS FOR (n:Statement) ON (n.invalidAt);
      CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name);
      
      // Create vector indexes for semantic search (if using Neo4j 5.0+)
      CREATE VECTOR INDEX entity_embedding IF NOT EXISTS FOR (n:Entity) ON n.nameEmbedding
      OPTIONS {indexConfig: {dimensions: 1536, similarity: "cosine"}};
      
      CREATE VECTOR INDEX statement_embedding IF NOT EXISTS FOR (n:Statement) ON n.factEmbedding
      OPTIONS {indexConfig: {dimensions: 1536, similarity: "cosine"}};
      
      CREATE VECTOR INDEX episode_embedding IF NOT EXISTS FOR (n:Episode) ON n.contentEmbedding
      OPTIONS {indexConfig: {dimensions: 1536, similarity: "cosine"}};
    `);

    logger.info("Neo4j schema initialized successfully");
    return true;
  } catch (error) {
    logger.error("Failed to initialize Neo4j schema", { error });
    return false;
  }
};

// Close the driver when the application shuts down
const closeDriver = async () => {
  await driver.close();
  logger.info("Neo4j driver closed");
};

export { driver, verifyConnectivity, runQuery, initializeSchema, closeDriver };
