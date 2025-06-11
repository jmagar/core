import { PlusIcon, Loader2 } from "lucide-react";
import { Button } from "../ui";
import { Textarea } from "../ui/textarea";
import { useState } from "react";
import { z } from "zod";
import { EpisodeType } from "@core/types";
import { useFetcher } from "@remix-run/react";

export const IngestBodyRequest = z.object({
  episodeBody: z.string(),
  referenceTime: z.string(),
  type: z.enum([EpisodeType.Conversation, EpisodeType.Text]), // Assuming these are the EpisodeType values
  source: z.string(),
  spaceId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const Ingest = () => {
  const [text, setText] = useState("");
  const fetcher = useFetcher();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    fetcher.submit(
      {
        episodeBody: text,
        type: "TEXT",
        referenceTime: new Date().toISOString(),
        source: "local",
      },
      { method: "POST", action: "/home/dashboard" },
    );
  };

  const isLoading = fetcher.state === "submitting";

  return (
    <div className="flex flex-col">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <input type="hidden" name="type" value="TEXT" />
        <input
          type="hidden"
          name="referenceTime"
          value={new Date().toISOString()}
        />
        <input type="hidden" name="source" value="local" />
        <Textarea
          name="episodeBody"
          value={text}
          placeholder="Tell what you want to add"
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
        />

        <div className="mt-2 flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            className="gap-1"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <PlusIcon size={16} />
            )}
            {isLoading ? "Adding..." : "Add"}
          </Button>
        </div>
      </form>
    </div>
  );
};
