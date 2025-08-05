import { json } from "@remix-run/node";
import { z } from "zod";
import { logger } from "~/services/logger.service";
import {
  createLoaderApiRoute,
} from "~/services/routeBuilders/apiBuilder.server";
import { ClusteringService } from "~/services/clustering.server";

const clusteringService = new ClusteringService();

const loader = createLoaderApiRoute(
  {
    allowJWT: true,
    findResource: async () => 1, // Dummy resource
    authorization: {
      action: "search",
    },
    corsStrategy: "all",
    params: z.object({
      clusterId: z.string(),
    }),
  },
  async ({ authentication, params }) => {
    try {
      const statements = await clusteringService.getClusterStatements(
        params.clusterId,
        authentication.userId,
      );

      return json({
        success: true,
        data: {
          clusterId: params.clusterId,
          statements: statements,
        },
      });
    } catch (error) {
      logger.error("Error getting cluster statements:", { error });
      return json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  },
);

export { loader };