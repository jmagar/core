import React, { useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Check } from "lucide-react";

interface ConnectedAccountSectionProps {
  activeAccount?: {
    id: string;
    createdAt: string;
  };
}

export function ConnectedAccountSection({
  activeAccount,
}: ConnectedAccountSectionProps) {
  const disconnectFetcher = useFetcher();

  const handleDisconnect = useCallback(() => {
    if (!activeAccount?.id) return;

    disconnectFetcher.submit(
      {
        integrationAccountId: activeAccount.id,
      },
      {
        method: "post",
        action: "/api/v1/integration_account/disconnect",
        encType: "application/json",
      },
    );
  }, [activeAccount?.id, disconnectFetcher]);

  React.useEffect(() => {
    if (disconnectFetcher.state === "idle" && disconnectFetcher.data) {
      window.location.reload();
    }
  }, [disconnectFetcher.state, disconnectFetcher.data]);

  if (!activeAccount) return null;

  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-lg font-medium">Connected Account</h3>
      <div className="bg-background-3 rounded-lg p-4">
        <div className="text-sm">
          <p className="inline-flex items-center gap-2 font-medium">
            <Check size={16} /> Account ID: {activeAccount.id}
          </p>
          <p className="text-muted-foreground mb-3">
            Connected on{" "}
            {new Date(activeAccount.createdAt).toLocaleDateString()}
          </p>
          <div className="flex w-full justify-end">
            <Button
              variant="destructive"
              disabled={disconnectFetcher.state === "submitting"}
              onClick={handleDisconnect}
            >
              {disconnectFetcher.state === "submitting"
                ? "Disconnecting..."
                : "Disconnect"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
