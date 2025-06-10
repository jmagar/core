import { useLocalCommonState } from "~/hooks/use-local-state";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import { parse } from "@conform-to/zod";
import { json } from "@remix-run/node";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Ingest } from "~/components/dashboard/ingest";
import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/server-runtime";
import { requireUserId } from "~/services/session.server";
import { useActionData } from "@remix-run/react";
import { addToQueue, IngestBodyRequest } from "~/lib/ingest.server";
import { getNodeLinks } from "~/lib/neo4j.server";
import { useTypedLoaderData } from "remix-typedjson";

import { GraphVisualization } from "~/components/graph/graph-visualization";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const submission = parse(formData, { schema: IngestBodyRequest });

  if (!submission.value || submission.intent !== "submit") {
    return json(submission);
  }

  return await addToQueue(submission.value, userId);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const nodeLinks = await getNodeLinks(userId);

  return nodeLinks;
}

export default function Dashboard() {
  const nodeLinks = useTypedLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();

  const [size, setSize] = useState(15);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel
        collapsible={false}
        className="h-[calc(100vh_-_20px)] overflow-hidden rounded-md"
        order={1}
        id="home"
      >
        <div className="home flex h-full flex-col overflow-y-auto p-3">
          <h2 className="text-xl"> Graph </h2>
          <p className="text-muted-foreground"> Your memory graph </p>

          <div className="bg-background-3 mt-2 grow rounded">
            {typeof window !== "undefined" && (
              <GraphVisualization triplets={nodeLinks} />
            )}
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle className="bg-border w-[0.5px]" />

      <ResizablePanel
        className="rounded-md"
        collapsible={false}
        maxSize={50}
        minSize={25}
        defaultSize={size}
        onResize={(size) => setSize(size)}
        order={2}
        id="rightScreen"
      >
        <Tabs defaultValue="ingest" className="p-3 text-base">
          <TabsList>
            <TabsTrigger value="ingest">Add</TabsTrigger>
            <TabsTrigger value="retrieve">Retrieve</TabsTrigger>
          </TabsList>
          <TabsContent value="ingest">
            <Ingest actionData={actionData} />
          </TabsContent>
        </Tabs>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
