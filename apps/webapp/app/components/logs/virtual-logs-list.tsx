import { useEffect, useRef } from "react";
import {
  InfiniteLoader,
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  type Index,
  type ListRowProps,
} from "react-virtualized";
import { type LogItem } from "~/hooks/use-logs";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { ScrollManagedList } from "../virtualized-list";
import { LogTextCollapse } from "./log-text-collapse";

interface VirtualLogsListProps {
  logs: LogItem[];
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  height?: number;
}

function LogItemRenderer(
  props: ListRowProps,
  logs: LogItem[],
  cache: CellMeasurerCache,
) {
  const { index, key, style, parent } = props;
  const log = logs[index];

  if (!log) {
    return (
      <CellMeasurer
        key={key}
        cache={cache}
        columnIndex={0}
        parent={parent}
        rowIndex={index}
      >
        <div key={key} style={style} className="p-4">
          <div className="h-24 animate-pulse rounded bg-gray-200" />
        </div>
      </CellMeasurer>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PROCESSING":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100 hover:text-blue-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 hover:text-yellow-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800";
      case "FAILED":
        return "bg-red-100 text-red-800 hover:bg-red-100 hover:text-red-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800 hover:bg-gray-100 hover:text-gray-800";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100 hover:text-gray-800";
    }
  };

  return (
    <CellMeasurer
      key={key}
      cache={cache}
      columnIndex={0}
      parent={parent}
      rowIndex={index}
    >
      <div key={key} style={style} className="pb-2">
        <Card className="h-full">
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded text-xs">
                  {log.source}
                </Badge>
                <div className="flex items-center gap-1">
                  <Badge
                    className={cn(
                      "rounded text-xs",
                      getStatusColor(log.status),
                    )}
                  >
                    {log.status.charAt(0).toUpperCase() +
                      log.status.slice(1).toLowerCase()}
                  </Badge>
                </div>
              </div>
              <div className="text-muted-foreground text-xs">
                {new Date(log.time).toLocaleString()}
              </div>
            </div>

            <LogTextCollapse
              text={log.ingestText}
              error={log.error}
              logData={log.data}
              episodeUUID={log.episodeUUID}
            />
          </CardContent>
        </Card>
      </div>
    </CellMeasurer>
  );
}

export function VirtualLogsList({
  logs,
  hasMore,
  loadMore,
  isLoading,
}: VirtualLogsListProps) {
  // Create a CellMeasurerCache instance using useRef to prevent recreation
  const cacheRef = useRef<CellMeasurerCache | null>(null);
  if (!cacheRef.current) {
    cacheRef.current = new CellMeasurerCache({
      defaultHeight: 120, // Default row height
      fixedWidth: true, // Rows have fixed width but dynamic height
    });
  }
  const cache = cacheRef.current;

  useEffect(() => {
    cache.clearAll();
  }, [logs, cache]);

  const isRowLoaded = ({ index }: { index: number }) => {
    return !!logs[index];
  };

  const loadMoreRows = async () => {
    if (hasMore) {
      return loadMore();
    }

    return false;
  };

  const rowRenderer = (props: ListRowProps) => {
    return LogItemRenderer(props, logs, cache);
  };

  const rowHeight = ({ index }: Index) => {
    return cache.getHeight(index, 0);
  };

  const itemCount = hasMore ? logs.length + 1 : logs.length;

  return (
    <div className="h-[calc(100vh_-_132px)] overflow-hidden rounded-lg">
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
          Loading more logs...
        </div>
      )}
    </div>
  );
}
