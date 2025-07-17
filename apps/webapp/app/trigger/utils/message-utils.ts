import { PrismaClient } from "@prisma/client";
import { type Message } from "@core/types";

const prisma = new PrismaClient();

export const createIntegrationAccount = async ({
  integrationDefinitionId,
  userId,
  accountId,
  config,
  settings,
  workspaceId,
}: {
  integrationDefinitionId: string;
  userId: string;
  accountId: string;
  workspaceId: string;
  config?: Record<string, any>;
  settings?: Record<string, any>;
}) => {
  return prisma.integrationAccount.create({
    data: {
      accountId,
      integrationDefinitionId,
      integratedById: userId,
      integrationConfiguration: config || {},
      settings: settings || {},
      isActive: true,
      workspaceId,
    },
  });
};

export const saveMCPConfig = async ({
  integrationAccountId,
  config,
}: {
  integrationAccountId: string;
  config: any;
}) => {
  const integrationAccount = await prisma.integrationAccount.findUnique({
    where: {
      id: integrationAccountId,
    },
  });

  if (!integrationAccount) {
    return [];
  }

  const integrationConfig = integrationAccount.integrationConfiguration as any;

  return prisma.integrationAccount.update({
    where: {
      id: integrationAccountId,
    },
    data: {
      integrationConfiguration: {
        ...integrationConfig,
        mcp: config,
      },
    },
  });
};

export const saveIntegrationAccountState = async ({
  messages,
  integrationAccountId,
}: {
  messages: Message[];
  integrationAccountId: string;
}) => {
  const integrationAccount = await prisma.integrationAccount.findUnique({
    where: {
      id: integrationAccountId,
    },
  });

  const settings = integrationAccount?.settings as any;
  const state = settings.state;

  return Promise.all(
    messages.map(async (message) => {
      return await prisma.integrationAccount.update({
        where: {
          id: integrationAccountId,
        },
        data: {
          settings: {
            ...settings,
            state: {
              ...state,
              ...message.data,
            },
          },
        },
      });
    }),
  );
};

export const createActivities = async ({
  integrationAccountId,
  messages,
}: {
  integrationAccountId: string;
  messages: Message[];
  userId: string;
}) => {
  const integrationAccount = await prisma.integrationAccount.findUnique({
    where: {
      id: integrationAccountId,
    },
  });

  if (!integrationAccount) {
    return [];
  }

  return await prisma.activity.createMany({
    data: messages.map((message) => {
      return {
        text: message.data.text,
        sourceURL: message.data.sourceURL,
        integrationAccountId,
        workspaceId: integrationAccount?.workspaceId,
      };
    }),
  });
};
