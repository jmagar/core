import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/db.server";
import { requireUserId } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { Workspace: true },
  });

  if (!user?.Workspace) {
    throw new Response("Workspace not found", { status: 404 });
  }

  const activeIngestionQueue = await prisma.ingestionQueue.findMany({
    where: {
      workspaceId: user.Workspace.id,
      status: {
        in: ["PENDING", "PROCESSING"],
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      error: true,
      data: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return json({
    queue: activeIngestionQueue,
    count: activeIngestionQueue.length,
  });
}
