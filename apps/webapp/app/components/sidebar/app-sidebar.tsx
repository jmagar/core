import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "../ui/sidebar";
import { Activity, LayoutGrid, MessageSquare, Network } from "lucide-react";
import { NavMain } from "./nav-main";
import { useUser } from "~/hooks/useUser";
import { NavUser } from "./nav-user";
import Logo from "../logo/logo";

const data = {
  navMain: [
    {
      title: "Conversation",
      url: "/home/conversation",
      icon: MessageSquare,
    },
    {
      title: "Memory",
      url: "/home/dashboard",
      icon: Network,
    },
    {
      title: "Activity",
      url: "/home/activity",
      icon: Activity,
    },
    {
      title: "Integrations",
      url: "/home/integrations",
      icon: LayoutGrid,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useUser();

  return (
    <Sidebar
      collapsible="none"
      {...props}
      className="bg-background h-[100vh] w-[calc(var(--sidebar-width-icon)+1px)]! py-2"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="mt-1 flex w-full items-center justify-center">
              <Logo width={20} height={20} />
            </div>
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
