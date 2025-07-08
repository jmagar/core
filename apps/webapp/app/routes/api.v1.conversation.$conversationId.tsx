import { json } from "@remix-run/node";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";

import { getWorkspaceByUser } from "~/models/workspace.server";
import {
  getConversation,
  deleteConversation,
} from "~/services/conversation.server";
import { z } from "zod";

export const ConversationIdSchema = z.object({
  conversationId: z.string(),
});

const { action, loader } = createActionApiRoute(
  {
    params: ConversationIdSchema,
    allowJWT: true,
    authorization: {
      action: "oauth",
    },
    corsStrategy: "all",
  },
  async ({ params, authentication, request }) => {
    const workspace = await getWorkspaceByUser(authentication.userId);

    if (!workspace) {
      throw new Error("No workspace found");
    }

    const method = request.method;

    if (method === "GET") {
      // Get a conversation by ID
      const conversation = await getConversation(params.conversationId);
      return json(conversation);
    }

    if (method === "DELETE") {
      // Soft delete a conversation
      const deleted = await deleteConversation(params.conversationId);
      return json(deleted);
    }

    // Method not allowed
    return new Response("Method Not Allowed", { status: 405 });
  },
);

export { action, loader };
