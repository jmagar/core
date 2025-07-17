import { tasks } from "@trigger.dev/sdk/v3";

import { logger } from "./logger.service";
import { type integrationRun } from "~/trigger/integrations/integration-run";

import type {
  IntegrationAccount,
  IntegrationDefinitionV2,
} from "@core/database";

/**
 * Triggers an integration run asynchronously.
 */
export async function runIntegrationTriggerAsync(
  integrationDefinition: IntegrationDefinitionV2,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
  userId?: string,
  workspaceId?: string,
) {
  logger.info(
    `Triggering async integration run for ${integrationDefinition.slug}`,
    {
      integrationId: integrationDefinition.id,
      event: event.event,
      userId,
      workspaceId,
    },
  );

  return await tasks.trigger<typeof integrationRun>("integration-run", {
    integrationDefinition,
    event: event.event,
    eventBody: event.eventBody,
    integrationAccount: event.integrationAccount,
    workspaceId,
  });
}

/**
 * Triggers an integration run and waits for completion.
 */
export async function runIntegrationTrigger(
  integrationDefinition: IntegrationDefinitionV2,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
  userId?: string,
  workspaceId?: string,
  integrationAccount?: IntegrationAccount,
) {
  logger.info(
    `Triggering sync integration run for ${integrationDefinition.slug}`,
    {
      integrationId: integrationDefinition.id,
      event: event.event,
      userId,
      workspaceId,
    },
  );

  const response = await tasks.triggerAndPoll<typeof integrationRun>(
    "integration-run",
    {
      integrationDefinition,
      integrationAccount,
      workspaceId,
      userId,
      event: event.event,
      eventBody: event.eventBody,
    },
  );

  if (response.status === "COMPLETED") {
    return response.output;
  }

  throw new Error(`Integration trigger failed with status: ${response.status}`);
}
