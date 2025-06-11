"use client";

import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { NodePopupContent, EdgePopupContent } from "./type";
import { getNodeColor } from "./node-colors";

import { useMemo } from "react";

import { useTheme } from "remix-themes";

import dayjs from "dayjs";

/**
 * Format a date string into a readable format
 */
export function formatDate(
  dateString?: string | null,
  format: string = "MMM D, YYYY",
): string {
  if (!dateString) return "Unknown";

  try {
    return dayjs(dateString).format(format);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
}

interface GraphPopoversProps {
  showNodePopup: boolean;
  showEdgePopup: boolean;
  nodePopupContent: NodePopupContent | null;
  edgePopupContent: EdgePopupContent | null;
  onOpenChange?: (open: boolean) => void;
  labelColorMap?: Map<string, number>;
}

export function GraphPopovers({
  showNodePopup,
  showEdgePopup,
  nodePopupContent,
  edgePopupContent,
  onOpenChange,
  labelColorMap,
}: GraphPopoversProps) {
  const [resolvedTheme] = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  const primaryNodeLabel = useMemo((): string | null => {
    if (!nodePopupContent) {
      return null;
    }

    // Check if node has primaryLabel property (GraphNode)
    const nodeAny = nodePopupContent.node as any;
    if (nodeAny.primaryLabel && typeof nodeAny.primaryLabel === "string") {
      return nodeAny.primaryLabel;
    }

    // Fall back to original logic with labels
    const primaryLabel = nodePopupContent.node.labels?.find(
      (label) => label !== "Entity",
    );
    return primaryLabel || "Entity";
  }, [nodePopupContent]);

  // Get the color for the primary label
  const labelColor = useMemo(() => {
    if (!primaryNodeLabel || !labelColorMap) return "";
    return getNodeColor(primaryNodeLabel, isDarkMode, labelColorMap);
  }, [primaryNodeLabel, isDarkMode, labelColorMap]);

  const attributesToDisplay = useMemo(() => {
    if (!nodePopupContent) {
      return [];
    }

    const entityProperties = Object.fromEntries(
      Object.entries(nodePopupContent.node.attributes || {}).filter(([key]) => {
        return key !== "labels" && !key.includes("Embedding");
      }),
    );

    return Object.entries(entityProperties).map(([key, value]) => ({
      key,
      value,
    }));
  }, [nodePopupContent]);

  return (
    <div className="absolute top-4 right-4 z-50">
      <Popover open={showNodePopup} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <div className="pointer-events-none h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent
          className="w-80 overflow-hidden"
          side="bottom"
          align="end"
          sideOffset={5}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-2">
            <div className="mb-1 flex items-center justify-between">
              <h4 className="leading-none font-medium">Node Details</h4>
              {primaryNodeLabel && (
                <span
                  className="rounded-full px-2 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: labelColor }}
                >
                  {primaryNodeLabel}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {attributesToDisplay.length > 0 && (
                <div>
                  <div className="space-y-1.5">
                    {attributesToDisplay.map(({ key, value }) => (
                      <p key={key} className="text-sm">
                        <span className="font-medium text-black dark:text-white">
                          {key}:
                        </span>{" "}
                        <span className="text-muted-foreground break-words">
                          {typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={showEdgePopup} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <div className="pointer-events-none h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent
          className="w-80 overflow-hidden"
          side="bottom"
          align="end"
          sideOffset={5}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="bg-grayAlpha-100 mb-4 rounded-md p-2">
            <p className="text-sm break-all">
              Episode → {edgePopupContent?.target.name || "Unknown"}
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="leading-none font-medium">Relationship</h4>
            <div className="grid gap-2">
              <p className="text-muted-foreground text-sm break-all">
                <span className="mr-2 text-sm font-medium text-black dark:text-white">
                  UUID:
                </span>
                {edgePopupContent?.relation.uuid || "Unknown"}
              </p>
              <p className="text-muted-foreground text-sm break-all">
                <span className="mr-2 text-sm font-medium text-black dark:text-white">
                  Type:
                </span>
                {edgePopupContent?.relation.type || "Unknown"}
              </p>
              <p className="text-muted-foreground text-sm break-all">
                <span className="mr-2 text-sm font-medium text-black dark:text-white">
                  Created:
                </span>
                {formatDate(edgePopupContent?.relation.createdAt)}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
