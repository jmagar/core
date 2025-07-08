import { json } from "@remix-run/node";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";

import { getWorkspaceByUser } from "~/models/workspace.server";
import {
  createConversation,
  CreateConversationSchema,
} from "~/services/conversation.server";

const { action, loader } = createActionApiRoute(
  {
    body: CreateConversationSchema,
    allowJWT: true,
    authorization: {
      action: "oauth",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const workspace = await getWorkspaceByUser(authentication.userId);

    if (!workspace) {
      throw new Error("No workspace found");
    }

    // Call the service to get the redirect URL
    const conversation = await createConversation(
      workspace?.id,
      authentication.userId,
      body,
    );

    return json(conversation);
  },
);

export { action, loader };
