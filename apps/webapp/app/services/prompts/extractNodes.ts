/**
 * Prompts for extracting entity nodes from episodes
 */

import { type CoreMessage } from "ai";

export interface ExtractedEntity {
  name: string;
  type: string;
  attributes?: Record<string, any>;
}

export interface ExtractedEntities {
  entities: ExtractedEntity[];
}

export interface MissedEntities {
  missedEntities: string[];
}

export interface EntityClassificationTriple {
  uuid: string;
  name: string;
  type: string | null;
}

export interface EntityClassification {
  entityClassifications: EntityClassificationTriple[];
}

/**
 * Extract entities from an episode using message-based approach
 */
export const extract_message = (
  context: Record<string, any>,
): CoreMessage[] => {
  const sysPrompt = `You are an AI assistant that extracts entity nodes from conversational messages. 
Your primary task is to extract and classify significant entities mentioned in the conversation.`;

  const userPrompt = `
<PREVIOUS EPISODES>
${JSON.stringify(context.previousEpisodes || [], null, 2)}
</PREVIOUS EPISODES>

<CURRENT EPISODE>
${context.episodeContent}
</CURRENT EPISODE>

<ENTITY TYPES>
${JSON.stringify(context.entityTypes || {}, null, 2)}
</ENTITY TYPES>

Instructions:

You are given a conversation context and a CURRENT EPISODE. Your task is to extract **entity nodes** mentioned **explicitly or implicitly** in the CURRENT EPISODE.

1. **Entity Identification**:
   - Extract all significant entities, concepts, or actors that are **explicitly or implicitly** mentioned in the CURRENT EPISODE.
   - **Exclude** entities mentioned only in the PREVIOUS EPISODES (they are for context only).

2. **Entity Classification**:
   - Use the descriptions in ENTITY TYPES to classify each extracted entity.
   - Assign the appropriate type for each one.

3. **Exclusions**:
   - Do NOT extract entities representing relationships or actions.
   - Do NOT extract dates, times, or other temporal information—these will be handled separately.

4. **Formatting**:
   - Be **explicit and unambiguous** in naming entities (e.g., use full names when available).

${context.customPrompt || ""}
`;

  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
};

/**
 * Extract entities from text-based content
 */
export const extract_text = (context: Record<string, any>): CoreMessage[] => {
  const sysPrompt = `You are an AI assistant that extracts entity nodes from text. 
Your primary task is to extract and classify the speaker and other significant entities mentioned in the provided text.`;

  const userPrompt = `
<TEXT>
${context.episodeContent}
</TEXT>

<ENTITY TYPES>
${JSON.stringify(context.entityTypes || {}, null, 2)}
</ENTITY TYPES>

Given the above text, extract entities from the TEXT that are explicitly or implicitly mentioned.
For each entity extracted, also determine its entity type based on the provided ENTITY TYPES and their descriptions.
Indicate the classified entity type by providing its entity_type_id.

${context.customPrompt || ""}

Guidelines:
1. Extract significant entities, concepts, or actors mentioned in the conversation.
2. Avoid creating nodes for relationships or actions.
3. Avoid creating nodes for temporal information like dates, times or years (these will be added to edges later).
4. Be as explicit as possible in your node names, using full names and avoiding abbreviations.
`;

  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
};

/**
 * Extract entities from an episode using JSON-based approach
 */
export const extract_json = (context: Record<string, any>): CoreMessage[] => {
  const sysPrompt = `You are an AI assistant that extracts entity nodes from text. 
Your primary task is to extract and classify significant entities mentioned in the content.`;

  const userPrompt = `
<PREVIOUS EPISODES>
${JSON.stringify(context.previousEpisodes || [], null, 2)}
</PREVIOUS EPISODES>

<CURRENT EPISODE>
${context.episodeContent}
</CURRENT EPISODE>

<ENTITY TYPES>
${JSON.stringify(context.entityTypes || {}, null, 2)}
</ENTITY TYPES>

Instructions:

Extract all significant entities mentioned in the CURRENT EPISODE. For each entity, provide a name and type.
Respond with a JSON object containing an "entities" array of objects, each with "name" and "type" properties.

Guidelines:
1. Extract significant entities, concepts, or actors mentioned in the content.
2. Avoid creating nodes for relationships or actions.
3. Avoid creating nodes for temporal information like dates, times or years (these will be added to edges later).
4. Be as explicit as possible in your node names, using full names and avoiding abbreviations.

${context.customPrompt || ""}
`;

  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
};

/**
 * Check for missed entities
 */
export const reflexion = (context: Record<string, any>): CoreMessage[] => {
  const sysPrompt = `You are an AI assistant that determines which entities have not been extracted from the given context`;

  const userPrompt = `
<PREVIOUS EPISODES>
${JSON.stringify(context.previousEpisodes || [], null, 2)}
</PREVIOUS EPISODES>

<CURRENT EPISODE>
${context.episodeContent}
</CURRENT EPISODE>

<EXTRACTED ENTITIES>
${JSON.stringify(context.extractedEntities || [], null, 2)}
</EXTRACTED ENTITIES>

Given the above previous episodes, current episode, and list of extracted entities; determine if any entities haven't been
extracted. Respond with a JSON object containing a "missedEntities" array of strings.
`;

  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
};

/**
 * Extract additional attributes for entities
 */
export const extract_attributes = (
  context: Record<string, any>,
): CoreMessage[] => {
  return [
    {
      role: "system",
      content:
        "You are a helpful assistant that extracts entity properties from the provided text.",
    },
    {
      role: "user",
      content: `
<EPISODES>
${JSON.stringify(context.previousEpisodes || [], null, 2)}
${JSON.stringify(context.episodeContent, null, 2)}
</EPISODES>

Given the above EPISODES and the following ENTITY, update any of its attributes based on the information provided
in EPISODES. Use the provided attribute descriptions to better understand how each attribute should be determined.

Guidelines:
1. Do not hallucinate entity property values if they cannot be found in the current context.
2. Only use the provided EPISODES and ENTITY to set attribute values.
3. The summary attribute represents a summary of the ENTITY, and should be updated with new information about the Entity from the EPISODES. 
    Summaries must be no longer than 250 words.

<ENTITY>
${JSON.stringify(context.node, null, 2)}
</ENTITY>
`,
    },
  ];
};
