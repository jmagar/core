import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";

export interface IngestionQueueItem {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  createdAt: string;
  error?: string;
  data: any;
}

export interface IngestionStatusResponse {
  queue: IngestionQueueItem[];
  count: number;
}

export function useIngestionStatus() {
  const fetcher = useFetcher<IngestionStatusResponse>();
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    const pollIngestionStatus = () => {
      if (fetcher.state === "idle") {
        fetcher.load("/api/v1/ingestion-queue/status");
      }
    };

    // Initial load
    pollIngestionStatus();

    // Set up polling interval
    const interval = setInterval(pollIngestionStatus, 3000); // Poll every 3 seconds
    setIsPolling(true);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, []); // Remove fetcher from dependencies to prevent infinite loop

  return {
    data: fetcher.data,
    isLoading: fetcher.state === "loading",
    isPolling,
    error: fetcher.data === undefined && fetcher.state === "idle" ? "Error loading ingestion status" : null
  };
}
