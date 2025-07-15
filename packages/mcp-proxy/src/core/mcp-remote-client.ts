import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  MCPRemoteClientConfig,
  AuthenticationResult,
  ProxyConnectionConfig,
  CredentialLoadCallback,
  MCPProxyFunction,
  StoredCredentials,
  TransportStrategy,
} from "../types/remote-client.js";
import { MCPAuthProxyError } from "../utils/errors.js";
import { NodeOAuthClientProvider } from "../lib/node-oauth-client-provider.js";
import { globalAuthStorage } from "../lib/in-memory-auth-storage.js";
import { getServerUrlHash } from "../lib/utils.js";
import { RemixMCPTransport } from "../utils/mcp-transport.js";
import { createMCPTransportBridge } from "../utils/mcp-transport-bridge.js";
import {
  createAuthProviderFromConfig,
  createAuthProviderForProxy,
} from "../utils/auth-provider-factory.js";

/**
 * Creates an MCP authentication client that handles OAuth flow
 * @param config Configuration for the MCP service
 * @param onCredentialSave Callback to save credentials to your database
 * @returns Authentication client with OAuth capabilities
 */
export function createMCPAuthClient(config: MCPRemoteClientConfig): MCPAuthenticationClient {
  return new MCPAuthenticationClient(config);
}

/**
 * Creates an MCP proxy that forwards requests to the remote MCP server
 * Consolidates all proxy functionality into a single function
 * @param config Configuration for the proxy connection
 * @param onCredentialLoad Callback to load credentials from your database
 * @returns Proxy function that can be used in your Remix API routes
 */
export function createMCPProxy(
  config: ProxyConnectionConfig & {
    /** Enable debug logging */
    debug?: boolean;
  },
  onCredentialLoad: CredentialLoadCallback
): MCPProxyFunction {
  return async (request: Request, userApiKey: string): Promise<Response> => {
    return new Promise<Response>(async (resolve) => {
      let bridge: any = null;

      try {
        // Load credentials for this user and server
        const credentials = await onCredentialLoad(userApiKey, config.serverUrl);

        if (!credentials) {
          return resolve(
            new Response(
              JSON.stringify({
                error: "No credentials found for this service",
              }),
              {
                status: 401,
                headers: { "Content-Type": "application/json" },
              }
            )
          );
        }

        // Check if tokens are expired
        if (credentials.expiresAt && credentials.expiresAt < new Date()) {
          return resolve(
            new Response(
              JSON.stringify({
                error: "Credentials expired - please re-authenticate",
              }),
              {
                status: 401,
                headers: { "Content-Type": "application/json" },
              }
            )
          );
        }

        // Create remote transport (connects to the MCP server) FIRST
        const serverTransport = await createRemoteTransport(
          credentials.serverUrl,
          credentials,
          config.redirectUrl,
          config.transportStrategy || "sse-first"
        );

        // Start server transport and wait for connection
        await serverTransport.start();

        // Create Remix transport (converts HTTP to MCP messages)
        const clientTransport = new RemixMCPTransport(request, resolve);

        // Bridge the transports
        const bridgeOptions: any = {
          debug: config.debug || false,
          onError: (error: Error, source: string) => {
            console.error(`[MCP Bridge] ${source} error:`, error);
          },
        };

        if (config.debug) {
          bridgeOptions.onMessage = (direction: string, message: any) => {
            console.log(`[MCP Bridge] ${direction}:`, message.method || message.id);
          };
        }

        bridge = createMCPTransportBridge(
          clientTransport as any,
          serverTransport as any,
          bridgeOptions
        );

        // Set up timeout
        const timeoutId = config.timeout
          ? setTimeout(() => {
              bridge?.close().catch(console.error);
              if (!resolve) return;
              resolve(
                new Response(
                  JSON.stringify({
                    error: "Request timeout",
                  }),
                  {
                    status: 408,
                    headers: { "Content-Type": "application/json" },
                  }
                )
              );
            }, config.timeout)
          : null;

        // Start only the client transport (server is already started)
        await clientTransport.start();

        // Clean up after a reasonable time (since HTTP is request/response)
        setTimeout(() => {
          if (timeoutId) clearTimeout(timeoutId);
          bridge?.close().catch(console.error);
        }, 1000);
      } catch (error) {
        console.error("MCP Transport Proxy Error:", error);

        if (bridge) {
          bridge.close().catch(console.error);
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        resolve(
          new Response(
            JSON.stringify({
              error: `Transport proxy error: ${errorMessage}`,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          )
        );
      }
    });
  };

  // Helper function to create remote transport
  async function createRemoteTransport(
    serverUrl: string,
    credentials: StoredCredentials,
    redirectUrl: string,
    transportStrategy: TransportStrategy = "sse-first"
  ): Promise<SSEClientTransport | StreamableHTTPClientTransport> {
    // Create auth provider with stored credentials using common factory
    const authProvider = await createAuthProviderForProxy(serverUrl, credentials, redirectUrl);

    const url = new URL(serverUrl);
    const headers = {
      Authorization: `Bearer ${credentials.tokens.access_token}`,
      "Content-Type": "application/json",
      ...config.headers,
    };

    // Create transport based on strategy (don't start yet)
    let transport: SSEClientTransport | StreamableHTTPClientTransport;

    // For SSE, we need eventSourceInit for authentication
    const eventSourceInit = {
      fetch: (url: string | URL, init?: RequestInit) => {
        return fetch(url, {
          ...init,
          headers: {
            ...(init?.headers as Record<string, string> | undefined),
            ...headers,
            Accept: "text/event-stream",
          } as Record<string, string>,
        });
      },
    };

    switch (transportStrategy) {
      case "sse-only":
        transport = new SSEClientTransport(url, {
          authProvider,
          requestInit: { headers },
          eventSourceInit,
        });
        break;

      case "http-only":
        transport = new StreamableHTTPClientTransport(url, {
          authProvider,
          requestInit: { headers },
        });
        break;

      case "sse-first":
        // Try SSE first, fallback to HTTP on error
        try {
          transport = new SSEClientTransport(url, {
            authProvider,
            requestInit: { headers },
            eventSourceInit,
          });
        } catch (error) {
          console.warn("SSE transport failed, falling back to HTTP:", error);
          transport = new StreamableHTTPClientTransport(url, {
            authProvider,
            requestInit: { headers },
          });
        }
        break;

      case "http-first":
        // Try HTTP first, fallback to SSE on error
        try {
          transport = new StreamableHTTPClientTransport(url, {
            authProvider,
            requestInit: { headers },
          });
        } catch (error) {
          console.warn("HTTP transport failed, falling back to SSE:", error);
          transport = new SSEClientTransport(url, {
            authProvider,
            requestInit: { headers },
            eventSourceInit,
          });
        }
        break;

      default:
        throw new Error(`Unknown transport strategy: ${transportStrategy}`);
    }

    return transport;
  }
}

export class MCPAuthenticationClient {
  private serverUrlHash: string;
  private authProvider: NodeOAuthClientProvider | null = null;
  private client: Client | null = null;

  constructor(private config: MCPRemoteClientConfig) {
    this.serverUrlHash = getServerUrlHash(config.serverUrl);

    console.log(config);
    // Validate configuration
    this.validateConfig();
  }

  /**
   * Gets the auth provider instance, creating it if needed
   * This method can be called independently to get auth provider for other uses
   */
  getAuthProvider(): NodeOAuthClientProvider {
    if (!this.authProvider) {
      this.authProvider = createAuthProviderFromConfig(this.config);
    }
    return this.authProvider;
  }

  private validateConfig(): void {
    if (!this.config.serverUrl) {
      throw new MCPAuthProxyError("Server URL is required", "INVALID_CONFIG");
    }

    const url = new URL(this.config.serverUrl);
    const isLocalhost =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.protocol === "http:";

    if (!(url.protocol === "https:" || isLocalhost)) {
      throw new MCPAuthProxyError("Only HTTPS URLs are allowed (except localhost)", "INVALID_URL");
    }
  }

  /**
   * Gets authorization URL for OAuth flow (alternative to initiateAuth)
   * @param options OAuth options
   * @returns Authorization URL string
   */
  async getAuthorizationURL(
    options: {
      scope?: string;
      resourceMetadataUrl?: string;
    } = {}
  ): Promise<{ authUrl: string; state: string }> {
    try {
      const authProvider = this.getAuthProvider();
      return await authProvider.authorizationURL(options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new MCPAuthProxyError(
        `Failed to get authorization URL: ${errorMessage}`,
        "AUTH_URL_FAILED"
      );
    }
  }

  /**
   * Completes OAuth flow with authorization code
   * Supports both new persistent flow and legacy state validation
   * @param options OAuth completion options
   * @returns Success status
   */
  async completeOAuthFlow(options: {
    authorizationCode: string;
    state?: string;
    scope?: string;
    resourceMetadataUrl?: string;
  }): Promise<AuthenticationResult> {
    try {
      const authProvider = this.getAuthProvider();

      // State validation (if state is provided - for backward compatibility)
      // if (options.state) {
      //   const providerState = authProvider.state?.() || "";
      //   if (options.state !== providerState) {
      //     throw new OAuthError("Invalid state parameter - possible CSRF attack");
      //   }
      // }

      // Use the NodeOAuthClientProvider's completeAuth method
      await authProvider.completeAuth({
        authorizationCode: options.authorizationCode,
        ...(options.scope && { scope: options.scope }),
        ...(options.resourceMetadataUrl && {
          resourceMetadataUrl: options.resourceMetadataUrl,
        }),
      });

      // Get the saved tokens and client info
      const tokens = await authProvider.tokens();
      if (!tokens) {
        throw new MCPAuthProxyError("No tokens available after OAuth completion", "TOKENS_MISSING");
      }

      const clientInfo = await authProvider.clientInformation();
      const codeVerifier = await authProvider.codeVerifier();

      const storedCredentials = clientInfo
        ? {
            serverUrl: this.config.serverUrl,
            tokens,
            expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
            clientInfo,
            codeVerifier,
          }
        : {};

      // Clear in-memory storage after successful callback
      await globalAuthStorage.clearServerData(this.serverUrlHash);

      return {
        success: true,
        ...storedCredentials,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new MCPAuthProxyError(
        `Failed to complete OAuth flow: ${errorMessage}`,
        "OAUTH_COMPLETION_FAILED"
      );
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}
