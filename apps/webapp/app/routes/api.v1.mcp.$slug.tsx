import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";

import { getIntegrationDefinitionWithSlug } from "~/services/integrationDefinition.server";
import { proxyRequest } from "~/utils/proxy.server";
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

      const { serverUrl } = spec.mcpAuth;

      // Find the integration account for this user and integration
      const integrationAccount = await getIntegrationAccount(
        integrationDefinition.id,
        authentication.userId,
      );

      const integrationConfig =
        integrationAccount?.integrationConfiguration as any;

      if (!integrationAccount || !integrationConfig || !integrationConfig.mcp) {
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
        serverUrl,
        integrationConfig.mcp.tokens.access_token,
      );
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
