// lib/ingest.queue.ts
import { IngestionStatus } from "@core/database";
import { z } from "zod";
import { prisma } from "~/db.server";
import { ingestTask } from "~/trigger/ingest/ingest";

export const IngestBodyRequest = z.object({
  episodeBody: z.string(),
  referenceTime: z.string(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  source: z.string(),
  spaceId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const addToQueue = async (
  body: z.infer<typeof IngestBodyRequest>,
  userId: string,
) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    include: {
      Workspace: true,
    },
  });

  if (!user?.Workspace?.id) {
    throw new Error(
      "Workspace ID is required to create an ingestion queue entry.",
    );
  }

  const queuePersist = await prisma.ingestionQueue.create({
    data: {
      spaceId: body.spaceId ? body.spaceId : null,
      data: body,
      status: IngestionStatus.PENDING,
      priority: 1,
      workspaceId: user.Workspace.id,
    },
  });

  const handler = await ingestTask.trigger(
    { body, userId, workspaceId: user.Workspace.id, queueId: queuePersist.id },
    {
      queue: "ingestion-queue",
      concurrencyKey: userId,
      tags: [user.id, queuePersist.id],
    },
  );

  return { id: handler.id, token: handler.publicAccessToken };
};
