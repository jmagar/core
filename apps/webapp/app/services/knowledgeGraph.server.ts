import { openai } from "@ai-sdk/openai";
import {
  type CoreMessage,
  embed,
  generateText,
  type LanguageModelV1,
  streamText,
} from "ai";
import { EpisodeType, LLMMappings, LLMModelEnum } from "@recall/types";
import { logger } from "./logger.service";
import crypto from "crypto";
import { dedupeNodes, extract_message, extract_text } from "./prompts/nodes";
import { extract_statements } from "./prompts/statements";

const HelixDB = await import("helix-ts").then((m) => m.default);

/**
 * Interface for episodic node in the reified knowledge graph
 * Episodes are containers for statements and represent source information
 */
export interface EpisodicNode {
  uuid?: string;
  name: string;
  content: string;
  contentEmbedding?: number[];
  type: string;
  source: string;
  createdAt: Date;
  validAt: Date;
  labels: string[];
  userId: string;
  space?: string;
  sessionId?: string;
}

/**
 * Interface for entity node in the reified knowledge graph
 * Entities represent subjects, objects, or predicates in statements
 */
export interface EntityNode {
  uuid: string;
  name: string;
  type: string;
  attributes: Record<string, any>;
  nameEmbedding: number[];
  createdAt: Date;
  userId: string;
  space?: string;
}

/**
 * Interface for statement node in the reified knowledge graph
 * Statements are first-class objects representing facts with temporal properties
 */
export interface StatementNode {
  uuid?: string;
  fact: string;
  factEmbedding: number[];
  createdAt: Date;
  validAt: Date;
  invalidAt: Date | null;
  attributes: Record<string, any>;
  userId: string;
  space?: string;
}

/**
 * Interface for a triple in the reified knowledge graph
 * A triple connects a subject, predicate, object via a statement node
 * and maintains provenance information
 */
export interface Triple {
  statement: StatementNode;
  subject: EntityNode;
  predicate: EntityNode;
  object: EntityNode;
  provenance: EpisodicNode;
}

export type AddEpisodeParams = {
  name: string;
  episodeBody: string;
  referenceTime: Date;
  type: EpisodeType;
  source: string;
  userId: string;
  spaceId?: string;
  sessionId?: string;
};

export type AddEpisodeResult = {
  episodeUuid: string;
  nodesCreated: number;
  statementsCreated: number;
  processingTimeMs: number;
};

// Initialize Helix client
const helixClient = new HelixDB();

// Default number of previous episodes to retrieve for context
const DEFAULT_EPISODE_WINDOW = 5;
const RELEVANT_SCHEMA_LIMIT = 10;

export class KnowledgeGraphService {
  async getEmbedding(text: string) {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: text,
    });

    return embedding;
  }

  async retrieveEpisodes(
    referenceTime: Date,
    episodeWindow: number = DEFAULT_EPISODE_WINDOW,
    userId?: string,
    type?: EpisodeType,
  ): Promise<EpisodicNode[]> {
    try {
      // Use the proper HelixDB query for retrieving episodes
      const episodes = await helixClient.query("getRecentEpisodes", {
        referenceTime: referenceTime.toISOString(),
        limit: episodeWindow,
        userId: userId || null,
        source: type || null,
      });

      if (!episodes || !Array.isArray(episodes)) {
        logger.warn(
          "Unexpected response from HelixDB for getRecentEpisodes:",
          episodes,
        );
        return [];
      }

      // Map to EpisodicNode interface
      return episodes
        .map((ep) => ({
          uuid: ep.uuid,
          name: ep.name,
          content: ep.content,
          sourceDescription: ep.sourceDescription,
          source: ep.source as EpisodeType,
          createdAt: new Date(ep.createdAt),
          validAt: new Date(ep.validAt),
          entityEdges: ep.entityEdges || [],
          userId: ep.userId,
          type: ep.type,
          labels: ep.labels || [],
          space: ep.space,
          sessionId: ep.sessionId,
        }))
        .reverse();
    } catch (error) {
      logger.error("Error retrieving episode context:", { error });
      return [];
    }
  }

  /**
   * Process an episode and update the knowledge graph.
   *
   * This method extracts information from the episode, creates nodes and statements,
   * and updates the HelixDB database according to the reified + temporal approach.
   */
  async addEpisode(params: AddEpisodeParams) {
    const startTime = Date.now();
    const now = new Date();

    console.log(params);

    try {
      // Step 1: Context Retrieval - Get previous episodes for context
      const previousEpisodes = await this.retrieveEpisodes(
        params.referenceTime,
        RELEVANT_SCHEMA_LIMIT,
        params.userId,
        params.type,
      );

      // Step 2: Episode Creation - Create or retrieve the episode
      const episode: EpisodicNode = {
        uuid: crypto.randomUUID(),
        name: params.name,
        content: params.episodeBody,
        source: params.source || EpisodeType.Text,
        type: params.type,
        createdAt: now,
        validAt: params.referenceTime,
        labels: [],
        userId: params.userId,
        space: params.spaceId,
        sessionId: params.sessionId,
      };

      // Step 3: Entity Extraction - Extract entities from the episode content
      const extractedNodes = await this.extractEntities(
        episode,
        previousEpisodes,
      );

      // Step 4: Entity Resolution - Resolve extracted nodes to existing nodes or create new ones
      // const { resolvedNodes, uuidMap } = await this.resolveExtractedNodes(
      //   extractedNodes,
      //   episode,
      //   previousEpisodes,
      // );

      // // Step 5: Statement Extraction - Extract statements (triples) instead of direct edges
      // const extractedStatements = await this.extractStatements(
      //   episode,
      //   resolvedNodes,
      //   previousEpisodes,
      // );

      // // Step 6: Statement Resolution - Resolve statements and detect contradictions
      // const { resolvedStatements, invalidatedStatements } =
      //   await this.resolveStatements(
      //     extractedStatements,
      //     episode,
      //     resolvedNodes,
      //   );

      // // Step 7: Role Assignment & Attribute Extraction - Extract additional attributes for nodes
      // const hydratedNodes = await this.extractAttributesFromNodes(
      //   resolvedNodes,
      //   episode,
      //   previousEpisodes,
      // );

      // Step 8: Generate embeddings for semantic search
      // Note: In this implementation, embeddings are generated during extraction
      // but could be moved to a separate step for clarity

      // Step 10: Save everything to HelixDB using the reified + temporal structure
      // await this.saveToHelixDB(
      //   episode,
      //   hydratedNodes,
      //   resolvedStatements,
      //   invalidatedStatements,
      // );

      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;

      return {
        episodeUuid: episode.uuid,
        // nodesCreated: hydratedNodes.length,
        // statementsCreated: resolvedStatements.length,
        processingTimeMs,
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
  ): Promise<EntityNode[]> {
    // Use the prompt library to get the appropriate prompts
    const context = {
      episodeContent: episode.content,
      previousEpisodes: previousEpisodes.map((ep) => ({
        content: ep.content,
        createdAt: ep.createdAt.toISOString(),
      })),
      entityTypes: {}, // Could be populated with entity type definitions
    };

    // Get the extract_json prompt from the prompt library
    const messages =
      episode.type === EpisodeType.Conversation
        ? extract_message(context)
        : extract_text(context);

    let responseText = "";

    await this.makeModelCall(
      false,
      LLMModelEnum.GPT41,
      messages as CoreMessage[],
      (text) => {
        responseText = text;
      },
    );

    // Convert to EntityNode objects
    const entities: EntityNode[] = [];

    const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);
    if (outputMatch && outputMatch[1]) {
      responseText = outputMatch[1].trim();
      const extractedEntities = JSON.parse(responseText || "{}").entities || [];

      entities.push(
        ...(await Promise.all(
          extractedEntities.map(async (entity: any) => ({
            uuid: crypto.randomUUID(),
            name: entity.name,
            type: entity.type,
            attributes: entity.attributes || {},
            nameEmbedding: await this.getEmbedding(entity.name),
            createdAt: new Date(),
            userId: episode.userId,
          })),
        )),
      );
    }

    return entities;
  }

  /**
   * Resolve extracted nodes to existing nodes or create new ones
   */
  private async resolveExtractedNodes(
    extractedNodes: EntityNode[],
    episode: EpisodicNode,
    previousEpisodes: EpisodicNode[],
  ) {
    const uuidMap = new Map<string, string>();

    const existingNodesLists = await Promise.all(
      extractedNodes.map(async (extractedNode) => {
        // Check if a similar node already exists in HelixDB
        // Use vector similarity search to find similar entities
        // Threshold is 0.85 - meaning at least 85% similarity (lower cosine distance)
        const similarEntities = await helixClient.query("findSimilarEntities", {
          queryEmbedding: extractedNode.nameEmbedding,
          limit: 5, // Get top 5 matches
          threshold: 0.85, // 85% similarity threshold
        });

        return similarEntities.nodes;
      }),
    );

    if (!existingNodesLists || existingNodesLists.length === 0) {
      extractedNodes.forEach((node) => {
        uuidMap.set(node.uuid, node.uuid);
      });
      return { resolvedNodes: extractedNodes, uuidMap };
    }

    // Prepare context for LLM
    const extractedNodesContext = extractedNodes.map(
      (node: EntityNode, i: number) => {
        return {
          id: i,
          name: node.name,
          entity_type: node.type,
          entity_type_description: "Default Entity Type",
          duplication_candidates: existingNodesLists[i].map(
            (candidate: EntityNode, j: number) => ({
              idx: j,
              name: candidate.name,
              entity_types: candidate.type,
              ...candidate.attributes,
            }),
          ),
        };
      },
    );

    const context = {
      extracted_nodes: extractedNodesContext,
      episode_content: episode ? episode.content : "",
      previous_episodes: previousEpisodes
        ? previousEpisodes.map((ep) => ep.content)
        : [],
    };

    const messages = dedupeNodes(context);

    let responseText = "";

    await this.makeModelCall(
      false,
      LLMModelEnum.GPT41,
      messages as CoreMessage[],
      (text) => {
        responseText = text;
      },
    );

    const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);
    if (outputMatch && outputMatch[1]) {
      responseText = outputMatch[1].trim();
      const parsedResponse = JSON.parse(responseText);
      const nodeResolutions = parsedResponse.entity_resolutions || [];

      // Process each node resolution to either map to an existing node or keep as new
      const resolvedNodes = nodeResolutions.map((resolution: any) => {
        const resolutionId = resolution.id ?? -1;
        const duplicateIdx = resolution.duplicate_idx ?? -1;
        const extractedNode = extractedNodes[resolutionId];

        // If a duplicate was found, use the existing node, otherwise use the extracted node
        const resolvedNode =
          duplicateIdx >= 0 &&
          duplicateIdx < existingNodesLists[resolutionId]?.length
            ? existingNodesLists[resolutionId][duplicateIdx]
            : extractedNode;

        // Update the name if provided in the resolution
        if (resolution.name) {
          resolvedNode.name = resolution.name;
        }

        // Map the extracted UUID to the resolved UUID
        uuidMap.set(extractedNode.uuid, resolvedNode.uuid);

        return resolvedNode;
      });

      return { resolvedNodes, uuidMap };
    }
  }

  /**
   * Extract statements as first-class objects from an episode using LLM
   * This replaces the previous extractEdges method with a reified approach
   */
  private async extractStatements(
    episode: EpisodicNode,
    resolvedNodes: EntityNode[],
    previousEpisodes: EpisodicNode[],
  ): Promise<Triple[]> {
    // Use the prompt library to get the appropriate prompts
    const context = {
      episodeContent: episode.content,
      previousEpisodes: previousEpisodes.map((ep) => ({
        content: ep.content,
        createdAt: ep.createdAt.toISOString(),
      })),
      entities: resolvedNodes.map((node) => ({
        name: node.name,
        type: node.type,
        uuid: node.uuid,
      })),
      referenceTime: episode.validAt.toISOString(),
    };

    // Get the statement extraction prompt from the prompt library
    const messages = extract_statements(context);

    let responseText = "";

    await this.makeModelCall(
      false,
      LLMModelEnum.GPT41,
      messages as CoreMessage[],
      (text) => {
        responseText = text;
      },
    );

    // Parse the statements from the LLM response
    const extractedTriples = JSON.parse(responseText || "{}").edges || [];

    // Convert extracted triples to Triple objects with Statement nodes
    const triples = await Promise.all(
      // Fix: Type 'any'.
      extractedTriples.map(async (triple: any) => {
        // Find the subject and object nodes
        const subjectNode = resolvedNodes.find(
          (node) => node.name.toLowerCase() === triple.source.toLowerCase(),
        );

        const objectNode = resolvedNodes.find(
          (node) => node.name.toLowerCase() === triple.target.toLowerCase(),
        );

        // Find or create a predicate node for the relationship type
        const predicateNode = resolvedNodes.find(
          (node) =>
            node.name.toLowerCase() === triple.relationship.toLowerCase(),
        ) || {
          uuid: crypto.randomUUID(),
          name: triple.relationship,
          type: "Predicate",
          attributes: {},
          nameEmbedding: await this.getEmbedding(triple.relationship),
          createdAt: new Date(),
          userId: episode.userId,
        };

        if (subjectNode && objectNode) {
          // Create a statement node
          const statement: StatementNode = {
            uuid: crypto.randomUUID(),
            fact: triple.fact,
            factEmbedding: await this.getEmbedding(triple.fact),
            createdAt: new Date(),
            validAt: episode.validAt,
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
      }),
    );

    // Filter out null values (where subject or object wasn't found)
    return triples.filter(Boolean) as Triple[];
  }

  private async resolvePredicateNodes(
    triples: Triple[],
    episode: EpisodicNode,
  ) {
    const predicateNodes: EntityNode[] = triples.map((triple: Triple) => {
      return triple.predicate;
    });

    if (predicateNodes.length === 0) {
      return;
    }

    const existingNodesLists = await Promise.all(
      predicateNodes.map(async (predicateNode) => {
        // Check if a similar node already exists in HelixDB
        // Use vector similarity search to find similar entities
        // Threshold is 0.85 - meaning at least 85% similarity (lower cosine distance)
        const similarEntities = await helixClient.query("findSimilarEntities", {
          queryEmbedding: predicateNode.nameEmbedding,
          limit: 5, // Get top 5 matches
          threshold: 0.85, // 85% similarity threshold
        });

        return similarEntities.nodes;
      }),
    );
  }

  /**
   * Resolve statements by checking for existing statements and handling contradictions
   * This replaces the previous resolveExtractedEdges method with a reified approach
   */
  private async resolveStatements(
    triples: Triple[],
    episode: EpisodicNode,
    nodes: EntityNode[],
  ): Promise<{
    resolvedStatements: Triple[];
    invalidatedStatements: Triple[];
  }> {
    const resolvedStatements: Triple[] = [];
    const invalidatedStatements: Triple[] = [];

    for (const triple of triples) {
      // Find similar existing statements in HelixDB using the findContradictoryStatements query
      const existingStatements = await helixClient.query(
        "findContradictoryStatements",
        {
          subjectId: triple.subject.uuid,
          predicateId: triple.predicate.uuid,
        },
      );

      if (existingStatements && existingStatements.length > 0) {
        // If we have statements with the same subject and predicate,
        // check if they have different objects (contradiction)

        // Get full triple information for the existing statement
        const existingTripleData = await helixClient.query(
          "getTripleForStatement",
          {
            statementId: existingStatements[0].uuid,
          },
        );

        if (
          existingTripleData &&
          existingTripleData.object.uuid !== triple.object.uuid
        ) {
          // This is potentially a contradiction - objects differ for same subject+predicate

          // Use LLM to determine if this is truly a contradiction
          const isContradiction = await this.detectContradiction(
            triple.statement.fact,
            existingTripleData.statement.fact,
          );

          if (isContradiction) {
            // Create a copy of the existing statement as invalidated
            const invalidatedStatement: Triple = {
              statement: {
                ...existingTripleData.statement,
                invalidAt: episode.validAt, // Mark as invalid at this episode's time
              },
              subject: existingTripleData.subject,
              predicate: existingTripleData.predicate,
              object: existingTripleData.object,
              provenance: existingTripleData.provenance,
            };

            invalidatedStatements.push(invalidatedStatement);

            // Add the new statement as a replacement
            resolvedStatements.push(triple);
          } else {
            // Not a contradiction, just add the new statement
            resolvedStatements.push(triple);
          }
        } else {
          // Same triple already exists, no need to create a duplicate
          // We could merge additional metadata or update provenance information
          resolvedStatements.push(triple);
        }
      } else {
        // This is a new statement, add it as is
        resolvedStatements.push(triple);
      }
    }

    return { resolvedStatements, invalidatedStatements };
  }

  /**
   * Detect if a new statement contradicts an existing statement
   * This supports the reified + temporal knowledge graph approach by detecting
   * statement-level contradictions rather than edge-level contradictions
   */
  private async detectContradiction(
    newFact: string,
    existingFact: string,
    context?: { subject?: string; predicate?: string },
  ): Promise<boolean> {
    // Use the prompt library to get the appropriate prompts
    const promptContext = {
      newFact,
      existingFact,
      subject: context?.subject || null,
      predicate: context?.predicate || null,
    };

    // Get the detect_contradiction prompt from the prompt library
    // The prompt should be updated to handle reified statements specifically

    // promptLibrary.detectContradiction.detect_json.call(promptContext);

    let responseText = "";

    await this.makeModelCall(false, LLMModelEnum.GPT41, [], (text) => {
      responseText = text;
    });

    try {
      const result = JSON.parse(responseText);

      // If we have a well-formed response with temporal information, use it
      if (
        result.temporalAnalysis &&
        typeof result.temporalAnalysis === "object"
      ) {
        // Check if the statements contradict based on temporal validity
        // This is important for the reified + temporal approach
        if (result.temporalAnalysis.areCompatible === false) {
          return true; // This is a contradiction
        }
      }

      // Fall back to the direct contradiction flag if temporal analysis isn't available
      return result.isContradiction === true;
    } catch (e) {
      // Fallback to simple text parsing if JSON parsing fails
      return (
        responseText.toLowerCase().includes("true") ||
        responseText.toLowerCase().includes("contradiction")
      );
    }
  }

  /**
   * Extract additional attributes for nodes
   */
  private async extractAttributesFromNodes(
    nodes: EntityNode[],
    episode: EpisodicNode,
    previousEpisodes: EpisodicNode[],
  ): Promise<EntityNode[]> {
    // This could involve LLM to extract more attributes for each node
    // For simplicity, we'll just return the nodes as is
    return nodes;
  }

  // buildEpisodicEdges method removed as part of the reified knowledge graph refactoring.
  // In the reified model, episodes connect to entities through Statement nodes and HasProvenance edges.

  /**
   * Save all entities and statements to HelixDB using reified structure
   * Creates statements and HasSubject, HasObject, HasPredicate, HasProvenance edges
   */
  private async saveToHelixDB(
    episode: EpisodicNode,
    nodes: EntityNode[],
    resolvedStatements: Triple[],
    invalidatedStatements: Triple[],
  ): Promise<void> {
    try {
      // 1. Save the episode first
      await helixClient.query("saveEpisode", {
        uuid: episode.uuid,
        name: episode.name,
        content: episode.content,
        source: episode.source,
        // sourceDescription: episode.sourceDescription,
        userId: episode.userId || null,
        labels: episode.labels || [],
        createdAt: episode.createdAt.toISOString(),
        validAt: episode.validAt.toISOString(),
        embedding: [], // Embedding could be added here if needed
      });

      // 2. Save or update all entity nodes
      for (const node of nodes) {
        await helixClient.query("saveEntity", {
          uuid: node.uuid,
          name: node.name,
          summary: node.type, // Using type as summary
          userId: node.userId || null,
          createdAt: node.createdAt.toISOString(),
          attributesJson: JSON.stringify(node.attributes || {}),
          embedding: node.nameEmbedding || [],
        });
      }

      // 3. Process all resolved statements
      for (const triple of resolvedStatements) {
        // Save the statement node first
        await helixClient.query("saveStatement", {
          uuid: triple.statement.uuid,
          fact: triple.statement.fact,
          // groupId: triple.statement.groupId,
          userId: triple.statement.userId || null,
          createdAt: triple.statement.createdAt.toISOString(),
          validAt: triple.statement.validAt.toISOString(),
          invalidAt: triple.statement.invalidAt
            ? triple.statement.invalidAt.toISOString()
            : null,
          // attributesJson: triple.statement.attributesJson,
          // embedding: triple.statement.embedding || [],
        });

        // Create HasSubject edge
        await helixClient.query("createHasSubjectEdge", {
          uuid: crypto.randomUUID(),
          statementId: triple.statement.uuid,
          entityId: triple.subject.uuid,
          createdAt: new Date().toISOString(),
        });

        // Create HasObject edge
        await helixClient.query("createHasObjectEdge", {
          uuid: crypto.randomUUID(),
          statementId: triple.statement.uuid,
          entityId: triple.object.uuid,
          createdAt: new Date().toISOString(),
        });

        // Create HasPredicate edge
        await helixClient.query("createHasPredicateEdge", {
          uuid: crypto.randomUUID(),
          statementId: triple.statement.uuid,
          entityId: triple.predicate.uuid,
          createdAt: new Date().toISOString(),
        });

        // Create HasProvenance edge to link the statement to its source episode
        await helixClient.query("createHasProvenanceEdge", {
          uuid: crypto.randomUUID(),
          statementId: triple.statement.uuid,
          episodeId: episode.uuid,
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Handle invalidated statements (update them with new invalidAt time)
      for (const triple of invalidatedStatements) {
        await helixClient.query("saveStatement", {
          uuid: triple.statement.uuid,
          fact: triple.statement.fact,
          // groupId: triple.statement.groupId,
          userId: triple.statement.userId || null,
          createdAt: triple.statement.createdAt.toISOString(),
          validAt: triple.statement.validAt.toISOString(),
          // invalidAt: triple.statement.invalidAt.toISOString(), // This will be the episode.validAt timestamp
          // attributesJson: triple.statement.attributesJson,
          // embedding: triple.statement.embedding || [],
        });
      }
    } catch (error) {
      console.error("Error saving to HelixDB:", error);
      throw error;
    }
  }

  private async makeModelCall(
    stream: boolean,
    model: LLMModelEnum,
    messages: CoreMessage[],
    onFinish: (text: string, model: string) => void,
  ) {
    let modelInstance;
    let finalModel: string = "unknown";

    switch (model) {
      case LLMModelEnum.GPT35TURBO:
      case LLMModelEnum.GPT4TURBO:
      case LLMModelEnum.GPT4O:
      case LLMModelEnum.GPT41:
      case LLMModelEnum.GPT41MINI:
      case LLMModelEnum.GPT41NANO:
        finalModel = LLMMappings[model];
        modelInstance = openai(finalModel);
        break;

      case LLMModelEnum.CLAUDEOPUS:
      case LLMModelEnum.CLAUDESONNET:
      case LLMModelEnum.CLAUDEHAIKU:
        finalModel = LLMMappings[model];
        break;

      case LLMModelEnum.GEMINI25FLASH:
      case LLMModelEnum.GEMINI25PRO:
      case LLMModelEnum.GEMINI20FLASH:
      case LLMModelEnum.GEMINI20FLASHLITE:
        finalModel = LLMMappings[model];
        break;

      default:
        logger.warn(`Unsupported model type: ${model}`);
        break;
    }

    if (stream) {
      return await streamText({
        model: modelInstance as LanguageModelV1,
        messages,
        onFinish: async ({ text }) => {
          onFinish(text, finalModel);
        },
      });
    }

    const { text } = await generateText({
      model: modelInstance as LanguageModelV1,
      messages,
    });

    onFinish(text, finalModel);

    return text;
  }
}
