import { useLoaderData } from "@remix-run/react";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/server-runtime";
import { LoaderCircle } from "lucide-react";
import { ClientOnly } from "remix-utils/client-only";
import { SpacePatternList } from "~/components/spaces/space-pattern-list";
import { requireUserId, requireWorkpace } from "~/services/session.server";
import { SpacePattern } from "~/services/spacePattern.server";
import { addToQueue } from "~/lib/ingest.server";
import { redirect } from "@remix-run/node";
import { SpaceService } from "~/services/space.server";
import { EpisodeTypeEnum } from "@core/types";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const workspace = await requireWorkpace(request);
  const spaceService = new SpacePattern();

  const spaceId = params.spaceId as string;
  const spacePatterns = await spaceService.getSpacePatternsForSpace(
    spaceId,
    workspace.id,
  );

  return {
    spacePatterns: spacePatterns || [],
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const workspace = await requireWorkpace(request);
  const userId = await requireUserId(request);
  const spaceService = new SpaceService();
  const spacePatternService = new SpacePattern();
  const spaceId = params.spaceId as string;

  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;
  const patternId = formData.get("patternId") as string;

  if (actionType === "delete" || actionType === "add") {
    // Get the space pattern to access its data
    const spacePattern = await spacePatternService.getSpacePatternById(
      patternId,
      workspace.id,
    );
    if (!spacePattern) {
      throw new Error("Space pattern not found");
    }

    // Get the space to access its name
    const space = await spaceService.getSpace(spaceId, workspace.id);
    if (!space) {
      throw new Error("Space not found");
    }

    // Always delete the space pattern
    await spacePatternService.deleteSpacePattern(patternId, workspace.id);

    // If it's an "add" action, also trigger ingestion
    if (actionType === "add") {
      await addToQueue(
        {
          episodeBody: spacePattern.summary,
          referenceTime: new Date().toISOString(),
          metadata: {
            pattern: spacePattern.name,
          },
          source: space.name,
          spaceId: space.id,
          type: EpisodeTypeEnum.CONVERSATION,
        },
        userId,
      );
    }
  }

  return redirect(`/home/space/${spaceId}/patterns`);
}

export default function Patterns() {
  const { spacePatterns } = useLoaderData<typeof loader>();

  const loadMore = () => {
    // TODO: Implement pagination
  };

  return (
    <div className="flex h-full w-full flex-col pt-2">
      <div className="flex h-[calc(100vh_-_140px)] w-full">
        <ClientOnly
          fallback={<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
        >
          {() => (
            <SpacePatternList
              patterns={spacePatterns}
              hasMore={false} // TODO: Implement real pagination
              loadMore={loadMore}
              isLoading={false}
            />
          )}
        </ClientOnly>
      </div>
    </div>
  );
}
