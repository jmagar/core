import { runQuery } from "~/lib/neo4j.server";
import type { EpisodicNode } from "@core/types";

export async function saveEpisode(episode: EpisodicNode): Promise<string> {
  const query = `
    MERGE (e:Episode {uuid: $uuid})
    ON CREATE SET
      e.content = $content,
      e.originalContent = $originalContent,
      e.contentEmbedding = $contentEmbedding,
      e.metadata = $metadata,
      e.source = $source,
      e.createdAt = $createdAt,
      e.validAt = $validAt,
      e.userId = $userId,
      e.labels = $labels,
      e.space = $space,
      e.sessionId = $sessionId
    ON MATCH SET
      e.content = $content,
      e.contentEmbedding = $contentEmbedding,
      e.originalContent = $originalContent,
      e.metadata = $metadata,
      e.source = $source,
      e.validAt = $validAt,
      e.labels = $labels,
      e.space = $space,
      e.sessionId = $sessionId
    RETURN e.uuid as uuid
  `;

  const params = {
    uuid: episode.uuid,
    content: episode.content,
    originalContent: episode.originalContent,
    source: episode.source,
    metadata: JSON.stringify(episode.metadata || {}),
    userId: episode.userId || null,
    labels: episode.labels || [],
    createdAt: episode.createdAt.toISOString(),
    validAt: episode.validAt.toISOString(),
    contentEmbedding: episode.contentEmbedding || [],
    space: episode.space || null,
    sessionId: episode.sessionId || null,
  };

  const result = await runQuery(query, params);
  return result[0].get("uuid");
}

// Get an episode by UUID
export async function getEpisode(uuid: string): Promise<EpisodicNode | null> {
  const query = `
    MATCH (e:Episode {uuid: $uuid})
    RETURN e
  `;

  const result = await runQuery(query, { uuid });
  if (result.length === 0) return null;

  const episode = result[0].get("e").properties;
  return {
    uuid: episode.uuid,
    content: episode.content,
    originalContent: episode.originalContent,
    contentEmbedding: episode.contentEmbedding,
    metadata: JSON.parse(episode.metadata || "{}"),
    source: episode.source,
    createdAt: new Date(episode.createdAt),
    validAt: new Date(episode.validAt),
    labels: episode.labels,
    userId: episode.userId,
    space: episode.space,
    sessionId: episode.sessionId,
  };
}

// Get recent episodes with optional filters
export async function getRecentEpisodes(params: {
  referenceTime: Date;
  limit: number;
  userId: string;
  source?: string;
  sessionId?: string;
}): Promise<EpisodicNode[]> {
  let filters = `WHERE e.validAt <= $referenceTime
  AND e.userId = $userId`;

  if (params.source) {
    filters += `\nAND e.source = $source`;
  }

  if (params.sessionId) {
    filters += `\nAND e.sessionId = $sessionId`;
  }

  const query = `
    MATCH (e:Episode)
    ${filters}
    RETURN e
    ORDER BY e.validAt DESC
    LIMIT ${params.limit}
  `;

  const queryParams = {
    referenceTime: new Date(params.referenceTime).toISOString(),
    userId: params.userId,
    source: params.source || null,
    sessionId: params.sessionId || null,
  };

  const result = await runQuery(query, queryParams);

  return result.map((record) => {
    const episode = record.get("e").properties;
    return {
      uuid: episode.uuid,
      content: episode.content,
      originalContent: episode.originalContent,
      contentEmbedding: episode.contentEmbedding,
      metadata: JSON.parse(episode.metadata || "{}"),
      source: episode.source,
      createdAt: new Date(episode.createdAt),
      validAt: new Date(episode.validAt),
      labels: episode.labels,
      userId: episode.userId,
      space: episode.space,
      sessionId: episode.sessionId,
    };
  });
}

export async function searchEpisodesByEmbedding(params: {
  embedding: number[];
  userId: string;
  limit?: number;
  minSimilarity?: number;
}) {
  const query = `
  MATCH (episode:Episode)
  WHERE episode.userId = $userId
    AND episode.contentEmbedding IS NOT NULL
  WITH episode, 
       CASE 
         WHEN size(episode.contentEmbedding) = size($embedding) 
         THEN vector.similarity.cosine($embedding, episode.contentEmbedding) 
         ELSE 0 
       END AS score
  WHERE score >= $minSimilarity
  RETURN episode, score
  ORDER BY score DESC`;

  const result = await runQuery(query, {
    embedding: params.embedding,
    minSimilarity: params.minSimilarity,
    userId: params.userId,
  });

  if (!result || result.length === 0) {
    return [];
  }

  return result.map((record) => {
    const episode = record.get("episode").properties;
    const score = record.get("score");

    return {
      uuid: episode.uuid,
      content: episode.content,
      contentEmbedding: episode.contentEmbedding,
      createdAt: new Date(episode.createdAt),
      validAt: new Date(episode.validAt),
      invalidAt: episode.invalidAt ? new Date(episode.invalidAt) : null,
      attributes: episode.attributesJson
        ? JSON.parse(episode.attributesJson)
        : {},
      userId: episode.userId,
    };
  });
}
