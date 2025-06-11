import { PlusIcon, SearchIcon, Loader2 } from "lucide-react";
import { Button } from "../ui";
import { Textarea } from "../ui/textarea";
import { useState } from "react";
import { z } from "zod";
import { EpisodeType } from "@core/types";
import { useFetcher } from "@remix-run/react";

export const Search = () => {
  const [text, setText] = useState("");
  const fetcher = useFetcher<undefined | Record<string, string[]>>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    fetcher.submit(
      { query: text },
      { method: "POST", action: "/home/dashboard" },
    );
  };

  const searchResults = () => {
    const data = fetcher.data as {
      episodes?: string[];
      facts?: string[];
    };

    if (
      (!data.episodes || data.episodes.length === 0) &&
      (!data.facts || data.facts.length === 0)
    ) {
      return (
        <div className="mt-4">
          <p className="text-muted-foreground">No results found</p>
        </div>
      );
    }

    return (
      <div className="mt-4">
        {data.episodes && data.episodes.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-lg font-semibold">Episodes</h3>
            {data.episodes.map((episode, index) => (
              <div key={index} className="bg-secondary mb-2 rounded-lg p-3">
                {episode}
              </div>
            ))}
          </div>
        )}
        {data.facts && data.facts.length > 0 && (
          <div>
            <h3 className="mb-2 text-lg font-semibold">Facts</h3>
            {data.facts.map((fact, index) => (
              <div key={index} className="bg-secondary mb-2 rounded-lg p-3">
                {fact}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = fetcher.state === "submitting";

  return (
    <div className="flex flex-col">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <Textarea
          name="query"
          value={text}
          placeholder="What do you want to search"
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
              <SearchIcon size={16} />
            )}
            {isLoading ? "Searching..." : "Search"}
          </Button>
        </div>
      </form>

      {fetcher?.data && searchResults()}
    </div>
  );
};
