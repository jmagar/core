import { queue, task } from "@trigger.dev/sdk";
import { PrismaClient } from "@prisma/client";

import { logger } from "~/services/logger.service";
import { WebhookDeliveryStatus } from "@core/database";
import crypto from "crypto";

const prisma = new PrismaClient();

const webhookQueue = queue({
  name: "webhook-delivery-queue",
});

interface WebhookDeliveryPayload {
  activityId: string;
  workspaceId: string;
}

export const webhookDeliveryTask = task({
  id: "webhook-delivery",
  queue: webhookQueue,
  run: async (payload: WebhookDeliveryPayload) => {
    try {
      logger.log(
        `Processing webhook delivery for activity ${payload.activityId}`,
      );

      // Get the activity data
      const activity = await prisma.activity.findUnique({
        where: { id: payload.activityId },
        include: {
          integrationAccount: {
            include: {
              integrationDefinition: true,
            },
          },
          workspace: true,
        },
      });

      if (!activity) {
        logger.error(`Activity ${payload.activityId} not found`);
        return { success: false, error: "Activity not found" };
      }

      // Get active webhooks for this workspace
      const webhooks = await prisma.webhookConfiguration.findMany({
        where: {
          workspaceId: payload.workspaceId,
          isActive: true,
        },
      });

      if (webhooks.length === 0) {
        logger.log(
          `No active webhooks found for workspace ${payload.workspaceId}`,
        );
        return { success: true, message: "No webhooks to deliver to" };
      }

      // Prepare webhook payload
      const webhookPayload = {
        event: "activity.created",
        timestamp: new Date().toISOString(),
        data: {
          id: activity.id,
          text: activity.text,
          sourceURL: activity.sourceURL,
          createdAt: activity.createdAt,
          updatedAt: activity.updatedAt,
          integrationAccount: activity.integrationAccount
            ? {
                id: activity.integrationAccount.id,
                integrationDefinition: {
                  name: activity.integrationAccount.integrationDefinition.name,
                  slug: activity.integrationAccount.integrationDefinition.slug,
                },
              }
            : null,
          workspace: {
            id: activity.workspace.id,
            name: activity.workspace.name,
          },
        },
      };

      const payloadString = JSON.stringify(webhookPayload);
      const deliveryResults = [];

      // Deliver to each webhook
      for (const webhook of webhooks) {
        const deliveryId = crypto.randomUUID();

        try {
          // Create delivery log entry
          const deliveryLog = await prisma.webhookDeliveryLog.create({
            data: {
              webhookConfigurationId: webhook.id,
              activityId: activity.id,
              status: WebhookDeliveryStatus.FAILED, // Will update if successful
            },
          });

          // Prepare headers
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "Echo-Webhooks/1.0",
            "X-Webhook-Delivery": deliveryId,
            "X-Webhook-Event": "activity.created",
          };

          // Add HMAC signature if secret is configured
          if (webhook.secret) {
            const signature = crypto
              .createHmac("sha256", webhook.secret)
              .update(payloadString)
              .digest("hex");
            headers["X-Hub-Signature-256"] = `sha256=${signature}`;
          }

          // Make the HTTP request
          const response = await fetch(webhook.url, {
            method: "POST",
            headers,
            body: payloadString,
            signal: AbortSignal.timeout(30000), // 30 second timeout
          });

          const responseBody = await response.text().catch(() => "");

          // Update delivery log with results
          await prisma.webhookDeliveryLog.update({
            where: { id: deliveryLog.id },
            data: {
              status: response.ok
                ? WebhookDeliveryStatus.SUCCESS
                : WebhookDeliveryStatus.FAILED,
              responseStatusCode: response.status,
              responseBody: responseBody.slice(0, 1000), // Limit response body length
              error: response.ok
                ? null
                : `HTTP ${response.status}: ${response.statusText}`,
            },
          });

          deliveryResults.push({
            webhookId: webhook.id,
            success: response.ok,
            statusCode: response.status,
            error: response.ok
              ? null
              : `HTTP ${response.status}: ${response.statusText}`,
          });

          logger.log(`Webhook delivery to ${webhook.url}: ${response.status}`);
        } catch (error: any) {
          // Update delivery log with error
          const deliveryLog = await prisma.webhookDeliveryLog.findFirst({
            where: {
              webhookConfigurationId: webhook.id,
              activityId: activity.id,
            },
            orderBy: { createdAt: "desc" },
          });

          if (deliveryLog) {
            await prisma.webhookDeliveryLog.update({
              where: { id: deliveryLog.id },
              data: {
                status: WebhookDeliveryStatus.FAILED,
                error: error.message,
              },
            });
          }

          deliveryResults.push({
            webhookId: webhook.id,
            success: false,
            error: error.message,
          });

          logger.error(`Error delivering webhook to ${webhook.url}:`, error);
        }
      }

      const successCount = deliveryResults.filter((r) => r.success).length;
      const totalCount = deliveryResults.length;

      logger.log(
        `Webhook delivery completed: ${successCount}/${totalCount} successful`,
      );

      return {
        success: true,
        delivered: successCount,
        total: totalCount,
        results: deliveryResults,
      };
    } catch (error: any) {
      logger.error(
        `Error in webhook delivery task for activity ${payload.activityId}:`,
        error,
      );
      return { success: false, error: error.message };
    }
  },
});

// Helper function to trigger webhook delivery
export async function triggerWebhookDelivery(
  activityId: string,
  workspaceId: string,
) {
  try {
    await webhookDeliveryTask.trigger({
      activityId,
      workspaceId,
    });
    logger.log(`Triggered webhook delivery for activity ${activityId}`);
  } catch (error: any) {
    logger.error(
      `Failed to trigger webhook delivery for activity ${activityId}:`,
      error,
    );
  }
}
