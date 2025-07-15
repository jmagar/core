import React, { useMemo } from "react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { requireUserId, requireWorkpace } from "~/services/session.server";
import { getIntegrationDefinitions } from "~/services/integrationDefinition.server";
import { getIntegrationAccounts } from "~/services/integrationAccount.server";
import { IntegrationAuthDialog } from "~/components/integrations/IntegrationAuthDialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { getIcon, type IconType } from "~/components/icon-utils";
import { ArrowLeft, ExternalLink } from "lucide-react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const workspace = await requireWorkpace(request);
  const { slug } = params;

  const [integrationDefinitions, integrationAccounts] = await Promise.all([
    getIntegrationDefinitions(workspace.id),
    getIntegrationAccounts(userId),
  ]);

  const integration = integrationDefinitions.find(
    (def) => def.slug === slug || def.id === slug
  );

  if (!integration) {
    throw new Response("Integration not found", { status: 404 });
  }

  return json({
    integration,
    integrationAccounts,
    userId,
  });
}

function parseSpec(spec: any) {
  if (!spec) return {};
  if (typeof spec === "string") {
    try {
      return JSON.parse(spec);
    } catch {
      return {};
    }
  }
  return spec;
}

export default function IntegrationDetail() {
  const { integration, integrationAccounts } = useLoaderData<typeof loader>();

  const activeAccount = useMemo(
    () =>
      integrationAccounts.find(
        (acc) => acc.integrationDefinitionId === integration.id && acc.isActive
      ),
    [integrationAccounts, integration.id]
  );

  const specData = useMemo(() => parseSpec(integration.spec), [integration.spec]);
  const hasApiKey = !!specData?.auth?.api_key;
  const hasOAuth2 = !!specData?.auth?.OAuth2;
  const hasMCPAuth = !!specData?.mcpAuth;
  const Component = getIcon(integration.icon as IconType);

  return (
    <div className="home flex h-full flex-col overflow-y-auto p-4 px-5">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/home/integrations"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to Integrations
        </Link>
      </div>

      {/* Integration Details */}
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="bg-background-2 flex h-12 w-12 items-center justify-center rounded">
                <Component size={24} />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl">{integration.name}</CardTitle>
                <CardDescription className="mt-2 text-base">
                  {integration.description || `Connect to ${integration.name}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Connection Status */}
            <div className="mb-6 flex items-center gap-3">
              <span className="text-sm font-medium">Status:</span>
              {activeAccount ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
                  Connected
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  Not Connected
                </span>
              )}
            </div>

            {/* Authentication Methods */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Authentication Methods</h3>
              <div className="space-y-2">
                {hasApiKey && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">✓ API Key authentication</span>
                  </div>
                )}
                {hasOAuth2 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">✓ OAuth 2.0 authentication</span>
                  </div>
                )}
                {hasMCPAuth && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">✓ MCP (Model Context Protocol) authentication</span>
                  </div>
                )}
                {!hasApiKey && !hasOAuth2 && !hasMCPAuth && (
                  <div className="text-muted-foreground text-sm">
                    No authentication method specified
                  </div>
                )}
              </div>
            </div>

            {/* Connect Button */}
            {!activeAccount && (hasApiKey || hasOAuth2 || hasMCPAuth) && (
              <div className="mt-6 flex justify-center">
                <IntegrationAuthDialog integration={integration}>
                  <Button size="lg" className="px-8">
                    Connect to {integration.name}
                  </Button>
                </IntegrationAuthDialog>
              </div>
            )}

            {/* Connected Account Info */}
            {activeAccount && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium">Connected Account</h3>
                <div className="rounded-lg border bg-green-50 p-4">
                  <div className="text-sm text-green-800">
                    <p className="font-medium">Account ID: {activeAccount.id}</p>
                    <p className="text-muted-foreground">
                      Connected on {new Date(activeAccount.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Integration Spec Details */}
            {specData && Object.keys(specData).length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium">Integration Details</h3>
                <div className="rounded-lg border bg-gray-50 p-4">
                  <pre className="text-sm text-gray-700">
                    {JSON.stringify(specData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}