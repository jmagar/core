import {
  OAuthClientProvider,
  discoverOAuthProtectedResourceMetadata,
  discoverOAuthMetadata,
  startAuthorization,
  registerClient,
  exchangeAuthorization,
  refreshAuthorization,
  selectResourceURL,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
  OAuthMetadata,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { randomUUID } from "node:crypto";
import { getServerUrlHash, log, debugLog, DEBUG, MCP_REMOTE_VERSION } from "./utils.js";
import { globalAuthStorage } from "./in-memory-auth-storage.js";

export interface OAuthProviderOptions {
  serverUrl: string;
  redirectUrl: string;
  clientName?: string;
  clientUri?: string;
  softwareId?: string;
  softwareVersion?: string;
  staticOAuthClientMetadata?: Record<string, any> | null;
  staticOAuthClientInfo?: Record<string, any> | null;
  authorizeResource?: string;
  callbackPath?: string;
}

/**
 * Implements the OAuthClientProvider interface for Node.js environments.
 * Handles OAuth flow and token storage for MCP clients.
 */
export class NodeOAuthClientProvider implements OAuthClientProvider {
  private serverUrlHash: string;
  redirectUrl: string;
  private clientName: string;
  private clientUri: string;
  private softwareId: string;
  private softwareVersion: string;
  private staticOAuthClientMetadata: Record<string, any> | null | undefined;
  private staticOAuthClientInfo: Record<string, any> | null | undefined;
  private authorizeResource: string | undefined;
  private _state: string;

  constructor(readonly options: OAuthProviderOptions) {
    this.serverUrlHash = getServerUrlHash(options.serverUrl);
    this.redirectUrl = options.redirectUrl;
    this.clientName = options.clientName || "C.O.R.E. MCP";
    this.clientUri = options.clientUri || "https://github.com/modelcontextprotocol/mcp-cli";
    this.softwareId = options.softwareId || "2e6dc280-f3c3-4e01-99a7-8181dbd1d23d";
    this.softwareVersion = options.softwareVersion || MCP_REMOTE_VERSION;
    this.staticOAuthClientMetadata = options.staticOAuthClientMetadata;
    this.staticOAuthClientInfo = options.staticOAuthClientInfo;
    this.authorizeResource = options.authorizeResource;
    this._state = randomUUID();
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl.toString()],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: this.clientName,
      client_uri: this.clientUri,
      software_id: this.softwareId,
      software_version: this.softwareVersion,
      ...this.staticOAuthClientMetadata,
    };
  }

  state?(): string {
    return this._state;
  }

  /**
   * Gets the client information if it exists
   */
  async clientInformation(): Promise<OAuthClientInformationFull | undefined> {
    if (DEBUG) debugLog("Reading client info");
    if (this.staticOAuthClientInfo) {
      if (DEBUG) debugLog("Returning static client info");
      return this.staticOAuthClientInfo as OAuthClientInformationFull;
    }
    const clientInfo = await globalAuthStorage.getClientInformation(this.serverUrlHash);
    if (DEBUG) debugLog("Client info result:", clientInfo ? "Found" : "Not found");
    return clientInfo || undefined;
  }

  /**
   * Saves client information
   */
  async saveClientInformation(clientInformation: OAuthClientInformationFull): Promise<void> {
    if (DEBUG)
      debugLog("Saving client info", {
        client_id: clientInformation.client_id,
      });
    await globalAuthStorage.saveClientInformation(this.serverUrlHash, clientInformation);
  }

  /**
   * Gets the OAuth tokens if they exist
   */
  async tokens(): Promise<OAuthTokens | undefined> {
    if (DEBUG) {
      debugLog("Reading OAuth tokens");
      debugLog("Token request stack trace:", new Error().stack);
    }

    const tokens = await globalAuthStorage.getTokens(this.serverUrlHash);

    if (DEBUG) {
      if (tokens) {
        const timeLeft = tokens.expires_in || 0;

        // Alert if expires_in is invalid
        if (typeof tokens.expires_in !== "number" || tokens.expires_in < 0) {
          debugLog("⚠️ WARNING: Invalid expires_in detected while reading tokens ⚠️", {
            expiresIn: tokens.expires_in,
            tokenObject: JSON.stringify(tokens),
            stack: new Error("Invalid expires_in value").stack,
          });
        }

        debugLog("Token result:", {
          found: true,
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          expiresIn: `${timeLeft} seconds`,
          isExpired: timeLeft <= 0,
          expiresInValue: tokens.expires_in,
        });
      } else {
        debugLog("Token result: Not found");
      }
    }

    return tokens || undefined;
  }

  /**
   * Saves OAuth tokens
   */
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    if (DEBUG) {
      const timeLeft = tokens.expires_in || 0;

      // Alert if expires_in is invalid
      if (typeof tokens.expires_in !== "number" || tokens.expires_in < 0) {
        debugLog("⚠️ WARNING: Invalid expires_in detected in tokens ⚠️", {
          expiresIn: tokens.expires_in,
          tokenObject: JSON.stringify(tokens),
          stack: new Error("Invalid expires_in value").stack,
        });
      }

      debugLog("Saving tokens", {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: `${timeLeft} seconds`,
        expiresInValue: tokens.expires_in,
      });
    }

    await globalAuthStorage.saveTokens(this.serverUrlHash, tokens);
  }

  private authorizationUrl: string | null = null;

  /**
   * Captures the authorization URL instead of opening browser
   */
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (this.authorizeResource) {
      authorizationUrl.searchParams.set("resource", this.authorizeResource);
    }

    // Keep it
    console.log(this.authorizationUrl);

    // Store the URL instead of opening browser
    this.authorizationUrl = authorizationUrl.toString();

    if (DEBUG) debugLog("Authorization URL captured", authorizationUrl.toString());

    // For server-side usage, we don't open the browser
    log(`Authorization URL generated: ${authorizationUrl.toString()}`);
  }

  /**
   * Saves the PKCE code verifier
   */
  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    if (DEBUG) debugLog("Saving code verifier");
    await globalAuthStorage.saveCodeVerifier(this.serverUrlHash, codeVerifier);
  }

  /**
   * Gets the PKCE code verifier
   */
  async codeVerifier(): Promise<string> {
    if (DEBUG) debugLog("Reading code verifier");
    const verifier = await globalAuthStorage.getCodeVerifier(this.serverUrlHash);
    if (DEBUG) debugLog("Code verifier found:", !!verifier);
    if (!verifier) {
      throw new Error("No code verifier saved for session");
    }
    return verifier;
  }

  /**
   * Adds custom client authentication to OAuth token requests.
   * Optional method for custom authentication schemes.
   */
  async addClientAuthentication(
    _headers: Headers,
    _params: URLSearchParams,
    _url: string | URL,
    _metadata?: OAuthMetadata
  ): Promise<void> {
    // Default implementation - no custom authentication
    // Subclasses can override this for custom auth schemes
  }

  /**
   * Validates RFC 8707 Resource Indicator.
   * If defined, overrides the default validation behavior.
   */
  async validateResourceURL(
    _serverUrl: string | URL,
    _resource?: string
  ): Promise<URL | undefined> {
    // Default implementation - no resource validation
    // Subclasses can override this for custom validation
    return undefined;
  }

  /**
   * Invalidates the specified credentials
   */
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier"): Promise<void> {
    if (DEBUG) debugLog(`Invalidating credentials: ${scope}`);
    await globalAuthStorage.invalidateCredentials(this.serverUrlHash, scope);
    if (DEBUG) debugLog(`${scope} credentials invalidated`);
  }

  /**
   * Gets the authorization URL to initiate OAuth flow
   */
  async authorizationURL(
    options: {
      scope?: string;
      resourceMetadataUrl?: string;
    } = {}
  ): Promise<{ authUrl: string; state: string }> {
    const { scope, resourceMetadataUrl } = options;

    let resourceMetadata;
    let authorizationServerUrl: string = this.options.serverUrl;

    try {
      resourceMetadata = await discoverOAuthProtectedResourceMetadata(this.options.serverUrl, {
        resourceMetadataUrl: resourceMetadataUrl as string,
      });
      if (
        resourceMetadata.authorization_servers &&
        resourceMetadata.authorization_servers.length > 0
      ) {
        authorizationServerUrl = resourceMetadata.authorization_servers[0] as string;
      }
    } catch (_) {
      // Ignore errors and fall back to /.well-known/oauth-authorization-server
    }

    const resource = await selectResourceURL(this.options.serverUrl, this, resourceMetadata);
    const metadata = await discoverOAuthMetadata(this.options.serverUrl);

    // Handle client registration if needed
    let clientInformation = await this.clientInformation();
    if (!clientInformation) {
      if (!this.saveClientInformation) {
        throw new Error("OAuth client information must be saveable for dynamic registration");
      }
      const fullInformation = await registerClient(authorizationServerUrl, {
        metadata: metadata as any,
        clientMetadata: this.clientMetadata,
      });
      await this.saveClientInformation(fullInformation);
      clientInformation = fullInformation;
    }

    const state = this.state ? this.state() : randomUUID();

    const params: any = {
      metadata: metadata as any,
      clientInformation,
      state: state || "",
      redirectUrl: this.redirectUrl,
      scope: scope || this.clientMetadata.scope || "",
    };
    if (resource) {
      params.resource = resource;
    }

    // Start new authorization flow
    const { authorizationUrl, codeVerifier } = await startAuthorization(
      authorizationServerUrl,
      params
    );

    await this.saveCodeVerifier(codeVerifier);
    return { authUrl: authorizationUrl.toString(), state };
  }

  /**
   * Completes the OAuth flow with authorization code
   */
  async completeAuth(options: {
    authorizationCode: string;
    scope?: string;
    resourceMetadataUrl?: string;
  }): Promise<"AUTHORIZED"> {
    const { authorizationCode, resourceMetadataUrl } = options;
    let resourceMetadata;
    let authorizationServerUrl = this.options.serverUrl;

    try {
      resourceMetadata = await discoverOAuthProtectedResourceMetadata(this.options.serverUrl, {
        resourceMetadataUrl: resourceMetadataUrl as string,
      });

      if (
        resourceMetadata.authorization_servers &&
        resourceMetadata.authorization_servers.length > 0
      ) {
        authorizationServerUrl = resourceMetadata.authorization_servers[0] as string;
      }
    } catch (_) {
      // Ignore errors and fall back to /.well-known/oauth-authorization-server
    }

    const resource = await selectResourceURL(this.options.serverUrl, this, resourceMetadata);
    const metadata = await discoverOAuthMetadata(this.options.serverUrl);

    // Handle client registration if needed
    let clientInformation = await this.clientInformation();

    if (!clientInformation) {
      throw new Error(
        "Existing OAuth client information is required when exchanging an authorization code"
      );
    }

    // Check if we can refresh existing tokens first
    const tokens = await this.tokens();

    if (tokens?.refresh_token) {
      try {
        const refreshParams: any = {
          metadata: metadata as any,
          clientInformation,
          refreshToken: tokens.refresh_token,
        };
        if (resource) {
          refreshParams.resource = resource;
        }

        // Attempt to refresh the token
        const newTokens = await refreshAuthorization(authorizationServerUrl, refreshParams);
        await this.saveTokens(newTokens);
        return "AUTHORIZED";
      } catch (_) {
        // Could not refresh OAuth tokens, continue with authorization code exchange
      }
    }

    // Exchange authorization code for tokens
    const codeVerifier = await this.codeVerifier();

    const exchangeParams: any = {
      metadata: metadata as any,
      clientInformation,
      authorizationCode,
      codeVerifier,
      redirectUri: this.redirectUrl,
    };

    if (resource) {
      exchangeParams.resource = resource;
    }

    const newTokens = await exchangeAuthorization(authorizationServerUrl, exchangeParams);

    await this.saveTokens(newTokens);
    return "AUTHORIZED";
  }
}
