import neo4j from "neo4j-driver";
import { type RawTriplet } from "~/components/graph/type";
import { logger } from "~/services/logger.service";
import { singleton } from "~/utils/singleton";

// Create a singleton driver instance
const driver = singleton("neo4j", getDriver);
const EMBEDDING_MODEL_SIZE = process.env.EMBEDDING_MODEL_SIZE ?? "1024";

function getDriver() {
  return neo4j.driver(
    process.env.NEO4J_URI ?? "bolt://localhost:7687",
    neo4j.auth.basic(
      process.env.NEO4J_USERNAME as string,
      process.env.NEO4J_PASSWORD as string,
    ),
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
}

let schemaInitialized = false;

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

// Get all nodes and relationships for a user
export const getAllNodesForUser = async (userId: string) => {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n)-[r]->(m)
       WHERE n.userId = $userId OR m.userId = $userId
       RETURN n, r, m`,
      { userId },
    );
    return result.records;
  } catch (error) {
    logger.error(`Error getting nodes for user ${userId}: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
};

export const getNodeLinks = async (userId: string) => {
  const result = await getAllNodesForUser(userId);
  const triplets: RawTriplet[] = [];

  result.forEach((record) => {
    const sourceNode = record.get("n");
    const targetNode = record.get("m");
    const edge = record.get("r");
    triplets.push({
      sourceNode: {
        uuid: sourceNode.identity.toString(),
        labels: sourceNode.labels,
        attributes: sourceNode.properties,
        name: sourceNode.properties.name || "",
        createdAt: sourceNode.properties.createdAt || "",
      },
      edge: {
        uuid: edge.identity.toString(),
        type: edge.type,
        source_node_uuid: sourceNode.identity.toString(),
        target_node_uuid: targetNode.identity.toString(),
        createdAt: edge.properties.createdAt || "",
      },
      targetNode: {
        uuid: targetNode.identity.toString(),
        labels: targetNode.labels,
        attributes: targetNode.properties,
        name: targetNode.properties.name || "",
        createdAt: edge.properties.createdAt || "",
      },
    });
  });

  return triplets;
};

// Get graph data with cluster information for reified graph
export const getClusteredGraphData = async (userId: string) => {
  const session = driver.session();
  try {
    // Get the simplified graph structure: Episode, Subject, Object with Predicate as edge
    const result = await session.run(
      `// Get all statements with their episode and entity connections
       MATCH (e:Episode)-[:HAS_PROVENANCE]->(s:Statement)
       WHERE s.userId = $userId

       // Get subject and object entities
       MATCH (s)-[:HAS_SUBJECT]->(subj:Entity)
       MATCH (s)-[:HAS_PREDICATE]->(pred:Entity)
       MATCH (s)-[:HAS_OBJECT]->(obj:Entity)

       // Return Episode, Subject, and Object as nodes with Predicate as edge label
       WITH e, s, subj, pred, obj
       UNWIND [
         // Episode -> Subject
         {source: e, sourceType: 'Episode', target: subj, targetType: 'Entity', predicate: null},
         // Episode -> Object
         {source: e, sourceType: 'Episode', target: obj, targetType: 'Entity', predicate: null},
         // Subject -> Object (with Predicate as edge)
         {source: subj, sourceType: 'Entity', target: obj, targetType: 'Entity', predicate: pred.name}
       ] AS rel

       RETURN DISTINCT
         rel.source.uuid as sourceUuid,
         rel.source.name as sourceName,
         rel.source.content as sourceContent,
         rel.sourceType as sourceNodeType,
         rel.target.uuid as targetUuid,
         rel.target.name as targetName,
         rel.targetType as targetNodeType,
         rel.predicate as predicateLabel,
         e.uuid as episodeUuid,
         e.content as episodeContent,
         s.uuid as statementUuid,
         s.spaceIds as spaceIds,
         s.fact as fact,
         s.invalidAt as invalidAt,
         s.validAt as validAt,
         s.createdAt as createdAt`,
      { userId },
    );

    const triplets: RawTriplet[] = [];
    const processedEdges = new Set<string>();

    result.records.forEach((record) => {
      const sourceUuid = record.get("sourceUuid");
      const sourceName = record.get("sourceName");
      const sourceContent = record.get("sourceContent");
      const sourceNodeType = record.get("sourceNodeType");

      const targetUuid = record.get("targetUuid");
      const targetName = record.get("targetName");
      const targetNodeType = record.get("targetNodeType");

      const predicateLabel = record.get("predicateLabel");
      const episodeUuid = record.get("episodeUuid");
      const episodeContent = record.get("episodeContent");
      const statementUuid = record.get("statementUuid");
      const clusterIds = record.get("spaceIds");
      const clusterId = clusterIds ? clusterIds[0] : undefined;
      const fact = record.get("fact");
      const invalidAt = record.get("invalidAt");
      const validAt = record.get("validAt");
      const createdAt = record.get("createdAt");

      // Create unique edge identifier to avoid duplicates
      // For Episode->Subject edges, use generic type; for Subject->Object use predicate
      const edgeType = predicateLabel || "HAS_SUBJECT";
      const edgeKey = `${sourceUuid}-${targetUuid}-${edgeType}`;
      if (processedEdges.has(edgeKey)) return;
      processedEdges.add(edgeKey);

      // Build node attributes based on type
      const sourceAttributes =
        sourceNodeType === "Episode"
          ? {
              nodeType: "Episode",
              content: sourceContent,
              episodeUuid: sourceUuid,
              clusterId,
            }
          : {
              nodeType: "Entity",
              name: sourceName,
              clusterId,
            };

      const targetAttributes =
        targetNodeType === "Episode"
          ? {
              nodeType: "Episode",
              content: sourceContent,
              episodeUuid: targetUuid,
              clusterId,
            }
          : {
              nodeType: "Entity",
              name: targetName,
              clusterId,
            };

      // Build display name
      const sourceDisplayName =
        sourceNodeType === "Episode"
          ? sourceContent || episodeUuid
          : sourceName || sourceUuid;
      const targetDisplayName =
        targetNodeType === "Episode"
          ? sourceContent || episodeUuid
          : targetName || targetUuid;

      triplets.push({
        sourceNode: {
          uuid: sourceUuid,
          labels: [sourceNodeType],
          attributes: sourceAttributes,
          name: sourceDisplayName,
          clusterId,
          createdAt: createdAt || "",
        },
        edge: {
          uuid: `${sourceUuid}-${targetUuid}-${edgeType}`,
          type: edgeType,
          source_node_uuid: sourceUuid,
          target_node_uuid: targetUuid,
          createdAt: createdAt || "",
        },
        targetNode: {
          uuid: targetUuid,
          labels: [targetNodeType],
          attributes: targetAttributes,
          clusterId,
          name: targetDisplayName,
          createdAt: createdAt || "",
        },
      });
    });

    return triplets;
  } catch (error) {
    logger.error(
      `Error getting clustered graph data for user ${userId}: ${error}`,
    );
    throw error;
  } finally {
    await session.close();
  }
};

export async function initNeo4jSchemaOnce() {
  if (schemaInitialized) return;

  const session = driver.session();

  try {
    // Check if schema already exists
    const result = await session.run(`
      SHOW INDEXES YIELD name WHERE name = "entity_name" RETURN name
    `);

    if (result.records.length === 0) {
      // Run your schema creation here (indexes, constraints, etc.)
      await initializeSchema();
    }

    schemaInitialized = true;
  } catch (e: any) {
    logger.error("Error in initialising", e);
  } finally {
    await session.close();
  }
}

// Initialize the database schema
const initializeSchema = async () => {
  try {
    logger.info("Initialising neo4j schema");

    // Create constraints for unique IDs
    await runQuery(
      "CREATE CONSTRAINT episode_uuid IF NOT EXISTS FOR (n:Episode) REQUIRE n.uuid IS UNIQUE",
    );
    await runQuery(
      "CREATE CONSTRAINT entity_uuid IF NOT EXISTS FOR (n:Entity) REQUIRE n.uuid IS UNIQUE",
    );
    await runQuery(
      "CREATE CONSTRAINT statement_uuid IF NOT EXISTS FOR (n:Statement) REQUIRE n.uuid IS UNIQUE",
    );
    await runQuery(
      "CREATE CONSTRAINT cluster_uuid IF NOT EXISTS FOR (n:Cluster) REQUIRE n.uuid IS UNIQUE",
    );

    // Create indexes for better query performance
    await runQuery(
      "CREATE INDEX episode_valid_at IF NOT EXISTS FOR (n:Episode) ON (n.validAt)",
    );
    await runQuery(
      "CREATE INDEX statement_valid_at IF NOT EXISTS FOR (n:Statement) ON (n.validAt)",
    );
    await runQuery(
      "CREATE INDEX statement_invalid_at IF NOT EXISTS FOR (n:Statement) ON (n.invalidAt)",
    );
    await runQuery(
      "CREATE INDEX statement_cluster_id IF NOT EXISTS FOR (n:Statement) ON (n.clusterId)",
    );
    await runQuery(
      "CREATE INDEX statement_space_id IF NOT EXISTS FOR (n:Statement) ON (n.spaceId)",
    );
    await runQuery(
      "CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name)",
    );
    await runQuery(
      "CREATE INDEX entity_uuid IF NOT EXISTS FOR (n:Entity) ON (n.uuid)",
    );
    await runQuery(
      "CREATE INDEX entity_type IF NOT EXISTS FOR (n:Entity) ON (n.type)",
    );
    await runQuery(
      "CREATE INDEX entity_user_id IF NOT EXISTS FOR (n:Entity) ON (n.userId)",
    );
    await runQuery(
      "CREATE INDEX statement_user_id IF NOT EXISTS FOR (n:Statement) ON (n.userId)",
    );
    await runQuery(
      "CREATE INDEX cluster_user_id IF NOT EXISTS FOR (n:Cluster) ON (n.userId)",
    );
    await runQuery(
      "CREATE INDEX cluster_aspect_type IF NOT EXISTS FOR (n:Cluster) ON (n.aspectType)",
    );

    // Space-optimized indexes for better query performance
    await runQuery(
      "CREATE INDEX space_user_uuid IF NOT EXISTS FOR (n:Space) ON (n.userId, n.uuid)",
    );
    await runQuery(
      "CREATE INDEX space_user_active IF NOT EXISTS FOR (n:Space) ON (n.userId, n.isActive)",
    );
    await runQuery(
      "CREATE INDEX statement_user_spaces IF NOT EXISTS FOR (n:Statement) ON (n.userId, n.spaceIds)",
    );
    await runQuery(
      "CREATE INDEX statement_user_invalid IF NOT EXISTS FOR (n:Statement) ON (n.userId, n.invalidAt)",
    );
    await runQuery(
      "CREATE INDEX statement_user_uuid IF NOT EXISTS FOR (n:Statement) ON (n.userId, n.uuid)",
    );
    await runQuery(
      "CREATE INDEX entity_user_uuid IF NOT EXISTS FOR (n:Entity) ON (n.userId, n.uuid)",
    );
    await runQuery(
      "CREATE INDEX episode_user_uuid IF NOT EXISTS FOR (n:Episode) ON (n.userId, n.uuid)",
    );
    await runQuery(
      "CREATE INDEX episode_user_id IF NOT EXISTS FOR (n:Episode) ON (n.userId)",
    );

    // Create vector indexes for semantic search (if using Neo4j 5.0+)
    await runQuery(`
      CREATE VECTOR INDEX entity_embedding IF NOT EXISTS FOR (n:Entity) ON n.nameEmbedding
      OPTIONS {indexConfig: {\`vector.dimensions\`: ${EMBEDDING_MODEL_SIZE}, \`vector.similarity_function\`: 'cosine', \`vector.hnsw.ef_construction\`: 400, \`vector.hnsw.m\`: 32}}
    `);

    await runQuery(`
      CREATE VECTOR INDEX statement_embedding IF NOT EXISTS FOR (n:Statement) ON n.factEmbedding
      OPTIONS {indexConfig: {\`vector.dimensions\`: ${EMBEDDING_MODEL_SIZE}, \`vector.similarity_function\`: 'cosine', \`vector.hnsw.ef_construction\`: 400, \`vector.hnsw.m\`: 32}}
    `);

    await runQuery(`
      CREATE VECTOR INDEX episode_embedding IF NOT EXISTS FOR (n:Episode) ON n.contentEmbedding
      OPTIONS {indexConfig: {\`vector.dimensions\`: ${EMBEDDING_MODEL_SIZE}, \`vector.similarity_function\`: 'cosine', \`vector.hnsw.ef_construction\`: 400, \`vector.hnsw.m\`: 32}}
    `);

    // Create fulltext indexes for BM25 search
    await runQuery(`
      CREATE FULLTEXT INDEX statement_fact_index IF NOT EXISTS
      FOR (n:Statement) ON EACH [n.fact]
      OPTIONS {
        indexConfig: {
          \`fulltext.analyzer\`: 'english'
        }
      }
    `);

    await runQuery(`
      CREATE FULLTEXT INDEX entity_name_index IF NOT EXISTS
      FOR (n:Entity) ON EACH [n.name]
      OPTIONS {
        indexConfig: {
          \`fulltext.analyzer\`: 'english'
        }
      }
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
