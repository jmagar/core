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

export const createIntegrationAccount = async ({
  integrationDefinitionId,
  userId,
  accountId,
  config,
  settings,
}: {
  integrationDefinitionId: string;
  userId: string;
  accountId: string;
  config?: Record<string, any>;
  settings?: Record<string, any>;
}) => {
  return prisma.integrationAccount.create({
    data: {
      accountId,
      integrationDefinitionId,
      integratedById: userId,
      config: config || {},
      settings: settings || {},
      isActive: true,
    },
  });
};

export const getIntegrationAccounts = async (userId: string) => {
  return prisma.integrationAccount.findMany({
    where: {
      integratedById: userId,
      isActive: true,
    },
    include: {
      integrationDefinition: true,
    },
  });
};
