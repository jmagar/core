import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

export interface OAuth2AuthorizeRequest {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

export interface OAuth2TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  client_id: string;
  client_secret?: string;
  code_verifier?: string;
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuth2ErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
  state?: string;
}

// OAuth2 Error types
export const OAuth2Errors = {
  INVALID_REQUEST: "invalid_request",
  INVALID_CLIENT: "invalid_client",
  INVALID_GRANT: "invalid_grant",
  UNAUTHORIZED_CLIENT: "unauthorized_client",
  UNSUPPORTED_GRANT_TYPE: "unsupported_grant_type",
  INVALID_SCOPE: "invalid_scope",
  ACCESS_DENIED: "access_denied",
  UNSUPPORTED_RESPONSE_TYPE: "unsupported_response_type",
  SERVER_ERROR: "server_error",
  TEMPORARILY_UNAVAILABLE: "temporarily_unavailable",
} as const;

export class OAuth2Service {
  // Generate secure random string
  private generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  // Validate OAuth2 client
  async validateClient(clientId: string, clientSecret?: string): Promise<any> {
    const client = await prisma.oAuthClient.findUnique({
      where: {
        clientId,
        isActive: true,
      },
      include: {
        workspace: true,
      },
    });

    if (!client) {
      throw new Error(OAuth2Errors.INVALID_CLIENT);
    }

    // If client secret is provided, validate it
    if (clientSecret && client.clientSecret !== clientSecret) {
      throw new Error(OAuth2Errors.INVALID_CLIENT);
    }

    return client;
  }

  // Validate redirect URI
  validateRedirectUri(client: any, redirectUri: string): boolean {
    const allowedUris = client.redirectUris
      .split(",")
      .map((uri: string) => uri.trim());
    return allowedUris.includes(redirectUri);
  }

  // Validate PKCE challenge
  validatePkceChallenge(
    codeVerifier: string,
    codeChallenge: string,
    method: string = "S256",
  ): boolean {
    if (method === "S256") {
      const hash = crypto.createHash("sha256").update(codeVerifier).digest();
      const challenge = hash.toString("base64url");
      return challenge === codeChallenge;
    } else if (method === "plain") {
      return codeVerifier === codeChallenge;
    }
    return false;
  }

  // Create authorization code
  async createAuthorizationCode(params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scope?: string;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): Promise<string> {
    const code = this.generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find the client to get the internal database ID
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: params.clientId },
      select: { id: true },
    });

    if (!client) {
      throw new Error(OAuth2Errors.INVALID_CLIENT);
    }

    await prisma.oAuthAuthorizationCode.create({
      data: {
        code,
        clientId: client.id, // Use internal database ID
        userId: params.userId,
        redirectUri: params.redirectUri,
        scope: params.scope,
        state: params.state,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: params.codeChallengeMethod,
        expiresAt,
      },
    });

    return code;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(params: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuth2TokenResponse> {
    // Find the client first to get the internal database ID
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: params.clientId },
      select: { id: true },
    });

    if (!client) {
      throw new Error(OAuth2Errors.INVALID_CLIENT);
    }

    // Find and validate authorization code
    const authCode = await prisma.oAuthAuthorizationCode.findFirst({
      where: {
        code: params.code,
        clientId: client.id, // Use internal database ID
        redirectUri: params.redirectUri,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        client: true,
        user: true,
      },
    });

    if (!authCode) {
      throw new Error(OAuth2Errors.INVALID_GRANT);
    }

    // Validate PKCE if required
    if (authCode.codeChallenge) {
      if (!params.codeVerifier) {
        throw new Error(OAuth2Errors.INVALID_REQUEST);
      }
      if (
        !this.validatePkceChallenge(
          params.codeVerifier,
          authCode.codeChallenge,
          authCode.codeChallengeMethod || "S256",
        )
      ) {
        throw new Error(OAuth2Errors.INVALID_GRANT);
      }
    }

    // Mark code as used
    await prisma.oAuthAuthorizationCode.update({
      where: { id: authCode.id },
      data: { used: true },
    });

    // Generate access token
    const accessToken = this.generateSecureToken(64);
    const refreshToken = this.generateSecureToken(64);
    const expiresIn = 3600; // 1 hour
    const accessTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    const refreshTokenExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ); // 30 days

    // Store tokens
    await prisma.oAuthAccessToken.create({
      data: {
        token: accessToken,
        clientId: client.id, // Use internal database ID
        userId: authCode.userId,
        scope: authCode.scope,
        expiresAt: accessTokenExpiresAt,
      },
    });

    await prisma.oAuthRefreshToken.create({
      data: {
        token: refreshToken,
        clientId: client.id, // Use internal database ID
        userId: authCode.userId,
        scope: authCode.scope,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: authCode.scope || undefined,
    };
  }

  // Validate access token
  async validateAccessToken(token: string): Promise<any> {
    const accessToken = await prisma.oAuthAccessToken.findFirst({
      where: {
        token,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        client: true,
        user: true,
      },
    });

    if (!accessToken) {
      throw new Error("Invalid or expired token");
    }

    return accessToken;
  }

  // Get user info from access token
  async getUserInfo(token: string): Promise<any> {
    const accessToken = await this.validateAccessToken(token);

    return {
      sub: accessToken.user.id,
      email: accessToken.user.email,
      name: accessToken.user.name,
      display_name: accessToken.user.displayName,
      avatar_url: accessToken.user.avatarUrl,
      email_verified: true, // Assuming email is verified if user exists
    };
  }

  // Refresh access token
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
  ): Promise<OAuth2TokenResponse> {
    // Find the client first to get the internal database ID
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId },
      select: { id: true },
    });

    if (!client) {
      throw new Error(OAuth2Errors.INVALID_CLIENT);
    }

    const storedRefreshToken = await prisma.oAuthRefreshToken.findFirst({
      where: {
        token: refreshToken,
        clientId: client.id, // Use internal database ID
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        client: true,
        user: true,
      },
    });

    if (!storedRefreshToken) {
      throw new Error(OAuth2Errors.INVALID_GRANT);
    }

    // Generate new access token
    const accessToken = this.generateSecureToken(64);
    const expiresIn = 3600; // 1 hour
    const accessTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.oAuthAccessToken.create({
      data: {
        token: accessToken,
        clientId: client.id, // Use internal database ID
        userId: storedRefreshToken.userId,
        scope: storedRefreshToken.scope,
        expiresAt: accessTokenExpiresAt,
      },
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: storedRefreshToken.scope || undefined,
    };
  }
}

export const oauth2Service = new OAuth2Service();
