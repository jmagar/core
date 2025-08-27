import { Calendar } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { type SpacePattern } from "@prisma/client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui";
import { useFetcher } from "@remix-run/react";

interface SpacePatternCardProps {
  pattern: SpacePattern;
}

export function SpacePatternCard({ pattern }: SpacePatternCardProps) {
  const [dialog, setDialog] = useState(false);
  const fetcher = useFetcher();
  const displayText = pattern.summary;

  const handleAction = (actionType: "add" | "delete") => {
    fetcher.submit(
      {
        actionType,
        patternId: pattern.id,
      },
      { method: "POST" },
    );
    setDialog(false);
  };

  return (
    <>
      <div className="group flex w-full items-center px-2 pr-2">
        <div
          className={cn(
            "group-hover:bg-grayAlpha-100 flex min-w-[0px] shrink grow items-start gap-2 rounded-md px-3",
          )}
          onClick={() => setDialog(true)}
        >
          <div
            className={cn(
              "border-border flex w-full min-w-[0px] shrink flex-col border-b py-1",
            )}
          >
            <div className="flex w-full items-center justify-between gap-6">
              <div className="inline-flex min-h-[24px] min-w-[0px] shrink cursor-pointer items-center justify-start">
                <div className={cn("truncate text-left")}>{displayText}</div>
              </div>
              <div className="text-muted-foreground flex shrink-0 items-center justify-end gap-2 text-xs">
                <Badge variant="secondary" className="rounded text-xs">
                  {pattern.type}
                </Badge>
                <Badge variant="secondary" className="rounded text-xs">
                  {pattern.name}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md overflow-auto p-4">
          <DialogHeader>
            <DialogTitle>Pattern</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Badge variant="secondary" className="rounded text-xs">
                {pattern.type}
              </Badge>
              <Badge variant="secondary" className="rounded text-xs">
                {pattern.name}
              </Badge>
            </div>
            <p>{displayText}</p>

            <div className="flex justify-end">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => handleAction("delete")}
                  disabled={fetcher.state === "submitting"}
                >
                  Delete
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleAction("add")}
                  disabled={fetcher.state === "submitting"}
                >
                  Add to memory
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
