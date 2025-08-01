import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { z } from "zod";
import { authenticateOAuthRequest } from "~/services/apiAuth.server";
import { prisma } from "~/db.server";

// Schema for the integration account ID parameter
const ParamsSchema = z.object({
  id: z.string().min(1, "Integration account ID is required"),
});

/**
 * API endpoint for OAuth apps to get integration account credentials
 * GET /api/v1/integration_account/:id/credentials
 * Authorization: Bearer <oauth_access_token>
 * Required scope: integration:credentials
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    // Authenticate OAuth request and verify integration:credentials scope
    const authResult = await authenticateOAuthRequest(request, ["integration:credentials", "integration"]);
    
    if (!authResult.success) {
      return json(
        { 
          error: "unauthorized", 
          error_description: authResult.error 
        },
        { status: 401 }
      );
    }

    // Validate parameters
    const parseResult = ParamsSchema.safeParse(params);
    if (!parseResult.success) {
      return json(
        { 
          error: "invalid_request", 
          error_description: "Invalid integration account ID" 
        },
        { status: 400 }
      );
    }

    const { id } = parseResult.data;

    // Get the integration account with proper access control
    const integrationAccount = await prisma.integrationAccount.findFirst({
      where: {
        id,
        integratedById: authResult.user!.id, // Ensure user owns this integration account
        isActive: true,
        deleted: null,
      },
      include: {
        integrationDefinition: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
          },
        },
      },
    });

    if (!integrationAccount) {
      return json(
        { 
          error: "not_found", 
          error_description: "Integration account not found or access denied" 
        },
        { status: 404 }
      );
    }

    // Extract credentials from integrationConfiguration
    const credentials = integrationAccount.integrationConfiguration as Record<string, any>;
    
    // Return the credentials and metadata
    return json({
      id: integrationAccount.id,
      accountId: integrationAccount.accountId,
      provider: integrationAccount.integrationDefinition.slug,
      name: integrationAccount.integrationDefinition.name,
      icon: integrationAccount.integrationDefinition.icon,
      credentials,
      settings: integrationAccount.settings,
      connectedAt: integrationAccount.createdAt,
      isActive: integrationAccount.isActive,
    });

  } catch (error) {
    console.error("Error fetching integration account credentials:", error);
    return json(
      { 
        error: "server_error", 
        error_description: "Internal server error" 
      },
      { status: 500 }
    );
  }
};

// Method not allowed for non-GET requests
export const action = async () => {
  return json(
    { 
      error: "method_not_allowed", 
      error_description: "Only GET requests are allowed" 
    },
    { status: 405 }
  );
}; 