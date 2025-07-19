import { json } from "@remix-run/node";
import { oauth2Service } from "~/services/oauth2.server";

export interface OAuth2Context {
  user: {
    id: string;
    email: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  client: {
    id: string;
    clientId: string;
    name: string;
  };
  token: {
    id: string;
    token: string;
    scope: string | null;
    expiresAt: Date;
  };
}

export async function requireOAuth2(request: Request): Promise<OAuth2Context> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw json(
      { error: "invalid_token", error_description: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const accessToken = await oauth2Service.validateAccessToken(token);
    
    return {
      user: {
        id: accessToken.user.id,
        email: accessToken.user.email,
        name: accessToken.user.name,
        displayName: accessToken.user.displayName,
        avatarUrl: accessToken.user.avatarUrl,
      },
      client: {
        id: accessToken.client.id,
        clientId: accessToken.client.clientId,
        name: accessToken.client.name,
      },
      token: {
        id: accessToken.id,
        token: accessToken.token,
        scope: accessToken.scope,
        expiresAt: accessToken.expiresAt,
      },
    };
  } catch (error) {
    throw json(
      { error: "invalid_token", error_description: "Invalid or expired access token" },
      { status: 401 }
    );
  }
}

export async function getOAuth2Context(request: Request): Promise<OAuth2Context | null> {
  try {
    return await requireOAuth2(request);
  } catch (error) {
    return null;
  }
}

export function hasScope(context: OAuth2Context, requiredScope: string): boolean {
  if (!context.token.scope) {
    return false;
  }
  
  const scopes = context.token.scope.split(' ');
  return scopes.includes(requiredScope);
}

export function requireScope(context: OAuth2Context, requiredScope: string): void {
  if (!hasScope(context, requiredScope)) {
    throw json(
      { error: "insufficient_scope", error_description: `Required scope: ${requiredScope}` },
      { status: 403 }
    );
  }
}