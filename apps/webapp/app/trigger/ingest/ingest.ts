import { queue, task } from "@trigger.dev/sdk";
import { z } from "zod";
import { KnowledgeGraphService } from "~/services/knowledgeGraph.server";
import { linkEpisodeToDocument } from "~/services/graphModels/document";

import { IngestionStatus } from "@core/database";
import { logger } from "~/services/logger.service";
import { triggerSpaceAssignment } from "../spaces/space-assignment";
import { prisma } from "../utils/prisma";
import { EpisodeType } from "@core/types";

export const IngestBodyRequest = z.object({
  episodeBody: z.string(),
  referenceTime: z.string(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  source: z.string(),
  spaceId: z.string().optional(),
  sessionId: z.string().optional(),
  type: z
    .enum([EpisodeType.CONVERSATION, EpisodeType.DOCUMENT])
    .default(EpisodeType.CONVERSATION),
});

const ingestionQueue = queue({
  name: "ingestion-queue",
  concurrencyLimit: 1,
});

// Register the Trigger.dev task
export const ingestTask = task({
  id: "ingest-episode",
  queue: ingestionQueue,
  machine: "medium-2x",
  run: async (payload: {
    body: z.infer<typeof IngestBodyRequest>;
    userId: string;
    workspaceId: string;
    queueId: string;
  }) => {
    try {
      logger.log(`Processing job for user ${payload.userId}`);

      const ingestionQueue = await prisma.ingestionQueue.update({
        where: { id: payload.queueId },
        data: {
          status: IngestionStatus.PROCESSING,
        },
      });

      const knowledgeGraphService = new KnowledgeGraphService();

      const episodeBody = payload.body as any;

      const episodeDetails = await knowledgeGraphService.addEpisode(
        {
          ...episodeBody,
          userId: payload.userId,
        },
        prisma,
      );

      // Link episode to document if it's a document chunk
      if (
        episodeBody.type === EpisodeType.DOCUMENT &&
        episodeBody.metadata.documentUuid &&
        episodeDetails.episodeUuid
      ) {
        try {
          await linkEpisodeToDocument(
            episodeDetails.episodeUuid,
            episodeBody.metadata.documentUuid,
            episodeBody.metadata.chunkIndex || 0,
          );
          logger.log(
            `Linked episode ${episodeDetails.episodeUuid} to document ${episodeBody.metadata.documentUuid} at chunk ${episodeBody.metadata.chunkIndex || 0}`,
          );
        } catch (error) {
          logger.error(`Failed to link episode to document:`, {
            error,
            episodeUuid: episodeDetails.episodeUuid,
            documentUuid: episodeBody.metadata.documentUuid,
          });
        }
      }

      let finalOutput = episodeDetails;
      let episodeUuids: string[] = episodeDetails.episodeUuid
        ? [episodeDetails.episodeUuid]
        : [];
      let currentStatus: IngestionStatus = IngestionStatus.COMPLETED;
      if (episodeBody.type === EpisodeType.DOCUMENT) {
        const currentOutput = ingestionQueue.output as any;
        currentOutput.episodes.push(episodeDetails);
        episodeUuids = currentOutput.episodes.map(
          (episode: any) => episode.episodeUuid,
        );

        finalOutput = {
          ...currentOutput,
        };

        if (currentOutput.episodes.length !== currentOutput.totalChunks) {
          currentStatus = IngestionStatus.PROCESSING;
        }
      }

      await prisma.ingestionQueue.update({
        where: { id: payload.queueId },
        data: {
          output: finalOutput,
          status: currentStatus,
        },
      });

      // Trigger space assignment after successful ingestion
      try {
        logger.info(`Triggering space assignment after successful ingestion`, {
          userId: payload.userId,
          workspaceId: payload.workspaceId,
          episodeId: episodeDetails?.episodeUuid,
        });
        if (
          episodeDetails.episodeUuid &&
          currentStatus === IngestionStatus.COMPLETED
        ) {
          await triggerSpaceAssignment({
            userId: payload.userId,
            workspaceId: payload.workspaceId,
            mode: "episode",
            episodeIds: episodeUuids,
          });
        }
      } catch (assignmentError) {
        // Don't fail the ingestion if assignment fails
        logger.warn(`Failed to trigger space assignment after ingestion:`, {
          error: assignmentError,
          userId: payload.userId,
          episodeId: episodeDetails?.episodeUuid,
        });
      }

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
