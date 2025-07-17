import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db.server";
import { requireUserId } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const url = new URL(request.url);

  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const source = url.searchParams.get("source");
  const status = url.searchParams.get("status");
  const skip = (page - 1) * limit;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { Workspace: true },
  });

  if (!user?.Workspace) {
    throw new Response("Workspace not found", { status: 404 });
  }

  // Build where clause for filtering - only items with activityId
  const whereClause: any = {
    workspaceId: user.Workspace.id,
    activityId: {
      not: null,
    },
  };

  if (status) {
    whereClause.status = status;
  }

  // If source filter is provided, we need to filter by integration source
  if (source) {
    whereClause.activity = {
      integrationAccount: {
        integrationDefinition: {
          slug: source,
        },
      },
    };
  }

  const [logs, totalCount] = await Promise.all([
    prisma.ingestionQueue.findMany({
      where: whereClause,
      include: {
        activity: {
          include: {
            integrationAccount: {
              include: {
                integrationDefinition: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.ingestionQueue.count({
      where: whereClause,
    }),
  ]);

  // Get available sources for filtering (only those with activities)
  const availableSources = await prisma.integrationDefinitionV2.findMany({
    where: {
      IntegrationAccount: {
        some: {
          workspaceId: user.Workspace.id,
          Activity: {
            some: {
              IngestionQueue: {
                some: {
                  activityId: {
                    not: null,
                  },
                },
              },
            },
          },
        },
      },
    },
    select: {
      name: true,
      slug: true,
    },
  });

  // Format the response
  const formattedLogs = logs.map((log) => ({
    id: log.id,
    source:
      log.activity?.integrationAccount?.integrationDefinition?.name ||
      (log.data as any)?.source ||
      "Unknown",
    ingestText:
      log.activity?.text ||
      (log.data as any)?.episodeBody ||
      (log.data as any)?.text ||
      "No content",
    time: log.createdAt,
    processedAt: log.processedAt,
    status: log.status,
    error: log.error,
    episodeUUID: (log.output as any)?.episodeUuid,
    sourceURL: log.activity?.sourceURL,
    integrationSlug:
      log.activity?.integrationAccount?.integrationDefinition?.slug,
    activityId: log.activityId,
    data: log.data,
  }));

  return json({
    logs: formattedLogs,
    totalCount,
    page,
    limit,
    hasMore: skip + logs.length < totalCount,
    availableSources,
  });
}
