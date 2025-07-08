// DEPRECATED: This route is deprecated. Please use /api/v1/add instead.
// The API logic has been moved to /api/v1/add. This file is retained for reference only.

import { json } from "@remix-run/node";

import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { addToQueue, IngestBodyRequest } from "~/lib/ingest.server";

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
