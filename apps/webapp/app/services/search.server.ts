import {
  type EntityNode,
  type KnowledgeGraphService,
  type StatementNode,
} from "./knowledgeGraph.server";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import HelixDB from "helix-ts";

// Initialize OpenAI for embeddings
const openaiClient = openai("gpt-4.1-2025-04-14");

// Initialize Helix client
const helixClient = new HelixDB();

/**
 * SearchService provides methods to search the reified + temporal knowledge graph
 * using a hybrid approach combining BM25, vector similarity, and BFS traversal.
 */
export class SearchService {
  private knowledgeGraphService: KnowledgeGraphService;

  constructor(knowledgeGraphService: KnowledgeGraphService) {
    this.knowledgeGraphService = knowledgeGraphService;
  }

  async getEmbedding(text: string) {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: text,
    });

    return embedding;
  }

  /**
   * Search the knowledge graph using a hybrid approach
   * @param query The search query
   * @param userId The user ID for personalization
   * @param options Search options
   * @returns Array of relevant statements
   */
  public async search(
    query: string,
    userId: string,
    options: SearchOptions = {},
  ): Promise<StatementNode[]> {
    // Default options
    const opts: Required<SearchOptions> = {
      limit: options.limit || 10,
      maxBfsDepth: options.maxBfsDepth || 4,
      validAt: options.validAt || new Date(),
      includeInvalidated: options.includeInvalidated || false,
      entityTypes: options.entityTypes || [],
      predicateTypes: options.predicateTypes || [],
    };

    // 1. Run parallel search methods
    const [bm25Results, vectorResults, bfsResults] = await Promise.all([
      this.performBM25Search(query, userId, opts),
      this.performVectorSearch(query, userId, opts),
      this.performBfsSearch(query, userId, opts),
    ]);

    // 2. Combine and deduplicate results
    const combinedStatements = this.combineAndDeduplicate([
      ...bm25Results,
      ...vectorResults,
      ...bfsResults,
    ]);

    // 3. Rerank the combined results
    const rerankedStatements = await this.rerankStatements(
      query,
      combinedStatements,
      opts,
    );

    // 4. Return top results
    return rerankedStatements.slice(0, opts.limit);
  }

  /**
   * Perform BM25 keyword-based search on statements
   */
  private async performBM25Search(
    query: string,
    userId: string,
    options: Required<SearchOptions>,
  ): Promise<StatementNode[]> {
    // TODO: Implement BM25 search using HelixDB or external search index
    // This is a placeholder implementation
    try {
      const results = await helixClient.query("searchStatementsByKeywords", {
        query,
        userId,
        validAt: options.validAt.toISOString(),
        includeInvalidated: options.includeInvalidated,
        limit: options.limit * 2, // Fetch more for reranking
      });

      return results.statements || [];
    } catch (error) {
      console.error("BM25 search error:", error);
      return [];
    }
  }

  /**
   * Perform vector similarity search on statement embeddings
   */
  private async performVectorSearch(
    query: string,
    userId: string,
    options: Required<SearchOptions>,
  ): Promise<StatementNode[]> {
    try {
      // 1. Generate embedding for the query
      const embedding = await this.generateEmbedding(query);

      // 2. Search for similar statements
      const results = await helixClient.query("searchStatementsByVector", {
        embedding,
        userId,
        validAt: options.validAt.toISOString(),
        includeInvalidated: options.includeInvalidated,
        limit: options.limit * 2, // Fetch more for reranking
      });

      return results.statements || [];
    } catch (error) {
      console.error("Vector search error:", error);
      return [];
    }
  }

  /**
   * Perform BFS traversal starting from entities mentioned in the query
   */
  private async performBfsSearch(
    query: string,
    userId: string,
    options: Required<SearchOptions>,
  ): Promise<StatementNode[]> {
    try {
      // 1. Extract potential entities from query
      const entities = await this.extractEntitiesFromQuery(query);

      // 2. For each entity, perform BFS traversal
      const allStatements: StatementNode[] = [];

      for (const entity of entities) {
        const statements = await this.bfsTraversal(
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
      console.error("BFS search error:", error);
      return [];
    }
  }

  /**
   * Perform BFS traversal starting from an entity
   */
  private async bfsTraversal(
    startEntityId: string,
    maxDepth: number,
    validAt: Date,
    userId: string,
    includeInvalidated: boolean,
  ): Promise<StatementNode[]> {
    // Track visited nodes to avoid cycles
    const visited = new Set<string>();
    // Track statements found during traversal
    const statements: StatementNode[] = [];
    // Queue for BFS traversal [nodeId, depth]
    const queue: [string, number][] = [[startEntityId, 0]];

    while (queue.length > 0) {
      const [nodeId, depth] = queue.shift()!;

      // Skip if already visited or max depth reached
      if (visited.has(nodeId) || depth > maxDepth) continue;
      visited.add(nodeId);

      // Get statements where this entity is subject or object
      const connectedStatements = await helixClient.query(
        "getConnectedStatements",
        {
          entityId: nodeId,
          userId,
          validAt: validAt.toISOString(),
          includeInvalidated,
        },
      );

      // Add statements to results
      if (connectedStatements.statements) {
        statements.push(...connectedStatements.statements);

        // Add connected entities to queue
        for (const statement of connectedStatements.statements) {
          // Get subject and object entities
          if (statement.subjectId && !visited.has(statement.subjectId)) {
            queue.push([statement.subjectId, depth + 1]);
          }
          if (statement.objectId && !visited.has(statement.objectId)) {
            queue.push([statement.objectId, depth + 1]);
          }
        }
      }
    }

    return statements;
  }

  /**
   * Extract potential entities from a query using embeddings or LLM
   */
  private async extractEntitiesFromQuery(query: string): Promise<EntityNode[]> {
    // TODO: Implement more sophisticated entity extraction
    // This is a placeholder implementation that uses simple vector search
    try {
      const embedding = await this.getEmbedding(query);

      const results = await helixClient.query("searchEntitiesByVector", {
        embedding,
        limit: 3, // Start with top 3 entities
      });

      return results.entities || [];
    } catch (error) {
      console.error("Entity extraction error:", error);
      return [];
    }
  }

  /**
   * Combine and deduplicate statements from multiple sources
   */
  private combineAndDeduplicate(statements: StatementNode[]): StatementNode[] {
    const uniqueStatements = new Map<string, StatementNode>();

    for (const statement of statements) {
      if (!uniqueStatements.has(statement.uuid)) {
        uniqueStatements.set(statement.uuid, statement);
      }
    }

    return Array.from(uniqueStatements.values());
  }

  /**
   * Rerank statements based on relevance to the query
   */
  private async rerankStatements(
    query: string,
    statements: StatementNode[],
    options: Required<SearchOptions>,
  ): Promise<StatementNode[]> {
    // TODO: Implement more sophisticated reranking
    // This is a placeholder implementation using cosine similarity
    try {
      // 1. Generate embedding for the query
      const queryEmbedding = await this.getEmbedding(query);

      // 2. Generate or retrieve embeddings for statements
      const statementEmbeddings = await Promise.all(
        statements.map(async (statement) => {
          // If statement has embedding, use it; otherwise generate
          if (statement.factEmbedding && statement.factEmbedding.length > 0) {
            return { statement, embedding: statement.factEmbedding };
          }

          // Generate text representation of statement
          const statementText = this.statementToText(statement);
          const embedding = await this.getEmbedding(statementText);

          return { statement, embedding };
        }),
      );

      // 3. Calculate cosine similarity
      const scoredStatements = statementEmbeddings.map(
        ({ statement, embedding }) => {
          const similarity = this.cosineSimilarity(queryEmbedding, embedding);
          return { statement, score: similarity };
        },
      );

      // 4. Sort by score (descending)
      scoredStatements.sort((a, b) => b.score - a.score);

      // 5. Return statements in order of relevance
      return scoredStatements.map(({ statement }) => statement);
    } catch (error) {
      console.error("Reranking error:", error);
      // Fallback: return original order
      return statements;
    }
  }

  /**
   * Convert a statement to a text representation
   */
  private statementToText(statement: StatementNode): string {
    // TODO: Implement more sophisticated text representation
    // This is a placeholder implementation
    return `${statement.subjectName || "Unknown"} ${statement.predicateName || "has relation with"} ${statement.objectName || "Unknown"}`;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

/**
 * Search options interface
 */
export interface SearchOptions {
  limit?: number;
  maxBfsDepth?: number;
  validAt?: Date;
  includeInvalidated?: boolean;
  entityTypes?: string[];
  predicateTypes?: string[];
}

/**
 * Create a singleton instance of the search service
 */
let searchServiceInstance: SearchService | null = null;

export function getSearchService(
  knowledgeGraphService?: KnowledgeGraphService,
): SearchService {
  if (!searchServiceInstance) {
    if (!knowledgeGraphService) {
      throw new Error(
        "KnowledgeGraphService must be provided when initializing SearchService",
      );
    }
    searchServiceInstance = new SearchService(knowledgeGraphService);
  }
  return searchServiceInstance;
}
