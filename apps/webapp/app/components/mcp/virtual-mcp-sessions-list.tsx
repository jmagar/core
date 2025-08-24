import { useEffect, useRef, useState } from "react";
import {
  InfiniteLoader,
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  type Index,
  type ListRowProps,
} from "react-virtualized";
import { type McpSessionItem } from "~/hooks/use-mcp-sessions";
import { ScrollManagedList } from "../virtualized-list";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "~/lib/utils";
import { Card, CardContent } from "../ui/card";
import { getIconForAuthorise } from "../icon-utils";

interface VirtualMcpSessionsListProps {
  sessions: McpSessionItem[];
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  height?: number;
}

export function MCPUrlBox() {
  const [copied, setCopied] = useState(false);
  const [selectedSource, setSelectedSource] = useState<
    "Claude" | "Cursor" | "Other"
  >("Claude");

  const getMcpURL = (source: "Claude" | "Cursor" | "Other") => {
    const baseUrl = "https://core.heysol.ai/api/v1/mcp";
    return `${baseUrl}?source=${source}`;
  };

  const mcpURL = getMcpURL(selectedSource);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(mcpURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Card className="min-w-[400px] rounded-lg bg-transparent pt-1">
      <CardContent className="pt-2 text-base">
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="bg-grayAlpha-100 flex space-x-1 rounded-lg p-1">
              {(["Claude", "Cursor", "Other"] as const).map((source) => (
                <Button
                  key={source}
                  onClick={() => setSelectedSource(source)}
                  variant="ghost"
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 transition-all",
                    selectedSource === source
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {source}
                </Button>
              ))}
            </div>

            <div className="bg-background-3 flex items-center rounded">
              <Input
                type="text"
                id="mcpURL"
                value={mcpURL}
                readOnly
                className="bg-background-3 block w-full text-base"
              />
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={copyToClipboard}
                className="px-3"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function McpSessionItemRenderer(
  props: ListRowProps,
  sessions: McpSessionItem[],
  cache: CellMeasurerCache,
) {
  const { index, key, style, parent } = props;
  const session = sessions[index];

  if (!session) {
    return (
      <CellMeasurer
        key={key}
        cache={cache}
        columnIndex={0}
        parent={parent}
        rowIndex={index}
      >
        <div key={key} style={style} className="p-4">
          <div className="h-20 animate-pulse rounded bg-gray-200" />
        </div>
      </CellMeasurer>
    );
  }

  const createdAt = new Date(session.createdAt);
  const deleted = !!session.deleted;

  return (
    <CellMeasurer
      key={key}
      cache={cache}
      columnIndex={0}
      parent={parent}
      rowIndex={index}
    >
      <div key={key} style={style} className="px-0 py-2">
        <div className="flex w-full items-center">
          <div
            className={cn(
              "group-hover:bg-grayAlpha-100 flex min-w-[0px] shrink grow items-start gap-2 rounded-md px-2",
            )}
          >
            <div
              className={cn(
                "border-border flex w-full min-w-[0px] shrink flex-col border-b py-1",
              )}
            >
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex w-full items-center gap-2">
                  {getIconForAuthorise(session.source.toLowerCase(), 18)}

                  <div className="inline-flex min-h-[24px] min-w-[0px] shrink cursor-pointer items-center justify-start">
                    <div className={cn("truncate text-left")}>
                      {session.source}
                    </div>
                  </div>
                </div>

                <div className="text-muted-foreground flex shrink-0 items-center justify-end text-xs">
                  <div className="flex items-center">
                    {!deleted && (
                      <Badge className="bg-success/20 text-success mr-2 rounded text-xs">
                        Active
                      </Badge>
                    )}
                    <div className="text-muted-foreground mr-3">
                      {createdAt.toLocaleString()}
                    </div>

                    {session.integrations.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {session.integrations.map((integration) => (
                          <Badge
                            key={integration}
                            variant="secondary"
                            className="rounded text-xs"
                          >
                            {getIconForAuthorise(integration, 12)}
                            {integration}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CellMeasurer>
  );
}

export function VirtualMcpSessionsList({
  sessions,
  hasMore,
  loadMore,
  isLoading,
}: VirtualMcpSessionsListProps) {
  // Create a CellMeasurerCache instance using useRef to prevent recreation
  const cacheRef = useRef<CellMeasurerCache | null>(null);
  if (!cacheRef.current) {
    cacheRef.current = new CellMeasurerCache({
      defaultHeight: 100, // Default row height
      fixedWidth: true, // Rows have fixed width but dynamic height
    });
  }
  const cache = cacheRef.current;

  useEffect(() => {
    cache.clearAll();
  }, [sessions, cache]);

  const isRowLoaded = ({ index }: { index: number }) => {
    return !!sessions[index];
  };

  const loadMoreRows = async () => {
    if (hasMore) {
      return loadMore();
    }
    return false;
  };

  const rowRenderer = (props: ListRowProps) => {
    return McpSessionItemRenderer(props, sessions, cache);
  };

  const rowHeight = ({ index }: Index) => {
    return cache.getHeight(index, 0);
  };

  const itemCount = hasMore ? sessions.length + 1 : sessions.length;

  return (
    <div className="h-full grow overflow-hidden">
      <AutoSizer className="h-full">
        {({ width, height: autoHeight }) => (
          <InfiniteLoader
            isRowLoaded={isRowLoaded}
            loadMoreRows={loadMoreRows}
            rowCount={itemCount}
            threshold={5}
          >
            {({ onRowsRendered, registerChild }) => (
              <ScrollManagedList
                ref={registerChild}
                className="h-auto overflow-auto"
                height={autoHeight}
                width={width}
                rowCount={itemCount}
                rowHeight={rowHeight}
                onRowsRendered={onRowsRendered}
                rowRenderer={rowRenderer}
                deferredMeasurementCache={cache}
                overscanRowCount={10}
              />
            )}
          </InfiniteLoader>
        )}
      </AutoSizer>

      {isLoading && (
        <div className="text-muted-foreground p-4 text-center text-sm">
          Loading more sessions...
        </div>
      )}
    </div>
  );
}
