import { json } from "@remix-run/node";

import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { addToQueue } from "~/lib/ingest.server";
import { IngestBodyRequest } from "~/trigger/ingest/ingest";

const { action, loader } = createActionApiRoute(
  {
    body: IngestBodyRequest,
    allowJWT: true,
    authorization: {
      action: "ingest",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const response = addToQueue(body, authentication.userId);
    return json({ ...response });
  },
);

export { action, loader };
