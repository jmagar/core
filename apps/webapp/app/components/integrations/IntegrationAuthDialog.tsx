import React, { useState, useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FormButtons } from "~/components/ui/FormButtons";

interface IntegrationAuthDialogProps {
  integration: {
    id: string;
    name: string;
    description?: string;
    spec: any;
  };
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
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

export function IntegrationAuthDialog({
  integration,
  children,
  onOpenChange,
}: IntegrationAuthDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMCPConnecting, setIsMCPConnecting] = useState(false);

  const apiKeyFetcher = useFetcher();
  const oauthFetcher = useFetcher<{ redirectURL: string }>();
  const mcpFetcher = useFetcher<{ redirectURL: string }>();

  const specData = parseSpec(integration.spec);
  const hasApiKey = !!specData?.auth?.api_key;
  const hasOAuth2 = !!specData?.auth?.OAuth2;
  const hasMCPAuth = !!specData?.mcpAuth;

  const handleApiKeyConnect = useCallback(() => {
    if (!apiKey.trim()) return;

    setIsLoading(true);
    apiKeyFetcher.submit(
      {
        integrationDefinitionId: integration.id,
        apiKey,
      },
      {
        method: "post",
        action: "/api/v1/integration_account",
        encType: "application/json",
      },
    );
  }, [integration.id, apiKey, apiKeyFetcher]);

  const handleOAuthConnect = useCallback(() => {
    setIsConnecting(true);
    oauthFetcher.submit(
      {
        integrationDefinitionId: integration.id,
        redirectURL: window.location.href,
      },
      {
        method: "post",
        action: "/api/v1/oauth",
        encType: "application/json",
      },
    );
  }, [integration.id, oauthFetcher]);

  const handleMCPConnect = useCallback(() => {
    setIsMCPConnecting(true);
    mcpFetcher.submit(
      {
        integrationDefinitionId: integration.id,
        redirectURL: window.location.href,
        mcp: true,
      },
      {
        method: "post",
        action: "/api/v1/oauth",
        encType: "application/json",
      },
    );
  }, [integration.id, mcpFetcher]);

  // Watch for fetcher completion
  React.useEffect(() => {
    if (apiKeyFetcher.state === "idle" && isLoading) {
      if (apiKeyFetcher.data !== undefined) {
        window.location.reload();
      }
    }
  }, [apiKeyFetcher.state, apiKeyFetcher.data, isLoading]);

  React.useEffect(() => {
    if (oauthFetcher.state === "idle" && isConnecting) {
      if (oauthFetcher.data?.redirectURL) {
        window.location.href = oauthFetcher.data.redirectURL;
      } else {
        setIsConnecting(false);
      }
    }
  }, [oauthFetcher.state, oauthFetcher.data, isConnecting]);

  React.useEffect(() => {
    if (mcpFetcher.state === "idle" && isMCPConnecting) {
      if (mcpFetcher.data?.redirectURL) {
        window.location.href = mcpFetcher.data.redirectURL;
      } else {
        setIsMCPConnecting(false);
      }
    }
  }, [mcpFetcher.state, mcpFetcher.data, isMCPConnecting]);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          setApiKey("");
        }
        onOpenChange?.(open);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to {integration.name}</DialogTitle>
          <DialogDescription>
            {integration.description ||
              `Connect your ${integration.name} account to enable integration.`}
          </DialogDescription>
        </DialogHeader>

        {/* API Key Authentication */}
        {hasApiKey && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="apiKey" className="text-sm font-medium">
                {specData?.auth?.api_key?.label || "API Key"}
              </label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {specData?.auth?.api_key?.description && (
                <p className="text-muted-foreground text-xs">
                  {specData.auth.api_key.description}
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
                  {isLoading || apiKeyFetcher.state === "submitting"
                    ? "Connecting..."
                    : "Connect"}
                </Button>
              }
            />
          </div>
        )}

        {/* OAuth Authentication */}
        {hasOAuth2 && (
          <div className="flex justify-center py-4">
            <Button
              type="button"
              variant="default"
              size="lg"
              disabled={isConnecting || oauthFetcher.state === "submitting"}
              onClick={handleOAuthConnect}
            >
              {isConnecting || oauthFetcher.state === "submitting"
                ? "Connecting..."
                : `Connect to ${integration.name}`}
            </Button>
          </div>
        )}

        {/* MCP Authentication */}
        {hasMCPAuth && (
          <div className="space-y-4 py-4">
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">MCP Authentication</h4>
              <p className="text-muted-foreground text-xs mb-4">
                This integration requires MCP (Model Context Protocol) authentication.
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={isMCPConnecting || mcpFetcher.state === "submitting"}
                onClick={handleMCPConnect}
              >
                {isMCPConnecting || mcpFetcher.state === "submitting"
                  ? "Connecting..."
                  : `Connect via MCP`}
              </Button>
            </div>
          </div>
        )}

        {/* No authentication method found */}
        {!hasApiKey && !hasOAuth2 && !hasMCPAuth && (
          <div className="text-muted-foreground py-4 text-center">
            This integration doesn't specify an authentication method.
          </div>
        )}

        <DialogFooter className="sm:justify-start">
          <div className="text-muted-foreground w-full text-xs">
            By connecting, you agree to the {integration.name} terms of service.
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}