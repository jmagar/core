import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { json } from "@remix-run/node";
import { searchMemoryAgent } from "~/agents/searchMemoryAgent.server";

export const ExtensionSearchBodyRequest = z.object({
  input: z.string().min(1, "Input text is required"),
});

/**
 * Generate context summary from user input using SearchMemoryAgent
 */
async function generateContextSummary(
  userInput: string,
  userId: string,
): Promise<string> {
  try {
    const summary = await searchMemoryAgent.generateContextSummary({
      userInput,
      userId,
    });

    return summary;
  } catch (error) {
    console.error("Error generating context with agent:", error);
    // Fallback: use simple context description
    return `Context related to: ${userInput}. Looking for relevant background information, previous discussions, and related concepts that would help provide a comprehensive answer.`;
  }
}

const { action, loader } = createActionApiRoute(
  {
    body: ExtensionSearchBodyRequest,
    method: "POST",
    allowJWT: true,
    authorization: {
      action: "search",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    // Generate context summary using SearchMemoryAgent
    const contextSummary = await generateContextSummary(
      body.input,
      authentication.userId,
    );

    // Return results with agent-generated context summary
    const finalResults = {
      context_summary: contextSummary, // Agent's context summary
    };

    return json(finalResults);
  },
);

export { action, loader };
