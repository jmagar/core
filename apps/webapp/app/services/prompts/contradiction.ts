/**
 * Prompts for detecting contradictions between facts
 */

import { type CoreMessage } from "ai";

export interface ContradictionResult {
  isContradiction: boolean;
  explanation?: string;
  resolution?: string;
}

/**
 * Detect contradictions between facts
 */
export const detect = (context: Record<string, any>): CoreMessage[] => {
  return [
    {
      role: "system",
      content:
        "You are an expert at detecting contradictions between facts in a knowledge graph.",
    },
    {
      role: "user",
      content: `
<EXISTING FACT>
${JSON.stringify(context.existingFact, null, 2)}
</EXISTING FACT>

<NEW FACT>
${JSON.stringify(context.newFact, null, 2)}
</NEW FACT>

Determine if the NEW FACT contradicts the EXISTING FACT. A contradiction occurs when:
1. Both facts cannot be simultaneously true
2. The facts present mutually exclusive information about the same entities and relationship

Respond with a JSON object containing:
- "isContradiction": boolean (true if contradiction exists)
- "explanation": string (brief explanation of the contradiction if one exists)
- "resolution": string (suggested resolution approach, if applicable)

Be careful to consider:
- Temporal context (facts may be true at different times)
- Different levels of specificity (one fact may be more detailed)
- Different perspectives or interpretations
`,
    },
  ];
};
