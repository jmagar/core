import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { callbackHandler } from "~/services/oauth/oauth.server";
import type { CallbackParams } from "~/services/oauth/oauth-utils.server";

// This route handles the OAuth callback, similar to the NestJS controller
const { loader } = createActionApiRoute(
  {
    allowJWT: false,
    corsStrategy: "all",
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const params: CallbackParams = {};
    for (const [key, value] of url.searchParams.entries()) {
      params[key] = value;
    }
    return await callbackHandler(params);
  },
);

export { loader };
