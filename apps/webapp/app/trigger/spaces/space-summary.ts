import { queue, task } from "@trigger.dev/sdk/v3";
import { logger } from "~/services/logger.service";
import { SpaceService } from "~/services/space.server";
import { makeModelCall } from "~/lib/model.server";
import { runQuery } from "~/lib/neo4j.server";
import { updateSpaceStatus, SPACE_STATUS } from "../utils/space-status";
import type { CoreMessage } from "ai";
import { z } from "zod";
import { triggerSpacePattern } from "./space-pattern";
import { getSpace, updateSpace } from "../utils/space-utils";

import { EpisodeType } from "@core/types";
import { getSpaceStatementCount } from "~/services/graphModels/space";
import { addToQueue } from "../utils/queue";

interface SpaceSummaryPayload {
  userId: string;
  workspaceId: string;
  spaceId: string; // Single space only
  triggerSource?: "assignment" | "manual" | "scheduled";
}

interface SpaceEpisodeData {
  uuid: string;
  content: string;
  originalContent: string;
  source: string;
  createdAt: Date;
  validAt: Date;
  metadata: any;
  sessionId: string | null;
}

interface SpaceSummaryData {
  spaceId: string;
  spaceName: string;
  spaceDescription?: string;
  statementCount: number;
  summary: string;
  keyEntities: string[];
  themes: string[];
  confidence: number;
  lastUpdated: Date;
  isIncremental: boolean;
}

// Zod schema for LLM response validation
const SummaryResultSchema = z.object({
  summary: z.string(),
  keyEntities: z.array(z.string()),
  themes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const CONFIG = {
  maxEpisodesForSummary: 20, // Limit episodes for performance
  minEpisodesForSummary: 1, // Minimum episodes to generate summary
  summaryPromptTokenLimit: 4000, // Approximate token limit for prompt
};

export const spaceSummaryQueue = queue({
  name: "space-summary-queue",
  concurrencyLimit: 1,
});

export const spaceSummaryTask = task({
  id: "space-summary",
  queue: spaceSummaryQueue,
  run: async (payload: SpaceSummaryPayload) => {
    const { userId, workspaceId, spaceId, triggerSource = "manual" } = payload;

    logger.info(`Starting space summary generation`, {
      userId,
      workspaceId,
      spaceId,
      triggerSource,
    });

    try {
      // Update status to processing
      await updateSpaceStatus(spaceId, SPACE_STATUS.PROCESSING, {
        userId,
        operation: "space-summary",
        metadata: { triggerSource, phase: "start_summary" },
      });

      // Generate summary for the single space
      const summaryResult = await generateSpaceSummary(spaceId, userId);

      if (summaryResult) {
        // Store the summary
        await storeSummary(summaryResult);

        // Update status to ready after successful completion
        await updateSpaceStatus(spaceId, SPACE_STATUS.READY, {
          userId,
          operation: "space-summary",
          metadata: {
            triggerSource,
            phase: "completed_summary",
            statementCount: summaryResult.statementCount,
            confidence: summaryResult.confidence,
          },
        });

        logger.info(`Generated summary for space ${spaceId}`, {
          statementCount: summaryResult.statementCount,
          confidence: summaryResult.confidence,
          themes: summaryResult.themes.length,
          triggerSource,
        });

        // Ingest summary as document if it exists and continue with patterns
        if (!summaryResult.isIncremental && summaryResult.statementCount > 0) {
          await processSpaceSummarySequentially({
            userId,
            workspaceId,
            spaceId,
            spaceName: summaryResult.spaceName,
            summaryContent: summaryResult.summary,
            triggerSource: "summary_complete",
          });
        }

        return {
          success: true,
          spaceId,
          triggerSource,
          summary: {
            statementCount: summaryResult.statementCount,
            confidence: summaryResult.confidence,
            themesCount: summaryResult.themes.length,
          },
        };
      } else {
        // No summary generated - this could be due to insufficient episodes or no new episodes
        // This is not an error state, so update status to ready
        await updateSpaceStatus(spaceId, SPACE_STATUS.READY, {
          userId,
          operation: "space-summary",
          metadata: {
            triggerSource,
            phase: "no_summary_needed",
            reason: "Insufficient episodes or no new episodes to summarize",
          },
        });

        logger.info(
          `No summary generated for space ${spaceId} - insufficient or no new episodes`,
        );
        return {
          success: true,
          spaceId,
          triggerSource,
          summary: null,
          reason: "No episodes to summarize",
        };
      }
    } catch (error) {
      // Update status to error on exception
      try {
        await updateSpaceStatus(spaceId, SPACE_STATUS.ERROR, {
          userId,
          operation: "space-summary",
          metadata: {
            triggerSource,
            phase: "exception",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      } catch (statusError) {
        logger.warn(`Failed to update status to error for space ${spaceId}`, {
          statusError,
        });
      }

      logger.error(
        `Error in space summary generation for space ${spaceId}:`,
        error as Record<string, unknown>,
      );
      throw error;
    }
  },
});

async function generateSpaceSummary(
  spaceId: string,
  userId: string,
): Promise<SpaceSummaryData | null> {
  try {
    // 1. Get space details
    const spaceService = new SpaceService();
    const space = await spaceService.getSpace(spaceId, userId);

    if (!space) {
      logger.warn(`Space ${spaceId} not found for user ${userId}`);
      return null;
    }

    // 2. Check for existing summary
    const existingSummary = await getExistingSummary(spaceId);
    const isIncremental = existingSummary !== null;

    // 3. Get episodes (all or new ones based on existing summary)
    const episodes = await getSpaceEpisodes(
      spaceId,
      userId,
      isIncremental ? existingSummary?.lastUpdated : undefined,
    );

    // Handle case where no new episodes exist for incremental update
    if (isIncremental && episodes.length === 0) {
      logger.info(
        `No new episodes found for space ${spaceId}, skipping summary update`,
      );
      return null;
    }

    // Check minimum episode requirement for new summaries only
    if (!isIncremental && episodes.length < CONFIG.minEpisodesForSummary) {
      logger.info(
        `Space ${spaceId} has insufficient episodes (${episodes.length}) for new summary`,
      );
      return null;
    }

    // 4. Process episodes using unified approach
    let summaryResult;

    if (episodes.length > CONFIG.maxEpisodesForSummary) {
      logger.info(
        `Large space detected (${episodes.length} episodes). Processing in batches.`,
      );

      // Process in batches, each building on previous result
      const batches: SpaceEpisodeData[][] = [];
      for (let i = 0; i < episodes.length; i += CONFIG.maxEpisodesForSummary) {
        batches.push(episodes.slice(i, i + CONFIG.maxEpisodesForSummary));
      }

      let currentSummary = existingSummary?.summary || null;
      let currentThemes = existingSummary?.themes || [];
      let cumulativeConfidence = 0;

      for (const [batchIndex, batch] of batches.entries()) {
        logger.info(
          `Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} episodes`,
        );

        const batchResult = await generateUnifiedSummary(
          space.name,
          space.description as string,
          batch,
          currentSummary,
          currentThemes,
        );

        if (batchResult) {
          currentSummary = batchResult.summary;
          currentThemes = batchResult.themes;
          cumulativeConfidence += batchResult.confidence;
        } else {
          logger.warn(`Failed to process batch ${batchIndex + 1}`);
        }

        // Small delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      summaryResult = currentSummary
        ? {
            summary: currentSummary,
            themes: currentThemes,
            confidence: Math.min(cumulativeConfidence / batches.length, 1.0),
          }
        : null;
    } else {
      logger.info(
        `Processing ${episodes.length} episodes with unified approach`,
      );

      // Use unified approach for smaller spaces
      summaryResult = await generateUnifiedSummary(
        space.name,
        space.description as string,
        episodes,
        existingSummary?.summary || null,
        existingSummary?.themes || [],
      );
    }

    if (!summaryResult) {
      logger.warn(`Failed to generate LLM summary for space ${spaceId}`);
      return null;
    }

    // Get the actual current statement count from Neo4j
    const currentStatementCount = await getSpaceStatementCount(spaceId, userId);

    return {
      spaceId: space.uuid,
      spaceName: space.name,
      spaceDescription: space.description as string,
      statementCount: currentStatementCount,
      summary: summaryResult.summary,
      keyEntities: summaryResult.keyEntities || [],
      themes: summaryResult.themes,
      confidence: summaryResult.confidence,
      lastUpdated: new Date(),
      isIncremental,
    };
  } catch (error) {
    logger.error(
      `Error generating summary for space ${spaceId}:`,
      error as Record<string, unknown>,
    );
    return null;
  }
}

async function generateUnifiedSummary(
  spaceName: string,
  spaceDescription: string | undefined,
  episodes: SpaceEpisodeData[],
  previousSummary: string | null = null,
  previousThemes: string[] = [],
): Promise<{
  summary: string;
  themes: string[];
  confidence: number;
  keyEntities?: string[];
} | null> {
  try {
    const prompt = createUnifiedSummaryPrompt(
      spaceName,
      spaceDescription,
      episodes,
      previousSummary,
      previousThemes,
    );

    // Space summary generation requires HIGH complexity (creative synthesis, narrative generation)
    let responseText = "";
    await makeModelCall(false, prompt, (text: string) => {
      responseText = text;
    }, undefined, 'high');

    return parseSummaryResponse(responseText);
  } catch (error) {
    logger.error(
      "Error generating unified summary:",
      error as Record<string, unknown>,
    );
    return null;
  }
}

function createUnifiedSummaryPrompt(
  spaceName: string,
  spaceDescription: string | undefined,
  episodes: SpaceEpisodeData[],
  previousSummary: string | null,
  previousThemes: string[],
): CoreMessage[] {
  // If there are no episodes and no previous summary, we cannot generate a meaningful summary
  if (episodes.length === 0 && previousSummary === null) {
    throw new Error(
      "Cannot generate summary without episodes or existing summary",
    );
  }

  const episodesText = episodes
    .map(
      (episode) =>
        `- ${episode.content} (Source: ${episode.source}, Session: ${episode.sessionId || "N/A"})`,
    )
    .join("\n");

  // Extract key entities and themes from episode content
  const contentWords = episodes
    .map((ep) => ep.content.toLowerCase())
    .join(" ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const wordFrequency = new Map<string, number>();
  contentWords.forEach((word) => {
    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
  });

  const topEntities = Array.from(wordFrequency.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  const isUpdate = previousSummary !== null;

  return [
    {
      role: "system",
      content: `You are an expert at analyzing and summarizing structured knowledge within semantic spaces. Your task is to ${isUpdate ? "update an existing summary by integrating new episodes" : "create a comprehensive summary of episodes"}.

CRITICAL RULES:
1. Base your summary ONLY on insights derived from the actual content/episodes provided
2. Use the space description only as contextual guidance, never copy or paraphrase it
3. Write in a factual, neutral tone - avoid promotional language ("pivotal", "invaluable", "cutting-edge")
4. Be specific and concrete - reference actual content, patterns, and themes found in the episodes
5. If episodes are insufficient for meaningful insights, state that more data is needed

INSTRUCTIONS:
${
  isUpdate
    ? `1. Review the existing summary and themes carefully
2. Analyze the new episodes for patterns and insights
3. Identify connecting points between existing knowledge and new episodes
4. Update the summary to seamlessly integrate new information while preserving valuable existing insights
5. Evolve themes by adding new ones or refining existing ones based on connections found
6. Update the markdown summary to reflect the enhanced themes and new insights`
    : `1. Analyze the semantic content and relationships within the episodes
2. Identify the main themes and patterns across all episodes (themes must have at least 3 supporting episodes)
3. Create a coherent summary that captures the essence of this knowledge domain
4. Generate a well-structured markdown summary organized by the identified themes`
}
${isUpdate ? "7" : "6"}. Assess your confidence in the ${isUpdate ? "updated" : ""} summary quality (0.0-1.0)

THEME IDENTIFICATION RULES:
- A theme must be supported by AT LEAST 3 related episodes to be considered valid
- Themes should represent substantial, meaningful patterns rather than minor occurrences
- Each theme must capture a distinct semantic domain or conceptual area
- Only identify themes that have sufficient evidence in the data
- If fewer than 3 episodes support a potential theme, do not include it
- Themes will be used to organize the markdown summary into logical sections

${
  isUpdate
    ? `CONNECTION FOCUS:
- Entity relationships that span across batches/time
- Theme evolution and expansion  
- Temporal patterns and progressions
- Contradictions or confirmations of existing insights
- New insights that complement existing knowledge`
    : ""
}

RESPONSE FORMAT:
Provide your response inside <output></output> tags with valid JSON. Include both HTML summary and markdown format.

<output>
{
  "summary": "${isUpdate ? "Updated HTML summary that integrates new insights with existing knowledge. Write factually about what the statements reveal - mention specific entities, relationships, and patterns found in the data. Avoid marketing language. Use HTML tags for structure." : "Factual HTML summary based on patterns found in the statements. Report what the data actually shows - specific entities, relationships, frequencies, and concrete insights. Avoid promotional language. Use HTML tags like <p>, <strong>, <ul>, <li> for structure. Keep it concise and evidence-based."}",
  "keyEntities": ["entity1", "entity2", "entity3"],
  "themes": ["${isUpdate ? 'updated_theme1", "new_theme2", "evolved_theme3' : 'theme1", "theme2", "theme3'}"],
  "confidence": 0.85
}
</output>

JSON FORMATTING RULES:
- HTML content in summary field is allowed and encouraged
- Escape quotes within strings as \"
- Escape HTML angle brackets if needed: &lt; and &gt;
- Use proper HTML tags for structure: <p>, <strong>, <em>, <ul>, <li>, <h3>, etc.
- HTML content should be well-formed and semantic

GUIDELINES:
${
  isUpdate
    ? `- Preserve valuable insights from existing summary
- Integrate new information by highlighting connections
- Themes should evolve naturally, don't replace wholesale
- The updated summary should read as a coherent whole
- Make the summary user-friendly and explain what value this space provides`
    : `- Report only what the episodes actually reveal - be specific and concrete
- Cite actual content and patterns found in the episodes
- Avoid generic descriptions that could apply to any space
- Use neutral, factual language - no "comprehensive", "robust", "cutting-edge" etc.
- Themes must be backed by at least 3 supporting episodes with clear evidence
- Better to have fewer, well-supported themes than many weak ones
- Confidence should reflect actual data quality and coverage, not aspirational goals`
}`,
    },
    {
      role: "user",
      content: `SPACE INFORMATION:
Name: "${spaceName}"
Description (for context only): ${spaceDescription || "No description provided"}

${
  isUpdate
    ? `EXISTING SUMMARY:
${previousSummary}

EXISTING THEMES:
${previousThemes.join(", ")}

NEW EPISODES TO INTEGRATE (${episodes.length} episodes):`
    : `EPISODES IN THIS SPACE (${episodes.length} episodes):`
}
${episodesText}

${
  episodes.length > 0
    ? `TOP WORDS BY FREQUENCY:
${topEntities.join(", ")}`
    : ""
}

${
  isUpdate
    ? "Please identify connections between the existing summary and new episodes, then update the summary to integrate the new insights coherently. Remember: only summarize insights from the actual episode content, not the space description."
    : "Please analyze the episodes and provide a comprehensive summary that captures insights derived from the episode content provided. Use the description only as context. If there are too few episodes to generate meaningful insights, indicate that more data is needed rather than falling back on the description."
}`,
    },
  ];
}

async function getExistingSummary(spaceId: string): Promise<{
  summary: string;
  themes: string[];
  lastUpdated: Date;
  statementCount: number;
} | null> {
  try {
    const existingSummary = await getSpace(spaceId);

    if (existingSummary?.summary) {
      return {
        summary: existingSummary.summary,
        themes: existingSummary.themes,
        lastUpdated: existingSummary.lastPatternTrigger || new Date(),
        statementCount: existingSummary.statementCount || 0,
      };
    }

    return null;
  } catch (error) {
    logger.warn(`Failed to get existing summary for space ${spaceId}:`, {
      error,
    });
    return null;
  }
}

async function getSpaceEpisodes(
  spaceId: string,
  userId: string,
  sinceDate?: Date,
): Promise<SpaceEpisodeData[]> {
  // Build query to get distinct episodes that have statements in the space
  let whereClause =
    "s.spaceIds IS NOT NULL AND $spaceId IN s.spaceIds AND s.invalidAt IS NULL";
  const params: any = { spaceId, userId };

  // Store the sinceDate condition separately to apply after e is defined
  let dateCondition = "";
  if (sinceDate) {
    dateCondition = "e.createdAt > $sinceDate";
    params.sinceDate = sinceDate.toISOString();
  }

  const query = `
    MATCH (s:Statement{userId: $userId})
    WHERE ${whereClause}
    OPTIONAL MATCH (e:Episode{userId: $userId})-[:HAS_PROVENANCE]->(s)
    WITH e
    WHERE e IS NOT NULL ${dateCondition ? `AND ${dateCondition}` : ""}
    RETURN DISTINCT e
    ORDER BY e.createdAt DESC
  `;

  const result = await runQuery(query, params);

  return result.map((record) => {
    const episode = record.get("e").properties;
    return {
      uuid: episode.uuid,
      content: episode.content,
      originalContent: episode.originalContent,
      source: episode.source,
      createdAt: new Date(episode.createdAt),
      validAt: new Date(episode.validAt),
      metadata: JSON.parse(episode.metadata || "{}"),
      sessionId: episode.sessionId,
    };
  });
}

function parseSummaryResponse(response: string): {
  summary: string;
  themes: string[];
  confidence: number;
  keyEntities?: string[];
} | null {
  try {
    // Extract content from <output> tags
    const outputMatch = response.match(/<output>([\s\S]*?)<\/output>/);
    if (!outputMatch) {
      logger.warn("No <output> tags found in LLM summary response");
      logger.debug("Full LLM response:", { response });
      return null;
    }

    let jsonContent = outputMatch[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (jsonError) {
      logger.warn("JSON parsing failed, attempting cleanup and retry", {
        originalError: jsonError,
        jsonContent: jsonContent.substring(0, 500) + "...", // Log first 500 chars
      });

      // More aggressive cleanup for malformed JSON
      jsonContent = jsonContent
        .replace(/([^\\])"/g, '$1\\"') // Escape unescaped quotes
        .replace(/^"/g, '\\"') // Escape quotes at start
        .replace(/\\\\"/g, '\\"'); // Fix double-escaped quotes

      parsed = JSON.parse(jsonContent);
    }

    // Validate the response structure
    const validationResult = SummaryResultSchema.safeParse(parsed);
    if (!validationResult.success) {
      logger.warn("Invalid LLM summary response format:", {
        error: validationResult.error,
        parsedData: parsed,
      });
      return null;
    }

    return validationResult.data;
  } catch (error) {
    logger.error(
      "Error parsing LLM summary response:",
      error as Record<string, unknown>,
    );
    logger.debug("Failed response content:", { response });
    return null;
  }
}

async function storeSummary(summaryData: SpaceSummaryData): Promise<void> {
  try {
    // Store in PostgreSQL for API access and persistence
    await updateSpace(summaryData);

    // Also store in Neo4j for graph-based queries
    const query = `
      MATCH (space:Space {uuid: $spaceId})
      SET space.summary = $summary,
          space.keyEntities = $keyEntities,
          space.themes = $themes,
          space.summaryConfidence = $confidence,
          space.summaryStatementCount = $statementCount,
          space.summaryLastUpdated = datetime($lastUpdated)
      RETURN space
    `;

    await runQuery(query, {
      spaceId: summaryData.spaceId,
      summary: summaryData.summary,
      keyEntities: summaryData.keyEntities,
      themes: summaryData.themes,
      confidence: summaryData.confidence,
      statementCount: summaryData.statementCount,
      lastUpdated: summaryData.lastUpdated.toISOString(),
    });

    logger.info(`Stored summary for space ${summaryData.spaceId}`, {
      themes: summaryData.themes.length,
      keyEntities: summaryData.keyEntities.length,
      confidence: summaryData.confidence,
    });
  } catch (error) {
    logger.error(
      `Error storing summary for space ${summaryData.spaceId}:`,
      error as Record<string, unknown>,
    );
    throw error;
  }
}

/**
 * Process space summary sequentially: ingest document then trigger patterns
 */
async function processSpaceSummarySequentially({
  userId,
  workspaceId,
  spaceId,
  spaceName,
  summaryContent,
  triggerSource,
}: {
  userId: string;
  workspaceId: string;
  spaceId: string;
  spaceName: string;
  summaryContent: string;
  triggerSource:
    | "summary_complete"
    | "manual"
    | "assignment"
    | "scheduled"
    | "new_space"
    | "growth_threshold"
    | "ingestion_complete";
}): Promise<void> {
  // Step 1: Ingest summary as document synchronously
  await ingestSpaceSummaryDocument(spaceId, userId, spaceName, summaryContent);

  logger.info(
    `Successfully ingested space summary document for space ${spaceId}`,
  );

  // Step 2: Now trigger space patterns (patterns will have access to the ingested summary)
  await triggerSpacePattern({
    userId,
    workspaceId,
    spaceId,
    triggerSource,
  });

  logger.info(
    `Sequential processing completed for space ${spaceId}: summary ingested → patterns triggered`,
  );
}

/**
 * Ingest space summary as document synchronously
 */
async function ingestSpaceSummaryDocument(
  spaceId: string,
  userId: string,
  spaceName: string,
  summaryContent: string,
): Promise<void> {
  // Create the ingest body
  const ingestBody = {
    episodeBody: summaryContent,
    referenceTime: new Date().toISOString(),
    metadata: {
      documentType: "space_summary",
      spaceId,
      spaceName,
      generatedAt: new Date().toISOString(),
    },
    source: "space",
    spaceId,
    sessionId: spaceId,
    type: EpisodeType.DOCUMENT,
  };

  // Add to queue
  await addToQueue(ingestBody, userId);

  logger.info(`Queued space summary for synchronous ingestion`);

  return;
}

// Helper function to trigger the task
export async function triggerSpaceSummary(payload: SpaceSummaryPayload) {
  return await spaceSummaryTask.trigger(payload, {
    queue: "space-summary-queue",
    concurrencyKey: payload.userId,
    tags: [payload.userId, payload.spaceId],
  });
}
