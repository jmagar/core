import { json } from "@remix-run/node";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { OAuthBodySchema } from "~/services/oauth/oauth-utils.server";

import {
  getRedirectURL,
  getRedirectURLForMCP,
} from "~/services/oauth/oauth.server";
import { getWorkspaceByUser } from "~/models/workspace.server";

// This route handles the OAuth redirect URL generation, similar to the NestJS controller
const { action, loader } = createActionApiRoute(
  {
    body: OAuthBodySchema,
    allowJWT: true,
    authorization: {
      action: "oauth",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const workspace = await getWorkspaceByUser(authentication.userId);

    // Call the appropriate service based on MCP flag
    const redirectURL = body.mcp
      ? await getRedirectURLForMCP(body, authentication.userId, workspace?.id)
      : await getRedirectURL(body, authentication.userId, workspace?.id);

    return json(redirectURL);
  },
);

export { action, loader };
