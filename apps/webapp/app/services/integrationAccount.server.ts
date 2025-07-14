import { prisma } from "~/db.server";

export const getIntegrationAccount = async (
  integrationDefinitionId: string,
  userId: string,
) => {
  return await prisma.integrationAccount.findFirst({
    where: {
      integrationDefinitionId: integrationDefinitionId,
      integratedById: userId,
      isActive: true,
    },
  });
};
