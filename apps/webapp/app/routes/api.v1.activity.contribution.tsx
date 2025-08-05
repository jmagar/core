import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { requireUserId } from "~/services/session.server";
import { prisma } from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Get user's workspace
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { Workspace: { select: { id: true } } },
  });

  if (!user?.Workspace) {
    throw new Response("Workspace not found", { status: 404 });
  }

  // Get activity data for the last year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const activities = await prisma.ingestionQueue.findMany({
    where: {
      workspaceId: user.Workspace.id,
      createdAt: {
        gte: oneYearAgo,
      },
    },
    select: {
      createdAt: true,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Group activities by date
  const activityByDate = activities.reduce(
    (acc, activity) => {
      const date = activity.createdAt.toISOString().split("T")[0];
      if (!acc[date]) {
        acc[date] = { count: 0, status: activity.status };
      }
      acc[date].count += 1;
      return acc;
    },
    {} as Record<string, { count: number; status: string }>,
  );

  // Convert to array format for the component
  const contributionData = Object.entries(activityByDate).map(
    ([date, data]) => ({
      date,
      count: data.count,
      status: data.status,
    }),
  );

  return json({
    success: true,
    data: {
      contributionData,
      totalActivities: activities.length,
    },
  });
}
