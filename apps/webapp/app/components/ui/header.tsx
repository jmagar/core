import { useLocation } from "@remix-run/react";

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

export function SiteHeader() {
  const location = useLocation();
  const title = getHeaderTitle(location.pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2">
        <h1 className="text-base">{title}</h1>
      </div>
    </header>
  );
}
