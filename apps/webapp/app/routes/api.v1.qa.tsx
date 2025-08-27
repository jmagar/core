import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { SearchService } from "~/services/search.server";
import { makeModelCall } from "~/lib/model.server";
import { json } from "@remix-run/node";

export const QABodyRequest = z.object({
  question: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  spaceId: z.string().optional(),
  limit: z.number().optional(),
  maxBfsDepth: z.number().optional(),
  includeInvalidated: z.boolean().optional(),
  entityTypes: z.array(z.string()).optional(),
  scoreThreshold: z.number().optional(),
  minResults: z.number().optional(),
});

const searchService = new SearchService();
const { action, loader } = createActionApiRoute(
  {
    body: QABodyRequest,
    allowJWT: true,
    authorization: {
      action: "search",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    // First, search for relevant information
    const searchResults = await searchService.search(
      body.question,
      authentication.userId,
      {
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        limit: body.limit || 20, // Get more results for better context
        maxBfsDepth: body.maxBfsDepth,
        includeInvalidated: body.includeInvalidated,
        entityTypes: body.entityTypes,
        scoreThreshold: body.scoreThreshold,
        minResults: body.minResults,
      },
    );

    // Combine episodes and facts into context
    let context = [...searchResults.episodes].join("\n\n");

    searchResults.facts.map((fact) => {
      context += `\n\nfact: ${fact.fact}\n validAt: ${fact.validAt}`;
    });

    // console.log("Context:", context);

    if (!context.trim()) {
      return json({
        question: body.question,
        generated_answer: "I couldn't find any relevant information to answer this question.",
      });
    }

    // Generate answer using LLM
    const prompt = `You are an analytical AI that reasons deeply about context before answering questions. Your task is to:

1. FIRST: Look for direct, explicit answers in the context
2. ANALYZE the context thoroughly for relevant information
3. IDENTIFY patterns, connections, and implications 
4. REASON about what the context suggests or implies
5. ANSWER based on direct evidence OR analysis

<reasoning>
- Scan through ALL episodes and facts completely before answering
- Look for every explicit statement that relates to the question
- NEVER stop after finding the first answer - continue scanning for more
- When asking "what did X show Y", look for ALL items X showed Y on that date
- Collect multiple items, events, or details that answer the same question
- If not found directly, identify all context elements related to the question
- Look for patterns, themes, and implicit information in the context
- Consider what the context suggests beyond explicit statements
- Note any contradictions or missing information that affects the answer
- Pay close attention to temporal information and dates (validAt timestamps)
- For time-sensitive questions, prioritize more recent information
- Consider the chronological sequence of events when relevant
- CRITICAL: Ensure completeness by including ALL relevant items found
- If you find 2+ items for the same question, mention them all in your answer
- Be precise with details (specific types, colors, descriptions when available)
- Draw logical conclusions based on available evidence
- Don't give reasoning in the output
</reasoning>

Follow this output format. don't give the JSON with \`\`\`json
<output>
{"answer" : "Your direct, short(max 2 sentences) answer based on your analysis"}
</output>
`;

    const userPrompt = `<context>
    ${context}
    </context>

    <question>
    Question: ${body.question}
    </question>
    `;
    let responseText = "";
    let generated_answer = "";
    try {
      await makeModelCall(
        false, // Don't stream
        [{ role: "system", content: prompt }, { role: "user", content: userPrompt }],
        (text) => {
          responseText = text;
        }
      );

      const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/);
      if (outputMatch && outputMatch[1]) {
        try {
          const parsedOutput = JSON.parse(outputMatch[1].trim());
          generated_answer = parsedOutput.answer || "No answer provided";
        } catch (jsonError) {
          console.error("Error parsing JSON output:", jsonError);
          generated_answer = outputMatch[1].trim();
        }
      }
    } catch (error) {
      console.error("Error generating answer:", error);
      generated_answer = "I encountered an error while generating an answer to this question.";
    }

    return json({
      question: body.question,
      generated_answer,
    });
  },
);

export { action, loader };