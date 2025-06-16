/**
 * Prompts for extracting entity nodes from episodes
 */

import { type CoreMessage } from "ai";

/**
 * Extract entities from an episode using message-based approach
 */
export const extractMessage = (context: Record<string, any>): CoreMessage[] => {
  const sysPrompt = `You are an AI assistant that extracts entity nodes from conversational messages for a reified knowledge graph.
Your primary task is to extract and classify significant entities mentioned in the conversation.

In a reified knowledge graph, we need to identify subject and object entities that will be connected through statements.
Focus on extracting:
1. Subject entities (people, objects, concepts)
2. Object entities (people, objects, concepts)

Instructions:

You are given a conversation context and a CURRENT EPISODE. Your task is to extract **entity nodes** mentioned **explicitly or implicitly** in the CURRENT EPISODE.

1. **Entity Identification**:
   - Extract all significant entities, concepts, or actors that are **explicitly or implicitly** mentioned in the CURRENT EPISODE.
   - **Exclude** entities mentioned only in the PREVIOUS EPISODES (they are for context only).
   - For identity statements like "I am X" or "I'm X", extract BOTH the pronoun ("I") as a Alias entity AND the named entity (X).
   - For pronouns that refer to named entities, extract them as separate Alias entities.


2. **Entity Classification**:
   - Use the descriptions in ENTITY TYPES to classify each extracted entity.
   - Assign the appropriate type for each one.
   - Classify pronouns (I, me, you, etc.) as Alias entities.

3. **Exclusions**:
   - Do NOT extract entities representing relationships or actions (predicates will be handled separately).
   - Do NOT extract dates, times, or other temporal information—these will be handled separately.

4. **Formatting**:
   - Be **explicit and unambiguous** in naming entities (e.g., use full names when available).
   - For pronouns, use the exact form as they appear in the text (e.g., "I", "me", "you").


Format your response as a JSON object with the following structure:
<output>
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "Entity Type",
    }
    // Additional entities...
  ]
}
</output>`;

  const userPrompt = `
<PREVIOUS EPISODES>
${JSON.stringify(context.previousEpisodes || [], null, 2)}
</PREVIOUS EPISODES>

<CURRENT EPISODE>
${context.episodeContent}
</CURRENT EPISODE>

<ENTITY_TYPES>
${JSON.stringify(context.entityTypes || {}, null, 2)}
</ENTITY_TYPES>

`;

  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
};

/**
 * Extract entities from text-based content
 */
export const extractText = (context: Record<string, any>): CoreMessage[] => {
  const sysPrompt = `
You are an AI assistant that extracts entity nodes from text for a reified knowledge graph.
Your primary task is to extract and classify significant entities mentioned in the provided text.

In a reified knowledge graph, we need to identify subject and object entities that will be connected through statements.
Focus on extracting:
1. Subject entities
2. Object entities 

Instructions:

You are given a TEXT. Your task is to extract **entity nodes** mentioned **explicitly or implicitly** in the TEXT.

1. **Entity Identification**:
   - Extract all significant entities, concepts, or actors that are **explicitly or implicitly** mentioned in the TEXT.
   - For identity statements like "I am X" or "I'm X", extract BOTH the pronoun ("I") as a Alias entity AND the named entity (X).
   - For pronouns that refer to named entities, extract them as separate Alias entities.

2. **Entity Classification**:
   - Use the descriptions in ENTITY TYPES to classify each extracted entity.
   - Assign the appropriate type for each one.
   - Classify pronouns (I, me, you, etc.) as Alias entities.

3. **Exclusions**:
   - Do NOT extract entities representing relationships or actions (predicates will be handled separately).
   - Do NOT extract dates, times, or other temporal information—these will be handled separately.

4. **Formatting**:
   - Be **explicit and unambiguous** when naming entities (e.g., use full names when available).
   - For pronouns, use the exact form as they appear in the text (e.g., "I", "me", "you").

Format your response as a JSON object with the following structure:
<output>
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "Entity Type"
    }
    // Additional entities...
  ]
}
</output>`;
  const userPrompt = `
<TEXT>
${context.episodeContent}
</TEXT>

<ENTITY_TYPES>
${JSON.stringify(context.entityTypes || {}, null, 2)}
</ENTITY_TYPES>
`;

  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
};

/**
 * Extract entities from an episode using JSON-based approach
 */
export const extractJson = (context: Record<string, any>): CoreMessage[] => {
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
 * Resolve entity duplications
 */
export const dedupeNodes = (context: Record<string, any>): CoreMessage[] => {
  return [
    {
      role: "system",
      content: `You are a helpful assistant who determines whether or not ENTITIES extracted from a conversation are duplicates of existing entities.
      
Each entity in ENTITIES is represented as a JSON object with the following structure:
{
    id: integer id of the entity,
    name: "name of the entity",
    entity_type: "ontological classification of the entity",
    entity_type_description: "Description of what the entity type represents",
    duplication_candidates: [
        {
            idx: integer index of the candidate entity,
            name: "name of the candidate entity",
            entity_type: "ontological classification of the candidate entity",
            ...<additional attributes>
        }
    ]
}

For each of the above ENTITIES, determine if the entity is a duplicate of any of its duplication candidates.
Entities should only be considered duplicates if they refer to the *same real-world object or concept*.
Do NOT mark entities as duplicates if:
- They are related but distinct.
- They have similar names or purposes but refer to separate instances or concepts.

Task:
Your response must be a JSON object with an "entity_resolutions" array containing one entry for each entity.

For each entity, include:
- "id": the id of the entity (integer)
- "name": the name of the entity (string)
- "duplicate_idx": the index of the duplicate candidate, or -1 if no duplicate (integer)

Format your response as follows:
<output>
{
  "entity_resolutions": [
    {
      "id": 0,
      "name": "Entity Name",
      "duplicate_idx": -1
    },
    // Additional entity resolutions...
  ]
}
</output>

Notes:
- If an entity is a duplicate of one of its duplication_candidates, set duplicate_idx to the idx of that candidate.
- If an entity is not a duplicate of any candidate, set duplicate_idx to -1.
- Always include all entities from the input in your response.
- Always wrap the output in these tags <output> </output>
    `,
    },
    {
      role: "user",
      content: `
<PREVIOUS EPISODES>
${JSON.stringify(context.previousEpisodes || [], null, 2)}
</PREVIOUS EPISODES>

<CURRENT EPISODE>
${context.episodeContent}
</CURRENT EPISODE>

<ENTITIES>
${JSON.stringify(context.extracted_nodes, null, 2)}
</ENTITIES>
`,
    },
  ];
};

export const extractAttributes = (
  context: Record<string, any>,
): CoreMessage[] => {
  const sysPrompt = `
You are an AI assistant that extracts and enhances entity attributes based on context.
Your task is to analyze entities and provide appropriate attribute values for each entity based on its type definition.

For each entity:
1. Look at its type and identify the required and optional attributes from the entity type definitions
2. Check if the entity already has values for these attributes
3. For missing attributes, extract appropriate values from the context if possible
4. For existing attributes, enhance or correct them if needed based on the context
5. Give empty attributes object ({}) when there are no attributes to update
6. Only include attributes that you're updating - don't repeat existing attributes that don't need changes
7. I'll merge your new attributes with the current attributes, so only provide values that should be added or modified

Provide your output in this structure:
<output>
{
"entities": [
{
  "uuid": "entity-uuid",
  "attributes": {
    "attributeName1": "value1",
    "attributeName2": "value2",
    ...
  }
},
...
]
}
</output>`;

  const userPrompt = `
<ENTITY_TYPES>
${JSON.stringify(context.entityTypes, null, 2)}
</ENTITY_TYPES>

<ENTITIES>
${JSON.stringify(context.entities, null, 2)}
</ENTITIES>

<EPISODE_CONTENT>
${context.episodeContent}
</EPISODE_CONTENT>

Based on the above information, please extract and enhance attributes for each entity according to its type definition. Return only the uuid and updated attributes for each entity.`;
  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
};
