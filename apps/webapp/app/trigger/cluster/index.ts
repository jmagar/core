import { queue, task } from "@trigger.dev/sdk";
import { z } from "zod";
import { ClusteringService } from "~/services/clustering.server";
import { logger } from "~/services/logger.service";

const clusteringService = new ClusteringService();

// Define the payload schema for cluster tasks
export const ClusterPayload = z.object({
  userId: z.string(),
  mode: z.enum(["auto", "incremental", "complete", "drift"]).default("auto"),
  forceComplete: z.boolean().default(false),
});

const clusterQueue = queue({
  name: "cluster-queue",
  concurrencyLimit: 10,
});

/**
 * Single clustering task that handles all clustering operations based on payload mode
 */
export const clusterTask = task({
  id: "cluster",
  queue: clusterQueue,
  maxDuration: 1800, // 30 minutes max
  run: async (payload: z.infer<typeof ClusterPayload>) => {
    logger.info(`Starting ${payload.mode} clustering task for user ${payload.userId}`);

    try {
      let result;
      
      switch (payload.mode) {
        case "incremental":
          result = await clusteringService.performIncrementalClustering(
            payload.userId,
          );
          logger.info(`Incremental clustering completed for user ${payload.userId}:`, {
            newStatementsProcessed: result.newStatementsProcessed,
            newClustersCreated: result.newClustersCreated,
          });
          break;

        case "complete":
          result = await clusteringService.performCompleteClustering(
            payload.userId,
          );
          logger.info(`Complete clustering completed for user ${payload.userId}:`, {
            clustersCreated: result.clustersCreated,
            statementsProcessed: result.statementsProcessed,
          });
          break;

        case "drift":
          // First detect drift
          const driftMetrics = await clusteringService.detectClusterDrift(
            payload.userId,
          );

          if (driftMetrics.driftDetected) {
            // Handle drift by splitting low-cohesion clusters
            const driftResult = await clusteringService.handleClusterDrift(
              payload.userId,
            );

            logger.info(`Cluster drift handling completed for user ${payload.userId}:`, {
              driftDetected: true,
              clustersProcessed: driftResult.clustersProcessed,
              newClustersCreated: driftResult.newClustersCreated,
              splitClusters: driftResult.splitClusters,
            });

            result = {
              driftDetected: true,
              ...driftResult,
              driftMetrics,
            };
          } else {
            logger.info(`No cluster drift detected for user ${payload.userId}`);
            result = {
              driftDetected: false,
              clustersProcessed: 0,
              newClustersCreated: 0,
              splitClusters: [],
              driftMetrics,
            };
          }
          break;

        case "auto":
        default:
          result = await clusteringService.performClustering(
            payload.userId,
            payload.forceComplete,
          );
          logger.info(`Auto clustering completed for user ${payload.userId}:`, {
            clustersCreated: result.clustersCreated,
            statementsProcessed: result.statementsProcessed,
            approach: result.approach,
          });
          break;
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error(`${payload.mode} clustering failed for user ${payload.userId}:`, {
        error,
      });
      throw error;
    }
  },
});
