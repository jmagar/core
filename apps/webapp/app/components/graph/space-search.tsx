import { useState, useCallback, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useDebounce } from "~/hooks/use-debounce";
import type { RawTriplet } from "./type";

interface SpaceSearchProps {
  triplets: RawTriplet[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
}

export function SpaceSearch({
  triplets,
  searchQuery,
  onSearchChange,
  placeholder = "Search in episodes...",
}: SpaceSearchProps) {
  const [inputValue, setInputValue] = useState(searchQuery);

  // Debounce the search to avoid too many re-renders
  const debouncedSearchQuery = useDebounce(inputValue, 300);

  // Update parent component when debounced value changes
  useMemo(() => {
    if (debouncedSearchQuery !== searchQuery) {
      onSearchChange(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, searchQuery, onSearchChange]);

  // Helper to determine if a node is an episode
  const isEpisodeNode = useCallback((node: any) => {
    // Check if node has content attribute (indicates it's an episode)
    return (
      node.attributes?.content ||
      node.attributes?.episodeUuid ||
      (node.labels && node.labels.includes("Episode"))
    );
  }, []);

  // Count episode nodes that match the search
  const matchingEpisodes = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return 0;

    const query = debouncedSearchQuery.toLowerCase();
    const episodes: Record<string, number> = {};

    triplets.forEach((triplet) => {
      // Check if source node is an episode and matches
      if (
        isEpisodeNode(triplet.sourceNode) &&
        triplet.sourceNode.attributes?.content?.toLowerCase().includes(query)
      ) {
        episodes[triplet.sourceNode.uuid] = 1;
      }

      // Check if target node is an episode and matches
      if (
        isEpisodeNode(triplet.targetNode) &&
        triplet.targetNode.attributes?.content?.toLowerCase().includes(query)
      ) {
        episodes[triplet.targetNode.uuid] = 1;
      }
    });

    return Object.keys(episodes).length;
  }, [triplets, debouncedSearchQuery]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleClear = () => {
    setInputValue("");
    onSearchChange("");
  };

  const hasSearchQuery = inputValue.trim().length > 0;

  return (
    <div className="flex w-full max-w-md items-center gap-2">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pr-8 pl-10"
        />
        {hasSearchQuery && (
          <Button
            variant="ghost"
            size="xs"
            onClick={handleClear}
            className="absolute top-1/2 right-1 -translate-y-1/2"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Show search results count */}
      {debouncedSearchQuery.trim() && (
        <div className="text-muted-foreground shrink-0 text-sm">
          {matchingEpisodes} episode{matchingEpisodes !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
