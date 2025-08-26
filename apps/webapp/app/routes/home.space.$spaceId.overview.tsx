import SpaceGraph from "~/components/spaces/space-graph";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Button } from "~/components/ui";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  Clock,
  LoaderCircle,
} from "lucide-react";
import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { getIcon, IconPicker } from "~/components/icon-picker";
import { SpaceSummary } from "~/components/spaces/space-summary.client";
import {
  type ActionFunctionArgs,
  redirect,
  type LoaderFunctionArgs,
} from "@remix-run/server-runtime";
import { requireUserId } from "~/services/session.server";
import { SpaceService } from "~/services/space.server";
import { useTypedLoaderData } from "remix-typedjson";
import { useFetcher } from "@remix-run/react";
import { Badge } from "~/components/ui/badge";
import { ClientOnly } from "remix-utils/client-only";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  const spaceService = new SpaceService();

  const spaceId = params.spaceId; // Get spaceId from URL params
  const space = await spaceService.getSpace(spaceId as string, userId);

  return space;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const spaceService = new SpaceService();
  const spaceId = params.spaceId;

  if (!spaceId) {
    throw new Error("Space ID is required");
  }

  const formData = await request.formData();
  const icon = formData.get("icon");

  if (typeof icon !== "string") {
    throw new Error("Invalid icon data");
  }

  await spaceService.updateSpace(spaceId, { icon }, userId);

  return redirect(`/home/space/${spaceId}/overview`);
}

// Helper function to get status display info
function getStatusDisplay(status?: string | null) {
  switch (status) {
    case "processing":
      return {
        label: "Processing",
        variant: "outline" as const,
        icon: <Activity className="h-3 w-3" />,
        className: "text-success-foreground bg-success rounded border-none",
      };
    case "pending":
      return {
        label: "Pending",
        variant: "outline" as const,
        icon: <Clock className="h-3 w-3" />,
        className: "text-warning-foreground bg-warning rounded border-none",
      };
    case "error":
      return {
        label: "Error",
        variant: "outline" as const,
        icon: <AlertCircle className="h-3 w-3" />,
        className:
          "text-destructive-foreground rounded bg-destructive border-none",
      };
    default:
      return null;
  }
}

export default function Overview() {
  const [graphOpen, setGraphOpen] = React.useState(true);
  const [summaryOpen, setSummaryOpen] = React.useState(true);
  const space = useTypedLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const statusDisplay = getStatusDisplay(space?.status);

  const handleIconChange = (icon: string) => {
    const formData = new FormData();
    formData.append("icon", icon);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="mt-10 flex w-[80ch] flex-col">
      <Popover>
        <PopoverTrigger>
          <div className="relative mb-2">{getIcon(space?.icon, 24)}</div>
        </PopoverTrigger>
        <PopoverContent className="p-2">
          <IconPicker
            onSelectIcon={(icon, color) =>
              handleIconChange(JSON.stringify({ icon, color }))
            }
            onSelectEmoji={(emoji) =>
              handleIconChange(JSON.stringify({ emoji }))
            }
            onRemove={() => handleIconChange("")}
          />
        </PopoverContent>
      </Popover>
      <h2 className="flex items-center gap-2 text-xl">
        {space.name}
        {statusDisplay && (
          <Badge
            variant={statusDisplay.variant}
            className={`flex items-center gap-1 ${statusDisplay.className}`}
          >
            {statusDisplay.icon}
            {statusDisplay.label}
          </Badge>
        )}
      </h2>

      <Collapsible
        className="my-10"
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
      >
        <CollapsibleTrigger>
          <Button
            variant="ghost"
            className="text-muted-foreground mb-1 -ml-2 gap-1"
          >
            Summary
            <ChevronDown
              size={14}
              className={`transition-transform duration-300 ${
                !graphOpen ? "rotate-270 transform" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="text-md">
            <ClientOnly
              fallback={<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            >
              {() => <SpaceSummary summary={space.summary} />}
            </ClientOnly>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        className="my-10"
        open={graphOpen}
        onOpenChange={setGraphOpen}
      >
        <CollapsibleTrigger>
          <Button
            variant="ghost"
            className="text-muted-foreground mb-1 -ml-2 gap-1"
          >
            Graph
            <ChevronDown
              size={14}
              className={`transition-transform duration-300 ${
                !graphOpen ? "rotate-270 transform" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SpaceGraph userId={space.userId} clusterId={space.id as string} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
