import { json, LoaderFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const ParamsSchema = z.object({
  workspaceSlug: z.string(),
});

export const IngestBodyRequest = z.object({
  name: z.string(),
  episodeBody: z.string(),
  referenceTime: z.string(),
  type: z.enum(["CONVERSATION", "TEXT"]), // Assuming these are the EpisodeType values
  source: z.string(),
  userId: z.string(),
  spaceId: z.string().optional(),
  sessionId: z.string().optional(),
});

const { action, loader } = createActionApiRoute(
  {
    params: ParamsSchema,
    body: IngestBodyRequest,
    allowJWT: true,
    authorization: {
      action: "ingest",
    },
    corsStrategy: "all",
  },
  async ({ body, headers, params, authentication }) => {
    console.log(body, headers, params, authentication);

    return json({});
  },
);

export { action, loader };
