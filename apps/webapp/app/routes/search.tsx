import { z } from "zod";
import { createActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { SearchService } from "~/services/search.server";
import { json } from "@remix-run/node";

export const SearchBodyRequest = z.object({
  query: z.string(),
  spaceId: z.string().optional(),
  sessionId: z.string().optional(),
});

const searchService = new SearchService();
const { action, loader } = createActionApiRoute(
  {
    body: SearchBodyRequest,
    allowJWT: true,
    authorization: {
      action: "search",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const results = await searchService.search(
      body.query,
      authentication.userId,
    );
    return json(results);
  },
);

export { action, loader };
