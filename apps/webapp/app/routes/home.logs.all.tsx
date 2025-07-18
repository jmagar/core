import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { useLogs } from "~/hooks/use-logs";
import { LogsFilters } from "~/components/logs/logs-filters";
import { VirtualLogsList } from "~/components/logs/virtual-logs-list";
import { AppContainer, PageContainer } from "~/components/layout/app-layout";
import { Card, CardContent } from "~/components/ui/card";
import { Database, LoaderCircle } from "lucide-react";
import { PageHeader } from "~/components/common/page-header";

export default function LogsAll() {
  const navigate = useNavigate();
  const [selectedSource, setSelectedSource] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();

  const {
    logs,
    hasMore,
    loadMore,
    availableSources,
    isLoading,
    isInitialLoad,
  } = useLogs({
    endpoint: "/api/v1/logs/all",
    source: selectedSource,
    status: selectedStatus,
  });

  return (
    <>
      <PageHeader
        title="Logs"
        tabs={[
          {
            label: "All",
            value: "all",
            isActive: true,
            onClick: () => navigate("/home/logs/all"),
          },
          {
            label: "Activity",
            value: "activity",
            isActive: false,
            onClick: () => navigate("/home/logs/activity"),
          },
        ]}
      />
      <div className="h-[calc(100vh_-_56px)] space-y-6 p-4 px-5">
        {isInitialLoad ? (
          <>
            <LoaderCircle className="text-primary h-4 w-4 animate-spin" />{" "}
          </>
        ) : (
          <>
            {" "}
            {/* Filters */}
            {logs.length > 0 && (
              <LogsFilters
                availableSources={availableSources}
                selectedSource={selectedSource}
                selectedStatus={selectedStatus}
                onSourceChange={setSelectedSource}
                onStatusChange={setSelectedStatus}
              />
            )}
            {/* Logs List */}
            <div className="space-y-4">
              {logs.length === 0 ? (
                <Card>
                  <CardContent className="bg-background-2 flex items-center justify-center py-16">
                    <div className="text-center">
                      <Database className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                      <h3 className="mb-2 text-lg font-semibold">
                        No logs found
                      </h3>
                      <p className="text-muted-foreground">
                        {selectedSource || selectedStatus
                          ? "Try adjusting your filters to see more results."
                          : "No ingestion logs are available yet."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <VirtualLogsList
                  logs={logs}
                  hasMore={hasMore}
                  loadMore={loadMore}
                  isLoading={isLoading}
                  height={600}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
