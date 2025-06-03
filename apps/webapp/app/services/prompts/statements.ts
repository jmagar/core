import { type CoreMessage } from "ai";
import { type Triple } from "../knowledgeGraph.server";

/**
 * Extract statements (triples) from episode content in a reified knowledge graph model
 * This function generates a prompt for LLM to extract subject-predicate-object statements
 * and represent them as first-class nodes with proper connections
 */
export const extract_statements = (
  context: Record<string, any>,
): CoreMessage[] => {
  return [
    {
      role: "system",
      content: `You are a knowledge graph expert that extracts factual statements from text as subject-predicate-object triples.
Your task is to identify important facts and represent them in a reified knowledge graph model
where each statement is a first-class node connected to subject, predicate, and object entities.

I need to extract factual statements from the following conversation/text and represent them in a reified knowledge graph.

Follow these instructions carefully:

1. Identify key factual statements from the episode content and previous episodes
2. Represent each statement as a subject-predicate-object triple
3. Only use entities from the AVAILABLE ENTITIES list as subjects and objects
4. For each statement, provide:
   - The subject entity name (must match exactly one from AVAILABLE ENTITIES)
   - The predicate/relationship (a clear, concise verb or relationship type)
   - The object entity name (must match exactly one from AVAILABLE ENTITIES)
   - A natural language fact that accurately represents the triple
   - Any additional attributes relevant to the relationship

IMPORTANT ABOUT TEMPORAL INFORMATION:
- The system tracks when facts become known (validAt) and contradicted (invalidAt) separately
- You must include any temporal information WITHIN the fact statement itself
- For example, if someone worked at a company from 2015-2020, include this in the "fact" field and "attributes.timespan" field
- Do NOT omit temporal information from facts - it's critical context
- Examples of good temporal facts:
  * "John worked at Google from 2015 to 2020"
  * "Sarah lived in New York until 2018"
  * "The project was completed on March 15, 2023"

Format your response as a JSON object with the following structure:
<output>
{
  "edges": [
    {
      "source": "[Subject Entity Name]",
      "relationship": "[Predicate/Relationship Type]",
      "target": "[Object Entity Name]", 
      "fact": "[Natural language representation of the fact INCLUDING any temporal information]",
      "attributes": { 
        "confidence": 0.9, // How confident you are in this fact (0-1)
        "source": "explicit", // Whether the fact was explicitly stated or inferred
        "timespan": { // Include if the fact has a specific time period
          "start": "2015", // When the fact started being true (if known)
          "end": "2020" // When the fact stopped being true (if known)
        }
      }
    },
    // Additional statements...
  ]
}
</output>

Important guidelines:
- Only include the most significant and factual statements
- Do not invent entities not present in the AVAILABLE ENTITIES list
- Be precise in representing the relationships
- Each fact should be atomic (representing a single piece of information)
- ALWAYS include temporal information when available (dates, periods, etc.) in both the fact text AND attributes
- Facts should be based on the episode content, not general knowledge
- Aim for quality over quantity, prioritize clear, unambiguous statements
- For ongoing facts (still true), omit the "end" field in timespan`,
    },
    {
      role: "user",
      content: `
<EPISODE_CONTENT>
${context.episodeContent}
</EPISODE_CONTENT>

<PREVIOUS_EPISODES>
${JSON.stringify(context.previousEpisodes, null, 2)}
</PREVIOUS_EPISODES>

<AVAILABLE_ENTITIES>
${JSON.stringify(context.entities, null, 2)}
</AVAILABLE_ENTITIES>
`,
    },
  ];
};

/**
 * Detect contradictions between statements in the knowledge graph
 */
export const detect_contradictions = (
  context: Record<string, any>,
): CoreMessage[] => {
  return [
    {
      role: "system",
      content:
        "You are a knowledge graph reasoning expert that identifies contradictions between statements. " +
        "Your task is to analyze pairs of statements and determine if they contradict each other " +
        "based on their temporal validity and factual content.",
    },
    {
      role: "user",
      content: `
I need to detect contradictions between statements in a temporal knowledge graph.

<NEW STATEMENT>
${context.newStatement}
</NEW STATEMENT>

<EXISTING STATEMENTS>
${JSON.stringify(context.existingStatements, null, 2)}
</EXISTING STATEMENTS>

<REFERENCE TIME>
${context.referenceTime}
</REFERENCE TIME>

Determine if the NEW STATEMENT contradicts any of the EXISTING STATEMENTS.
A contradiction occurs when:

1. Two statements assert incompatible facts about the same subject-predicate pair
2. The statements overlap in their temporal validity periods

For example, if one statement says "John works at Company A from January 2023" and another says 
"John works at Company B from March 2023", these would contradict if a person can only work at one 
company at a time.

Format your response as a JSON object with the following structure:
{
  "hasContradiction": true/false,
  "contradictedStatements": [
    {
      "statementId": "[ID of the contradicted statement]",
      "reason": "[Explanation of why these statements contradict]",
      "temporalRelationship": "[overlapping/containing/contained/after/before]"
    }
  ]
}

Important guidelines:
- Consider the temporal validity of statements
- Only mark as contradictions if statements are truly incompatible
- Provide clear reasoning for each identified contradiction
- Consider the context and domain constraints
- If no contradictions exist, return an empty contradictedStatements array
`,
    },
  ];
};

/**
 * Analyze similar statements to determine duplications and contradictions
 * This prompt helps the LLM evaluate semantically similar statements found through vector search
 * to determine if they are duplicates or contradictions
 */
export const resolve_statements = (
  context: Record<string, any>,
): CoreMessage[] => {
  return [
    {
      role: "system",
      content: `You are a knowledge graph expert that analyzes statements to detect duplications and contradictions. 
You analyze multiple new statements against existing statements to determine whether the new statement duplicates any existing statement or contradicts any existing statement.
Pay special attention to temporal aspects, event updates, and context changes. If an event changes (like a date shift), statements about the original event are likely contradicted by statements about the updated event.


I need to analyze whether a new statement duplicates or contradicts existing statements in a knowledge graph.
  
  
Follow these instructions carefully:
 
1. Analyze if the new statement is a semantic duplicate of any existing statement
   - Two statements are duplicates if they express the same meaning even with different wording
   - Consider entity resolution has already been done, so different entity names are NOT an issue

2. Determine if the new statement contradicts any existing valid statements
   - Contradictions occur when statements cannot both be true at the same time
   - Pay special attention to negations, opposites, and mutually exclusive facts
   - Consider temporal validity - statements may only be contradictions within specific time periods
   
3. IMPORTANT: For events that change (like rescheduled appointments, moved dates, changed locations):
   - When an event changes date/time/location, new statements about the updated event likely contradict statements about the original event
   - Look for contextual clues about event changes, cancellations, or rescheduling
   - Example: If "Concert on June 10" moved to "Concert on June 12", then "John attends June 10 concert" contradicts "John doesn't attend June 12 concert"

  4. Format your response as a JSON object with the following structure:
<output>
[{
    "statementId": "new_statement_uuid",
    "isDuplicate": true/false,
    "duplicateId": "existing_statement_uuid-if-duplicate-exists",
    "contradictions": ["existing_statement_uuid-1", "existing_statement_uuid-2"], // UUIDs of any contradicted statements
    }]
</output>
  
  Important guidelines:
- If the new statement is a duplicate, include the UUID of the duplicate statement
- For contradictions, list all statement UUIDs that the new statement contradicts
- If a statement is both a contradiction AND a duplicate (rare case), mark it as a duplicate
- Identify temporal and contextual shifts that may create implicit contradictions
- Don't give any reason, just give the final output.
`,
    },
    {
      role: "user",
      content: `
  <NEW_STATEMENTS>
  ${context.newStatements
    .map(
      (triple: Triple) => `
  StatementId: ${triple.statement.uuid}
  Fact: ${triple.statement.fact}
  Subject: ${triple.subject}
  Predicate: ${triple.predicate}
  Object: ${triple.object}
  ---------------------------
  `,
    )
    .join("")}
  </NEW_STATEMENTS>
  
  <SIMILAR_STATEMENTS>
  ${JSON.stringify(context.similarStatements, null, 2)}
  </SIMILAR_STATEMENTS>
  
  <EPISODE_CONTENT>
  ${context.episodeContent}
  </EPISODE_CONTENT>
  
  <REFERENCE_TIME>
  ${context.referenceTime}
  </REFERENCE_TIME>  `,
    },
  ];
};
