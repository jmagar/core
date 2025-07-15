import { json } from "@remix-run/node";
import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { createIntegrationAccount } from "~/services/integrationAccount.server";
import { IntegrationEventType } from "@core/types";
import { runIntegrationTrigger } from "~/services/integration.server";
import { getIntegrationDefinitionWithId } from "~/services/integrationDefinition.server";
import { logger } from "~/services/logger.service";

// Schema for creating an integration account with API key
const IntegrationAccountBodySchema = z.object({
  integrationDefinitionId: z.string(),
  apiKey: z.string(),
});

// Route for creating an integration account directly with an API key
const { action, loader } = createActionApiRoute(
  {
    body: IntegrationAccountBodySchema,
    allowJWT: true,
    authorization: {
      action: "create",
      subject: "IntegrationAccount",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const { integrationDefinitionId, apiKey } = body;
    const { userId } = authentication;

    try {
      // Get the integration definition
      const integrationDefinition = await getIntegrationDefinitionWithId(
        integrationDefinitionId
      );

      if (!integrationDefinition) {
        return json(
          { error: "Integration definition not found" },
          { status: 404 }
        );
      }

      // Trigger the SETUP event for the integration
      const setupResult = await runIntegrationTrigger(
        integrationDefinition,
        {
          event: IntegrationEventType.SETUP,
          eventBody: {
            apiKey,
          },
        },
        userId
      );

      if (!setupResult || !setupResult.accountId) {
        return json(
          { error: "Failed to setup integration with the provided API key" },
          { status: 400 }
        );
      }

      // Create the integration account
      const integrationAccount = await createIntegrationAccount({
        accountId: setupResult.accountId,
        integrationDefinitionId,
        userId,
        config: setupResult.config || {},
        settings: setupResult.settings || {},
      });

      return json({ success: true, integrationAccount });
    } catch (error) {
      logger.error("Error creating integration account", {
        error,
        userId,
        integrationDefinitionId,
      });
      return json(
        { error: "Failed to create integration account" },
        { status: 500 }
      );
    }
  }
);

export { action, loader };