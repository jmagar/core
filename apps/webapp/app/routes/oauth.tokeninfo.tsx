import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { oauth2Service } from "~/services/oauth2.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const idToken = url.searchParams.get("id_token");

  if (!idToken) {
    return json(
      { error: "invalid_request", error_description: "Missing id_token parameter" },
      { status: 400 }
    );
  }

  try {
    const userInfo = await oauth2Service.getUserInfoFromIdToken(idToken);
    return json(userInfo);
  } catch (error) {
    return json(
      { error: "invalid_token", error_description: "Invalid or expired ID token" },
      { status: 401 }
    );
  }
};