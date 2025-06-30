import { json } from "@remix-run/node";
import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { addToQueue, type IngestBodyRequest } from "~/lib/ingest.server";
import { prisma } from "~/db.server";
import { logger } from "~/services/logger.service";
import { IngestionStatus } from "@core/database";

const ReingestionBodyRequest = z.object({
  userId: z.string().optional(),
  spaceId: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
});

type ReingestionRequest = z.infer<typeof ReingestionBodyRequest>;

async function getCompletedIngestionsByUser(userId?: string, spaceId?: string) {
  const whereClause: any = {
    status: IngestionStatus.COMPLETED,
    deleted: null
  };

  if (userId) {
    whereClause.workspace = {
      userId: userId,
    };
  }

  if (spaceId) {
    whereClause.spaceId = spaceId;
  }

  const ingestions = await prisma.ingestionQueue.findMany({
    where: whereClause,
    include: {
      workspace: {
        include: {
          user: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'asc' }, // Maintain temporal order
    ],
  });

  return ingestions;
}

async function getAllUsers() {
  const users = await prisma.user.findMany({
    include: {
      Workspace: true,
    },
  });
  return users.filter(user => user.Workspace); // Only users with workspaces
}

async function reingestionForUser(userId: string, spaceId?: string, dryRun = false) {
  const ingestions = await getCompletedIngestionsByUser(userId, spaceId);
  
  logger.info(`Found ${ingestions.length} completed ingestions for user ${userId}${spaceId ? ` in space ${spaceId}` : ''}`);

  if (dryRun) {
    return {
      userId,
      ingestionCount: ingestions.length,
      ingestions: ingestions.map(ing => ({
        id: ing.id,
        createdAt: ing.createdAt,
        spaceId: ing.spaceId,
        data: {
          episodeBody: (ing.data as any)?.episodeBody?.substring(0, 100) + 
                      ((ing.data as any)?.episodeBody?.length > 100 ? '...' : ''),
          source: (ing.data as any)?.source,
          referenceTime: (ing.data as any)?.referenceTime,
        },
      })),
    };
  }

  // Queue ingestions in temporal order (already sorted by createdAt ASC)
  const queuedJobs = [];
  for (const ingestion of ingestions) {
    try {
      // Parse the original data and add reingestion metadata
      const originalData = ingestion.data as z.infer<typeof IngestBodyRequest>;
      
      const reingestionData = {
        ...originalData,
        source: `reingest-${originalData.source}`,
        metadata: {
          ...originalData.metadata,
          isReingestion: true,
          originalIngestionId: ingestion.id,
        },
      };

      const queueResult = await addToQueue(reingestionData, userId);
      queuedJobs.push(queueResult);
    } catch (error) {
      logger.error(`Failed to queue ingestion ${ingestion.id} for user ${userId}:`, {error});
    }
  }

  return {
    userId,
    ingestionCount: ingestions.length,
    queuedJobsCount: queuedJobs.length,
    queuedJobs,
  };
}

const { action, loader } = createActionApiRoute(
  {
    body: ReingestionBodyRequest,
    allowJWT: true,
    authorization: {
      action: "reingest",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const { userId, spaceId, dryRun } = body;

    try {
      if (userId) {
        // Reingest for specific user
        const result = await reingestionForUser(userId, spaceId, dryRun);
        return json({
          success: true,
          type: "single_user",
          result,
        });
      } else {
        // Reingest for all users
        const users = await getAllUsers();
        const results = [];

        logger.info(`Starting reingestion for ${users.length} users`);

        for (const user of users) {
          try {
            const result = await reingestionForUser(user.id, spaceId, dryRun);
            results.push(result);
            
            if (!dryRun) {
              // Add small delay between users to prevent overwhelming the system
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            logger.error(`Failed to reingest for user ${user.id}:`, {error});
            results.push({
              userId: user.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return json({
          success: true,
          type: "all_users",
          totalUsers: users.length,
          results,
          summary: {
            totalIngestions: results.reduce((sum, r) => sum, 0),
            totalQueuedJobs: results.reduce((sum, r) => sum, 0),
          },
        });
      }
    } catch (error) {
      logger.error("Reingestion failed:", {error});
      return json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }
);

export { action, loader };