import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { createMCPProxy } from "@core/mcp-proxy";
import { getIntegrationDefinitionWithSlug } from "~/services/integrationDefinition.server";
import { z } from "zod";
import { getIntegrationAccount } from "~/services/integrationAccount.server";

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

      if (!spec.mcpAuth) {
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

      const { serverUrl, transportStrategy } = spec.mcpAuth;

      const mcpProxy = createMCPProxy(
        {
          serverUrl,
          timeout: 30000,
          debug: true,
          transportStrategy: transportStrategy || "sse-first",
          // Fix this
          redirectUrl: "",
        },
        // Callback to load credentials from the database
        async () => {
          // Find the integration account for this user and integration
          const integrationAccount = await getIntegrationAccount(
            integrationDefinition.id,
            authentication.userId,
          );

          const integrationConfig =
            integrationAccount?.integrationConfiguration as any;

          if (!integrationAccount || !integrationConfig) {
            return null;
          }

          return {
            serverUrl,
            tokens: {
              access_token: integrationConfig.access_token,
              token_type: integrationConfig.token_type || "bearer",
              expires_in: integrationConfig.expires_in || 3600,
              refresh_token: integrationConfig.refresh_token,
              scope: integrationConfig.scope || "read write",
            },
            expiresAt: integrationConfig.expiresAt
              ? new Date(integrationConfig.expiresAt)
              : new Date(Date.now() + 3600 * 1000),
          };
        },
      );

      return await mcpProxy(request, "");
    } catch (error: any) {
      console.error("MCP Proxy Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
);

export { action, loader };
