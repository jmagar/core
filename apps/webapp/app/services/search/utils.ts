import type { EntityNode, StatementNode } from "@recall/types";
import type { SearchOptions } from "../search.server";
import type { Embedding } from "ai";
import { logger } from "../logger.service";
import { runQuery } from "~/lib/neo4j.server";

/**
 * Perform BM25 keyword-based search on statements
 */
export async function performBM25Search(
  query: string,
  userId: string,
  options: Required<SearchOptions>,
): Promise<StatementNode[]> {
  try {
    // Sanitize the query for Lucene syntax
    const sanitizedQuery = sanitizeLuceneQuery(query);

    // Use Neo4j's built-in fulltext search capabilities
    const cypher = `
        CALL db.index.fulltext.queryNodes("statement_fact_index", $query) 
        YIELD node AS s, score
        WHERE 
          s.validAt <= $validAt 
          AND (s.invalidAt IS NULL OR s.invalidAt > $validAt)
          AND (s.userId = $userId)
        RETURN s, score
        ORDER BY score DESC
      `;

    const params = {
      query: sanitizedQuery,
      userId,
      validAt: options.validAt.toISOString(),
    };

    const records = await runQuery(cypher, params);
    // return records.map((record) => record.get("s").properties as StatementNode);
    return [];
  } catch (error) {
    logger.error("BM25 search error:", { error });
    return [];
  }
}

/**
 * Sanitize a query string for Lucene syntax
 */
export function sanitizeLuceneQuery(query: string): string {
  // Escape special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \
  let sanitized = query.replace(
    /[+\-&|!(){}[\]^"~*?:\\]/g,
    (match) => "\\" + match,
  );

  // If query is too long, truncate it
  const MAX_QUERY_LENGTH = 32;
  const words = sanitized.split(" ");
  if (words.length > MAX_QUERY_LENGTH) {
    sanitized = words.slice(0, MAX_QUERY_LENGTH).join(" ");
  }

  return sanitized;
}

/**
 * Perform vector similarity search on statement embeddings
 */
export async function performVectorSearch(
  query: Embedding,
  userId: string,
  options: Required<SearchOptions>,
): Promise<StatementNode[]> {
  try {
    // 1. Generate embedding for the query
    // const embedding = await this.getEmbedding(query);

    // 2. Search for similar statements using Neo4j vector search
    const cypher = `
      MATCH (s:Statement)
      WHERE 
        s.validAt <= $validAt 
        AND (s.invalidAt IS NULL OR s.invalidAt > $validAt)
        AND (s.userId = $userId OR s.isPublic = true)
      WITH s, vector.similarity.cosine(s.factEmbedding, $embedding) AS score
      WHERE score > 0.7
      RETURN s, score
      ORDER BY score DESC
    `;

    const params = {
      embedding: query,
      userId,
      validAt: options.validAt.toISOString(),
    };

    const records = await runQuery(cypher, params);
    // return records.map((record) => record.get("s").properties as StatementNode);
    return [];
  } catch (error) {
    logger.error("Vector search error:", { error });
    return [];
  }
}

/**
 * Perform BFS traversal starting from entities mentioned in the query
 */
export async function performBfsSearch(
  embedding: Embedding,
  userId: string,
  options: Required<SearchOptions>,
): Promise<StatementNode[]> {
  try {
    // 1. Extract potential entities from query
    const entities = await extractEntitiesFromQuery(embedding);

    // 2. For each entity, perform BFS traversal
    const allStatements: StatementNode[] = [];

    for (const entity of entities) {
      const statements = await bfsTraversal(
        entity.uuid,
        options.maxBfsDepth,
        options.validAt,
        userId,
        options.includeInvalidated,
      );
      allStatements.push(...statements);
    }

    return allStatements;
  } catch (error) {
    logger.error("BFS search error:", { error });
    return [];
  }
}

/**
 * Perform BFS traversal starting from an entity
 */
export async function bfsTraversal(
  startEntityId: string,
  maxDepth: number,
  validAt: Date,
  userId: string,
  includeInvalidated: boolean,
): Promise<StatementNode[]> {
  try {
    // Use Neo4j's built-in path finding capabilities for efficient BFS
    // This query implements BFS up to maxDepth and collects all statements along the way
    const cypher = `
      MATCH (e:Entity {uuid: $startEntityId})<-[:HAS_SUBJECT|HAS_OBJECT|HAS_PREDICATE]-(s:Statement)
      WHERE 
        s.validAt <= $validAt
        AND (s.invalidAt IS NULL OR s.invalidAt > $validAt)
        AND (s.userId = $userId)
        AND ($includeInvalidated OR s.invalidAt IS NULL)
      RETURN s as statement
    `;

    const params = {
      startEntityId,
      maxDepth,
      validAt: validAt.toISOString(),
      userId,
      includeInvalidated,
    };

    const records = await runQuery(cypher, params);
    return records.map(
      (record) => record.get("statement").properties as StatementNode,
    );
  } catch (error) {
    logger.error("BFS traversal error:", { error });
    return [];
  }
}

/**
 * Extract potential entities from a query using embeddings or LLM
 */
export async function extractEntitiesFromQuery(
  embedding: Embedding,
): Promise<EntityNode[]> {
  try {
    // Use vector similarity to find relevant entities
    const cypher = `
        // Match entities using vector similarity on name embeddings
        MATCH (e:Entity)
        WHERE e.nameEmbedding IS NOT NULL
        WITH e, vector.similarity.cosine(e.nameEmbedding, $embedding) AS score
        WHERE score > 0.7
        RETURN e
        ORDER BY score DESC
        LIMIT 3
      `;

    const params = {
      embedding,
    };

    const records = await runQuery(cypher, params);

    return records.map((record) => record.get("e").properties as EntityNode);
  } catch (error) {
    logger.error("Entity extraction error:", { error });
    return [];
  }
}

/**
 * Combine and deduplicate statements from different search methods
 */
export function combineAndDeduplicateStatements(
  statements: StatementNode[],
): StatementNode[] {
  return Array.from(
    new Map(
      statements.map((statement) => [statement.uuid, statement]),
    ).values(),
  );
}
