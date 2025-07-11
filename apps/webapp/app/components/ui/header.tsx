import { useLocation, useNavigate } from "@remix-run/react";
import { Button } from "./button";
import { Plus } from "lucide-react";
import { SidebarTrigger } from "./sidebar";

const PAGE_TITLES: Record<string, string> = {
  "/home/dashboard": "Memory graph",
  "/home/conversation": "Conversation",
  "/home/integrations": "Integrations",
  "/home/activity": "Activity",
};

function getHeaderTitle(pathname: string): string {
  // Try to match the most specific path first
  for (const key of Object.keys(PAGE_TITLES)) {
    if (pathname.startsWith(key)) {
      return PAGE_TITLES[key];
    }
  }
  // Default fallback
  return "Documents";
}

function isConversationDetail(pathname: string): boolean {
  // Matches /home/conversation/<something> but not /home/conversation exactly
  return /^\/home\/conversation\/[^/]+$/.test(pathname);
}

export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = getHeaderTitle(location.pathname);

  const showNewConversationButton = isConversationDetail(location.pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-gray-300 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-1 px-4 pr-2 lg:gap-2">
        <div className="flex items-center gap-1">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-base">{title}</h1>
        </div>
        <div>
          {showNewConversationButton && (
            <Button
              onClick={() => navigate("/home/conversation")}
              variant="secondary"
              className="gap-2"
            >
              <Plus size={14} />
              New conversation
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
