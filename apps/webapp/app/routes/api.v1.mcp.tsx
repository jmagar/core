import { json } from "@remix-run/node";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  isInitializeRequest,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  createHybridActionApiRoute,
  createLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { handleTransport } from "~/utils/mcp";
import { MCPSessionManager } from "~/utils/mcp/session-manager";
import { TransportManager } from "~/utils/mcp/transport-manager";
import { IntegrationLoader } from "~/utils/mcp/integration-loader";
import { callMemoryTool, memoryTools } from "~/utils/mcp/memory";
import { logger } from "~/services/logger.service";

// Request schemas
const MCPRequestSchema = z.object({}).passthrough();
const QueryParams = z.object({
  source: z.string().optional(),
  integrations: z.string().optional(), // comma-separated slugs
});

// Common function to create and setup transport
async function createTransport(
  sessionId: string,
  source: string,
  integrations: string[],
  userId: string,
  workspaceId: string,
): Promise<StreamableHTTPServerTransport> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
    onsessioninitialized: async (sessionId) => {
      // Clean up old sessions (24+ hours) during new session initialization
      try {
        const [dbCleanupCount, memoryCleanupCount] = await Promise.all([
          MCPSessionManager.cleanupOldSessions(),
          TransportManager.cleanupOldSessions(),
        ]);
        if (dbCleanupCount > 0 || memoryCleanupCount > 0) {
          logger.log(`Cleaned up ${dbCleanupCount} DB sessions and ${memoryCleanupCount} memory sessions`);
        }
      } catch (error) {
        logger.error(`Error during session cleanup: ${error}`);
      }

      // Store session in database
      await MCPSessionManager.upsertSession(sessionId, source, integrations);

      // Store main transport
      TransportManager.setMainTransport(sessionId, transport);
    },
  });

  // Setup cleanup on close
  transport.onclose = async () => {
    await MCPSessionManager.deleteSession(sessionId);
    await TransportManager.cleanupSession(sessionId);
  };

  // Load integration transports
  try {
    const result = await IntegrationLoader.loadIntegrationTransports(
      sessionId,
      userId,
      workspaceId,
      integrations.length > 0 ? integrations : undefined,
    );
    logger.log(
      `Loaded ${result.loaded} integration transports for session ${sessionId}`,
    );
    if (result.failed.length > 0) {
      logger.warn(`Failed to load some integrations: ${result.failed}`);
    }
  } catch (error) {
    logger.error(`Error loading integration transports: ${error}`);
  }

  // Create and connect MCP server
  const server = await createMcpServer(userId, sessionId);
  await server.connect(transport);

  return transport;
}

// Create MCP server with memory tools + dynamic integration tools
async function createMcpServer(userId: string, sessionId: string) {
  const server = new Server(
    {
      name: "core-unified-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Dynamic tool listing that includes integration tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Get integration tools
    let integrationTools: any[] = [];
    try {
      integrationTools =
        await IntegrationLoader.getAllIntegrationTools(sessionId);
    } catch (error) {
      logger.error(`Error loading integration tools: ${error}`);
    }

    return {
      tools: [...memoryTools, ...integrationTools],
    };
  });

  // Handle tool calls for both memory and integration tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle memory tools
    if (name.startsWith("memory_")) {
      return await callMemoryTool(name, args, userId);
    }

    // Handle integration tools (prefixed with integration slug)
    if (name.includes("_") && !name.startsWith("memory_")) {
      try {
        return await IntegrationLoader.callIntegrationTool(
          sessionId,
          name,
          args,
        );
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calling integration tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle memory tools
    if (name.startsWith("memory_")) {
      return await callMemoryTool(name, args, userId);
    }

    // Handle integration tools (prefixed with integration slug)
    if (name.includes("_") && !name.startsWith("memory_")) {
      try {
        return await IntegrationLoader.callIntegrationTool(
          sessionId,
          name,
          args,
        );
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calling integration tool: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

// Handle MCP requests
const handleMCPRequest = async (
  request: Request,
  body: any,
  authentication: any,
  queryParams: z.infer<typeof QueryParams>,
) => {
  const sessionId = request.headers.get("mcp-session-id") as string | undefined;
  const source = queryParams.source || "api";
  const integrations = queryParams.integrations
    ? queryParams.integrations.split(",").map((s) => s.trim())
    : [];

  const userId = authentication.userId;
  const workspaceId = authentication.workspaceId;

  try {
    let transport: StreamableHTTPServerTransport;
    let currentSessionId = sessionId;

    if (sessionId && (await MCPSessionManager.isSessionActive(sessionId))) {
      // Use existing session
      const sessionData = TransportManager.getSessionInfo(sessionId);
      if (!sessionData.exists) {
        // Session exists in DB but not in memory, recreate transport
        logger.log(`Recreating transport for session ${sessionId}`);
        const sessionDetails = await MCPSessionManager.getSession(sessionId);
        if (sessionDetails) {
          transport = await createTransport(
            sessionId,
            sessionDetails.source,
            sessionDetails.integrations,
            userId,
            workspaceId,
          );
        } else {
          throw new Error("Session not found in database");
        }
      } else {
        transport = sessionData.mainTransport as StreamableHTTPServerTransport;
      }
    } else if (!sessionId && isInitializeRequest(body)) {
      // New initialization request
      currentSessionId = randomUUID();
      transport = await createTransport(
        currentSessionId,
        source,
        integrations,
        userId,
        workspaceId,
      );
    } else {
      // Invalid request
      return json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Bad Request: No valid session ID provided or session inactive",
          },
          id: body?.id || null,
        },
        { status: 400 },
      );
    }

    // Handle the request through existing transport utility
    const response = await handleTransport(transport!, request, body);
    return response;
  } catch (error) {
    console.error("MCP SSE request error:", error);
    return json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
        id: body?.id || null,
      },
      { status: 500 },
    );
  }
};

// Handle DELETE requests for session cleanup
const handleDelete = async (request: Request) => {
  const sessionId = request.headers.get("mcp-session-id") as string | undefined;

  if (!sessionId) {
    return new Response("Missing session ID", { status: 400 });
  }

  try {
    // Mark session as deleted in database
    await MCPSessionManager.deleteSession(sessionId);

    // Clean up all transports
    await TransportManager.cleanupSession(sessionId);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting session:", error);
    return new Response("Internal server error", { status: 500 });
  }
};

const { action } = createHybridActionApiRoute(
  {
    body: MCPRequestSchema,
    searchParams: QueryParams,
    allowJWT: true,
    authorization: {
      action: "mcp",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication, request, searchParams }) => {
    const method = request.method;

    if (method === "POST") {
      return await handleMCPRequest(
        request,
        body,
        authentication,
        searchParams,
      );
    } else if (method === "DELETE") {
      return await handleDelete(request);
    } else {
      return json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: "Method not allowed",
          },
          id: null,
        },
        { status: 405 },
      );
    }
  },
);

const loader = createLoaderApiRoute(
  {
    allowJWT: true,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ request }) => {
    // Handle SSE requests (for server-to-client notifications)
    const sessionId = request.headers.get("mcp-session-id");
    if (!sessionId) {
      return new Response("Missing session ID for SSE", { status: 400 });
    }

    const sessionData = TransportManager.getSessionInfo(sessionId);
    if (!sessionData.exists) {
      // Check if session exists in database and recreate transport
      const sessionDetails = await MCPSessionManager.getSession(sessionId);
      if (!sessionDetails) {
        return new Response("Session not found", { status: 404 });
      }

      // Session exists in DB but not in memory - need authentication to recreate
      return new Response("Session not found", { status: 404 });
    }

    // Return SSE stream (this would be handled by the transport's handleRequest method)
    // For now, just return session info
    return json({
      sessionId,
      active: await MCPSessionManager.isSessionActive(sessionId),
      integrationCount: sessionData.integrationCount,
      createdAt: sessionData.createdAt,
    });
  },
);

export { action, loader };
