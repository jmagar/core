import { queue, task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";
import { logger } from "~/services/logger.service";
import {
  deliverWebhook,
  type WebhookEventType,
  type WebhookTarget,
} from "./webhook-delivery-utils";

const prisma = new PrismaClient();

const integrationWebhookQueue = queue({
  name: "integration-webhook-queue",
});

interface OAuthIntegrationWebhookPayload {
  integrationAccountId: string;
  eventType: WebhookEventType;
  userId: string;
}

export const integrationWebhookTask = task({
  id: "integration-webhook-delivery",
  queue: integrationWebhookQueue,
  run: async (payload: OAuthIntegrationWebhookPayload) => {
    try {
      logger.log(
        `Processing OAuth integration webhook delivery for integration account ${payload.integrationAccountId}`,
      );

      // Get the integration account details
      const integrationAccount = await prisma.integrationAccount.findUnique({
        where: { id: payload.integrationAccountId },
        include: {
          integrationDefinition: true,
        },
      });

      if (!integrationAccount) {
        logger.error(
          `Integration account ${payload.integrationAccountId} not found`,
        );
        return { success: false, error: "Integration account not found" };
      }

      // Get all OAuth clients that:
      // 1. Have integration scope granted for this user
      // 2. Have webhook URLs configured
      const oauthClients = await prisma.oAuthClientInstallation.findMany({
        where: {
          workspaceId: integrationAccount.workspaceId,
          installedById: payload.userId,
          isActive: true,
          // Check if client has integration scope in allowedScopes
          grantedScopes: {
            contains: "integration",
          },
        },
        select: {
          id: true,
          oauthClient: {
            select: {
              clientId: true,
              webhookUrl: true,
              webhookSecret: true,
            },
          },
        },
      });

      logger.log(`Found ${oauthClients.length} OAuth clients`);

      if (oauthClients.length === 0) {
        logger.log(
          `No OAuth clients with integration scope found for user ${payload.userId}`,
        );
        return { success: true, message: "No OAuth clients to notify" };
      }

      const integrationConfig =
        integrationAccount.integrationConfiguration as any;
      // Prepare webhook payload
      const webhookPayload = {
        event: payload.eventType,
        user_id: payload.userId,
        integration: {
          id: integrationAccount.id,
          provider: integrationAccount.integrationDefinition.slug,
          mcp_endpoint: integrationConfig.mcp
            ? `${process.env.API_BASE_URL}/api/v1/mcp/${integrationAccount.integrationDefinition.slug}`
            : undefined,
          name: integrationAccount.integrationDefinition.name,
          icon: integrationAccount.integrationDefinition.icon,
        },
        timestamp: new Date().toISOString(),
      };

      // Convert OAuth clients to targets
      const targets: WebhookTarget[] = oauthClients
        .filter((client) => client.oauthClient?.webhookUrl)
        .map((client) => ({
          url: `${client.oauthClient?.webhookUrl}`,
          secret: client.oauthClient?.webhookSecret,
          accountId: client.id,
        }));

      // Use common delivery function
      const result = await deliverWebhook({
        payload: webhookPayload,
        targets,
        eventType: payload.eventType,
      });

      const successfulDeliveries = result.summary.successful;
      const totalDeliveries = result.summary.total;

      logger.log(
        `OAuth integration webhook delivery completed: ${successfulDeliveries}/${totalDeliveries} successful`,
        {
          integrationId: integrationAccount.id,
          integrationProvider: integrationAccount.integrationDefinition.slug,
          userId: payload.userId,
        },
      );

      return {
        success: result.success,
        deliveryResults: result.deliveryResults,
        summary: {
          total: totalDeliveries,
          successful: successfulDeliveries,
          failed: totalDeliveries - successfulDeliveries,
        },
      };
    } catch (error) {
      logger.error(
        `Failed to process OAuth integration webhook delivery for integration account ${payload.integrationAccountId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Helper function to trigger OAuth integration webhook delivery
export async function triggerIntegrationWebhook(
  integrationAccountId: string,
  userId: string,
  eventType: WebhookEventType,
) {
  try {
    await integrationWebhookTask.trigger({
      integrationAccountId,
      userId,
      eventType,
    });
    logger.log(
      `Triggered OAuth integration webhook delivery for integration account ${integrationAccountId}`,
    );
  } catch (error: any) {
    logger.error(
      `Failed to trigger OAuth integration webhook delivery for integration account ${integrationAccountId}:`,
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
}
