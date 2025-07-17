import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/services/session.server";

import { logger } from "~/services/logger.service";
import { prisma } from "~/db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const body = await request.json();
    const { integrationAccountId } = body;

    if (!integrationAccountId) {
      return json(
        { error: "Integration account ID is required" },
        { status: 400 },
      );
    }

    // Soft delete the integration account by setting deletedAt
    const updatedAccount = await prisma.integrationAccount.delete({
      where: {
        id: integrationAccountId,
        deleted: null,
      },
    });

    logger.info("Integration account disconnected (soft deleted)", {
      integrationAccountId,
      userId,
    });

    return json({
      success: true,
      message: "Integration account disconnected successfully",
    });
  } catch (error) {
    logger.error("Failed to disconnect integration account", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return json(
      { error: "Failed to disconnect integration account" },
      { status: 500 },
    );
  }
}
