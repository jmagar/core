#!/usr/bin/env node

import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { zodToJsonSchema } from "zod-to-json-schema";

import { z } from "zod";
import { IngestKGSchema, SearchKGSchema } from "./types/graph.js";
import { searchKnowledgeGraph, ingestKnowledgeGraph } from "./operations/graph.js";

// Create an MCP server
const server = new Server(
  {
    name: "CORE-MCP",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_memory",
        description: "Search the memory graph for episodes or statements",
        inputSchema: zodToJsonSchema(SearchKGSchema),
      },
      {
        name: "ingest_memory",
        description: "Ingest data into the memory graph pipeline",
        inputSchema: zodToJsonSchema(IngestKGSchema),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "search_memory": {
        const args = SearchKGSchema.parse(request.params.arguments);
        const result = await searchKnowledgeGraph(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "ingest_memory": {
        const args = IngestKGSchema.parse(request.params.arguments);
        const result = await ingestKnowledgeGraph(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${JSON.stringify(error.errors)}`);
    }
    throw error;
  }
});

async function runServer() {
  // Check required environment variables
  const requiredEnvVars = ["API_TOKEN", "API_BASE_URL", "SOURCE"];
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sigma MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
