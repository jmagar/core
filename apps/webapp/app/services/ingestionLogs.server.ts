import { prisma } from "~/db.server";

export async function getIngestionLogs(
  userId: string,
  page: number = 1,
  limit: number = 10,
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      Workspace: true,
    },
  });

  const skip = (page - 1) * limit;

  const [ingestionLogs, total] = await Promise.all([
    prisma.ingestionQueue.findMany({
      where: {
        workspaceId: user?.Workspace?.id,
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.ingestionQueue.count({
      where: {
        workspaceId: user?.Workspace?.id,
      },
    }),
  ]);

  return {
    ingestionLogs,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      limit,
    },
  };
}
