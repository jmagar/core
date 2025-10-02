import { useState, useEffect, type ReactNode } from "react";
import { useFetcher } from "@remix-run/react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Badge, BadgeColor } from "../ui/badge";
import { type LogItem } from "~/hooks/use-logs";
import Markdown from "react-markdown";
import { getIconForAuthorise } from "../icon-utils";
import { cn, formatString } from "~/lib/utils";
import { getStatusColor } from "./utils";
import { format } from "date-fns";

interface LogDetailsProps {
  log: LogItem;
}

interface PropertyItemProps {
  label: string;
  value?: string | ReactNode;
  icon?: ReactNode;
  variant?: "default" | "secondary" | "outline" | "status";
  statusColor?: string;
  className?: string;
}

function PropertyItem({
  label,
  value,
  icon,
  variant = "secondary",
  statusColor,
  className,
}: PropertyItemProps) {
  if (!value) return null;

  return (
    <div className="flex items-center py-1">
      <span className="text-muted-foreground min-w-[160px]">{label}</span>

      {variant === "status" ? (
        <Badge
          className={cn(
            "!bg-grayAlpha-100 text-muted-foreground h-7 rounded px-4 text-xs",
            className,
          )}
        >
          {statusColor && (
            <BadgeColor className={cn(statusColor, "h-2.5 w-2.5")} />
          )}
          {value}
        </Badge>
      ) : (
        <Badge variant={variant} className={cn("h-7 rounded px-4", className)}>
          {icon}
          {value}
        </Badge>
      )}
    </div>
  );
}

interface EpisodeFact {
  uuid: string;
  fact: string;
  createdAt: string;
  validAt: string;
  attributes: any;
}

interface EpisodeFactsResponse {
  facts: EpisodeFact[];
  invalidFacts: EpisodeFact[];
}

function getStatusValue(status: string) {
  if (status === "PENDING") {
    return "In Queue";
  }

  return status;
}

export function LogDetails({ log }: LogDetailsProps) {
  const [facts, setFacts] = useState<any[]>([]);
  const [invalidFacts, setInvalidFacts] = useState<any[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const fetcher = useFetcher<EpisodeFactsResponse>();

  // Fetch episode facts when dialog opens and episodeUUID exists
  useEffect(() => {
    if (log.data?.type === "DOCUMENT" && log.data?.episodes?.length > 0) {
      setFactsLoading(true);
      setFacts([]);
      // Fetch facts for all episodes in DOCUMENT type
      Promise.all(
        log.data.episodes.map((episodeId: string) =>
          fetch(`/api/v1/episodes/${episodeId}/facts`).then((res) =>
            res.json(),
          ),
        ),
      )
        .then((results) => {
          const allFacts = results.flatMap((result) => result.facts || []);
          const allInvalidFacts = results.flatMap(
            (result) => result.invalidFacts || [],
          );
          setFacts(allFacts);
          setInvalidFacts(allInvalidFacts);
          setFactsLoading(false);
        })
        .catch(() => {
          setFactsLoading(false);
        });
    } else if (log.episodeUUID) {
      setFactsLoading(true);
      fetcher.load(`/api/v1/episodes/${log.episodeUUID}/facts`);
    }
  }, [log.episodeUUID, log.data?.type, log.data?.episodes, facts.length]);

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      setFactsLoading(false);
      const response = fetcher.data;
      setFacts(response.facts);
      setInvalidFacts(response.invalidFacts);
    }
  }, [fetcher.data, fetcher.state]);

  return (
    <div className="flex h-full w-full flex-col items-center overflow-auto">
      <div className="max-w-4xl">
        <div className="px-4 pt-4">
          <div className="mb-4 flex w-full items-center justify-between">
            <span>Episode Details</span>
          </div>
        </div>

        <div className="mb-10 px-4">
          <div className="space-y-1">
            {log.data?.type === "DOCUMENT" && log.data?.episodes ? (
              <PropertyItem
                label="Episodes"
                value={
                  <div className="flex flex-wrap gap-1">
                    {log.data.episodes.map(
                      (episodeId: string, index: number) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs"
                        >
                          {episodeId}
                        </Badge>
                      ),
                    )}
                  </div>
                }
                variant="secondary"
              />
            ) : (
              <PropertyItem
                label="Episode Id"
                value={log.episodeUUID}
                variant="secondary"
              />
            )}
            <PropertyItem
              label="Session Id"
              value={log.data?.sessionId?.toLowerCase()}
              variant="secondary"
            />
            <PropertyItem
              label="Type"
              value={formatString(
                log.data?.type ? log.data.type.toLowerCase() : "conversation",
              )}
              variant="secondary"
            />
            <PropertyItem
              label="Source"
              value={formatString(log.source?.toLowerCase())}
              icon={
                log.source &&
                getIconForAuthorise(log.source.toLowerCase(), 16, undefined)
              }
              variant="secondary"
            />

            <PropertyItem
              label="Status"
              value={getStatusValue(log.status)}
              variant="status"
              statusColor={log.status && getStatusColor(log.status)}
            />
          </div>
        </div>

        {/* Error Details */}
        {log.error && (
          <div className="mb-6 px-4">
            <div className="mb-2 flex w-full items-center justify-between">
              <span>Error Details</span>
            </div>
            <div className="bg-destructive/10 rounded-md p-3">
              <div className="flex items-start gap-2 text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="text-sm break-words whitespace-pre-wrap">
                  {log.error}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center p-4 pt-0">
          <div className="mb-2 flex w-full items-center justify-between">
            <span>Content</span>
          </div>
          {/* Log Content */}
          <div className="mb-4 w-full text-sm break-words whitespace-pre-wrap">
            <div className="rounded-md">
              <Markdown>{log.ingestText}</Markdown>
            </div>
          </div>
        </div>

        {/* Episode Facts */}
        <div className="mb-6 px-4">
          <div className="mb-2 flex w-full items-center justify-between">
            <span>Facts</span>
          </div>
          <div className="rounded-md">
            {factsLoading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : facts.length > 0 ? (
              <div className="flex flex-col gap-1">
                {facts.map((fact) => (
                  <div
                    key={fact.uuid}
                    className="bg-grayAlpha-100 flex items-center justify-between gap-2 rounded-md p-3"
                  >
                    <p className="text-sm">{fact.fact}</p>
                    <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                      <span>
                        Valid: {format(new Date(fact.validAt), "dd/MM/yyyy")}
                      </span>
                      {fact.invalidAt && (
                        <span>
                          Invalid:{" "}
                          {format(new Date(fact.invalidAt), "dd/MM/yyyy")}
                        </span>
                      )}
                      {Object.keys(fact.attributes).length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {Object.keys(fact.attributes).length} attributes
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {invalidFacts.map((fact) => (
                  <div
                    key={fact.uuid}
                    className="bg-grayAlpha-100 rounded-md p-3"
                  >
                    <p className="mb-1 text-sm">{fact.fact}</p>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      {fact.invalidAt && (
                        <span>
                          Invalid: {new Date(fact.invalidAt).toLocaleString()}
                        </span>
                      )}
                      {Object.keys(fact.attributes).length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {Object.keys(fact.attributes).length} attributes
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground p-4 text-center text-sm">
                No facts found for this episode
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
