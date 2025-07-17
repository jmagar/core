import { useLocation, useNavigate } from "@remix-run/react";
import { Button } from "./button";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { SidebarTrigger } from "./sidebar";

const PAGE_TITLES: Record<string, string> = {
  "/home/dashboard": "Memory graph",
  "/home/conversation": "Conversation",
  "/home/integrations": "Integrations",
  "/home/integration": "Integrations",
  "/home/logs": "Logs",
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

function isIntegrationsPage(pathname: string): boolean {
  return pathname === "/home/integrations";
}

function isAllLogs(pathname: string): boolean {
  return pathname === "/home/logs/all";
}

function isActivityLogs(pathname: string): boolean {
  return pathname === "/home/logs/activity";
}

function isLogsPage(pathname: string): boolean {
  // Matches /home/logs, /home/logs/all, /home/logs/activity, or any /home/logs/*
  return pathname.includes("/home/logs");
}

function getLogsTab(pathname: string): "all" | "activity" {
  if (pathname.startsWith("/home/logs/activity")) return "activity";
  // Default to "all" for /home/logs or /home/logs/all or anything else
  return "all";
}

// Back and Forward navigation component
function NavigationBackForward() {
  const navigate = useNavigate();

  return (
    <div className="mr-1 flex items-center gap-1">
      <Button
        variant="ghost"
        size="xs"
        aria-label="Back"
        onClick={() => navigate(-1)}
        className="rounded"
        type="button"
      >
        <ArrowLeft size={16} />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        aria-label="Forward"
        onClick={() => navigate(1)}
        className="rounded"
        type="button"
      >
        <ArrowRight size={16} />
      </Button>
    </div>
  );
}

export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = getHeaderTitle(location.pathname);

  const showNewConversationButton = isConversationDetail(location.pathname);
  const showRequestIntegrationButton = isIntegrationsPage(location.pathname);
  const showLogsTabs = isLogsPage(location.pathname);

  const logsTab = getLogsTab(location.pathname);

  const handleTabClick = (tab: "all" | "activity") => {
    if (tab === "all") {
      navigate("/home/logs/all");
    } else if (tab === "activity") {
      navigate("/home/logs/activity");
    }
  };

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-gray-300 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-1 px-4 pr-2 lg:gap-2">
        <div className="-ml-1 flex items-center gap-1">
          {/* Back/Forward navigation before SidebarTrigger */}
          <NavigationBackForward />
          <SidebarTrigger className="mr-1" />

          <h1 className="text-base">{title}</h1>

          {showLogsTabs && (
            <div className="ml-2 flex items-center gap-0.5">
              <Button
                size="sm"
                variant="secondary"
                className="rounded"
                isActive={isAllLogs(location.pathname)}
                onClick={() => handleTabClick("all")}
                aria-current={logsTab === "all" ? "page" : undefined}
              >
                All
              </Button>
              <Button
                size="sm"
                className="rounded"
                onClick={() => handleTabClick("activity")}
                isActive={isActivityLogs(location.pathname)}
                variant="secondary"
                aria-current={logsTab === "activity" ? "page" : undefined}
              >
                Activity
              </Button>
            </div>
          )}
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
          {showRequestIntegrationButton && (
            <Button
              onClick={() =>
                window.open(
                  "https://github.com/redplanethq/core/issues/new",
                  "_blank",
                )
              }
              variant="secondary"
              className="gap-2"
            >
              <Plus size={14} />
              Request New Integration
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
