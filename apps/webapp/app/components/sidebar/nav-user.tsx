import { LogOut, Settings } from "lucide-react";
import { AvatarText } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";
import type { User } from "~/models/user.server";
import { Button } from "../ui";
import { cn } from "~/lib/utils";
import { useLocation, useNavigate } from "@remix-run/react";

export function NavUser({ user }: { user: User }) {
  const { isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="link" className="mb-2 ml-2 gap-2 px-0">
              <AvatarText
                text={user.name ?? "User"}
                className="h-6 w-6 rounded"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "top"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex gap-2"
              onClick={() => navigate("/settings")}
            >
              <Settings size={16} />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex gap-2"
              onClick={() => navigate("/logout")}
            >
              <LogOut size={16} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
