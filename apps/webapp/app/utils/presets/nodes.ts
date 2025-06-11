export enum Apps {
  LINEAR = "LINEAR",
  SLACK = "SLACK",
  SOL = "SOL",
}

export const AppNames = {
  [Apps.LINEAR]: "Linear",
  [Apps.SLACK]: "Slack",
  [Apps.SOL]: "Sol",
} as const;

// General node types that are common across all apps
export const GENERAL_NODE_TYPES = {
  PERSON: {
    name: "Person",
    description: "Represents an individual, like a team member or contact",
  },
  APP: {
    name: "App",
    description: "A software application or service that's integrated",
  },
  PLACE: {
    name: "Place",
    description: "A physical location like an office, meeting room, or city",
  },
  ORGANIZATION: {
    name: "Organization",
    description: "A company, team, or any formal group of people",
  },
  EVENT: {
    name: "Event",
    description: "A meeting, deadline, or any time-based occurrence",
  },
  ALIAS: {
    name: "Alias",
    description: "An alternative name or identifier for an entity",
  },
} as const;

// App-specific node types
export const APP_NODE_TYPES = {
  [Apps.SOL]: {
    TASK: {
      name: "Sol Task",
      description:
        "An independent unit of work in Sol, such as a task, bug report, or feature request. Tasks can be associated with lists or linked as subtasks to other tasks.",
    },
    LIST: {
      name: "Sol List",
      description:
        "A flexible container in Sol for organizing content such as tasks, text, or references. Lists are used for task tracking, information collections, or reference materials.",
    },
    PREFERENCE: {
      name: "Sol Preference",
      description:
        "A user-stated intent, setting, or configuration in Sol, such as preferred formats, notification settings, timezones, or other customizations. Preferences reflect how a user wants the system to behave.",
    },
    COMMAND: {
      name: "Sol Command",
      description:
        "A user-issued command or trigger phrase, often starting with '/' or '@', that directs the system or an app to perform a specific action. Commands should always be extracted as distinct, important user actions.",
    },
    AUTOMATION: {
      name: "Sol Automation",
      description:
        "A workflow or rule in Sol that automatically performs actions based on specific conditions or triggers, such as recurring tasks, reminders, or integrations with other systems.",
    },
  },
  [Apps.LINEAR]: {
    ISSUE: {
      name: "Linear Issue",
      description: "A task, bug report, or feature request tracked in Linear",
    },
    PROJECT: {
      name: "Linear Project",
      description: "A collection of related issues and work items in Linear",
    },
    CYCLE: {
      name: "Linear Cycle",
      description: "A time-boxed iteration of work in Linear",
    },
    TEAM: {
      name: "Linear Team",
      description: "A group of people working together in Linear",
    },
    LABEL: {
      name: "Linear Label",
      description: "A tag used to categorize and organize issues in Linear",
    },
  },
  [Apps.SLACK]: {
    CHANNEL: {
      name: "Slack Channel",
      description: "A dedicated space for team communication in Slack",
    },
    THREAD: {
      name: "Slack Thread",
      description: "A focused conversation branch within a Slack channel",
    },
    MESSAGE: {
      name: "Slack Message",
      description: "A single communication sent in a Slack channel or thread",
    },
    REACTION: {
      name: "Slack Reaction",
      description: "An emoji response to a message in Slack",
    },
    FILE: {
      name: "Slack File",
      description: "A document, image or other file shared in Slack",
    },
  },
} as const;

/**
 * Returns both general node types and app-specific node types for given apps
 * @param apps Array of app names to get node types for
 * @returns Object containing general and app-specific node types
 */
export function getNodeTypes(apps: Array<keyof typeof APP_NODE_TYPES>) {
  const appSpecificTypes = apps.reduce((acc, appName) => {
    return {
      ...acc,
      [appName]: APP_NODE_TYPES[appName],
    };
  }, {});

  return {
    general: GENERAL_NODE_TYPES,
    appSpecific: appSpecificTypes,
  };
}

export function getNodeTypesString(apps: Array<keyof typeof APP_NODE_TYPES>) {
  let nodeTypesString = "";
  const generalTypes = Object.entries(GENERAL_NODE_TYPES)
    .map(([key, value]) => {
      return `- ${key}: "${value.description}"`;
    })
    .join("\n");
  nodeTypesString += `General Node Types:\n${generalTypes}\n\n`;

  const appSpecificTypes = apps.reduce((acc, appName) => {
    return {
      ...acc,
      [appName]: APP_NODE_TYPES[appName],
    };
  }, {});

  const appSpecificTypesString = Object.entries(appSpecificTypes)
    .map(([appName, types]) => {
      return `For ${appName}:\n${Object.entries(types as any)
        .map(([key, value]: any) => {
          return `- ${key}: "${value.description}"`;
        })
        .join("\n")}\n\n`;
    })
    .join("\n\n");

  nodeTypesString += `App-specific Node Types:\n${appSpecificTypesString}`;
  return nodeTypesString;
}
