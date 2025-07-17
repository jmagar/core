/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "@trigger.dev/sdk/v3";
import { jsonSchema, tool, type ToolSet } from "ai";

import { type MCPTool } from "./types";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
export class MCP {
  private Client: any;
  private clients: Record<string, any> = {};

  constructor() {}

  public async init() {
    this.Client = await MCP.importClient();
  }

  private static async importClient() {
    const { Client } = await import(
      "@modelcontextprotocol/sdk/client/index.js"
    );
    return Client;
  }

  async load(agents: string[], headers: any) {
    await Promise.all(
      agents.map(async (agent) => {
        return await this.connectToServer(
          agent,
          `${process.env.API_BASE_URL}/api/v1/mcp/${agent}`,
          headers,
        );
      }),
    );
  }

  async allTools(): Promise<ToolSet> {
    const clientEntries = Object.entries(this.clients);

    // Fetch all tools in parallel
    const toolsArrays = await Promise.all(
      clientEntries.map(async ([clientKey, client]) => {
        try {
          const { tools } = await client.listTools();
          return tools.map(({ name, description, inputSchema }: any) => [
            `${clientKey}--${name}`,
            tool({
              description,
              parameters: jsonSchema(inputSchema),
            }),
          ]);
        } catch (error) {
          logger.error(`Error fetching tools for ${clientKey}:`, { error });
          return [];
        }
      }),
    );

    // Flatten and convert to object
    return Object.fromEntries(toolsArrays.flat());
  }

  async tools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];

    for (const clientKey in this.clients) {
      const client = this.clients[clientKey];
      const { tools: clientTools } = await client.listTools();

      for (const tool of clientTools) {
        // Add client prefix to tool name
        tool.name = `${clientKey}--${tool.name}`;
        allTools.push(tool);
      }
    }

    return allTools;
  }

  async getTool(name: string) {
    try {
      const clientKey = name.split("--")[0];
      const toolName = name.split("--")[1];
      const client = this.clients[clientKey];
      const { tools: clientTools } = await client.listTools();
      const clientTool = clientTools.find((to: any) => to.name === toolName);

      return JSON.stringify(clientTool);
    } catch (e) {
      logger.error((e as string) ?? "Getting tool failed");
      throw new Error("Getting tool failed");
    }
  }

  async callTool(name: string, parameters: any) {
    const clientKey = name.split("--")[0];
    const toolName = name.split("--")[1];

    const client = this.clients[clientKey];

    const response = await client.callTool({
      name: toolName,
      arguments: parameters,
    });

    return response;
  }

  async connectToServer(name: string, url: string, headers: any) {
    try {
      const client = new this.Client(
        {
          name,
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      // Configure the transport for MCP server
      const transport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers },
      });

      // Connect to the MCP server
      await client.connect(transport, { timeout: 60 * 1000 * 5 });
      this.clients[name] = client;

      logger.info(`Connected to ${name} MCP server`);
    } catch (e) {
      logger.error(`Failed to connect to ${name} MCP server: `, { e });
      throw e;
    }
  }
}
