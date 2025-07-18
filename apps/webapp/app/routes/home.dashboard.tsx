import { useState, useEffect } from "react";
import { type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { requireUserId } from "~/services/session.server";
import { useTypedLoaderData } from "remix-typedjson";

import { GraphVisualizationClient } from "~/components/graph/graph-client";
import { LoaderCircle } from "lucide-react";
import { PageHeader } from "~/components/common/page-header";

export async function loader({ request }: LoaderFunctionArgs) {
  // Only return userId, not the heavy nodeLinks
  const userId = await requireUserId(request);
  return { userId };
}

export default function Dashboard() {
  const { userId } = useTypedLoaderData<typeof loader>();

  // State for nodeLinks and loading
  const [nodeLinks, setNodeLinks] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchNodeLinks() {
      setLoading(true);
      try {
        const res = await fetch(
          "/node-links?userId=" + encodeURIComponent(userId),
        );
        if (!res.ok) throw new Error("Failed to fetch node links");
        const data = await res.json();
        if (!cancelled) {
          setNodeLinks(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setNodeLinks([]);
          setLoading(false);
        }
      }
    }
    fetchNodeLinks();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <>
      <PageHeader title="Memory graph" />
      <div className="home flex h-[calc(100vh_-_56px)] flex-col overflow-y-auto p-3 text-base">
        <div className="flex grow items-center justify-center rounded">
          {loading ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <LoaderCircle size={18} className="mr-1 animate-spin" />
              <span className="text-muted-foreground">Loading graph...</span>
            </div>
          ) : (
            typeof window !== "undefined" &&
            nodeLinks && <GraphVisualizationClient triplets={nodeLinks} />
          )}
        </div>
      </div>
    </>
  );
}
