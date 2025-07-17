import React, { useMemo } from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { requireUserId, requireWorkpace } from "~/services/session.server";
import { getIntegrationDefinitions } from "~/services/integrationDefinition.server";
import { getIntegrationAccounts } from "~/services/integrationAccount.server";
import { IntegrationGrid } from "~/components/integrations/integration-grid";
import { PageHeader } from "~/components/common/page-header";
import { Plus } from "lucide-react";

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
    <div className="flex h-full flex-col">
      <PageHeader
        title="Integrations"
        actions={[
          {
            label: "Request New Integration",
            icon: <Plus size={14} />,
            onClick: () =>
              window.open(
                "https://github.com/redplanethq/core/issues/new",
                "_blank",
              ),
            variant: "secondary",
          },
        ]}
      />
      <div className="home flex h-[calc(100vh_-_56px)] flex-col overflow-y-auto p-4 px-5">
        <IntegrationGrid
          integrations={integrationDefinitions}
          activeAccountIds={activeAccountIds}
        />
      </div>
    </div>
  );
}
