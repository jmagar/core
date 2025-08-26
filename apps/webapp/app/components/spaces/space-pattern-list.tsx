import { useEffect, useRef } from "react";
import {
  InfiniteLoader,
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  type Index,
  type ListRowProps,
} from "react-virtualized";
import { Database } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { ScrollManagedList } from "../virtualized-list";
import { type SpacePattern } from "@prisma/client";
import { SpacePatternCard } from "./space-pattern-card";

interface SpacePatternListProps {
  patterns: any[];
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  height?: number;
}

function PatternItemRenderer(
  props: ListRowProps,
  patterns: SpacePattern[],
  cache: CellMeasurerCache,
) {
  const { index, key, style, parent } = props;
  const pattern = patterns[index];

  return (
    <CellMeasurer
      key={key}
      cache={cache}
      columnIndex={0}
      parent={parent}
      rowIndex={index}
    >
      <div key={key} style={style} className="pb-2">
        <SpacePatternCard pattern={pattern} />
      </div>
    </CellMeasurer>
  );
}

export function SpacePatternList({
  patterns,
  hasMore,
  loadMore,
  isLoading,
}: SpacePatternListProps) {
  // Create a CellMeasurerCache instance using useRef to prevent recreation
  const cacheRef = useRef<CellMeasurerCache | null>(null);
  if (!cacheRef.current) {
    cacheRef.current = new CellMeasurerCache({
      defaultHeight: 200, // Default row height for fact cards
      fixedWidth: true, // Rows have fixed width but dynamic height
    });
  }
  const cache = cacheRef.current;

  useEffect(() => {
    cache.clearAll();
  }, [patterns, cache]);

  if (patterns.length === 0 && !isLoading) {
    return (
      <Card className="bg-background-2 w-full">
        <CardContent className="bg-background-2 flex w-full items-center justify-center py-16">
          <div className="text-center">
            <Database className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">No patterns found</h3>
            <p className="text-muted-foreground">
              This space doesn't contain any patterns yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isRowLoaded = ({ index }: { index: number }) => {
    return !!patterns[index];
  };

  const loadMoreRows = async () => {
    if (hasMore) {
      return loadMore();
    }
    return false;
  };

  const rowRenderer = (props: ListRowProps) => {
    return PatternItemRenderer(props, patterns, cache);
  };

  const rowHeight = ({ index }: Index) => {
    return cache.getHeight(index, 0);
  };

  const itemCount = hasMore ? patterns.length + 1 : patterns.length;

  return (
    <div className="h-full grow overflow-hidden rounded-lg">
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
          Loading more patterns...
        </div>
      )}
    </div>
  );
}
