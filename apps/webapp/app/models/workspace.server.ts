import { type Workspace } from "@core/database";
import { prisma } from "~/db.server";

interface CreateWorkspaceDto {
  name: string;
  integrations: string[];
  userId: string;
}

export async function createWorkspace(
  input: CreateWorkspaceDto,
): Promise<Workspace> {
  const workspace = await prisma.workspace.create({
    data: {
      slug: input.name,
      name: input.name,
      userId: input.userId,
    },
  });

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      confirmedBasicDetails: true,
    },
  });

  return workspace;
}

export async function getWorkspaceByUser(userId: string) {
  return await prisma.workspace.findFirst({
    where: {
      userId,
    },
  });
}
