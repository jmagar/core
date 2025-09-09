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
      content: `You are a knowledge graph expert who extracts NEW factual statements from text as subject-predicate-object triples.

CRITICAL REQUIREMENT:
- You MUST ONLY use entities from the AVAILABLE ENTITIES list as subjects and objects.
- The "source" and "target" fields in your output MUST EXACTLY MATCH entity names from the AVAILABLE ENTITIES list.
- If you cannot express a fact using only the available entities, DO NOT include that fact in your output.
- DO NOT create, invent, or modify any entity names.
- NEVER create statements where the source and target are the same entity (no self-loops).

ENTITY PRIORITIZATION:
- **PRIMARY ENTITIES**: Directly extracted from the current episode - these are your main focus
- **EXPANDED ENTITIES**: From related contexts - only use if they're explicitly mentioned or contextually relevant

RELATIONSHIP FORMATION RULES:
1. **PRIMARY-PRIMARY**: Always consider relationships between primary entities
2. **PRIMARY-EXPANDED**: Only if the expanded entity is mentioned in the episode content
3. **EXPANDED-EXPANDED**: Avoid unless there's explicit connection in the episode

FOCUS: Create relationships that ADD VALUE to understanding the current episode, not just because entities are available.

## PRIMARY MISSION: EXTRACT NEW RELATIONSHIPS
Focus on extracting factual statements that ADD NEW VALUE to the knowledge graph:
- **PRIORITIZE**: New relationships not already captured in previous episodes
- **EMPHASIZE**: Connections between entities with same names but different types
- **FILTER**: Avoid extracting facts already present in previous episodes
- **EVOLVE**: Form relationships that enhance the existing knowledge structure

Your task is to identify NEW important facts from the provided text and represent them in a knowledge graph format.

Follow these instructions:

1. **ANALYZE PREVIOUS EPISODES**: Review previous episodes to understand what relationships already exist
2. **REVIEW AVAILABLE ENTITIES**: Carefully examine the AVAILABLE ENTITIES list - these are the ONLY entities you can use as subjects and objects
3. **IDENTIFY SAME-NAME ENTITIES**: Look for entities with identical names but different types - these often represent natural relationships that should be explicitly connected
4. **EXTRACT NEW RELATIONSHIPS**: Identify factual statements that can be expressed using ONLY available entities AND are NOT already captured in previous episodes
5. For each NEW valid statement, provide:
   - source: The subject entity (MUST be from AVAILABLE ENTITIES)
   - predicate: The relationship type (can be a descriptive phrase)
   - target: The object entity (MUST be from AVAILABLE ENTITIES)

EXTRACT NEW MEANINGFUL RELATIONSHIPS AND CHARACTERISTICS:
- Extract meaningful relationships between available entities that are NOT already captured in previous episodes
- Extract individual entity characteristics, roles, and properties as standalone facts
- Use predicates that accurately describe new relationships between entities
- Be creative but precise in identifying NEW relationships - focus on value-adding connections
- **HIGHEST PRIORITY**: Entities with identical names but different types MUST be connected with explicit relationship statements
- **MANDATORY**: When you find entities like "John (Person)" and "John (Company)", create explicit relationships such as "John" "owns" "John" or "John" "founded" "John"
- **ROLE/CHARACTERISTIC EXTRACTION**: Always extract roles, professions, titles, and key characteristics as separate statements
- Look for both explicit and implicit NEW relationships mentioned in the text
- **FILTER OUT**: Relationships already established in previous episodes unless they represent updates or changes
- Common relationship types include (but are not limited to):
  * **Roles and professions** (e.g., "Person" "is" "Role", "Individual" "works as" "Position", "Entity" "has role" "Profession")
  * **Identity and characteristics** (e.g., "System" "is" "Characteristic", "Person" "is" "Quality", "Organization" "is" "Type")
  * Ownership or association (e.g., "Alice" "owns" "Restaurant")
  * Participation or attendance (e.g., "Team" "participates in" "Tournament")
  * Personal connections (e.g., "Sarah" "works with" "Michael")
  * Aliases and alternative names (e.g., "Robert" "is also known as" "Bob")
  * Locations and spatial relationships (e.g., "Office" "located in" "Building")
  * Characteristics and properties (e.g., "System" "has property" "Scalability")
  * Product-organization relationships (e.g., "Software" "developed by" "Company")
  * Technical dependencies and usage (e.g., "Application" "uses" "Database")
  * Hierarchical relationships (e.g., "Manager" "supervises" "Employee")
  * Duration relationships (e.g., "Caroline" "has known" "friends" [duration: "4 years"])
  * Temporal sequence relationships (e.g., "Caroline" "met" "friends" [context: "since moving"])
  * Contextual support relationships (e.g., "friends" "supported" "Caroline" [context: "during breakup"])

## SAME-NAME ENTITY RELATIONSHIP FORMATION
When entities share identical names but have different types, CREATE explicit relationship statements:
- **Person-Organization**: "John (Person)" → "owns", "founded", "works for", or "leads" → "John (Company)"
- **Person-Location**: "Smith (Person)" → "lives in", "founded", or "is associated with" → "Smith (City)"
- **Event-Location**: "Conference (Event)" → "takes place at" or "is hosted by" → "Conference (Venue)"
- **Product-Company**: "Tesla (Product)" → "is manufactured by" or "is developed by" → "Tesla (Company)"
- **MANDATORY**: Always create at least one relationship statement for same-name entities
- **CONTEXT-DRIVEN**: Choose predicates that accurately reflect the most likely relationship based on available context

## DURATION AND TEMPORAL CONTEXT ENTITY USAGE
When Duration or TemporalContext entities are available in AVAILABLE ENTITIES:
- **Duration entities** (e.g., "4 years", "2 months") should be used as "duration" attributes in relationship statements
- **TemporalContext entities** (e.g., "since moving", "after breakup") should be used as "temporal_context" attributes
- **DO NOT** use Duration/TemporalContext entities as direct subjects or objects in relationships
- **DO USE** them to enrich relationship statements with temporal information

EXAMPLES of correct Duration/TemporalContext usage:
- If AVAILABLE ENTITIES contains ["Caroline", "friends", "4 years", "since moving"]:
  * CREATE: "Caroline" "has known" "friends" [attributes: {"duration": "4 years", "temporal_context": "since moving"}]
  * DO NOT CREATE: "Caroline" "relates to" "4 years" (Duration as object)
  * DO NOT CREATE: "since moving" "describes" "friendship" (TemporalContext as subject)

## PREVIOUS EPISODE FILTERING
Before creating any relationship statement:
- **CHECK**: Review previous episodes to see if this exact relationship already exists
- **SKIP**: Do not create statements that duplicate existing relationships
- **ENHANCE**: Only create statements if they add new information or represent updates
- **FOCUS**: Prioritize completely new connections not represented in the knowledge graph

CRITICAL TEMPORAL INFORMATION HANDLING:
- For events with specific dates/times, ALWAYS capture temporal information in statement attributes
- Use the "event_date" attribute to specify when the fact/event actually occurred (not when it was mentioned)
- Use the "temporal_context" attribute for temporal descriptions like "last week", "recently", etc.
- MANDATORY: Use the REFERENCE_TIME to resolve relative temporal expressions to absolute ISO dates
- Calculate event_date by using REFERENCE_TIME as the anchor point for relative time calculations
- Example: For "Max married to Tina on January 14", add:
  - "event_date": "January 14" (or fully resolved date if available)
  - "temporal_context": "specific date mentioned"
- For recent events: "went camping last week" → add:
  - "event_date": "[resolved ISO date ~7 days before episode date, e.g., '2023-06-20T00:00:00.000Z']"  
  - "temporal_context": "last week"
- For past events: "read book last year" → add:
  - "event_date": "[resolved ISO date ~1 year before episode date, e.g., '2022-06-27T00:00:00.000Z']"
  - "temporal_context": "last year"
- For future events: "going to Paris next month" → add:
  - "event_date": "[resolved ISO date ~1 month after episode date, e.g., '2023-07-27T00:00:00.000Z']"
  - "temporal_context": "next month"

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
        "confidence": confidence of the fact,
        "source": "explicit or implicit source type",
        "event_date": "ISO date when the fact/event actually occurred (if applicable)",
        "temporal_context": "original temporal description (e.g., 'last week', 'recently')",
        "duration": "duration information from Duration entities (e.g., '4 years', '2 months')",
        "context": "contextual information from TemporalContext entities (e.g., 'since moving', 'after breakup')"
      }
    }
  ]
}
</output>

IMPORTANT RULES:
- **ENTITIES**: ONLY use entities from AVAILABLE ENTITIES as source and target
- **NO INVENTION**: NEVER create statements where source or target is not in AVAILABLE ENTITIES
- **NO SELF-LOOPS**: NEVER create statements where the source and target are the same entity
- **SAME-NAME PRIORITY**: When entities share names but have different types, CREATE explicit relationship statements between them
- **NEW ONLY**: Do NOT create statements that duplicate relationships already present in previous episodes
- **TEMPORAL**: Instead of creating self-loops for temporal information, add timespan attributes to relevant statements
- **FILTER FIRST**: If you cannot express a NEW fact using only available entities, omit it entirely
- **OUTPUT FORMAT**: Always wrap output in tags <output> </output>

Example of CORRECT usage:
If AVAILABLE ENTITIES contains ["Person", "Individual", "Event", "Organization", "Role"], you can create:
- "Person" "is" "Role" ✓ (PRIORITY: role/characteristic extraction)
- "Person" "attends" "Event" ✓ (if not already in previous episodes)
- "Individual" "married to" "Person" with timespan attribute ✓ (if new relationship)
- "Person" "founded" "Organization" ✓ (PRIORITY: same name, different types when applicable)

Example of CORRECT Duration/TemporalContext usage:
If AVAILABLE ENTITIES contains ["Caroline", "friends", "4 years", "since moving", "breakup"]:
- "Caroline" "has known" "friends" [attributes: {"duration": "4 years", "context": "since moving"}] ✓
- "friends" "supported" "Caroline" [attributes: {"context": "during breakup"}] ✓
- "Caroline" "met" "friends" [attributes: {"context": "since moving"}] ✓

Example of INCORRECT usage:
- "John" "attends" "Party" ✗ (if "Party" is not in AVAILABLE ENTITIES)
- "Marriage" "occurs on" "Marriage" ✗ (NEVER create self-loops)
- "John" "attends" "Wedding" ✗ (if already captured in previous episodes)
- "Caroline" "relates to" "4 years" ✗ (Duration entity used as direct object)
- "since moving" "describes" "friendship" ✗ (TemporalContext entity used as direct subject)`,
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
<PRIMARY_ENTITIES>
${JSON.stringify(context.entities.primary, null, 2)}
</PRIMARY_ENTITIES>

<EXPANDED_ENTITIES>
${JSON.stringify(context.entities.expanded, null, 2)}
</EXPANDED_ENTITIES>
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
      content: `You are a knowledge graph expert that analyzes statements to detect duplications and TRUE contradictions. 
You analyze multiple new statements against existing statements to determine whether the new statement duplicates any existing statement or ACTUALLY contradicts any existing statement.

CRITICAL: Distinguish between CONTRADICTIONS, SUPERSEDING EVOLUTION, and PROGRESSIONS:
- CONTRADICTIONS: Statements that CANNOT both be true (mutually exclusive facts)  
- SUPERSEDING EVOLUTION: Sequential changes where the new state invalidates the previous state (e.g., technology migrations, job changes, relationship status changes)
- PROGRESSIONS: Sequential states or developments that CAN both be true (e.g., planning → execution, researching → deciding)


I need to analyze whether a new statement duplicates or contradicts existing statements in a knowledge graph.
  
  
Follow these instructions carefully:
 
1. Analyze if the new statement is a semantic duplicate of any existing statement
   - Two statements are duplicates if they express the same meaning even with different wording
   - Consider entity resolution has already been done, so different entity names are NOT an issue

2. Determine if the new statement ACTUALLY contradicts any existing valid statements
   - TRUE CONTRADICTIONS: Statements that cannot both be true simultaneously
   - Pay attention to direct negations, opposites, and mutually exclusive facts
   - Consider temporal context - statements may be contradictory only within specific time periods

3. CRITICAL DISTINCTION - What are NOT contradictions:
   - PROGRESSIONS: "researching X" → "decided on X" (both can be true - research led to decision)
   - TEMPORAL SEQUENCES: "planning camping" → "went camping" (both can be true - plan was executed)  
   - STATE CHANGES: "single" → "married" (both can be true at different times)
   - LEARNING/GROWTH: "studying topic X" → "expert in topic X" (both can be true - progression)

4. SPECIFIC EXAMPLES:

TRUE CONTRADICTIONS (mark as contradictions):
   - "John lives in New York" vs "John lives in San Francisco" (same time period, can't be both)
   - "Meeting at 3pm" vs "Meeting at 5pm" (same meeting, conflicting times)
   - "Project completed" vs "Project cancelled" (mutually exclusive outcomes) 
   - "Caroline is single" vs "Caroline is married" (same time period, opposite states)

SUPERSEDING EVOLUTION (mark as contradictions - old statement becomes invalid):
   - "Application built with NextJS" vs "Application migrated to Remix" (technology stack change)
   - "John works at CompanyA" vs "John joined CompanyB" (job change invalidates previous employment)
   - "Database uses MySQL" vs "Database migrated to PostgreSQL" (infrastructure change)
   - "System deployed on AWS" vs "System moved to Google Cloud" (platform migration)
   - "Caroline living in Boston" vs "Caroline moved to Seattle" (location change)
   - "Project using Python" vs "Project rewritten in TypeScript" (language migration)

NOT CONTRADICTIONS (do NOT mark as contradictions):
   - "Caroline researching adoption agencies" vs "Caroline finalized adoption agency" (research → decision progression)
   - "Caroline planning camping next week" vs "Caroline went camping" (planning → execution progression)
   - "User studying Python" vs "User completed Python course" (learning progression)
   - "Meeting scheduled for 3pm" vs "Meeting was held at 3pm" (planning → execution)
   - "Considering job offers" vs "Accepted job offer" (consideration → decision)
   - "Project in development" vs "Project launched" (development → deployment progression)
   - "Learning React" vs "Built app with React" (skill → application progression)

5. MANDATORY OUTPUT FORMAT:

You MUST wrap your response in <output> tags. Do not include any text outside these tags.

<output>
[{
    "statementId": "new_statement_uuid",
    "isDuplicate": false,
    "duplicateId": null,
    "contradictions": []
  },
  {
    "statementId": "another_statement_uuid",
    "isDuplicate": true,
    "duplicateId": "existing_duplicate_uuid",
    "contradictions": ["contradicted_statement_uuid"]
  }]
</output>

CRITICAL FORMATTING RULES:
- ALWAYS use <output> and </output> tags
- Include NO text before <output> or after </output>
- Return valid JSON array with all statement IDs from NEW_STATEMENTS
- If the new statement is a duplicate, include the UUID of the duplicate statement
- For TRUE contradictions AND superseding evolution, list statement UUIDs that the new statement contradicts
- If a statement is both a contradiction AND a duplicate (rare case), mark it as a duplicate  
- DO NOT mark progressions, temporal sequences, or cumulative developments as contradictions
- MARK superseding evolution (technology/job/location changes) as contradictions to invalidate old state
- ONLY mark genuine mutually exclusive facts and superseding evolution as contradictions
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
