import { type ModelMessage } from "ai";
import {
  type ExtractedTripleData,
  type AddEpisodeParams,
  type EntityNode,
  type EpisodicNode,
  type StatementNode,
  type Triple,
  EpisodeTypeEnum,
  type EpisodeType,
} from "@core/types";
import { logger } from "./logger.service";
import { ClusteringService } from "./clustering.server";
import crypto from "crypto";
import {
  dedupeNodes,
  extractAttributes,
  extractEntities,
} from "./prompts/nodes";
import {
  extractStatements,
  extractStatementsOSS,
  resolveStatementPrompt,
} from "./prompts/statements";
import {
  getEpisodeStatements,
  getRecentEpisodes,
  searchEpisodesByEmbedding,
} from "./graphModels/episode";
import {
  findExactPredicateMatches,
  findSimilarEntities,
} from "./graphModels/entity";
import {
  findContradictoryStatements,
  findSimilarStatements,
  findStatementsWithSameSubjectObject,
  getTripleForStatement,
  invalidateStatements,
  saveTriple,
  searchStatementsByEmbedding,
} from "./graphModels/statement";
import { getEmbedding, makeModelCall, isProprietaryModel } from "~/lib/model.server";
import { runQuery } from "~/lib/neo4j.server";
import { Apps, getNodeTypesString } from "~/utils/presets/nodes";
import { normalizePrompt, normalizeDocumentPrompt } from "./prompts";
import { type PrismaClient } from "@prisma/client";

// Default number of previous episodes to retrieve for context
const DEFAULT_EPISODE_WINDOW = 5;

export class KnowledgeGraphService {
  private clusteringService: ClusteringService;

  constructor() {
    this.clusteringService = new ClusteringService();
  }

  async getEmbedding(text: string) {
    return getEmbedding(text);
  }

  /**
   * Invalidate statements from a previous document version that are no longer supported
   * by the new document content using semantic similarity analysis
   */
  async invalidateStatementsFromPreviousDocumentVersion(params: {
    previousDocumentUuid: string;
    newDocumentContent: string;
    userId: string;
    invalidatedBy: string;
    semanticSimilarityThreshold?: number;
  }): Promise<{
    invalidatedStatements: string[];
    preservedStatements: string[];
    totalStatementsAnalyzed: number;
  }> {
    const threshold = params.semanticSimilarityThreshold || 0.75; // Lower threshold for document-level analysis
    const invalidatedStatements: string[] = [];
    const preservedStatements: string[] = [];

    // Step 1: Get all statements from the previous document version
    const previousStatements = await this.getStatementsFromDocument(
      params.previousDocumentUuid,
      params.userId,
    );

    if (previousStatements.length === 0) {
      return {
        invalidatedStatements: [],
        preservedStatements: [],
        totalStatementsAnalyzed: 0,
      };
    }

    logger.log(
      `Analyzing ${previousStatements.length} statements from previous document version`,
    );

    // Step 2: Generate embedding for new document content
    const newDocumentEmbedding = await this.getEmbedding(
      params.newDocumentContent,
    );

    // Step 3: For each statement, check if it's still semantically supported by new content
    for (const statement of previousStatements) {
      try {
        // Generate embedding for the statement fact
        const statementEmbedding = await this.getEmbedding(statement.fact);

        // Calculate semantic similarity between statement and new document
        const semanticSimilarity = this.calculateCosineSimilarity(
          statementEmbedding,
          newDocumentEmbedding,
        );

        if (semanticSimilarity < threshold) {
          invalidatedStatements.push(statement.uuid);
          logger.log(
            `Invalidating statement: "${statement.fact}" (similarity: ${semanticSimilarity.toFixed(3)})`,
          );
        } else {
          preservedStatements.push(statement.uuid);
          logger.log(
            `Preserving statement: "${statement.fact}" (similarity: ${semanticSimilarity.toFixed(3)})`,
          );
        }
      } catch (error) {
        logger.error(`Error analyzing statement ${statement.uuid}:`, { error });
        // On error, be conservative and invalidate
        invalidatedStatements.push(statement.uuid);
      }
    }

    // Step 4: Bulk invalidate the selected statements
    if (invalidatedStatements.length > 0) {
      await invalidateStatements({
        statementIds: invalidatedStatements,
        invalidatedBy: params.invalidatedBy,
      });

      logger.log(`Document-level invalidation completed`, {
        previousDocumentUuid: params.previousDocumentUuid,
        totalAnalyzed: previousStatements.length,
        invalidated: invalidatedStatements.length,
        preserved: preservedStatements.length,
        threshold,
      });
    }

    return {
      invalidatedStatements,
      preservedStatements,
      totalStatementsAnalyzed: previousStatements.length,
    };
  }

  /**
   * Get all statements that were created from episodes linked to a specific document
   */
  private async getStatementsFromDocument(
    documentUuid: string,
    userId: string,
  ): Promise<StatementNode[]> {
    const query = `
      MATCH (doc:Document {uuid: $documentUuid, userId: $userId})-[:CONTAINS_CHUNK]->(episode:Episode)
      MATCH (episode)-[:HAS_PROVENANCE]->(stmt:Statement)
      RETURN stmt
    `;

    const result = await runQuery(query, {
      documentUuid,
      userId,
    });

    return result.map((record) => {
      const stmt = record.get("stmt").properties;
      return {
        uuid: stmt.uuid,
        fact: stmt.fact,
        factEmbedding: stmt.factEmbedding || [],
        createdAt: new Date(stmt.createdAt),
        validAt: new Date(stmt.validAt),
        invalidAt: stmt.invalidAt ? new Date(stmt.invalidAt) : null,
        attributes: stmt.attributesJson ? JSON.parse(stmt.attributesJson) : {},
        userId: stmt.userId,
      };
    });
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vector dimensions must match");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Process an episode and update the knowledge graph.
   *
   * This method extracts information from the episode, creates nodes and statements,
   * and updates the HelixDB database according to the reified + temporal approach.
   */
  async addEpisode(
    params: AddEpisodeParams,
    prisma: PrismaClient,
  ): Promise<{
    episodeUuid: string | null;
    statementsCreated: number;
    processingTimeMs: number;
    tokenUsage?: {
      high: { input: number; output: number; total: number };
      low: { input: number; output: number; total: number };
    };
  }> {
    const startTime = Date.now();
    const now = new Date();

    // Track token usage by complexity
    const tokenMetrics = {
      high: { input: 0, output: 0, total: 0 },
      low: { input: 0, output: 0, total: 0 },
    };

    try {
      // Step 1: Context Retrieval - Get previous episodes for context
      const previousEpisodes = await getRecentEpisodes({
        referenceTime: params.referenceTime,
        limit: DEFAULT_EPISODE_WINDOW,
        userId: params.userId,
        source: params.source,
        sessionId: params.sessionId,
      });

      // Format session context from previous episodes
      const sessionContext =
        params.sessionId && previousEpisodes.length > 0
          ? previousEpisodes
              .map(
                (ep, i) =>
                  `Episode ${i + 1} (${ep.createdAt.toISOString()}): ${ep.content}`,
              )
              .join("\n\n")
          : undefined;

      const normalizedEpisodeBody = await this.normalizeEpisodeBody(
        params.episodeBody,
        params.source,
        params.userId,
        prisma,
        tokenMetrics,
        new Date(params.referenceTime),
        sessionContext,
        params.type,
      );

      const normalizedTime = Date.now();
      logger.log(`Normalized episode body in ${normalizedTime - startTime} ms`);

      if (normalizedEpisodeBody === "NOTHING_TO_REMEMBER") {
        logger.log("Nothing to remember");
        return {
          episodeUuid: null,
          statementsCreated: 0,
          processingTimeMs: 0,
        };
      }

      // Step 2: Episode Creation - Create or retrieve the episode
      const episode: EpisodicNode = {
        uuid: crypto.randomUUID(),
        content: normalizedEpisodeBody,
        originalContent: params.episodeBody,
        contentEmbedding: await this.getEmbedding(normalizedEpisodeBody),
        source: params.source,
        metadata: params.metadata || {},
        createdAt: now,
        validAt: new Date(params.referenceTime),
        labels: [],
        userId: params.userId,
        space: params.spaceId,
        sessionId: params.sessionId,
      };

      // Step 3: Entity Extraction - Extract entities from the episode content
      const extractedNodes = await this.extractEntities(
        episode,
        previousEpisodes,
        tokenMetrics,
      );

      console.log(extractedNodes.map((node) => node.name));

      const extractedTime = Date.now();
      logger.log(`Extracted entities in ${extractedTime - normalizedTime} ms`);

      // Step 3.1: Simple entity categorization (no type-based expansion needed)
      const categorizedEntities = {
        primary: extractedNodes,
        expanded: [], // No expansion needed with type-free approach
      };

      const expandedTime = Date.now();
      logger.log(`Processed entities in ${expandedTime - extractedTime} ms`);

      // Step 4: Statement Extrraction - Extract statements (triples) instead of direct edges
      const extractedStatements = await this.extractStatements(
        episode,
        categorizedEntities,
        previousEpisodes,
        tokenMetrics,
      );

      const extractedStatementsTime = Date.now();
      logger.log(
        `Extracted statements in ${extractedStatementsTime - expandedTime} ms`,
      );

      // Step 5: Entity Resolution - Resolve extracted nodes to existing nodes or create new ones
      const resolvedTriples = await this.resolveExtractedNodes(
        extractedStatements,
        episode,
        previousEpisodes,
        tokenMetrics,
      );

      const resolvedTriplesTime = Date.now();
      logger.log(
        `Resolved Entities in ${resolvedTriplesTime - extractedStatementsTime} ms`,
      );

      // Step 6: Statement Resolution - Resolve statements and detect contradictions
      const { resolvedStatements, invalidatedStatements } =
        await this.resolveStatements(
          resolvedTriples,
          episode,
          previousEpisodes,
          tokenMetrics,
        );

      const resolvedStatementsTime = Date.now();
      logger.log(
        `Resolved statements in ${resolvedStatementsTime - resolvedTriplesTime} ms`,
      );

      // Step 7: ADd attributes to entity nodes
      // const updatedTriples = await this.addAttributesToEntities(
      //   resolvedStatements,
      //   episode,
      // );

      const updatedTriples = resolvedStatements;

      const updatedTriplesTime = Date.now();
      logger.log(
        `Updated triples in ${updatedTriplesTime - resolvedStatementsTime} ms`,
      );

      for (const triple of updatedTriples) {
        const { subject, predicate, object, statement, provenance } = triple;
        const safeTriple = {
          subject: {
            ...subject,
            nameEmbedding: undefined,
            typeEmbedding: undefined,
          },
          predicate: {
            ...predicate,
            nameEmbedding: undefined,
            typeEmbedding: undefined,
          },
          object: {
            ...object,
            nameEmbedding: undefined,
            typeEmbedding: undefined,
          },
          statement: { ...statement, factEmbedding: undefined },
          provenance: { ...provenance, contentEmbedding: undefined },
        };
      }

      // Process triples sequentially to avoid race conditions
      for (const triple of updatedTriples) {
        await saveTriple(triple);
      }

      const saveTriplesTime = Date.now();
      logger.log(`Saved triples in ${saveTriplesTime - updatedTriplesTime} ms`);

      // Invalidate invalidated statements
      await invalidateStatements({
        statementIds: invalidatedStatements,
        invalidatedBy: episode.uuid,
      });

      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;
      logger.log(`Processing time: ${processingTimeMs} ms`);

      // Count only truly new statements (exclude duplicates)
      const newStatementsCount = updatedTriples.filter(triple =>
        triple.statement.createdAt >= episode.createdAt
      ).length;

      return {
        episodeUuid: episode.uuid,
        // nodesCreated: hydratedNodes.length,
        statementsCreated: newStatementsCount,
        processingTimeMs,
        tokenUsage: tokenMetrics,
      };
    } catch (error) {
      console.error("Error in addEpisode:", error);
      throw error;
    }
  }

  /**
   * Extract entities from an episode using LLM
   */
  private async extractEntities(
    episode: EpisodicNode,
    previousEpisodes: EpisodicNode[],
    tokenMetrics: { high: { input: number; output: number; total: number }; low: { input: number; output: number; total: number } },
  ): Promise<EntityNode[]> {
    // Use the prompt library to get the appropriate prompts
    const context = {
      episodeContent: episode.content,
      previousEpisodes: previousEpisodes.map((ep) => ({
        content: ep.content,
        createdAt: ep.createdAt.toISOString(),
      })),
    };

    // Get the unified entity extraction prompt
    const extractionMode = episode.sessionId ? "conversation" : "document";
    const messages = extractEntities(context, extractionMode);

    let responseText = "";

    // Entity extraction requires HIGH complexity (creative reasoning, nuanced NER)
    await makeModelCall(false, messages as ModelMessage[], (text, _model, usage) => {
      responseText = text;
      if (usage) {
        tokenMetrics.high.input += usage.inputTokens;
        tokenMetrics.high.output += usage.outputTokens;
        tokenMetrics.high.total += usage.totalTokens;
      }
    }, undefined, 'high');

    // Convert to EntityNode objects
    let entities: EntityNode[] = [];

    const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);

    if (outputMatch && outputMatch[1]) {
      responseText = outputMatch[1].trim();
      const parsedResponse = JSON.parse(responseText || "[]");
      // Handle both old format {entities: [...]} and new format [...]
      const extractedEntities = Array.isArray(parsedResponse) ? parsedResponse : (parsedResponse.entities || []);

      // Batch generate embeddings for entity names
      const entityNames = Array.isArray(extractedEntities[0]) ? extractedEntities : extractedEntities.map((entity: any) => entity.name || entity);
      const nameEmbeddings = await Promise.all(
        entityNames.map((name: string) => this.getEmbedding(name)),
      );

      entities = extractedEntities.map((entity: any, index: number) => ({
        uuid: crypto.randomUUID(),
        name: typeof entity === 'string' ? entity : entity.name,
        type: undefined, // Type will be inferred from statements
        attributes: typeof entity === 'string' ? {} : (entity.attributes || {}),
        nameEmbedding: nameEmbeddings[index],
        typeEmbedding: undefined, // No type embedding needed
        createdAt: new Date(),
        userId: episode.userId,
      }));
    }

    return entities;
  }

  /**
   * Extract statements as first-class objects from an episode using LLM
   * This replaces the previous extractEdges method with a reified approach
   */
  private async extractStatements(
    episode: EpisodicNode,
    categorizedEntities: {
      primary: EntityNode[];
      expanded: EntityNode[];
    },
    previousEpisodes: EpisodicNode[],
    tokenMetrics: { high: { input: number; output: number; total: number }; low: { input: number; output: number; total: number } },
  ): Promise<Triple[]> {
    // Use the prompt library to get the appropriate prompts
    const context = {
      episodeContent: episode.content,
      previousEpisodes: previousEpisodes.map((ep) => ({
        content: ep.content,
        createdAt: ep.createdAt.toISOString(),
      })),
      entities: {
        primary: categorizedEntities.primary.map((node) => ({
          name: node.name,
          type: node.type,
        })),
        expanded: categorizedEntities.expanded.map((node) => ({
          name: node.name,
          type: node.type,
        })),
      },
      referenceTime: episode.validAt.toISOString(),
    };

    console.log("proprietary model", isProprietaryModel(undefined, 'high'));
    // Statement extraction requires HIGH complexity (causal reasoning, emotional context)
    // Choose between proprietary and OSS prompts based on model type
    const messages = isProprietaryModel(undefined, 'high')
      ? extractStatements(context)
      : extractStatementsOSS(context);

    let responseText = "";
    await makeModelCall(false, messages as ModelMessage[], (text, _model, usage) => {
      responseText = text;
      if (usage) {
        tokenMetrics.high.input += usage.inputTokens;
        tokenMetrics.high.output += usage.outputTokens;
        tokenMetrics.high.total += usage.totalTokens;
      }
    }, undefined, 'high');

    const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);
    if (outputMatch && outputMatch[1]) {
      responseText = outputMatch[1].trim();
    } else {
      responseText = "{}";
    }

    // Parse the statements from the LLM response
    const parsedResponse = JSON.parse(responseText || "[]");
    // Handle both old format {"edges": [...]} and new format [...]
    const extractedTriples: ExtractedTripleData[] = Array.isArray(parsedResponse)
      ? parsedResponse
      : (parsedResponse.edges || []);

    console.log(`extracted triples length: ${extractedTriples.length}`);

    // Create maps to deduplicate entities by name within this extraction
    const predicateMap = new Map<string, EntityNode>();

    // First pass: collect all unique predicates from the current extraction
    for (const triple of extractedTriples) {
      const predicateName = triple.predicate.toLowerCase();
      if (!predicateMap.has(predicateName)) {
        // Create new predicate (embedding will be generated later in batch)
        const newPredicate = {
          uuid: crypto.randomUUID(),
          name: triple.predicate,
          type: "Predicate",
          attributes: {},
          nameEmbedding: null as any, // Will be filled later
          typeEmbedding: null as any, // Will be filled later
          createdAt: new Date(),
          userId: episode.userId,
        };
        predicateMap.set(predicateName, newPredicate);
      }
    }

    // Combine primary and expanded entities for entity matching
    const allEntities = [
      ...categorizedEntities.primary,
      ...categorizedEntities.expanded,
    ];

    // Batch generate embeddings for predicates and facts
    const uniquePredicates = Array.from(predicateMap.values());
    const factTexts = extractedTriples.map((t) => t.fact);
    const predicateNames = uniquePredicates.map((p) => p.name);

    const [predicateNameEmbeddings, predicateTypeEmbeddings, factEmbeddings] =
      await Promise.all([
        Promise.all(predicateNames.map((name) => this.getEmbedding(name))),
        Promise.all(predicateNames.map(() => this.getEmbedding("Predicate"))),
        Promise.all(factTexts.map((fact) => this.getEmbedding(fact))),
      ]);

    // Update predicate embeddings
    uniquePredicates.forEach((predicate, index) => {
      predicate.nameEmbedding = predicateNameEmbeddings[index];
      predicate.typeEmbedding = predicateTypeEmbeddings[index];
    });

    // Convert extracted triples to Triple objects with Statement nodes
    const triples = extractedTriples.map(
      (triple: ExtractedTripleData, tripleIndex: number) => {
        // Find the subject and object nodes by matching name (type-free approach)
        const subjectNode = allEntities.find(
          (node) => node.name.toLowerCase() === triple.source.toLowerCase(),
        );

        const objectNode = allEntities.find(
          (node) => node.name.toLowerCase() === triple.target.toLowerCase(),
        );

        // Get the deduplicated predicate node
        const predicateNode = predicateMap.get(triple.predicate.toLowerCase());

        if (subjectNode && objectNode && predicateNode) {
          // Determine the correct validAt date (when the fact actually occurred/occurs)
          let validAtDate = episode.validAt; // Default fallback to episode date

          // Check if statement has event_date indicating when the fact actually happened/happens
          if (triple.attributes?.event_date) {
            try {
              const eventDate = new Date(triple.attributes.event_date);
              // Use the event date as validAt (when the fact is actually true)
              if (!isNaN(eventDate.getTime())) {
                validAtDate = eventDate;
              }
            } catch (error) {
              // If parsing fails, use episode validAt as fallback
              logger.log(
                `Failed to parse event_date: ${triple.attributes.event_date}, using episode validAt`,
              );
            }
          }

          // Create a statement node
          const statement: StatementNode = {
            uuid: crypto.randomUUID(),
            fact: triple.fact,
            factEmbedding: factEmbeddings[tripleIndex],
            createdAt: new Date(),
            validAt: validAtDate,
            invalidAt: null,
            attributes: triple.attributes || {},
            userId: episode.userId,
          };

          return {
            statement,
            subject: subjectNode,
            predicate: predicateNode,
            object: objectNode,
            provenance: episode,
          };
        }
        return null;
      },
    );

    // Filter out null values (where subject or object wasn't found)
    return triples.filter(Boolean) as Triple[];
  }

  /**
   * Resolve extracted nodes to existing nodes or create new ones
   */
  private async resolveExtractedNodes(
    triples: Triple[],
    episode: EpisodicNode,
    previousEpisodes: EpisodicNode[],
    tokenMetrics: { high: { input: number; output: number; total: number }; low: { input: number; output: number; total: number } },
  ): Promise<Triple[]> {
    // Step 1: Extract unique entities from triples
    const uniqueEntitiesMap = new Map<string, EntityNode>();
    const entityIdToPositions = new Map<
      string,
      Array<{
        tripleIndex: number;
        position: "subject" | "predicate" | "object";
      }>
    >();

    // First pass: collect all unique entities and their positions in triples
    triples.forEach((triple, tripleIndex) => {
      // Process subject
      if (!uniqueEntitiesMap.has(triple.subject.uuid)) {
        uniqueEntitiesMap.set(triple.subject.uuid, triple.subject);
      }
      if (!entityIdToPositions.has(triple.subject.uuid)) {
        entityIdToPositions.set(triple.subject.uuid, []);
      }
      entityIdToPositions.get(triple.subject.uuid)!.push({
        tripleIndex,
        position: "subject",
      });

      // Process predicate
      if (!uniqueEntitiesMap.has(triple.predicate.uuid)) {
        uniqueEntitiesMap.set(triple.predicate.uuid, triple.predicate);
      }
      if (!entityIdToPositions.has(triple.predicate.uuid)) {
        entityIdToPositions.set(triple.predicate.uuid, []);
      }
      entityIdToPositions.get(triple.predicate.uuid)!.push({
        tripleIndex,
        position: "predicate",
      });

      // Process object
      if (!uniqueEntitiesMap.has(triple.object.uuid)) {
        uniqueEntitiesMap.set(triple.object.uuid, triple.object);
      }
      if (!entityIdToPositions.has(triple.object.uuid)) {
        entityIdToPositions.set(triple.object.uuid, []);
      }
      entityIdToPositions.get(triple.object.uuid)!.push({
        tripleIndex,
        position: "object",
      });
    });

    // Convert to arrays for processing
    const uniqueEntities = Array.from(uniqueEntitiesMap.values());

    // Separate predicates from other entities
    const predicates = uniqueEntities.filter(
      (entity) => entity.type === "Predicate",
    );
    const nonPredicates = uniqueEntities.filter(
      (entity) => entity.type !== "Predicate",
    );

    // Step 2a: Find similar entities for non-predicate entities
    const similarEntitiesResults = await Promise.all(
      nonPredicates.map(async (entity) => {
        const similarEntities = await findSimilarEntities({
          queryEmbedding: entity.nameEmbedding,
          limit: 5,
          threshold: 0.7,
          userId: episode.userId,
        });
        return {
          entity,
          similarEntities,
        };
      }),
    );

    // Step 2b: Find exact matches for predicates
    const exactPredicateResults = await Promise.all(
      predicates.map(async (predicate) => {
        const exactMatches = await findExactPredicateMatches({
          predicateName: predicate.name,
          userId: episode.userId,
        });

        // Filter out the current predicate from matches
        const filteredMatches = exactMatches.filter(
          (match) => match.uuid !== predicate.uuid,
        );

        return {
          entity: predicate,
          similarEntities: filteredMatches, // Use the same structure as similarEntitiesResults
        };
      }),
    );

    // Combine the results
    const allEntityResults = [
      ...similarEntitiesResults,
      ...exactPredicateResults,
    ];

    // Step 3: Prepare context for LLM deduplication
    const dedupeContext = {
      extracted_nodes: allEntityResults.map((result, index) => ({
        id: index,
        name: result.entity.name,
        entity_type: result.entity.type,
        duplication_candidates: result.similarEntities.map((candidate, j) => ({
          idx: j,
          name: candidate.name,
          entity_type: candidate.type,
        })),
      })),
      episode_content: episode ? episode.content : "",
      previous_episodes: previousEpisodes
        ? previousEpisodes.map((ep) => ep.content)
        : [],
    };

    // Step 4: Call LLM to resolve duplicates
    const messages = dedupeNodes(dedupeContext);
    let responseText = "";

    // Entity deduplication is LOW complexity (pattern matching, similarity comparison)
    await makeModelCall(false, messages as ModelMessage[], (text, _model, usage) => {
      responseText = text;
      if (usage) {
        tokenMetrics.low.input += usage.inputTokens;
        tokenMetrics.low.output += usage.outputTokens;
        tokenMetrics.low.total += usage.totalTokens;
      }
    }, undefined, 'low');

    // Step 5: Process LLM response
    const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);
    if (!outputMatch || !outputMatch[1]) {
      return triples; // Return original if parsing fails
    }

    try {
      responseText = outputMatch[1].trim();
      const parsedResponse = JSON.parse(responseText);
      const nodeResolutions = parsedResponse.entity_resolutions || [];

      // Step 6: Create mapping from original entity UUID to resolved entity
      const entityResolutionMap = new Map<string, EntityNode>();

      nodeResolutions.forEach((resolution: any, index: number) => {
        const originalEntity = allEntityResults[resolution.id ?? index];
        if (!originalEntity) return;

        const duplicateIdx = resolution.duplicate_idx ?? -1;

        // Get the corresponding result from allEntityResults
        const resultEntry = allEntityResults.find(
          (result) => result.entity.uuid === originalEntity.entity.uuid,
        );

        if (!resultEntry) return;

        // If a duplicate was found, use that entity, otherwise keep original
        const resolvedEntity =
          duplicateIdx >= 0 && duplicateIdx < resultEntry.similarEntities.length
            ? resultEntry.similarEntities[duplicateIdx]
            : originalEntity.entity;

        // Update name if provided
        if (resolution.name) {
          resolvedEntity.name = resolution.name;
        }

        // Map original UUID to resolved entity
        entityResolutionMap.set(originalEntity.entity.uuid, resolvedEntity);
      });

      // Step 7: Reconstruct triples with resolved entities
      const resolvedTriples = triples.map((triple) => {
        const newTriple = { ...triple };

        // Replace subject if resolved
        if (entityResolutionMap.has(triple.subject.uuid)) {
          newTriple.subject = entityResolutionMap.get(triple.subject.uuid)!;
        }

        // Replace predicate if resolved
        if (entityResolutionMap.has(triple.predicate.uuid)) {
          newTriple.predicate = entityResolutionMap.get(triple.predicate.uuid)!;
        }

        // Replace object if resolved
        if (entityResolutionMap.has(triple.object.uuid)) {
          newTriple.object = entityResolutionMap.get(triple.object.uuid)!;
        }

        return newTriple;
      });

      return resolvedTriples;
    } catch (error) {
      console.error("Error processing entity resolutions:", error);
      return triples; // Return original triples on error
    }
  }

  /**
   * Resolve statements by checking for existing statements and handling contradictions
   * This replaces the previous resolveExtractedEdges method with a reified approach
   */
  private async resolveStatements(
    triples: Triple[],
    episode: EpisodicNode,
    previousEpisodes: EpisodicNode[],
    tokenMetrics: { high: { input: number; output: number; total: number }; low: { input: number; output: number; total: number } },
  ): Promise<{
    resolvedStatements: Triple[];
    invalidatedStatements: string[];
  }> {
    const resolvedStatements: Triple[] = [];
    const invalidatedStatements: string[] = [];

    if (triples.length === 0) {
      return { resolvedStatements, invalidatedStatements };
    }

    // Step 1: Collect all potential matches for all triples at once
    const allPotentialMatches: Map<string, Omit<StatementNode, "factEmbedding">[]> = new Map();
    const allExistingTripleData: Map<string, Triple> = new Map();

    // For preparing the LLM context
    const newStatements: any[] = [];
    const similarStatements: any[] = [];

    for (const triple of triples) {
      // Track IDs of statements we've already checked to avoid duplicates
      const checkedStatementIds: string[] = [];
      let potentialMatches: Omit<StatementNode, "factEmbedding">[] = [];

      // Phase 1a: Find statements with exact subject-predicate match
      // Example: "John lives_in New York" vs "John lives_in San Francisco"
      const exactMatches = await findContradictoryStatements({
        subjectId: triple.subject.uuid,
        predicateId: triple.predicate.uuid,
        userId: triple.provenance.userId,
      });

      if (exactMatches && exactMatches.length > 0) {
        potentialMatches.push(...exactMatches);
        checkedStatementIds.push(...exactMatches.map((s) => s.uuid));
      }

      // Phase 1b: Find statements with same subject-object but different predicates
      // Example: "John is_married_to Sarah" vs "John is_divorced_from Sarah"
      const subjectObjectMatches = await findStatementsWithSameSubjectObject({
        subjectId: triple.subject.uuid,
        objectId: triple.object.uuid,
        excludePredicateId: triple.predicate.uuid,
        userId: triple.provenance.userId,
      });

      if (subjectObjectMatches && subjectObjectMatches.length > 0) {
        // Filter out statements we've already checked
        const newSubjectObjectMatches = subjectObjectMatches.filter(
          (match) => !checkedStatementIds.includes(match.uuid),
        );
        if (newSubjectObjectMatches.length > 0) {
          potentialMatches.push(...newSubjectObjectMatches);
          checkedStatementIds.push(
            ...newSubjectObjectMatches.map((s) => s.uuid),
          );
        }
      }

      // Phase 2: Find semantically similar statements
      const semanticMatches = await findSimilarStatements({
        factEmbedding: triple.statement.factEmbedding,
        threshold: 0.85,
        excludeIds: checkedStatementIds,
        userId: triple.provenance.userId,
      });

      if (semanticMatches && semanticMatches.length > 0) {
        potentialMatches.push(...semanticMatches);
      }

      // Phase 3: Check related memories for contradictory statements
      const previousEpisodesStatements: Omit<StatementNode, "factEmbedding">[] = [];

      await Promise.all(
        previousEpisodes.map(async (episode) => {
          const statements = await getEpisodeStatements({
            episodeUuid: episode.uuid,
            userId: episode.userId,
          });
          previousEpisodesStatements.push(...statements);
        }),
      );

      if (previousEpisodesStatements && previousEpisodesStatements.length > 0) {
        // Filter out facts we've already checked
        const newRelatedFacts = previousEpisodesStatements
          .flat()
          .filter((fact) => !checkedStatementIds.includes(fact.uuid));

        if (newRelatedFacts.length > 0) {
          potentialMatches.push(...newRelatedFacts);
        }
      }

      if (potentialMatches.length > 0) {
        logger.info(
          `Found ${potentialMatches.length} potential matches for: ${triple.statement.fact}`,
        );

        allPotentialMatches.set(triple.statement.uuid, potentialMatches);

        // Get full triple information for each potential match
        for (const match of potentialMatches) {
          if (!allExistingTripleData.has(match.uuid)) {
            const existingTripleData = await getTripleForStatement({
              statementId: match.uuid,
            });

            if (existingTripleData) {
              allExistingTripleData.set(match.uuid, existingTripleData);

              // Add to similarStatements for LLM context
              similarStatements.push({
                statementId: match.uuid,
                fact: existingTripleData.statement.fact,
                subject: existingTripleData.subject.name,
                predicate: existingTripleData.predicate.name,
                object: existingTripleData.object.name,
              });
            }
          }
        }
      }

      // Add to newStatements for LLM context
      newStatements.push({
        statement: {
          uuid: triple.statement.uuid,
          fact: triple.statement.fact,
        },
        subject: triple.subject.name,
        predicate: triple.predicate.name,
        object: triple.object.name,
      });
    }

    // Step 2: If we have potential matches, use the LLM to analyze them in batch
    if (similarStatements.length > 0) {
      // Prepare context for the LLM
      const promptContext = {
        newStatements,
        similarStatements,
        episodeContent: episode.content,
        referenceTime: episode.validAt.toISOString(),
      };

      // Get the statement resolution prompt
      const messages = resolveStatementPrompt(promptContext);

      let responseText = "";

      // Statement resolution is LOW complexity (rule-based duplicate/contradiction detection)
      await makeModelCall(false, messages, (text, _model, usage) => {
        responseText = text;
          if (usage) {
            tokenMetrics.low.input += usage.inputTokens;
            tokenMetrics.low.output += usage.outputTokens;
            tokenMetrics.low.total += usage.totalTokens;
          }
      }, undefined, 'low');

      try {
        // Extract the JSON response from the output tags
        const jsonMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);
        const analysisResult = jsonMatch ? JSON.parse(jsonMatch[1]) : [];

        // Process the analysis results
        for (const result of analysisResult) {
          const tripleIndex = triples.findIndex(
            (t) => t.statement.uuid === result.statementId,
          );
          if (tripleIndex === -1) continue;

          const triple = triples[tripleIndex];

          // Handle duplicates
          if (result.isDuplicate && result.duplicateId) {
            const duplicateTriple = allExistingTripleData.get(
              result.duplicateId,
            );
            if (duplicateTriple) {
              logger.info(`Statement is a duplicate: ${triple.statement.fact}`);
              resolvedStatements.push(duplicateTriple);
              continue;
            }
          }

          // Handle contradictions
          if (result.contradictions && result.contradictions.length > 0) {
            for (const contradictionId of result.contradictions) {
              const contradictedTriple =
                allExistingTripleData.get(contradictionId);
              if (contradictedTriple) {
                invalidatedStatements.push(contradictedTriple.statement.uuid);
              }
            }
          }

          // Add the new statement if it's not a duplicate
          if (!result.isDuplicate) {
            logger.info(`Adding new statement: ${triple.statement.fact}`);
            resolvedStatements.push(triple);
          }
        }
      } catch (e) {
        logger.error("Error processing batch analysis:", { error: e });

        // Fallback: add all statements as new if we couldn't process the analysis
        for (const triple of triples) {
          if (
            !resolvedStatements.some(
              (s) => s.statement.uuid === triple.statement.uuid,
            )
          ) {
            logger.info(
              `Fallback: Adding statement as new: ${triple.statement.fact}`,
            );
            resolvedStatements.push(triple);
          }
        }
      }
    } else {
      // No potential matches found for any statements, add them all as new
      for (const triple of triples) {
        logger.info(
          `No matches found, adding as new: ${triple.statement.fact}`,
        );
        resolvedStatements.push(triple);
      }
    }

    return { resolvedStatements, invalidatedStatements };
  }

  /**
   * Add attributes to entity nodes based on the resolved statements
   */
  private async addAttributesToEntities(
    triples: Triple[],
    episode: EpisodicNode,
    tokenMetrics: { high: { input: number; output: number; total: number }; low: { input: number; output: number; total: number } },
  ): Promise<Triple[]> {
    // Collect all unique entities from the triples
    const entityMap = new Map<string, EntityNode>();

    // Add all subjects, predicates, and objects to the map
    triples.forEach((triple) => {
      if (triple.subject) {
        entityMap.set(triple.subject.uuid, triple.subject);
      }
      if (triple.predicate) {
        entityMap.set(triple.predicate.uuid, triple.predicate);
      }
      if (triple.object) {
        entityMap.set(triple.object.uuid, triple.object);
      }
    });

    // Convert the map to an array of entities
    const entities = Array.from(entityMap.values());

    if (entities.length === 0) {
      return triples; // No entities to process
    }

    // Prepare simplified context for the LLM
    const context = {
      episodeContent: episode.content,
      entities: entities.map((entity) => ({
        uuid: entity.uuid,
        name: entity.name,
        currentAttributes: entity.attributes || {},
      })),
    };

    // Create a prompt for the LLM to extract attributes
    const messages = extractAttributes(context);

    let responseText = "";

    // Attribute extraction is LOW complexity (simple key-value extraction)
    await makeModelCall(false, messages as ModelMessage[], (text, _model, usage) => {
      responseText = text;
      if (usage) {
        tokenMetrics.low.input += usage.inputTokens;
        tokenMetrics.low.output += usage.outputTokens;
        tokenMetrics.low.total += usage.totalTokens;
      }
    }, undefined, 'low');

    try {
      const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);
      if (outputMatch && outputMatch[1]) {
        responseText = outputMatch[1].trim();
      }
      // Parse the LLM response
      const responseData = JSON.parse(responseText);
      const updatedEntities = responseData.entities || [];

      // Update entity attributes and save them
      for (const updatedEntity of updatedEntities) {
        const entity = entityMap.get(updatedEntity.uuid);
        if (entity) {
          // Merge the existing attributes with the new ones
          entity.attributes = {
            ...updatedEntity.attributes,
          };
        }
      }

      logger.info(`Updated attributes for ${updatedEntities.length} entities`);
    } catch (error) {
      logger.error("Error processing entity attributes", { error });
    }

    return triples;
  }

  /**
   * Normalize an episode by extracting entities and creating nodes and statements
   */
  private async normalizeEpisodeBody(
    episodeBody: string,
    source: string,
    userId: string,
    prisma: PrismaClient,
    tokenMetrics: { high: { input: number; output: number; total: number }; low: { input: number; output: number; total: number } },
    episodeTimestamp?: Date,
    sessionContext?: string,
    contentType?: EpisodeType,
  ) {
    let appEnumValues: Apps[] = [];
    if (Apps[source.toUpperCase() as keyof typeof Apps]) {
      appEnumValues = [Apps[source.toUpperCase() as keyof typeof Apps]];
    }
    const entityTypes = getNodeTypesString(appEnumValues);
    const relatedMemories = await this.getRelatedMemories(episodeBody, userId);

    // Fetch ingestion rules for this source
    const ingestionRules = await this.getIngestionRulesForSource(
      source,
      userId,
      prisma,
    );

    const context = {
      episodeContent: episodeBody,
      entityTypes: entityTypes,
      source,
      relatedMemories,
      ingestionRules,
      episodeTimestamp:
        episodeTimestamp?.toISOString() || new Date().toISOString(),
      sessionContext,
    };

    // Route to appropriate normalization prompt based on content type
    const messages =
      contentType === EpisodeTypeEnum.DOCUMENT
        ? normalizeDocumentPrompt(context)
        : normalizePrompt(context);
    // Normalization is LOW complexity (text cleaning and standardization)
    let responseText = "";
    await makeModelCall(false, messages, (text, _model, usage) => {
      responseText = text;
      if (usage) {
        tokenMetrics.low.input += usage.inputTokens;
        tokenMetrics.low.output += usage.outputTokens;
        tokenMetrics.low.total += usage.totalTokens;
      }
    }, undefined, 'high');
    let normalizedEpisodeBody = "";
    const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);
    if (outputMatch && outputMatch[1]) {
      normalizedEpisodeBody = outputMatch[1].trim();
    } else {
      // Log format violation and use fallback
      logger.warn("Normalization response missing <output> tags", {
        responseText: responseText.substring(0, 200) + "...",
        source,
        episodeLength: episodeBody.length,
      });

      // Fallback: use raw response if it's not empty and seems meaningful
      const trimmedResponse = responseText.trim();
      if (
        trimmedResponse &&
        trimmedResponse !== "NOTHING_TO_REMEMBER" &&
        trimmedResponse.length > 10
      ) {
        normalizedEpisodeBody = trimmedResponse;
        logger.info("Using raw response as fallback for normalization", {
          fallbackLength: trimmedResponse.length,
        });
      } else {
        logger.warn("No usable normalization content found", {
          responseText: responseText,
        });
      }
    }

    return normalizedEpisodeBody;
  }

  /**
   * Retrieves related episodes and facts based on semantic similarity to the current episode content.
   *
   * @param episodeContent The content of the current episode
   * @param userId The user ID
   * @param source The source of the episode
   * @param referenceTime The reference time for the episode
   * @returns A string containing formatted related episodes and facts
   */
  private async getRelatedMemories(
    episodeContent: string,
    userId: string,
    options: {
      episodeLimit?: number;
      factLimit?: number;
      minSimilarity?: number;
    } = {},
  ): Promise<string> {
    try {
      // Default configuration values
      const episodeLimit = options.episodeLimit ?? 5;
      const factLimit = options.factLimit ?? 10;
      const minSimilarity = options.minSimilarity ?? 0.75;

      // Get embedding for the current episode content
      const contentEmbedding = await this.getEmbedding(episodeContent);

      // Retrieve semantically similar episodes (excluding very recent ones that are already in context)
      const relatedEpisodes = await searchEpisodesByEmbedding({
        embedding: contentEmbedding,
        userId,
        limit: episodeLimit,
        minSimilarity,
      });

      // Retrieve semantically similar facts/statements
      const relatedFacts = await searchStatementsByEmbedding({
        embedding: contentEmbedding,
        userId,
        limit: factLimit,
        minSimilarity,
      });

      // Format the related memories for inclusion in the prompt
      let formattedMemories = "";

      if (relatedEpisodes.length > 0) {
        formattedMemories += "## Related Episodes\n";
        relatedEpisodes.forEach((episode, index) => {
          formattedMemories += `### Episode ${index + 1} (${new Date(episode.validAt).toISOString()})\n`;
          formattedMemories += `${episode.content}\n\n`;
        });
      }

      if (relatedFacts.length > 0) {
        formattedMemories += "## Related Facts\n";
        relatedFacts.forEach((fact) => {
          formattedMemories += `- ${fact.fact}\n`;
        });
      }

      return formattedMemories.trim();
    } catch (error) {
      console.error("Error retrieving related memories:", error);
      return "";
    }
  }

  /**
   * Retrieves active ingestion rules for a specific source and user
   */
  private async getIngestionRulesForSource(
    source: string,
    userId: string,
    prisma: PrismaClient,
  ): Promise<string | null> {
    try {
      // Import prisma here to avoid circular dependencies

      // Get the user's workspace
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { Workspace: true },
      });

      if (!user?.Workspace) {
        return null;
      }

      const integrationAccount = await prisma.integrationAccount.findFirst({
        where: {
          integrationDefinition: {
            slug: source,
          },
          workspaceId: user.Workspace.id,
          isActive: true,
          deleted: null,
        },
      });

      if (!integrationAccount) {
        return null;
      }

      // Fetch active rules for this source
      const rules = await prisma.ingestionRule.findMany({
        where: {
          source: integrationAccount.id,
          workspaceId: user.Workspace.id,
          isActive: true,
          deleted: null,
        },
        select: {
          text: true,
          name: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (rules.length === 0) {
        return null;
      }

      // Format rules for the prompt
      const formattedRules = rules
        .map((rule, index) => {
          const ruleName = rule.name ? `${rule.name}: ` : `Rule ${index + 1}: `;
          return `${ruleName}${rule.text}`;
        })
        .join("\n");

      return formattedRules;
    } catch (error) {
      console.error("Error retrieving ingestion rules:", error);
      return null;
    }
  }
}
