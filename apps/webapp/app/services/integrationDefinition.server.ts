import { prisma } from "~/db.server";

/**
 * Get all integration definitions available to a workspace.
 * Returns both global (workspaceId: null) and workspace-specific definitions.
 */
export async function getIntegrationDefinitions(workspaceId: string) {
  return prisma.integrationDefinitionV2.findMany({
    where: {
      OR: [{ workspaceId: null }, { workspaceId }],
    },
  });
}

/**
 * Get a single integration definition by its ID.
 */
export async function getIntegrationDefinitionWithId(
  integrationDefinitionId: string,
) {
  return prisma.integrationDefinitionV2.findUnique({
    where: { id: integrationDefinitionId },
  });
}

/**
 * Get a single integration definition by its slug.
 */
export async function getIntegrationDefinitionWithSlug(
  slug: string,
) {
  return prisma.integrationDefinitionV2.findFirst({
    where: { slug },
  });
}
