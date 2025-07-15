import { useState } from "react";
import { useLogs } from "~/hooks/use-logs";
import { LogsFilters } from "~/components/logs/logs-filters";
import { VirtualLogsList } from "~/components/logs/virtual-logs-list";
import { AppContainer, PageContainer, PageBody } from "~/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Activity } from "lucide-react";

export default function LogsActivity() {
  const [selectedSource, setSelectedSource] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  
  const { 
    logs, 
    hasMore, 
    loadMore, 
    availableSources, 
    isLoading, 
    isInitialLoad 
  } = useLogs({ 
    endpoint: '/api/v1/logs/activity', 
    source: selectedSource, 
    status: selectedStatus 
  });

  if (isInitialLoad) {
    return (
      <AppContainer>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </PageContainer>
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <PageContainer>
        <PageBody>
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">Activity Ingestion Logs</h1>
                  <p className="text-muted-foreground">
                    View ingestion logs for activities from connected integrations
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-sm">
                {logs.length} activity logs loaded
              </Badge>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <LogsFilters
                  availableSources={availableSources}
                  selectedSource={selectedSource}
                  selectedStatus={selectedStatus}
                  onSourceChange={setSelectedSource}
                  onStatusChange={setSelectedStatus}
                />
              </CardContent>
            </Card>

            {/* Logs List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Activity Ingestion Queue</h2>
                {hasMore && (
                  <span className="text-sm text-muted-foreground">
                    Scroll to load more...
                  </span>
                )}
              </div>
              
              {logs.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No activity logs found</h3>
                      <p className="text-muted-foreground">
                        {selectedSource || selectedStatus 
                          ? 'Try adjusting your filters to see more results.'
                          : 'No activity ingestion logs are available yet.'}
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
          </div>
        </PageBody>
      </PageContainer>
    </AppContainer>
  );
}
