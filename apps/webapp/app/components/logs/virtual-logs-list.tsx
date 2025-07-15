import { useEffect, useRef, useState } from "react";
import {
  List,
  InfiniteLoader,
  WindowScroller,
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  type Index,
  type ListRowProps,
} from "react-virtualized";
import { type LogItem } from "~/hooks/use-logs";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { ScrollManagedList } from "../virtualized-list";

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
              <p className="text-sm text-gray-700">{log.ingestText}</p>
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
    </CellMeasurer>
  );
}

export function VirtualLogsList({
  logs,
  hasMore,
  loadMore,
  isLoading,
  height = 600,
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
