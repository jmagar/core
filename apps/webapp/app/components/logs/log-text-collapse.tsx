import { useState } from "react";
import { useFetcher } from "@remix-run/react";
import { AlertCircle, Info, Trash } from "lucide-react";
import { cn } from "~/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui";
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

interface LogTextCollapseProps {
  text?: string;
  error?: string;
  logData: any;
  id: string;
  episodeUUID?: string;
}

export function LogTextCollapse({
  episodeUUID,
  text,
  error,
  id,
  logData,
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
    <>
      <div className="mb-2">
        <p
          className={cn(
            "whitespace-p-wrap pt-2 text-sm break-words",
            isLong ? "max-h-16 overflow-hidden" : "",
          )}
          style={{ lineHeight: "1.5" }}
          dangerouslySetInnerHTML={{ __html: text }}
        />

        {isLong && (
          <>
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
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-end text-xs",
          isLong && "justify-between",
        )}
      >
        {isLong && (
          <div className="flex items-center">
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
                  <Button variant="ghost" size="sm" className="rounded px-2">
                    <Trash size={15} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Episode</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this episode? This action
                      cannot be undone.
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
        )}
        {error && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertCircle className="h-3 w-3" />
            <span className="max-w-[200px] truncate" title={error}>
              {error}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
