import { Authenticator } from "remix-auth";

import type { AuthUser } from "./authUser";

import { addGoogleStrategy } from "./googleAuth.server";

import { env } from "~/env.server";
import { addEmailLinkStrategy } from "./emailAuth.server";

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session
const authenticator = new Authenticator<AuthUser>();

const isGoogleAuthSupported =
  typeof env.AUTH_GOOGLE_CLIENT_ID === "string" &&
  env.AUTH_GOOGLE_CLIENT_ID.length > 0 &&
  typeof env.AUTH_GOOGLE_CLIENT_SECRET === "string" &&
  env.AUTH_GOOGLE_CLIENT_SECRET.length > 0;

if (env.AUTH_GOOGLE_CLIENT_ID && env.AUTH_GOOGLE_CLIENT_SECRET) {
  addGoogleStrategy(
    authenticator,
    env.AUTH_GOOGLE_CLIENT_ID,
    env.AUTH_GOOGLE_CLIENT_SECRET,
  );
}

if (env.ENABLE_EMAIL_LOGIN) {
  addEmailLinkStrategy(authenticator);
}

export { authenticator, isGoogleAuthSupported };
