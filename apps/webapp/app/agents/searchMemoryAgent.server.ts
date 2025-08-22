import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { type CoreMessage, generateText, tool } from "ai";
import { logger } from "~/services/logger.service";
import { SearchService } from "~/services/search.server";

// Input schema for the agent
export const SearchMemoryAgentInput = z.object({
  userInput: z.string().min(1, "User input is required"),
  userId: z.string().min(1, "User ID is required"),
  context: z
    .string()
    .optional()
    .describe("Additional context about the user's current work"),
});

/**
 * Search Memory Agent - Designed to find relevant context from user's memory
 *
 * This agent searches the user's memory using a searchMemory tool, retrieves relevant
 * facts and episodes, then summarizes them into a concise, relevant context summary.
 */
export class SearchMemoryAgent {
  private model = openai("gpt-4o");
  private searchService = new SearchService();

  async generateContextSummary(
    input: z.infer<typeof SearchMemoryAgentInput>,
  ): Promise<string> {
    const { userInput, userId, context } = SearchMemoryAgentInput.parse(input);

    // Define the searchMemory tool that actually calls the search service
    const searchMemoryTool = tool({
      description:
        "Search the user's memory for relevant facts and episodes based on a query",
      parameters: z.object({
        query: z.string().describe("Search query to find relevant information"),
      }),
      execute: async ({ query }) => {
        try {
          const searchResult = await this.searchService.search(query, userId);

          return {
            facts: searchResult.facts || [],
            episodes: searchResult.episodes || [],
          };
        } catch (error) {
          logger.error(`SearchMemory tool error: ${error}`);
          return {
            facts: [],
            episodes: [],
          };
        }
      },
    });

    const messages: CoreMessage[] = [
      {
        role: "system",
        content: `You are a specialized memory search and summarization agent. Your job is to:

1. First, use the searchMemory tool to find relevant information from the user's memory based on their input
2. Then, analyze the retrieved facts and episodes to create a concise, relevant summary

You have access to a searchMemory tool that can search the user's knowledge base. Use this tool with relevant search queries to find information that would help answer their question.

After retrieving the information, provide a concise summary (2-4 sentences) that highlights the most relevant context for answering their question. Focus on:
- Key facts that directly relate to their question
- Important background information or decisions
- Relevant examples or past experiences
- Critical context that would help provide a good answer

If no relevant information is found, provide a brief statement indicating that.`,
      },
      {
        role: "user",
        content: `User input: "${userInput}"${context ? `\n\nAdditional context: ${context}` : ""}\n\nPlease search my memory for relevant information and provide a concise summary of the most important context for this question.`,
      },
    ];

    try {
      const result = await generateText({
        model: this.model,
        messages,
        tools: {
          searchMemory: searchMemoryTool,
        },
        maxSteps: 5,
        temperature: 0.3,
        maxTokens: 600,
      });

      return result.text.trim();
    } catch (error) {
      logger.error(`SearchMemoryAgent error: ${error}`);

      return `Context related to: ${userInput}. Looking for relevant background information, previous discussions, and related concepts that would help provide a comprehensive answer.`;
    }
  }
}

// Export a singleton instance
export const searchMemoryAgent = new SearchMemoryAgent();
