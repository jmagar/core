import { useState } from "react";
import { useFetcher } from "@remix-run/react";
import { AlertCircle, Info, Trash } from "lucide-react";
import { cn } from "~/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { type LogItem } from "~/hooks/use-logs";

interface LogTextCollapseProps {
  text?: string;
  error?: string;
  logData: any;
  log: LogItem;
  id: string;
  episodeUUID?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "PROCESSING":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100 hover:text-blue-800";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 hover:text-yellow-800";
    case "COMPLETED":
      return "bg-success/10 text-success hover:bg-success/10 hover:text-success";
    case "FAILED":
      return "bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive";
    case "CANCELLED":
      return "bg-gray-100 text-gray-800 hover:bg-gray-100 hover:text-gray-800";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100 hover:text-gray-800";
  }
};

export function LogTextCollapse({
  episodeUUID,
  text,
  error,
  id,
  logData,
  log,
}: LogTextCollapseProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteFetcher = useFetcher();

  const handleDelete = () => {
    if (!episodeUUID) {
      console.error("No episodeUuid found in log data");
      return;
    }

    deleteFetcher.submit(
      { id },
      {
        method: "DELETE",
        action: "/api/v1/ingestion_queue/delete",
        encType: "application/json",
      },
    );
    setDeleteDialogOpen(false);
  };

  // Show collapse if text is long (by word count)
  const COLLAPSE_WORD_LIMIT = 30;

  if (!text) {
    return (
      <div className="text-muted-foreground mb-2 text-xs italic">
        No log details.
      </div>
    );
  }

  // Split by words for word count
  const words = text.split(/\s+/);
  const isLong = words.length > COLLAPSE_WORD_LIMIT;

  let displayText: string;
  if (isLong) {
    displayText = words.slice(0, COLLAPSE_WORD_LIMIT).join(" ") + " ...";
  } else {
    displayText = text;
  }

  return (
    <div className="flex w-full items-center">
      <div
        className={cn(
          "group-hover:bg-grayAlpha-100 flex min-w-[0px] shrink grow items-start gap-2 rounded-md px-4",
        )}
      >
        <div
          className={cn(
            "border-border flex w-full min-w-[0px] shrink flex-col border-b py-2",
          )}
        >
          <div className="flex w-full items-center justify-between gap-4">
            <div
              className="inline-flex min-h-[24px] min-w-[0px] shrink cursor-pointer items-center justify-start"
              onClick={() => setDialogOpen(true)}
            >
              <div
                className={cn("truncate text-left")}
                dangerouslySetInnerHTML={{ __html: text }}
              ></div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-2xl p-4">
                <DialogHeader>
                  <DialogTitle className="flex w-full items-center justify-between">
                    <span>Log Details</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-auto p-0">
                  <p
                    className="px-3 py-2 text-sm break-words whitespace-pre-wrap"
                    style={{ lineHeight: "1.5" }}
                    dangerouslySetInnerHTML={{ __html: text }}
                  />
                  {error && (
                    <div className="mt-4 border-t px-3 py-2">
                      <div className="flex items-start gap-2 text-red-600">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div>
                          <p className="mb-1 text-sm font-medium">
                            Error Details
                          </p>
                          <p className="text-sm break-words whitespace-pre-wrap">
                            {error}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <div className="text-muted-foreground flex items-center justify-end text-xs">
              <div className="flex items-center">
                <Badge
                  className={cn(
                    "mr-3 rounded text-xs",
                    getStatusColor(log.status),
                  )}
                >
                  {log.status.charAt(0).toUpperCase() +
                    log.status.slice(1).toLowerCase()}
                </Badge>

                <div className="text-muted-foreground mr-3">
                  {new Date(log.time).toLocaleString()}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 rounded px-2"
                  onClick={() => setDialogOpen(true)}
                >
                  <Info size={15} />
                </Button>
                {episodeUUID && (
                  <AlertDialog
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded px-2"
                      >
                        <Trash size={15} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Episode</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this episode? This
                          action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
