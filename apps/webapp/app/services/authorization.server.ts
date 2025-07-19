export type AuthorizationAction = "read" | "write" | string; // Add more actions as needed

const ResourceTypes = ["spaces"] as const;

export type AuthorizationResources = {
  [key in (typeof ResourceTypes)[number]]?: string | string[];
};

export type AuthorizationEntity = {
  type: "PRIVATE" | "OAUTH2";
  scopes?: string[];
};

export type AuthorizationResult =
  | { authorized: true }
  | { authorized: false; reason: string };

/**
 * Checks if the given entity is authorized to perform a specific action on a resource.
 */
export function checkAuthorization(
  entity: AuthorizationEntity,
): AuthorizationResult {
  // "PRIVATE" is a secret key and has access to everything
  if (entity.type === "PRIVATE") {
    return { authorized: true };
  }

  // "OAUTH2" tokens are also authorized (scope-based authorization can be added later)
  if (entity.type === "OAUTH2") {
    return { authorized: true };
  }

  return { authorized: false, reason: "No key" };
}
