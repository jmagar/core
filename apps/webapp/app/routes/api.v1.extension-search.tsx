import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { json } from "@remix-run/node";
import { extensionSearch } from "~/trigger/extension/search";

export const ExtensionSearchBodyRequest = z.object({
  input: z.string().min(1, "Input text is required"),
});

const { action, loader } = createActionApiRoute(
  {
    body: ExtensionSearchBodyRequest,
    method: "POST",
    allowJWT: true,
    authorization: {
      action: "search",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const trigger = await extensionSearch.trigger({
      userInput: body.input,
      userId: authentication.userId,
    });

    return json(trigger);
  },
);

export { action, loader };
