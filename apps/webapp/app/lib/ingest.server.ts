// lib/ingest.queue.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "~/env.server";
import { KnowledgeGraphService } from "../services/knowledgeGraph.server";
import { z } from "zod";
import { EpisodeType } from "@core/types";
import { prisma } from "~/db.server";
import { IngestionStatus } from "@core/database";
import { logger } from "~/services/logger.service";

const connection = new IORedis({
  port: env.REDIS_PORT,
  host: env.REDIS_HOST,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const userQueues = new Map<string, Queue>();
const userWorkers = new Map<string, Worker>();

async function processUserJob(userId: string, job: any) {
  try {
    logger.log(`Processing job for user ${userId}`);

    await prisma.ingestionQueue.update({
      where: { id: job.data.queueId },
      data: {
        status: IngestionStatus.PROCESSING,
      },
    });

    const knowledgeGraphService = new KnowledgeGraphService();

    const episodeDetails = await knowledgeGraphService.addEpisode({
      ...job.data.body,
      userId,
    });

    await prisma.ingestionQueue.update({
      where: { id: job.data.queueId },
      data: {
        output: episodeDetails,
        status: IngestionStatus.COMPLETED,
      },
    });

    // your processing logic
  } catch (err: any) {
    await prisma.ingestionQueue.update({
      where: { id: job.data.queueId },
      data: {
        error: err.message,
        status: IngestionStatus.FAILED,
      },
    });

    console.error(`Error processing job for user ${userId}:`, err);
  }
}

export function getUserQueue(userId: string) {
  if (!userQueues.has(userId)) {
    const queueName = `ingest-user-${userId}`;
    const queue = new Queue(queueName, { connection });
    userQueues.set(userId, queue);

    const worker = new Worker(queueName, (job) => processUserJob(userId, job), {
      connection,
      concurrency: 1,
    });
    userWorkers.set(userId, worker);
  }

  return userQueues.get(userId)!;
}

export const IngestBodyRequest = z.object({
  name: z.string(),
  episodeBody: z.string(),
  referenceTime: z.string(),
  metadata: z.record(z.union([z.string(), z.number()])),
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

  const ingestionQueue = getUserQueue(userId);

  const jobDetails = await ingestionQueue.add(
    `ingest-user-${userId}`, // 👈 unique name per user
    {
      queueId: queuePersist.id,
      spaceId: body.spaceId,
      userId: userId,
      body,
    },
    {
      jobId: `${userId}-${Date.now()}`, // unique per job but grouped under user
    },
  );

  return {
    id: jobDetails.id,
  };
};
