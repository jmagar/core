import { type ActionFunctionArgs } from "@remix-run/server-runtime";
import { requireWorkpace } from "~/services/session.server";

import { redirect, json } from "@remix-run/node";
import { prisma } from "~/db.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const workspace = await requireWorkpace(request);
  const webhookId = params.id;

  if (!webhookId) {
    return json({ error: "Webhook ID is required" }, { status: 400 });
  }

  // Verify webhook belongs to the workspace
  const webhook = await prisma.webhookConfiguration.findFirst({
    where: {
      id: webhookId,
      workspaceId: workspace.id,
    },
  });

  if (!webhook) {
    return json({ error: "Webhook not found" }, { status: 404 });
  }

  if (request.method === "POST") {
    const formData = await request.formData();
    const method = formData.get("_method") as string;

    if (method === "DELETE") {
      try {
        await prisma.webhookConfiguration.delete({
          where: {
            id: webhookId,
          },
        });

        return redirect("/settings/webhooks");
      } catch (error) {
        console.error("Error deleting webhook:", error);
        return json({ error: "Failed to delete webhook" }, { status: 500 });
      }
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
