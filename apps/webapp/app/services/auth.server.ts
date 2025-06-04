import { Authenticator } from "remix-auth";
import type { AuthUser } from "./authUser";

import { addGoogleStrategy } from "./googleAuth.server";

import { env } from "~/env.server";

// Create an instance of the authenticator, pass a generic with what
// strategies will return and will store in the session
const authenticator = new Authenticator<AuthUser>();

const isGoogleAuthSupported =
  typeof env.AUTH_GOOGLE_CLIENT_ID === "string" &&
  typeof env.AUTH_GOOGLE_CLIENT_SECRET === "string";

if (env.AUTH_GOOGLE_CLIENT_ID && env.AUTH_GOOGLE_CLIENT_SECRET) {
  addGoogleStrategy(
    authenticator,
    env.AUTH_GOOGLE_CLIENT_ID,
    env.AUTH_GOOGLE_CLIENT_SECRET,
  );
}

export { authenticator, isGoogleAuthSupported };
