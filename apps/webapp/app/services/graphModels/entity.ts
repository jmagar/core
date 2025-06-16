import type { EntityNode } from "@core/types";
import { runQuery } from "~/lib/neo4j.server";

export async function saveEntity(entity: EntityNode): Promise<string> {
  const query = `
    MERGE (n:Entity {uuid: $uuid})
      ON CREATE SET
        n.name = $name,
        n.type = $type,
        n.attributes = $attributes,
        n.nameEmbedding = $nameEmbedding,
        n.createdAt = $createdAt,
        n.userId = $userId,
        n.space = $space
      ON MATCH SET
        n.name = $name,
        n.type = $type,
        n.attributes = $attributes,
        n.nameEmbedding = $nameEmbedding,
        n.space = $space
      RETURN n.uuid as uuid
    `;

  const params = {
    uuid: entity.uuid,
    name: entity.name,
    type: entity.type,
    attributes: JSON.stringify(entity.attributes || {}),
    nameEmbedding: entity.nameEmbedding,
    createdAt: entity.createdAt.toISOString(),
    userId: entity.userId,
    space: entity.space || null,
  };

  const result = await runQuery(query, params);
  return result[0].get("uuid");
}

export async function getEntity(uuid: string): Promise<EntityNode | null> {
  const query = `
    MATCH (entity:Entity {uuid: $uuid})
    RETURN entity
  `;

  const result = await runQuery(query, { uuid });
  if (result.length === 0) return null;

  const entity = result[0].get("entity").properties;
  return {
    uuid: entity.uuid,
    name: entity.name,
    type: entity.type,
    attributes: JSON.parse(entity.attributes || "{}"),
    nameEmbedding: entity.nameEmbedding,
    createdAt: new Date(entity.createdAt),
    userId: entity.userId,
    space: entity.space,
  };
}

// Find semantically similar entities
export async function findSimilarEntities(params: {
  queryEmbedding: number[];
  limit: number;
  threshold: number;
}): Promise<EntityNode[]> {
  const query = `
          MATCH (entity:Entity)
          WHERE entity.nameEmbedding IS NOT NULL
          WITH entity, vector.similarity.cosine($queryEmbedding, entity.nameEmbedding) AS score
          WHERE score >= $threshold
          RETURN entity, score
          ORDER BY score DESC
        `;

  const result = await runQuery(query, params);
  return result.map((record) => {
    const entity = record.get("entity").properties;

    return {
      uuid: entity.uuid,
      name: entity.name,
      type: entity.type,
      attributes: JSON.parse(entity.attributes || "{}"),
      nameEmbedding: entity.nameEmbedding,
      createdAt: new Date(entity.createdAt),
      userId: entity.userId,
      space: entity.space,
    };
  });
}
