import { redirect, type MetaFunction } from "@remix-run/node";
import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { typedjson } from "remix-typedjson";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { clearRedirectTo, commitSession } from "~/services/redirectTo.server";

import { requireUser, requireWorkpace } from "~/services/session.server";
import { confirmBasicDetailsPath } from "~/utils/pathBuilder";
export const meta: MetaFunction = () => {
  return [
    { title: "C.O.R.E" },
    { name: "description", content: "Welcome to C.O.R.E!" },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);

  //you have to confirm basic details before you can do anything
  if (!user.confirmedBasicDetails) {
    return redirect(confirmBasicDetailsPath());
  }

  const workspace = await requireWorkpace(request);

  return typedjson(
    {
      workspace,
    },
    {
      headers: {
        "Set-Cookie": await commitSession(await clearRedirectTo(request)),
      },
    },
  );
};

export default function Index() {
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
      <SidebarInset className="bg-background-2">
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6"></div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
