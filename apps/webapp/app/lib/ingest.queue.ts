// lib/ingest.queue.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "~/env.server";
import { KnowledgeGraphService } from "../services/knowledgeGraph.server";

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
    console.log(job);
    console.log(`Processing job for user ${userId}`);
    const knowledgeGraphService = new KnowledgeGraphService();

    knowledgeGraphService.addEpisode({ ...job.data.body, userId });

    // your processing logic
  } catch (err) {
    console.error(`Error processing job for user ${userId}:`, err);
  }
}

export function getUserQueue(userId: string) {
  if (!userQueues.has(userId)) {
    const queueName = `ingest-${userId}`;
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
