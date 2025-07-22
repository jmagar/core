import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";

import { getIntegrationDefinitionWithSlug } from "~/services/integrationDefinition.server";
import { proxyRequest } from "~/utils/proxy.server";
import { z } from "zod";
import { getIntegrationAccount } from "~/services/integrationAccount.server";
import { createMCPStdioProxy } from "@core/mcp-proxy";
import { randomUUID } from "node:crypto";
import { configureStdioMCPEnvironment } from "~/trigger/utils/mcp";

export const integrationSlugSchema = z.object({
  slug: z.string(),
});

const { action, loader } = createActionApiRoute(
  {
    params: integrationSlugSchema,
    allowJWT: true,
    authorization: {
      action: "mcp",
    },
    corsStrategy: "all",
  },
  async ({ authentication, request, params }) => {
    try {
      const slug = params.slug;

      if (!slug) {
        return new Response(
          JSON.stringify({ error: "Integration slug is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Fetch integration definition by slug
      const integrationDefinition =
        await getIntegrationDefinitionWithSlug(slug);

      if (!integrationDefinition) {
        return new Response(
          JSON.stringify({ error: "Integration not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const spec = integrationDefinition.spec as any;

      if (!spec.mcp) {
        return new Response(
          JSON.stringify({
            error: "MCP auth configuration not found for this integration",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const { url, type } = spec.mcp;

      // Find the integration account for this user and integration
      const integrationAccount = await getIntegrationAccount(
        integrationDefinition.id,
        authentication.userId,
      );

      if (type === "http") {
        const integrationConfig =
          integrationAccount?.integrationConfiguration as any;

        if (
          !integrationAccount ||
          !integrationConfig ||
          !integrationConfig.mcp
        ) {
          return new Response(
            JSON.stringify({
              error: "No integration account with mcp config",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Proxy the request to the serverUrl
        return await proxyRequest(
          request,
          url,
          integrationConfig.mcp.tokens.access_token,
        );
      } else {
        if (!integrationAccount) {
          return new Response(
            JSON.stringify({
              error: "No integration account found",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Configure environment variables using the utility function
        const { env, args } = configureStdioMCPEnvironment(
          spec,
          integrationAccount,
        );

        // Get session_id from headers (case-insensitive), or generate a new uuid if not present
        const sessionId =
          request.headers.get("mcp-session-id") ||
          request.headers.get("Mcp-Session-Id") ||
          randomUUID();

        // Use the saved local file instead of command
        const executablePath = `./integrations/${slug}/main`;

        return createMCPStdioProxy(request, executablePath, args, {
          env,
          sessionId,
        });
      }
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
);

export { action, loader };
