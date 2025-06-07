import { type Triple } from "@core/types";
import { type CoreMessage } from "ai";

/**
 * Extract statements (triples) from episode content in a reified knowledge graph model
 * This function generates a prompt for LLM to extract subject-predicate-object statements
 * and represent them as first-class nodes with proper connections
 */
export const extractStatements = (
  context: Record<string, any>,
): CoreMessage[] => {
  return [
    {
      role: "system",
      content: `You are a knowledge graph expert who extracts factual statements from text as subject-predicate-object triples.

CRITICAL REQUIREMENT:
- You MUST ONLY use entities from the AVAILABLE ENTITIES list as subjects and objects.
- The "source" and "target" fields in your output MUST EXACTLY MATCH entity names from the AVAILABLE ENTITIES list.
- If you cannot express a fact using only the available entities, DO NOT include that fact in your output.
- DO NOT create, invent, or modify any entity names.
- NEVER create statements where the source and target are the same entity (no self-loops).

Your task is to identify important facts from the provided text and represent them in a knowledge graph format.

Follow these instructions:

1. First, carefully review the AVAILABLE ENTITIES list. These are the ONLY entities you can use as subjects and objects.
2. Identify factual statements that can be expressed using ONLY these available entities.
3. For each valid statement, provide:
   - source: The subject entity (MUST be from AVAILABLE ENTITIES)
   - predicate: The relationship type (can be a descriptive phrase)
   - target: The object entity (MUST be from AVAILABLE ENTITIES)

EXTRACT ALL MEANINGFUL RELATIONSHIPS:
- Extract any meaningful relationship between available entities that's expressed in the text.
- Use predicates that accurately describe the relationship between entities.
- Be creative but precise in identifying relationships - don't miss important facts.
- Common examples include (but are not limited to):
  * Ownership or association (e.g., "Taylor Swift" "performs at" "Taylor Swift's concert")
  * Participation or attendance (e.g., "John" "attends" "Conference")
  * Personal connections (e.g., "John" "is friend of" "Max")
  * Aliases (e.g., "John" "is also known as" "John Smith")
  * Locations (e.g., "Company" "headquartered in" "City")
  * Characteristics (e.g., "Product" "has feature" "Feature")

ABOUT TEMPORAL INFORMATION:
- For events with dates/times, DO NOT create a separate statement with the event as both source and target.
- Instead, ADD the temporal information directly to the most relevant statement as attributes.
- Example: For "Max married to Tina on January 14", add the timespan to the "married to" relationship.
- If there are multiple statements about an event, choose the most ownership-related one to add the timespan to.

Format your response as a JSON object with the following structure:
<output>
{
  "edges": [
    {
      "source": "[Subject Entity Name - MUST be from AVAILABLE ENTITIES]",
      "predicate": "[Relationship Type]",
      "target": "[Object Entity Name - MUST be from AVAILABLE ENTITIES]", 
      "fact": "[Natural language representation of the fact]",
      "attributes": { 
        "confidence": confidence of the fact
        "source": "explicit or implicit source type",
      }
    }
  ]
}
</output>

IMPORTANT RULES:
- ONLY use entities from AVAILABLE ENTITIES as source and target.
- NEVER create statements where source or target is not in AVAILABLE ENTITIES.
- NEVER create statements where the source and target are the same entity (NO SELF-LOOPS).
- Instead of creating self-loops for temporal information, add timespan attributes to relevant statements.
- If you cannot express a fact using only available entities, omit it entirely.
- Always wrap output in tags <output> </output>.

Example of CORRECT usage:
If AVAILABLE ENTITIES contains ["John", "Max", "Wedding"], you can create:
- "John" "attends" "Wedding" ✓
- "Max" "married to" "Tina" with timespan attribute ✓

Example of INCORRECT usage:
- "John" "attends" "Party" ✗ (if "Party" is not in AVAILABLE ENTITIES)
- "Marriage" "occurs on" "Marriage" ✗ (NEVER create self-loops)
- "January 14" "is" "Marriage date" ✗ (if "January 14" or "Marriage date" is not in AVAILABLE ENTITIES)`,
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
 * Analyze similar statements to determine duplications and contradictions
 * This prompt helps the LLM evaluate semantically similar statements found through vector search
 * to determine if they are duplicates or contradictions
 */
export const resolveStatementPrompt = (
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
