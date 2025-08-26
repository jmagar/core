import { addToQueue } from "~/lib/ingest.server";
import { logger } from "~/services/logger.service";
import { SearchService } from "~/services/search.server";
import { SpaceService } from "~/services/space.server";

const searchService = new SearchService();
const spaceService = new SpaceService();

// Memory tool schemas (from existing memory endpoint)
const SearchParamsSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query in third person perspective",
    },
    validAt: {
      type: "string",
      description: "The valid at time in ISO format",
    },
    startTime: {
      type: "string",
      description: "The start time in ISO format",
    },
    endTime: {
      type: "string",
      description: "The end time in ISO format",
    },
    spaceIds: {
      type: "array",
      items: {
        type: "string",
      },
      description: "Array of strings representing UUIDs of spaces",
    },
  },
  required: ["query"],
};

const IngestSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "The data to ingest in text format",
    },
  },
  required: ["message"],
};

export const memoryTools = [
  {
    name: "memory_ingest",
    description: "Ingest data into the Echo memory system",
    inputSchema: IngestSchema,
  },
  {
    name: "memory_search",
    description: "Search through ingested memory data",
    inputSchema: SearchParamsSchema,
  },
  {
    name: "memory_get_spaces",
    description: "Search spaces in my memory",
    inputSchema: {
      type: "object",
      properties: {
        all: {
          type: "boolean",
          description: "Get all spaces",
          default: true,
        },
      },
    },
  },
];

// Function to call memory tools based on toolName
export async function callMemoryTool(
  toolName: string,
  args: any,
  userId: string,
  source: string,
) {
  try {
    switch (toolName) {
      case "memory_ingest":
        return await handleMemoryIngest({ ...args, userId, source });
      case "memory_search":
        return await handleMemorySearch({ ...args, userId, source });
      case "memory_get_spaces":
        return await handleMemoryGetSpaces(userId);
      default:
        throw new Error(`Unknown memory tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error calling memory tool ${toolName}:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error calling memory tool: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

// Handler for memory_ingest
async function handleMemoryIngest(args: any) {
  try {
    const response = addToQueue(
      {
        episodeBody: args.message,
        referenceTime: new Date().toISOString(),
        source: args.source,
      },
      args.userId,
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response),
        },
      ],
    };
  } catch (error) {
    logger.error(`MCP memory ingest error: ${error}`);

    return {
      content: [
        {
          type: "text",
          text: `Error ingesting data: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

// Handler for memory_search
async function handleMemorySearch(args: any) {
  try {
    const results = await searchService.search(args.query, args.userId, {
      startTime: args.startTime ? new Date(args.startTime) : undefined,
      endTime: args.endTime ? new Date(args.endTime) : undefined,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results),
        },
      ],
    };
  } catch (error) {
    logger.error(`MCP memory search error: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: `Error searching memory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

// Handler for memory_get_spaces
async function handleMemoryGetSpaces(userId: string) {
  try {
    const spaces = await spaceService.getUserSpaces(userId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(spaces),
        },
      ],
      isError: false,
    };
  } catch (error) {
    logger.error(`MCP get spaces error: ${error}`);

    return {
      content: [
        {
          type: "text",
          text: `Error getting spaces: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
