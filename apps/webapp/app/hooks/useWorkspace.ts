import { type Workspace } from "@core/database";
import { type UIMatch } from "@remix-run/react";

import { useTypedMatchesData } from "./useTypedMatchData";
import { loader } from "~/routes/home";

export function useOptionalWorkspace(
  matches?: UIMatch[],
): Workspace | undefined {
  const routeMatch = useTypedMatchesData<typeof loader>({
    id: "routes/home",
    matches,
  }) as any;

  return routeMatch?.workspace ?? undefined;
}

export function useWorkspace(matches?: UIMatch[]): Workspace {
  const maybeWorkspace = useOptionalWorkspace(matches);
  if (!maybeWorkspace) {
    throw new Error(
      "No workspace found in root loader, but Workspace is required by useWorkspace. If Workspace is optional, try useOptionalWorkspace instead.",
    );
  }
  return maybeWorkspace;
}
