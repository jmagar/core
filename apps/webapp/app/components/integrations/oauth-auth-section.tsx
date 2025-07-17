import React, { useState, useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "~/components/ui/button";

interface OAuthAuthSectionProps {
  integration: {
    id: string;
    name: string;
  };
  specData: any;
  activeAccount: any;
}

export function OAuthAuthSection({
  integration,
  specData,
  activeAccount,
}: OAuthAuthSectionProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const oauthFetcher = useFetcher<{ redirectURL: string }>();

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

  React.useEffect(() => {
    if (oauthFetcher.state === "idle" && isConnecting) {
      if (oauthFetcher.data?.redirectURL) {
        window.location.href = oauthFetcher.data.redirectURL;
      } else {
        setIsConnecting(false);
      }
    }
  }, [oauthFetcher.state, oauthFetcher.data, isConnecting]);

  if (activeAccount || !specData?.auth?.OAuth2) {
    return null;
  }

  return (
    <div className="bg-background-3 rounded-lg p-4">
      <h4 className="mb-3 font-medium">OAuth 2.0 Authentication</h4>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={isConnecting || oauthFetcher.state === "submitting"}
        onClick={handleOAuthConnect}
        className="w-full"
      >
        {isConnecting || oauthFetcher.state === "submitting"
          ? "Connecting..."
          : `Connect to ${integration.name}`}
      </Button>
    </div>
  );
}