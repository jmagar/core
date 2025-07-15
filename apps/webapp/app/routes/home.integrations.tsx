import React, { useMemo } from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { requireUserId, requireWorkpace } from "~/services/session.server";
import { getIntegrationDefinitions } from "~/services/integrationDefinition.server";
import { getIntegrationAccounts } from "~/services/integrationAccount.server";
import { IntegrationGrid } from "~/components/integrations/IntegrationGrid";

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
  const { integrationDefinitions, integrationAccounts } =
    useLoaderData<typeof loader>();

  const activeAccountIds = useMemo(
    () =>
      new Set(
        integrationAccounts
          .filter((acc) => acc.isActive)
          .map((acc) => acc.integrationDefinitionId),
      ),
    [integrationAccounts],
  );

  return (
    <div className="home flex h-full flex-col overflow-y-auto p-4 px-5">
      <div className="space-y-1 text-base">
        <p className="text-muted-foreground">Connect your tools and services</p>
      </div>

      <IntegrationGrid
        integrations={integrationDefinitions}
        activeAccountIds={activeAccountIds}
      />
    </div>
  );
}
