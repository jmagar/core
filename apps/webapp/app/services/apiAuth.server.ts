import { SignJWT, errors, jwtVerify } from "jose";

import { env } from "~/env.server";
import { findUserByToken } from "~/models/personal-token.server";

// See this for more: https://twitter.com/mattpocockuk/status/1653403198885904387?s=20
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type ApiAuthenticationResult =
  | ApiAuthenticationResultSuccess
  | ApiAuthenticationResultFailure;

export type ApiAuthenticationResultSuccess = {
  ok: true;
  apiKey: string;
  type: "PRIVATE";
  userId: string;
  scopes?: string[];
  oneTimeUse?: boolean;
};

export type ApiAuthenticationResultFailure = {
  ok: false;
  error: string;
};

/**
 * This method is the same as `authenticateApiRequest` but it returns a failure result instead of undefined.
 * It should be used from now on to ensure that the API key is always validated and provide a failure result.
 */
export async function authenticateApiRequestWithFailure(
  request: Request,
  options: { allowPublicKey?: boolean; allowJWT?: boolean } = {},
): Promise<ApiAuthenticationResult> {
  const apiKey = getApiKeyFromRequest(request);

  if (!apiKey) {
    return {
      ok: false,
      error: "Invalid API Key",
    };
  }

  const authentication = await authenticateApiKeyWithFailure(apiKey, options);

  return authentication;
}

/**
 * This method is the same as `authenticateApiKey` but it returns a failure result instead of undefined.
 * It should be used from now on to ensure that the API key is always validated and provide a failure result.
 */
export async function authenticateApiKeyWithFailure(
  apiKey: string,
  options: { allowPublicKey?: boolean; allowJWT?: boolean } = {},
): Promise<ApiAuthenticationResult> {
  const result = getApiKeyResult(apiKey);

  if (!result) {
    return {
      ok: false,
      error: "Invalid API Key",
    };
  }

  switch (result.type) {
    case "PRIVATE": {
      const user = await findUserByToken(result.apiKey);
      if (!user) {
        return {
          ok: false,
          error: "Invalid API Key",
        };
      }

      return {
        ok: true,
        ...result,
        userId: user.userId,
      };
    }
  }
}

export function isSecretApiKey(key: string) {
  return key.startsWith("tr_");
}

export function getApiKeyFromRequest(request: Request) {
  return getApiKeyFromHeader(request.headers.get("Authorization"));
}

export function getApiKeyFromHeader(authorization?: string | null) {
  if (typeof authorization !== "string" || !authorization) {
    return;
  }

  const apiKey = authorization.replace(/^Bearer /, "");
  return apiKey;
}

export function getApiKeyResult(apiKey: string): {
  apiKey: string;
  type: "PRIVATE";
} {
  return { apiKey, type: "PRIVATE" };
}
