import { prisma } from "~/db.server";

export async function getIngestionRuleBySource(
  source: string,
  workspaceId: string,
) {
  return await prisma.ingestionRule.findFirst({
    where: {
      source,
      workspaceId,
    },
  });
}

// Need to fix this later
export async function upsertIngestionRule({
  text,
  source,
  workspaceId,
  userId,
}: {
  text: string;
  source: string;
  workspaceId: string;
  userId: string;
}) {
  // Find existing rule first
  const existingRule = await prisma.ingestionRule.findFirst({
    where: {
      source,
      workspaceId,
    },
  });

  if (existingRule) {
    // Update existing rule
    return await prisma.ingestionRule.update({
      where: {
        id: existingRule.id,
      },
      data: {
        text,
      },
    });
  } else {
    // Create new rule
    return await prisma.ingestionRule.create({
      data: {
        text,
        source,
        workspaceId,
        userId,
      },
    });
  }
}
