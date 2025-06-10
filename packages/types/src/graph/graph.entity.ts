export enum EpisodeType {
  Conversation = "CONVERSATION",
  Text = "TEXT",
}

/**
 * Interface for episodic node in the reified knowledge graph
 * Episodes are containers for statements and represent source information
 */
export interface EpisodicNode {
  uuid: string;
  content: string;
  contentEmbedding?: number[];
  type: string;
  source: string;
  createdAt: Date;
  validAt: Date;
  labels: string[];
  userId: string;
  space?: string;
  sessionId?: string;
}

/**
 * Interface for entity node in the reified knowledge graph
 * Entities represent subjects, objects, or predicates in statements
 */
export interface EntityNode {
  uuid: string;
  name: string;
  type: string;
  attributes: Record<string, any>;
  nameEmbedding: number[];
  createdAt: Date;
  userId: string;
  space?: string;
}

/**
 * Interface for statement node in the reified knowledge graph
 * Statements are first-class objects representing facts with temporal properties
 */
export interface StatementNode {
  uuid: string;
  fact: string;
  factEmbedding: number[];
  createdAt: Date;
  validAt: Date;
  invalidAt: Date | null;
  attributes: Record<string, any>;
  userId: string;
  space?: string;
}

/**
 * Interface for a triple in the reified knowledge graph
 * A triple connects a subject, predicate, object via a statement node
 * and maintains provenance information
 */
export interface Triple {
  statement: StatementNode;
  subject: EntityNode;
  predicate: EntityNode;
  object: EntityNode;
  provenance: EpisodicNode;
}

export type AddEpisodeParams = {
  name: string;
  episodeBody: string;
  referenceTime: Date;
  type: EpisodeType;
  source: string;
  userId: string;
  spaceId?: string;
  sessionId?: string;
};

export type AddEpisodeResult = {
  episodeUuid: string;
  nodesCreated: number;
  statementsCreated: number;
  processingTimeMs: number;
};

export const entityTypes = {
  general: {
    PERSON: {
      type: "PERSON",
      description: "Any named individual mentioned or referenced.",
    },
    APP: {
      type: "APP",
      description: "Any third-party service or platform used by the user.",
    },
    SOL_AUTOMATION: {
      type: "SOL_AUTOMATION",
      description: "User workflows or flows combining triggers and actions.",
    },
    SOL_PREFERENCE: {
      type: "SOL_PREFERENCE",
      description: "User-stated intent, setting, or configuration like format, timezone, etc.",
    },
    COMMAND: {
      type: "COMMAND",
      description: "Trigger phrase mapped to an internal action, often starts with / or !",
    },
    TASK: {
      type: "TASK",
      description: "User-stated or inferred goal; may link to Person or App.",
    },
    EVENT: {
      type: "EVENT",
      description: "Time-based mention; supports parsing of phrases like 'next week', 'tomorrow'.",
    },
    LABEL: {
      type: "LABEL",
      description: "Optional categorization tag for organization or filtering.",
    },
    OBJECT: {
      type: "OBJECT",
      description: "Named non-person objects in the user's world (e.g., Projector, Car).",
    },
    TEAM: {
      type: "TEAM",
      description: "User-defined group of people, useful for permissions or targeting.",
    },
  },
  app_specific: {
    SLACK_CHANNEL: {
      type: "SLACK_CHANNEL",
      description: "Slack channel where automations or communications happen.",
    },
    SLACK_USER: {
      type: "SLACK_USER",
      description: "A user in Slack, can be tagged or messaged.",
    },
    GMAIL_THREAD: {
      type: "GMAIL_THREAD",
      description: "An email conversation thread in Gmail.",
    },
    NOTION_PAGE: {
      type: "NOTION_PAGE",
      description: "A page in Notion workspace.",
    },
    CALENDAR_EVENT: {
      type: "CALENDAR_EVENT",
      description: "Event from user's calendar (Google, Outlook, etc.).",
    },
  },
};
