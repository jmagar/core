import { useEffect, useState, useCallback } from "react";
import { useFetcher } from "@remix-run/react";

export interface McpSessionItem {
  id: string;
  source: string;
  integrations: string[];
  createdAt: string;
  deleted: string;
}

export interface McpSessionsResponse {
  sessions: McpSessionItem[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  availableSources: Array<{ name: string; slug: string; count: number }>;
  activeSources: string[];
}

export interface UseMcpSessionsOptions {
  endpoint: string;
  source?: string;
}

export function useMcpSessions({ endpoint, source }: UseMcpSessionsOptions) {
  const fetcher = useFetcher<McpSessionsResponse>();
  const [sessions, setSessions] = useState<McpSessionItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [availableSources, setAvailableSources] = useState<
    Array<{ name: string; slug: string; count: number }>
  >([]);
  const [activeSources, setActiveSources] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const buildUrl = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams();
      params.set("page", pageNum.toString());
      params.set("limit", "10");
      if (source) params.set("source", source);
      return `${endpoint}?${params.toString()}`;
    },
    [endpoint, source],
  );

  const loadMore = useCallback(() => {
    if (fetcher.state === "idle" && hasMore) {
      fetcher.load(buildUrl(page + 1));
    }
  }, [hasMore, page, buildUrl]);

  const reset = useCallback(() => {
    setSessions([]);
    setPage(1);
    setHasMore(true);
    setIsInitialLoad(true);
    fetcher.load(buildUrl(1));
  }, [buildUrl]);

  // Effect to handle fetcher data
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const {
        sessions: newSessions,
        hasMore: newHasMore,
        page: currentPage,
        availableSources: sources,
        activeSources: activeSourceNames,
      } = fetcher.data;

      if (currentPage === 1) {
        // First page or reset
        setSessions(newSessions);
        setIsInitialLoad(false);
      } else {
        // Append to existing sessions
        setSessions((prev) => [...prev, ...newSessions]);
      }

      setHasMore(newHasMore);
      setPage(currentPage);
      setAvailableSources(sources);
      setActiveSources(activeSourceNames);
    }
  }, [fetcher.data, fetcher.state]);

  // Effect to reset when filters change
  useEffect(() => {
    setSessions([]);
    setPage(1);
    setHasMore(true);
    setIsInitialLoad(true);
    fetcher.load(buildUrl(1));
  }, [source, buildUrl]);

  // Initial load
  useEffect(() => {
    if (isInitialLoad) {
      fetcher.load(buildUrl(1));
    }
  }, [isInitialLoad, buildUrl]);

  return {
    sessions,
    hasMore,
    loadMore,
    reset,
    availableSources,
    activeSources,
    isLoading: fetcher.state === "loading",
    isInitialLoad,
  };
}
