import { queue, task } from "@trigger.dev/sdk";
import { type z } from "zod";
import { KnowledgeGraphService } from "~/services/knowledgeGraph.server";
import { prisma } from "~/db.server";
import { IngestionStatus } from "@core/database";
import { logger } from "~/services/logger.service";
import { type IngestBodyRequest } from "~/lib/ingest.server";

const ingestionQueue = queue({
  name: "ingestion-queue",
});

// Register the Trigger.dev task
export const ingestTask = task({
  id: "ingest-episode",
  queue: ingestionQueue,
  run: async (payload: {
    body: z.infer<typeof IngestBodyRequest>;
    userId: string;
    workspaceId: string;
    queueId: string;
  }) => {
    try {
      logger.log(`Processing job for user ${payload.userId}`);

      await prisma.ingestionQueue.update({
        where: { id: payload.queueId },
        data: {
          status: IngestionStatus.PROCESSING,
        },
      });

      const knowledgeGraphService = new KnowledgeGraphService();

      const episodeBody = payload.body as any;

      const episodeDetails = await knowledgeGraphService.addEpisode({
        ...episodeBody,
        userId: payload.userId,
      });

      await prisma.ingestionQueue.update({
        where: { id: payload.queueId },
        data: {
          output: episodeDetails,
          status: IngestionStatus.COMPLETED,
        },
      });

      return { success: true, episodeDetails };
    } catch (err: any) {
      await prisma.ingestionQueue.update({
        where: { id: payload.queueId },
        data: {
          error: err.message,
          status: IngestionStatus.FAILED,
        },
      });

      logger.error(`Error processing job for user ${payload.userId}:`, err);
      return { success: false, error: err.message };
    }
  },
});
