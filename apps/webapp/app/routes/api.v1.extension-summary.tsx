import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { json } from "@remix-run/node";
import { extensionSummary } from "~/trigger/extension/summary";

export const ExtensionSummaryBodyRequest = z.object({
  html: z.string().min(1, "HTML content is required"),
  url: z.string().url("Valid URL is required"),
  title: z.string().optional(),
});

const { action, loader } = createActionApiRoute(
  {
    body: ExtensionSummaryBodyRequest,
    allowJWT: true,
    authorization: {
      action: "search",
    },
    corsStrategy: "all",
  },
  async ({ body }) => {
    const response = await extensionSummary.trigger(body);

    return json(response);
  },
);

export { action, loader };
