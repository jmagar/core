import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { requireOAuth2, requireScope } from "~/utils/oauth2-middleware";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Require OAuth2 authentication
    const oauth2Context = await requireOAuth2(request);
    
    // Require 'read' scope
    requireScope(oauth2Context, 'read');

    // Return user profile information
    return json({
      user: oauth2Context.user,
      client: {
        name: oauth2Context.client.name,
        id: oauth2Context.client.clientId,
      },
      scope: oauth2Context.token.scope,
    });
  } catch (error) {
    // Error responses are already formatted by the middleware
    throw error;
  }
};

// This endpoint only supports GET
export const action = () => {
  return json(
    { error: "method_not_allowed", error_description: "Only GET method is allowed" },
    { status: 405 }
  );
};