import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { SearchService } from "~/services/search.server";
import { makeModelCall } from "~/lib/model.server";
import { json } from "@remix-run/node";
import type { CoreMessage } from "ai";

export const ExtensionSearchBodyRequest = z.object({
  input: z.string().min(1, "Input text is required"),
  limit: z.number().optional().default(20),
  maxBfsDepth: z.number().optional(),
  includeInvalidated: z.boolean().optional(),
  entityTypes: z.array(z.string()).optional(),
  scoreThreshold: z.number().optional(),
  minResults: z.number().optional(),
});

const searchService = new SearchService();

/**
 * Generate multiple search queries from user input using LLM
 */
async function generateSearchQueries(userInput: string): Promise<string[]> {
  const messages: CoreMessage[] = [
    {
      role: "system",
      content: `You are my personal memory assistant. I'm writing something and need you to help me recall relevant information from my past conversations, notes, and experiences that might be useful for what I'm currently working on.

Based on what I'm typing, think about what information from my memory would be most helpful:
- What have I discussed before that relates to this topic?
- What context, decisions, or insights might I need to remember?
- What related work, people, or concepts should I be aware of?
- What problems or solutions have I encountered that are similar?
- What background information would help me with this task?

Generate 3-5 specific search queries that will help me find the most relevant memories and context for my current work. Think like you're helping me remember things I might have forgotten or overlooked.

Return the JSON array of strings wrapped in <output></output> tags. Each string should be a search query.

Format: <output>["query1", "query2", "query3"]</output>

Example input: "working on the user authentication feature"
Example output: ["user authentication implementation", "login flow discussion", "authentication security concerns", "user session management", "auth token handling"]`,
    },
    {
      role: "user", 
      content: userInput,
    },
  ];

  try {
    const response = await makeModelCall(
      false,
      messages,
      () => {}, // onFinish callback
      { temperature: 0.3 }
    );

    // Extract content from <output> tags and parse JSON
    const outputMatch = (response as string).match(/<output>(.*?)<\/output>/s);
    if (!outputMatch) {
      throw new Error("No output tags found in LLM response");
    }
    
    const queries = JSON.parse(outputMatch[1].trim());
    
    // Validate that we got an array of strings
    if (!Array.isArray(queries) || !queries.every(q => typeof q === 'string')) {
      throw new Error("Invalid response format from LLM");
    }

    return queries.slice(0, 5); // Limit to max 5 queries
  } catch (error) {
    console.error("Error generating search queries:", error);
    // Fallback: use the original input as a single query
    return [userInput];
  }
}

/**
 * Deduplicate facts and episodes from multiple search results
 */
function deduplicateResults(results: Array<{ episodes: string[]; facts: string[] }>) {
  const uniqueFacts = new Set<string>();
  const uniqueEpisodes = new Set<string>();

  for (const result of results) {
    result.facts.forEach(fact => uniqueFacts.add(fact));
    result.episodes.forEach(episode => uniqueEpisodes.add(episode));
  }

  return {
    facts: Array.from(uniqueFacts),
    episodes: Array.from(uniqueEpisodes),
  };
}

const { action, loader } = createActionApiRoute(
  {
    body: ExtensionSearchBodyRequest,
    allowJWT: true,
    authorization: {
      action: "search",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    // Generate multiple search queries from user input
    const searchQueries = await generateSearchQueries(body.input);
    
    // Execute all search queries in parallel
    const searchResults = await Promise.all(
      searchQueries.map(query => 
        searchService.search(query, authentication.userId, {
          limit: Math.ceil(body.limit / searchQueries.length), // Distribute limit across queries
          maxBfsDepth: body.maxBfsDepth,
          includeInvalidated: body.includeInvalidated,
          entityTypes: body.entityTypes,
          scoreThreshold: body.scoreThreshold,
          minResults: body.minResults,
        })
      )
    );

    // Deduplicate and combine results
    const combinedResults = deduplicateResults(searchResults);
    
    // Limit final results if they exceed the requested limit
    const finalResults = {
      facts: combinedResults.facts.slice(0, body.limit),
      episodes: combinedResults.episodes.slice(0, body.limit),
      queries_used: searchQueries, // Include the generated queries for debugging
    };

    return json(finalResults);
  },
);

export { action, loader };