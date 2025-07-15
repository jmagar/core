import { json } from "@remix-run/node";
import { z } from "zod";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";

const TestSchema = z.object({
  message: z.string(),
});

// This route can be called with either:
// 1. Personal access token: Authorization: Bearer <token>
// 2. Cookie-based authentication (when logged in via browser)
const { action, loader } = createHybridActionApiRoute(
  {
    body: TestSchema,
    method: "POST",
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    return json({
      success: true,
      message: body.message,
      authType: authentication.type,
      userId: authentication.userId,
      // Only include scopes if it's API key authentication
      ...(authentication.type === "PRIVATE" && { scopes: authentication.scopes }),
    });
  },
);

export { action, loader };