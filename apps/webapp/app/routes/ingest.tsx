import { EpisodeType } from "@recall/types";
import { json, LoaderFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { getUserQueue } from "~/lib/ingest.queue";
import { prisma } from "~/db.server";
import { IngestionStatus } from "@recall/database";

export const IngestBodyRequest = z.object({
  name: z.string(),
  episodeBody: z.string(),
  referenceTime: z.string(),
  type: z.enum([EpisodeType.Conversation, EpisodeType.Text]), // Assuming these are the EpisodeType values
  source: z.string(),
  spaceId: z.string().optional(),
  sessionId: z.string().optional(),
});

const { action, loader } = createActionApiRoute(
  {
    body: IngestBodyRequest,
    allowJWT: true,
    authorization: {
      action: "ingest",
    },
    corsStrategy: "all",
  },
  async ({ body, headers, params, authentication }) => {
    const queuePersist = await prisma.ingestionQueue.create({
      data: {
        spaceId: body.spaceId,
        data: body,
        status: IngestionStatus.PENDING,
        priority: 1,
      },
    });

    const ingestionQueue = getUserQueue(authentication.userId);

    await ingestionQueue.add(
      `ingest-user-${authentication.userId}`, // 👈 unique name per user
      {
        queueId: queuePersist.id,
        spaceId: body.spaceId,
        userId: authentication.userId,
        body,
      },
      {
        jobId: `${authentication.userId}-${Date.now()}`, // unique per job but grouped under user
      },
    );

    return json({});
  },
);

export { action, loader };
