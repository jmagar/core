import { useState } from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { requireUserId, requireWorkpace } from "~/services/session.server";
import { getIntegrationDefinitions } from "~/services/integrationDefinition.server";
import { getIntegrationAccounts } from "~/services/integrationAccount.server";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { FormButtons } from "~/components/ui/FormButtons";
import { Plus, Search } from "lucide-react";

// Loader to fetch integration definitions and existing accounts
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const workspace = await requireWorkpace(request);

  const [integrationDefinitions, integrationAccounts] = await Promise.all([
    getIntegrationDefinitions(workspace.id),
    getIntegrationAccounts(userId),
  ]);

  return json({
    integrationDefinitions,
    integrationAccounts,
    userId,
  });
}

export default function Integrations() {
  const { integrationDefinitions, integrationAccounts, userId } =
    useLoaderData<typeof loader>();
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if user has an active account for an integration
  const hasActiveAccount = (integrationDefinitionId: string) => {
    return integrationAccounts.some(
      (account) =>
        account.integrationDefinitionId === integrationDefinitionId &&
        account.isActive,
    );
  };

  // Handle connection with API key
  const handleApiKeyConnect = async () => {
    if (!selectedIntegration || !apiKey.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/integration_account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrationDefinitionId: selectedIntegration.id,
          apiKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to connect integration");
      }

      // Refresh the page to show the new integration account
      window.location.reload();
    } catch (error) {
      console.error("Error connecting integration:", error);
      // Handle error (could add error state and display message)
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OAuth connection
  const handleOAuthConnect = async () => {
    if (!selectedIntegration) return;

    setIsConnecting(true);
    try {
      const response = await fetch("/api/v1/oauth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrationDefinitionId: selectedIntegration.id,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start OAuth flow");
      }

      const { url } = await response.json();
      // Redirect to OAuth authorization URL
      window.location.href = url;
    } catch (error) {
      console.error("Error starting OAuth flow:", error);
      // Handle error
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="home flex h-full flex-col overflow-y-auto p-4 px-5">
      <div className="space-y-1 text-base">
        <p className="text-muted-foreground">Connect your tools and services</p>
      </div>

      {/* Integration cards grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {integrationDefinitions.map((integration) => {
          const isConnected = hasActiveAccount(integration.id);

          return (
            <Dialog
              key={integration.id}
              onOpenChange={(open) => {
                if (open) {
                  setSelectedIntegration(integration);
                  setApiKey("");
                } else {
                  setSelectedIntegration(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Card className="cursor-pointer transition-all hover:shadow-md">
                  <CardHeader className="p-4">
                    <div className="bg-background-2 mb-2 flex h-10 w-10 items-center justify-center rounded">
                      {integration.icon ? (
                        <img
                          src={integration.icon}
                          alt={integration.name}
                          className="h-6 w-6"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <CardTitle className="text-base">
                      {integration.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {integration.description ||
                        "Connect to " + integration.name}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="border-t p-3">
                    <div className="flex w-full items-center justify-end">
                      {isConnected ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          Connected
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Not connected
                        </span>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Connect to {integration.name}</DialogTitle>
                  <DialogDescription>
                    {integration.description ||
                      `Connect your ${integration.name} account to enable integration.`}
                  </DialogDescription>
                </DialogHeader>

                {/* API Key Authentication */}
                {(() => {
                  const specData =
                    typeof integration.spec === "string"
                      ? JSON.parse(integration.spec)
                      : integration.spec;
                  return specData?.auth?.api_key;
                })() && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label htmlFor="apiKey" className="text-sm font-medium">
                        {(() => {
                          const specData =
                            typeof integration.spec === "string"
                              ? JSON.parse(integration.spec)
                              : integration.spec;
                          return specData?.auth?.api_key?.label || "API Key";
                        })()}
                      </label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="Enter your API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      {(() => {
                        const specData =
                          typeof integration.spec === "string"
                            ? JSON.parse(integration.spec)
                            : integration.spec;
                        return specData?.auth?.api_key?.description;
                      })() && (
                        <p className="text-muted-foreground text-xs">
                          {(() => {
                            const specData =
                              typeof integration.spec === "string"
                                ? JSON.parse(integration.spec)
                                : integration.spec;
                            return specData?.auth?.api_key?.description;
                          })()}
                        </p>
                      )}
                    </div>

                    <FormButtons
                      confirmButton={
                        <Button
                          type="button"
                          variant="default"
                          disabled={isLoading || !apiKey.trim()}
                          onClick={handleApiKeyConnect}
                        >
                          {isLoading ? "Connecting..." : "Connect"}
                        </Button>
                      }
                    ></FormButtons>
                  </div>
                )}

                {/* OAuth Authentication */}
                {(() => {
                  const specData =
                    typeof integration.spec === "string"
                      ? JSON.parse(integration.spec)
                      : integration.spec;
                  return specData?.auth?.oauth2;
                })() && (
                  <div className="flex justify-center py-8">
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      disabled={isConnecting}
                      onClick={handleOAuthConnect}
                    >
                      {isConnecting
                        ? "Connecting..."
                        : `Connect to ${integration.name}`}
                    </Button>
                  </div>
                )}

                {/* No authentication method found */}
                {(() => {
                  const specData =
                    typeof integration.spec === "string"
                      ? JSON.parse(integration.spec)
                      : integration.spec;
                  return !specData?.auth?.api_key && !specData?.auth?.oauth2;
                })() && (
                  <div className="text-muted-foreground py-4 text-center">
                    This integration doesn't specify an authentication method.
                  </div>
                )}

                <DialogFooter className="sm:justify-start">
                  <div className="text-muted-foreground w-full text-xs">
                    By connecting, you agree to the {integration.name} terms of
                    service.
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>

      {/* Empty state */}
      {integrationDefinitions.length === 0 && (
        <div className="mt-20 flex flex-col items-center justify-center">
          <Search className="text-muted-foreground mb-2 h-12 w-12" />
          <h3 className="text-lg font-medium">No integrations found</h3>
        </div>
      )}
    </div>
  );
}
