/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from "@trigger.dev/sdk/v3";
import { jsonSchema, tool, type ToolSet } from "ai";
import * as fs from "fs";
import * as path from "path";

import { type MCPTool } from "./types";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { prisma } from "~/db.server";

export const configureStdioMCPEnvironment = (
  spec: any,
  account: any,
): { env: Record<string, string>; args: any[] } => {
  if (!spec.mcp) {
    return { env: {}, args: [] };
  }

  const mcpSpec = spec.mcp;
  const configuredMCP = { ...mcpSpec };

  // Replace config placeholders in environment variables
  if (configuredMCP.env) {
    for (const [key, value] of Object.entries(configuredMCP.env)) {
      if (typeof value === "string" && value.includes("${config:")) {
        // Extract the config key from the placeholder
        const configKey = value.match(/\$\{config:(.*?)\}/)?.[1];
        if (
          configKey &&
          account.integrationConfiguration &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (account.integrationConfiguration as any)[configKey]
        ) {
          configuredMCP.env[key] = value.replace(
            `\${config:${configKey}}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (account.integrationConfiguration as any)[configKey],
          );
        }
      }

      if (typeof value === "string" && value.includes("${integrationConfig:")) {
        // Extract the config key from the placeholder
        const configKey = value.match(/\$\{integrationConfig:(.*?)\}/)?.[1];
        if (
          configKey &&
          account.integrationDefinition.config &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (account.integrationDefinition.config as any)[configKey]
        ) {
          configuredMCP.env[key] = value.replace(
            `\${integrationConfig:${configKey}}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (account.integrationDefinition.config as any)[configKey],
          );
        }
      }
    }
  }

  return {
    env: configuredMCP.env || {},
    args: Array.isArray(configuredMCP.args) ? configuredMCP.args : [],
  };
};

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

export const getIntegrationStdioFile = async (
  integrationDefinitionSlug: string,
) => {
  // If the file is in public/integrations/[slug]/main, it is served at /integrations/[slug]/main
  return `/integrations/${integrationDefinitionSlug}/main`;
};

export const fetchAndSaveStdioIntegrations = async () => {
  try {
    logger.info("Starting stdio integrations fetch and save process");

    // Get all integration definitions
    const integrationDefinitions =
      await prisma.integrationDefinitionV2.findMany({
        where: {
          deleted: null, // Only active integrations
        },
      });

    logger.info(
      `Found ${integrationDefinitions.length} integration definitions`,
    );

    for (const integration of integrationDefinitions) {
      try {
        const spec = integration.spec as any;

        // Check if this integration has MCP config and is stdio type
        if (spec?.mcp?.type === "stdio" && spec?.mcp?.url) {
          logger.info(`Processing stdio integration: ${integration.slug}`);

          const integrationDir = path.join(
            process.cwd(),
            "integrations",
            integration.slug,
          );
          const targetFile = path.join(integrationDir, "main");

          // Create directory if it doesn't exist
          if (!fs.existsSync(integrationDir)) {
            fs.mkdirSync(integrationDir, { recursive: true });
            logger.info(`Created directory: ${integrationDir}`);
          }

          // Skip if file already exists
          if (fs.existsSync(targetFile)) {
            logger.info(
              `Integration ${integration.slug} already exists, skipping`,
            );
            continue;
          }

          const urlOrPath = spec.mcp.url;

          // If urlOrPath looks like a URL, use fetch, otherwise treat as local path
          let isUrl = false;
          try {
            // Try to parse as URL
            const parsed = new URL(urlOrPath);
            isUrl = ["http:", "https:"].includes(parsed.protocol);
          } catch {
            isUrl = false;
          }

          if (isUrl) {
            // Fetch the URL content
            logger.info(`Fetching content from URL: ${urlOrPath}`);
            const response = await fetch(urlOrPath);

            if (!response.ok) {
              logger.error(
                `Failed to fetch ${urlOrPath}: ${response.status} ${response.statusText}`,
              );
              continue;
            }

            const content = await response.text();

            // Save the content to the target file
            fs.writeFileSync(targetFile, content);

            // Make the file executable if it's a script
            if (process.platform !== "win32") {
              fs.chmodSync(targetFile, "755");
            }

            logger.info(
              `Successfully saved stdio integration: ${integration.slug} to ${targetFile}`,
            );
          } else {
            // Treat as local file path
            const sourcePath = path.isAbsolute(urlOrPath)
              ? urlOrPath
              : path.join(process.cwd(), urlOrPath);

            logger.info(`Copying content from local path: ${sourcePath}`);

            if (!fs.existsSync(sourcePath)) {
              logger.error(`Source file does not exist: ${sourcePath}`);
              continue;
            }

            fs.copyFileSync(sourcePath, targetFile);

            // Make the file executable if it's a script
            if (process.platform !== "win32") {
              fs.chmodSync(targetFile, "755");
            }

            logger.info(
              `Successfully copied stdio integration: ${integration.slug} to ${targetFile}`,
            );
          }
        } else {
          logger.debug(
            `Skipping integration ${integration.slug}: not a stdio type or missing URL`,
          );
        }
      } catch (error) {
        logger.error(`Error processing integration ${integration.slug}:`, {
          error,
        });
      }
    }

    logger.info("Completed stdio integrations fetch and save process");
  } catch (error) {
    logger.error("Failed to fetch and save stdio integrations:", { error });
    throw error;
  }
};
