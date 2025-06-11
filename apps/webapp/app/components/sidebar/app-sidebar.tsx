import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "../ui/sidebar";
import { DashboardIcon } from "@radix-ui/react-icons";
import { Code, Search } from "lucide-react";
import { NavMain } from "./nav-main";
import { useUser } from "~/hooks/useUser";
import { NavUser } from "./nav-user";
import { useWorkspace } from "~/hooks/useWorkspace";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/home/dashboard",
      icon: DashboardIcon,
    },
    {
      title: "API",
      url: "/home/api",
      icon: Code,
    },
    {
      title: "Logs",
      url: "/home/logs",
      icon: Search,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useUser();
  const workspace = useWorkspace();

  return (
    <Sidebar collapsible="offcanvas" {...props} className="bg-background">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <span className="text-base font-semibold">{workspace.name}</span>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarFooter className="p-0">
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
