import { type ActionFunctionArgs } from "@remix-run/server-runtime";
import { requireUserId, requireWorkpace } from "~/services/session.server";

import { redirect, json } from "@remix-run/node";
import { prisma } from "~/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const workspace = await requireWorkpace(request);

  if (request.method === "POST") {
    const formData = await request.formData();
    const url = formData.get("url") as string;
    const secret = formData.get("secret") as string;

    if (!url) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
      // Validate URL format
      new URL(url);
    } catch (error) {
      return json({ error: "Invalid URL format" }, { status: 400 });
    }

    try {
      await prisma.webhookConfiguration.create({
        data: {
          url,
          secret: secret || null,
          eventTypes: ["activity.created"], // Default to activity events
          workspaceId: workspace.id,
          userId,
          isActive: true,
        },
      });

      return redirect("/settings/webhooks");
    } catch (error) {
      console.error("Error creating webhook:", error);
      return json({ error: "Failed to create webhook" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
