import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { requireUser, requireWorkpace } from "~/services/session.server";

import { Outlet } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import { clearRedirectTo, commitSession } from "~/services/redirectTo.server";

import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { SiteHeader } from "~/components/ui/header";
import { FloatingIngestionStatus } from "~/components/ingestion/floating-ingestion-status";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);
  const workspace = await requireWorkpace(request);

  return typedjson(
    {
      user,
      workspace,
    },
    {
      headers: {
        "Set-Cookie": await commitSession(await clearRedirectTo(request)),
      },
    },
  );
};

export default function Home() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 54)",
          "--header-height": "calc(var(--spacing) * 12)",
          background: "var(--background)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="bg-background-2 h-full rounded pr-0">
        <SiteHeader />
        <div className="flex h-[calc(100vh_-_56px)] flex-col rounded">
          <div className="@container/main flex h-full flex-col gap-2">
            <div className="flex h-full flex-col">
              <Outlet />
            </div>
          </div>
        </div>
        <FloatingIngestionStatus />
      </SidebarInset>
    </SidebarProvider>
  );
}
