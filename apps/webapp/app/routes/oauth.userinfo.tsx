import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { oauth2Service } from "~/services/oauth2.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json(
        { error: "invalid_token", error_description: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate token and get user info
    try {
      const userInfo = await oauth2Service.getUserInfo(token);
      return json(userInfo);
    } catch (error) {
      return json(
        { error: "invalid_token", error_description: "Invalid or expired access token" },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error("OAuth2 userinfo endpoint error:", error);
    return json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 }
    );
  }
};

// This endpoint only supports GET
export const action = () => {
  return json(
    { error: "invalid_request", error_description: "Only GET method is allowed" },
    { status: 405 }
  );
};