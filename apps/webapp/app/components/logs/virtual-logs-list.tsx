import { useEffect, useRef, useState } from "react";
import { List, InfiniteLoader, WindowScroller } from "react-virtualized";
import { LogItem } from "~/hooks/use-logs";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { cn } from "~/lib/utils";

interface VirtualLogsListProps {
  logs: LogItem[];
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  height?: number;
}

const ITEM_HEIGHT = 120;

interface LogItemRendererProps {
  index: number;
  key: string;
  style: React.CSSProperties;
}

function LogItemRenderer(props: LogItemRendererProps, logs: LogItem[]) {
  const { index, key, style } = props;
  const log = logs[index];

  if (!log) {
    return (
      <div key={key} style={style} className="p-4">
        <div className="h-24 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PROCESSING":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PROCESSING":
        return "bg-blue-100 text-blue-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div key={key} style={style} className="p-2">
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {log.source}
              </Badge>
              <div className="flex items-center gap-1">
                {getStatusIcon(log.status)}
                <Badge className={cn("text-xs", getStatusColor(log.status))}>
                  {log.status.toLowerCase()}
                </Badge>
              </div>
            </div>
            <div className="text-muted-foreground text-xs">
              {new Date(log.time).toLocaleString()}
            </div>
          </div>

          <div className="mb-2">
            <p className="line-clamp-2 text-sm text-gray-700">
              {log.ingestText}
            </p>
          </div>

          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              {log.sourceURL && (
                <a
                  href={log.sourceURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Source URL
                </a>
              )}
              {log.processedAt && (
                <span>
                  Processed: {new Date(log.processedAt).toLocaleString()}
                </span>
              )}
            </div>

            {log.error && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span className="max-w-[200px] truncate" title={log.error}>
                  {log.error}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function VirtualLogsList({
  logs,
  hasMore,
  loadMore,
  isLoading,
  height = 600,
}: VirtualLogsListProps) {
  const [containerHeight, setContainerHeight] = useState(height);

  useEffect(() => {
    const updateHeight = () => {
      const availableHeight = window.innerHeight - 300; // Account for header, filters, etc.
      setContainerHeight(Math.min(availableHeight, height));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [height]);

  const isRowLoaded = ({ index }: { index: number }) => {
    return !!logs[index];
  };

  const loadMoreRows = async () => {
    if (hasMore) {
      return loadMore();
    }

    return false;
  };

  const rowRenderer = (props: LogItemRendererProps) => {
    return LogItemRenderer(props, logs);
  };

  const itemCount = hasMore ? logs.length + 1 : logs.length;

  return (
    <div className="overflow-hidden rounded-lg border">
      <InfiniteLoader
        isRowLoaded={isRowLoaded}
        loadMoreRows={loadMoreRows}
        rowCount={itemCount}
        threshold={5}
      >
        {({ onRowsRendered, registerChild }) => (
          <List
            ref={registerChild}
            height={containerHeight}
            rowCount={itemCount}
            rowHeight={ITEM_HEIGHT}
            onRowsRendered={onRowsRendered}
            rowRenderer={rowRenderer}
            className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          />
        )}
      </InfiniteLoader>

      {isLoading && (
        <div className="text-muted-foreground p-4 text-center text-sm">
          Loading more logs...
        </div>
      )}
    </div>
  );
}
