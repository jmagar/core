import { useState } from "react";
import { Check, ChevronsUpDown, Filter, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface LogsFiltersProps {
  availableSources: Array<{ name: string; slug: string }>;
  selectedSource?: string;
  selectedStatus?: string;
  onSourceChange: (source?: string) => void;
  onStatusChange: (status?: string) => void;
}

const statusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function LogsFilters({
  availableSources,
  selectedSource,
  selectedStatus,
  onSourceChange,
  onStatusChange,
}: LogsFiltersProps) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const selectedSourceName = availableSources.find(
    (s) => s.slug === selectedSource,
  )?.name;
  const selectedStatusLabel = statusOptions.find(
    (s) => s.value === selectedStatus,
  )?.label;

  const clearFilters = () => {
    onSourceChange(undefined);
    onStatusChange(undefined);
  };

  const hasFilters = selectedSource || selectedStatus;

  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex items-center gap-2">
        <Filter className="text-muted-foreground h-4 w-4" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      {/* Source Filter */}
      <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={sourceOpen}
            className="w-[200px] justify-between"
          >
            {selectedSourceName || "Select source..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search sources..." />
            <CommandList>
              <CommandEmpty>No sources found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value=""
                  onSelect={() => {
                    onSourceChange(undefined);
                    setSourceOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !selectedSource ? "opacity-100" : "opacity-0",
                    )}
                  />
                  All sources
                </CommandItem>
                {availableSources.map((source) => (
                  <CommandItem
                    key={source.slug}
                    value={source.slug}
                    onSelect={() => {
                      onSourceChange(
                        source.slug === selectedSource
                          ? undefined
                          : source.slug,
                      );
                      setSourceOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSource === source.slug
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {source.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Status Filter */}
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={statusOpen}
            className="w-[200px] justify-between"
          >
            {selectedStatusLabel || "Select status..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search status..." />
            <CommandList>
              <CommandEmpty>No status found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value=""
                  onSelect={() => {
                    onStatusChange(undefined);
                    setStatusOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !selectedStatus ? "opacity-100" : "opacity-0",
                    )}
                  />
                  All statuses
                </CommandItem>
                {statusOptions.map((status) => (
                  <CommandItem
                    key={status.value}
                    value={status.value}
                    onSelect={() => {
                      onStatusChange(
                        status.value === selectedStatus
                          ? undefined
                          : status.value,
                      );
                      setStatusOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedStatus === status.value
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {status.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Active Filters */}
      {hasFilters && (
        <div className="flex items-center gap-2">
          {selectedSource && (
            <Badge variant="secondary" className="gap-1">
              {selectedSourceName}
              <X
                className="hover:text-destructive h-3 w-3 cursor-pointer"
                onClick={() => onSourceChange(undefined)}
              />
            </Badge>
          )}
          {selectedStatus && (
            <Badge variant="secondary" className="gap-1">
              {selectedStatusLabel}
              <X
                className="hover:text-destructive h-3 w-3 cursor-pointer"
                onClick={() => onStatusChange(undefined)}
              />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
