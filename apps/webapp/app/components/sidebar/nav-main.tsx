import { cn } from "~/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { useLocation, useNavigate } from "@remix-run/react";

export const NavMain = ({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: any;
  }[];
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={location.pathname.includes(item.url)}
                className={cn(
                  location.pathname.includes(item.url) &&
                    "!bg-grayAlpha-100 hover:bg-grayAlpha-100!",
                )}
                onClick={() => navigate(item.url)}
              >
                {item.icon && <item.icon />}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
