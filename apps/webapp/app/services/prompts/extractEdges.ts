/**
 * Prompts for extracting relationships between entities
 */

import { Message, type CoreMessage } from "ai";

export interface Edge {
  relationshipType: string;
  sourceEntityName: string;
  targetEntityName: string;
  fact: string;
  validAt?: string;
  invalidAt?: string;
}

export interface ExtractedEdges {
  edges: Edge[];
}

export interface MissingFacts {
  missingFacts: string[];
}

/**
 * Extract relationships between entities
 */
export const edge = (context: Record<string, any>): CoreMessage[] => {
  return [
    {
      role: "system",
      content:
        "You are an expert fact extractor that extracts fact triples from text. " +
        "1. Extracted fact triples should also be extracted with relevant date information." +
        "2. Treat the CURRENT TIME as the time the CURRENT EPISODE was created. All temporal information should be extracted relative to this time.",
    },
    {
      role: "user",
      content: `
<PREVIOUS_EPISODES>
${JSON.stringify(context.previousEpisodes || [], null, 2)}
</PREVIOUS_EPISODES>

<CURRENT_EPISODE>
${context.episodeContent}
</CURRENT_EPISODE>

<ENTITIES>
${JSON.stringify(context.nodes || [], null, 2)}
</ENTITIES>

<REFERENCE_TIME>
${context.referenceTime}  # ISO 8601 (UTC); used to resolve relative time mentions
</REFERENCE_TIME>

<RELATIONSHIP TYPES>
${JSON.stringify(context.edgeTypes || {}, null, 2)}
</RELATIONSHIP TYPES>

# TASK
Extract all factual relationships between the given ENTITIES based on the CURRENT EPISODE.
Only extract facts that:
- involve two DISTINCT ENTITIES from the ENTITIES list,
- are clearly stated or unambiguously implied in the CURRENT EPISODE,
    and can be represented as edges in a knowledge graph.
- The RELATIONSHIP TYPES provide a list of the most important types of relationships, make sure to extract any facts that
    could be classified into one of the provided relationship types

You may use information from the PREVIOUS EPISODES only to disambiguate references or support continuity.

${context.customPrompt || ""}

# EXTRACTION RULES

1. Only emit facts where both the subject and object match entities in ENTITIES.
2. Each fact must involve two **distinct** entities.
3. Use a SCREAMING_SNAKE_CASE string as the \`relationshipType\` (e.g., FOUNDED, WORKS_AT).
4. Do not emit duplicate or semantically redundant facts.
5. The \`fact\` should quote or closely paraphrase the original source sentence(s).
6. Use \`REFERENCE_TIME\` to resolve vague or relative temporal expressions (e.g., "last week").
7. Do **not** hallucinate or infer temporal bounds from unrelated events.

# DATETIME RULES

- Use ISO 8601 with "Z" suffix (UTC) (e.g., 2025-04-30T00:00:00Z).
- If the fact is ongoing (present tense), set \`validAt\` to REFERENCE_TIME.
- If a change/termination is expressed, set \`invalidAt\` to the relevant timestamp.
- Leave both fields \`null\` if no explicit or resolvable time is stated.
- If only a date is mentioned (no time), assume 00:00:00.
- If only a year is mentioned, use January 1st at 00:00:00.

Respond with a JSON object containing an "edges" array of objects, each with "relationshipType", "sourceEntityName", "targetEntityName", "fact", and optionally "validAt" and "invalidAt" properties.
`,
    },
  ];
};

/**
 * Check for missed facts
 */
export const reflexion = (context: Record<string, any>): CoreMessage[] => {
  const sysPrompt = `You are an AI assistant that determines which facts have not been extracted from the given context`;

  const userPrompt = `
<PREVIOUS EPISODES>
${JSON.stringify(context.previousEpisodes || [], null, 2)}
</PREVIOUS EPISODES>

<CURRENT EPISODE>
${context.episodeContent}
</CURRENT EPISODE>

<EXTRACTED ENTITIES>
${JSON.stringify(context.nodes || [], null, 2)}
</EXTRACTED ENTITIES>

<EXTRACTED FACTS>
${JSON.stringify(context.extractedFacts || [], null, 2)}
</EXTRACTED FACTS>

Given the above EPISODES, list of EXTRACTED ENTITIES entities, and list of EXTRACTED FACTS; 
determine if any facts haven't been extracted. Respond with a JSON object containing a "missingFacts" array of strings.
`;

  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
};

/**
 * Extract additional attributes for edges
 */
export const extract_attributes = (
  context: Record<string, any>,
): CoreMessage[] => {
  return [
    {
      role: "system",
      content:
        "You are a helpful assistant that extracts fact properties from the provided text.",
    },
    {
      role: "user",
      content: `
<EPISODE>
${JSON.stringify(context.episodeContent, null, 2)}
</EPISODE>

<REFERENCE TIME>
${context.referenceTime}
</REFERENCE TIME>

Given the above EPISODE, its REFERENCE TIME, and the following FACT, update any of its attributes based on the information provided
in EPISODE. Use the provided attribute descriptions to better understand how each attribute should be determined.

Guidelines:
1. Do not hallucinate entity property values if they cannot be found in the current context.
2. Only use the provided EPISODES and FACT to set attribute values.

<FACT>
${JSON.stringify(context.fact, null, 2)}
</FACT>
`,
    },
  ];
};
