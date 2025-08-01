import { task, logger, queue } from "@trigger.dev/sdk";
import { runQuery } from "~/lib/neo4j.server";
import { getEmbedding } from "~/lib/model.server";
import type { EntityNode } from "@core/types";

interface EntityUpdateResult {
  uuid: string;
  name: string;
  type: string;
  success: boolean;
  error?: string;
}

interface BatchResult {
  batchId: string;
  entities: number;
  successful: number;
  failed: number;
  results: EntityUpdateResult[];
}

export const entity = queue({
  name: "entity-queue",
  concurrencyLimit: 5,
});

/**
 * Main orchestrator task that fans out batches of 100 entities
 */
export const updateAllEntityEmbeddings = task({
  id: "update-all-entity-embeddings",
  machine: "large-1x",

  run: async (
    payload: {
      userId?: string;
      batchSize?: number;
      forceUpdate?: boolean;
    } = {},
  ) => {
    const { userId, batchSize = 50, forceUpdate = false } = payload;

    logger.info("Starting entity embeddings update with fan-out approach", {
      userId,
      batchSize,
      forceUpdate,
      targetScope: userId ? `user ${userId}` : "all users",
    });

    try {
      // Step 1: Fetch entities (either all or only those needing updates)
      const entities = forceUpdate
        ? await getAllEntitiesForceRefresh(userId)
        : await getAllEntities(userId);
      logger.info(`Found ${entities.length} entities to update`, {
        strategy: forceUpdate ? "force-refresh-all" : "missing-embeddings-only",
      });

      if (entities.length === 0) {
        return {
          success: true,
          totalEntities: 0,
          totalBatches: 0,
          updated: 0,
          failed: 0,
          batchResults: [],
        };
      }

      // Step 2: Split entities into batches and fan out
      const batches: EntityNode[][] = [];
      for (let i = 0; i < entities.length; i += batchSize) {
        batches.push(entities.slice(i, i + batchSize));
      }

      logger.info(
        `Fanning out ${batches.length} batches of ~${batchSize} entities each`,
      );

      // Step 3: Fan out batch processing tasks in parallel
      const batchPromises = batches.map((batch, index) =>
        updateEntityBatch.trigger({
          entities: batch,
          batchId: `batch-${index + 1}`,
          batchNumber: index + 1,
          totalBatches: batches.length,
        }),
      );

      // Wait for all batch tasks to complete
      const batchRuns = await Promise.all(batchPromises);

      // Step 4: Collect results from all batches
      const batchResults: BatchResult[] = [];
      let totalUpdated = 0;
      let totalFailed = 0;

      for (const run of batchRuns) {
        try {
          // Note: In a real implementation, you'd need to wait for the run to complete
          // and fetch its result. This is a simplified version.
          logger.info(`Batch run ${run.id} started successfully`);
        } catch (error) {
          logger.error(`Failed to start batch run:`, { error });
        }
      }

      logger.info("All batches have been dispatched", {
        totalBatches: batches.length,
        totalEntities: entities.length,
        batchRunIds: batchRuns.map((r) => r.id),
      });

      return {
        success: true,
        totalEntities: entities.length,
        totalBatches: batches.length,
        batchRunIds: batchRuns.map((r) => r.id),
        message:
          "All batches dispatched successfully. Check individual batch runs for detailed results.",
      };
    } catch (error) {
      logger.error(
        "Fatal error during entity embeddings update orchestration:",
        { error },
      );
      throw error;
    }
  },
});

/**
 * Worker task that processes a single batch of entities
 */
export const updateEntityBatch = task({
  id: "update-entity-batch",
  queue: entity,
  run: async (payload: {
    entities: EntityNode[];
    batchId: string;
    batchNumber: number;
    totalBatches: number;
  }) => {
    const { entities, batchId, batchNumber, totalBatches } = payload;

    logger.info(`Processing ${batchId} (${batchNumber}/${totalBatches})`, {
      entityCount: entities.length,
    });

    const results: EntityUpdateResult[] = [];

    try {
      // Process all entities in this batch in parallel
      const entityPromises = entities.map((entity) =>
        updateEntityEmbeddings(entity),
      );
      const entityResults = await Promise.allSettled(entityPromises);

      // Collect results
      entityResults.forEach((result, index) => {
        const entity = entities[index];
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          logger.error(
            `Failed to update entity ${entity.uuid} in ${batchId}:`,
            { error: result.reason },
          );
          results.push({
            uuid: entity.uuid,
            name: entity.name,
            type: entity.type,
            success: false,
            error: result.reason?.message || "Unknown error",
          });
        }
      });

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      logger.info(`Completed ${batchId}`, {
        total: entities.length,
        successful,
        failed,
        successRate: `${((successful / entities.length) * 100).toFixed(2)}%`,
      });

      return {
        batchId,
        batchNumber,
        totalBatches,
        entities: entities.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      logger.error(`Fatal error in ${batchId}:`, { error });
      throw error;
    }
  },
});

/**
 * Fetch all entities from Neo4j database that need embedding updates
 */
async function getAllEntities(userId?: string): Promise<EntityNode[]> {
  try {
    // Only fetch entities that either:
    // 1. Have null/empty embeddings, OR
    // 2. Have embeddings but might need updates (optional: add timestamp check)
    const query = userId
      ? `MATCH (entity:Entity {userId: $userId}) 
         WHERE entity.nameEmbedding IS NULL 
            OR entity.typeEmbedding IS NULL 
            OR size(entity.nameEmbedding) = 0 
            OR size(entity.typeEmbedding) = 0
         RETURN entity ORDER BY entity.createdAt`
      : `MATCH (entity:Entity) 
         WHERE entity.nameEmbedding IS NULL 
            OR entity.typeEmbedding IS NULL 
            OR size(entity.nameEmbedding) = 0 
            OR size(entity.typeEmbedding) = 0
         RETURN entity ORDER BY entity.createdAt`;

    const params = userId ? { userId } : {};
    const records = await runQuery(query, params);

    return records.map((record) => {
      const entityProps = record.get("entity").properties;
      return {
        uuid: entityProps.uuid,
        name: entityProps.name,
        type: entityProps.type,
        attributes: JSON.parse(entityProps.attributes || "{}"),
        nameEmbedding: entityProps.nameEmbedding || [],
        typeEmbedding: entityProps.typeEmbedding || [],
        createdAt: new Date(entityProps.createdAt),
        userId: entityProps.userId,
        space: entityProps.space,
      };
    });
  } catch (error) {
    logger.error("Error fetching entities:", { error });
    throw new Error(`Failed to fetch entities: ${error}`);
  }
}

/**
 * Fetch ALL entities from Neo4j database (for force refresh)
 */
async function getAllEntitiesForceRefresh(
  userId?: string,
): Promise<EntityNode[]> {
  try {
    const query = userId
      ? `MATCH (entity:Entity {userId: $userId}) RETURN entity ORDER BY entity.createdAt`
      : `MATCH (entity:Entity) RETURN entity ORDER BY entity.createdAt`;

    const params = userId ? { userId } : {};
    const records = await runQuery(query, params);

    return records.map((record) => {
      const entityProps = record.get("entity").properties;
      return {
        uuid: entityProps.uuid,
        name: entityProps.name,
        type: entityProps.type,
        attributes: JSON.parse(entityProps.attributes || "{}"),
        nameEmbedding: entityProps.nameEmbedding || [],
        typeEmbedding: entityProps.typeEmbedding || [],
        createdAt: new Date(entityProps.createdAt),
        userId: entityProps.userId,
        space: entityProps.space,
      };
    });
  } catch (error) {
    logger.error("Error fetching entities:", { error });
    throw new Error(`Failed to fetch entities: ${error}`);
  }
}

/**
 * Update embeddings for a single entity
 */
async function updateEntityEmbeddings(
  entity: EntityNode,
): Promise<EntityUpdateResult> {
  try {
    logger.info(
      `Updating embeddings for entity: ${entity.name} (${entity.type})`,
    );

    // Generate new embeddings
    const [nameEmbedding, typeEmbedding] = await Promise.all([
      getEmbedding(entity.name),
      getEmbedding(entity.type),
    ]);

    // Update entity in Neo4j
    const updateQuery = `
      MATCH (entity:Entity {uuid: $uuid})
      SET 
        entity.nameEmbedding = $nameEmbedding,
        entity.typeEmbedding = $typeEmbedding,
        entity.updatedAt = $updatedAt
      RETURN entity.uuid as uuid
    `;

    const updateParams = {
      uuid: entity.uuid,
      nameEmbedding,
      typeEmbedding,
      updatedAt: new Date().toISOString(),
    };

    const result = await runQuery(updateQuery, updateParams);

    if (result.length === 0) {
      throw new Error(`Entity ${entity.uuid} not found during update`);
    }

    return {
      uuid: entity.uuid,
      name: entity.name,
      type: entity.type,
      success: true,
    };
  } catch (error) {
    return {
      uuid: entity.uuid,
      name: entity.name,
      type: entity.type,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error", // TODO: fix this
    };
  }
}

/**
 * Helper function to trigger the entity embeddings update
 */
export async function triggerEntityEmbeddingsUpdate(
  options: {
    userId?: string;
    batchSize?: number;
    forceUpdate?: boolean;
  } = {},
) {
  try {
    const result = await updateAllEntityEmbeddings.trigger(options);
    logger.info(`Triggered entity embeddings update with run ID: ${result.id}`);
    return result;
  } catch (error) {
    logger.error("Failed to trigger entity embeddings update:", { error });
    throw error;
  }
}

/**
 * Update a single entity's embeddings (useful for individual updates)
 */
export async function updateSingleEntityEmbeddings(
  entityUuid: string,
): Promise<EntityUpdateResult> {
  try {
    const query = `MATCH (entity:Entity {uuid: $uuid}) RETURN entity`;
    const records = await runQuery(query, { uuid: entityUuid });

    if (records.length === 0) {
      throw new Error(`Entity with UUID ${entityUuid} not found`);
    }

    const entityProps = records[0].get("entity").properties;
    const entity: EntityNode = {
      uuid: entityProps.uuid,
      name: entityProps.name,
      type: entityProps.type,
      attributes: JSON.parse(entityProps.attributes || "{}"),
      nameEmbedding: entityProps.nameEmbedding || [],
      typeEmbedding: entityProps.typeEmbedding || [],
      createdAt: new Date(entityProps.createdAt),
      userId: entityProps.userId,
      space: entityProps.space,
    };

    return await updateEntityEmbeddings(entity);
  } catch (error) {
    logger.error(`Error updating single entity ${entityUuid}:`, { error });
    throw error;
  }
}
