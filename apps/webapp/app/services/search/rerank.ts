import { type StatementNode } from "@core/types";
import { combineAndDeduplicateStatements } from "./utils";
import { type CoreMessage } from "ai";
import { makeModelCall } from "~/lib/model.server";
import { logger } from "../logger.service";

/**
 * Apply Weighted Reciprocal Rank Fusion to combine results
 */
export function applyWeightedRRF(results: {
  bm25: StatementNode[];
  vector: StatementNode[];
  bfs: StatementNode[];
}): StatementNode[] {
  // Determine weights based on query characteristics
  const weights = {
    bm25: 1.0,
    vector: 0.8,
    bfs: 0.5,
  };
  const k = 60; // RRF constant

  // Map to store combined scores
  const scores: Record<string, { score: number; statement: StatementNode }> =
    {};

  // Process BM25 results with their weight
  results.bm25.forEach((statement, rank) => {
    const uuid = statement.uuid;
    scores[uuid] = scores[uuid] || { score: 0, statement };
    scores[uuid].score += weights.bm25 * (1 / (rank + k));
  });

  // Process vector similarity results with their weight
  results.vector.forEach((statement, rank) => {
    const uuid = statement.uuid;
    scores[uuid] = scores[uuid] || { score: 0, statement };
    scores[uuid].score += weights.vector * (1 / (rank + k));
  });

  // Process BFS traversal results with their weight
  results.bfs.forEach((statement, rank) => {
    const uuid = statement.uuid;
    scores[uuid] = scores[uuid] || { score: 0, statement };
    scores[uuid].score += weights.bfs * (1 / (rank + k));
  });

  // Convert to array and sort by final score
  const sortedResults = Object.values(scores)
    .sort((a, b) => b.score - a.score)
    .map((item) => {
      // Add the RRF score to the statement for debugging
      return {
        ...item.statement,
        rrfScore: item.score,
      };
    });

  return sortedResults;
}

/**
 * Apply Cross-Encoder reranking to results
 * This is particularly useful when results come from a single source
 */
export async function applyCrossEncoderReranking(
  query: string,
  results: {
    bm25: StatementNode[];
    vector: StatementNode[];
    bfs: StatementNode[];
  },
): Promise<StatementNode[]> {
  // Combine all results
  const allResults = [...results.bm25, ...results.vector, ...results.bfs];

  // Deduplicate by UUID
  const uniqueResults = combineAndDeduplicateStatements(allResults);

  if (uniqueResults.length === 0) return [];

  logger.info(`Cross-encoder reranking ${uniqueResults.length} statements`);

  const finalStatements: StatementNode[] = [];

  await Promise.all(
    uniqueResults.map(async (statement) => {
      const messages: CoreMessage[] = [
        {
          role: "system",
          content: `You are an expert tasked with determining whether the statement is relevant to the query
            Respond with "True" if STATEMENT is relevant to QUERY and "False" otherwise.`,
        },
        {
          role: "user",
          content: `<QUERY>${query}</QUERY>\n<STATEMENT>${statement.fact}</STATEMENT>`,
        },
      ];

      let responseText = "";
      await makeModelCall(
        false,
        messages,
        (text) => {
          responseText = text;
        },
        { temperature: 0, maxTokens: 1 },
      );

      if (responseText === "True") {
        finalStatements.push(statement);
      }
    }),
  );

  return finalStatements;
}
