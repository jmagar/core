import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
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

        // Extract session ID and last event ID from incoming request
        const clientSessionId = request.headers.get("Mcp-Session-Id");
        const lastEventId = request.headers.get("Last-Event-Id");

        // Create remote transport (connects to the MCP server) FIRST
        const serverTransport = await createRemoteTransport(
          credentials.serverUrl,
          credentials,
          config.redirectUrl,
          config.transportStrategy || "sse-first",
          { sessionId: clientSessionId, lastEventId } // Pass both session and event IDs
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

        // Start only the client transport (server is already started)
        await clientTransport.start();
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
    transportStrategy: TransportStrategy = "sse-first",
    clientHeaders?: { sessionId?: string | null; lastEventId?: string | null }
  ): Promise<SSEClientTransport | StreamableHTTPClientTransport | StdioClientTransport> {
    // Create auth provider with stored credentials using common factory
    const authProvider = await createAuthProviderForProxy(serverUrl, credentials, redirectUrl);

    const url = new URL(serverUrl);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.tokens.access_token}`,
      "Content-Type": "application/json",
      ...config.headers,
    };

    // Add session and event headers if provided
    if (clientHeaders?.sessionId) {
      headers["Mcp-Session-Id"] = clientHeaders.sessionId;
    }
    if (clientHeaders?.lastEventId) {
      headers["Last-Event-Id"] = clientHeaders.lastEventId;
    }

    // Create transport based on strategy (don't start yet)
    let transport: SSEClientTransport | StreamableHTTPClientTransport | StdioClientTransport;

    switch (transportStrategy) {
      case "stdio":
        // For stdio transport, serverUrl should contain the command to execute
        // This is mainly for completeness - prefer using createMCPStdioProxy directly
        throw new Error(
          "Stdio transport not supported in createRemoteTransport. Use createMCPStdioProxy instead."
        );

      case "sse-only":
        transport = new SSEClientTransport(url, {
          authProvider,
          requestInit: { headers },
        });
        break;

      case "http-only":
        transport = new StreamableHTTPClientTransport(url, {
          requestInit: { headers },
        });
        break;

      case "sse-first":
        // Try SSE first, fallback to HTTP on error
        try {
          transport = new SSEClientTransport(url, {
            authProvider,
            requestInit: { headers },
          });
        } catch (error) {
          console.warn("SSE transport failed, falling back to HTTP:", error);
          transport = new StreamableHTTPClientTransport(url, {
            requestInit: { headers },
          });
        }
        break;

      case "http-first":
        // Try HTTP first, fallback to SSE on error
        try {
          transport = new StreamableHTTPClientTransport(url, {
            requestInit: { headers },
          });
        } catch (error) {
          console.warn("HTTP transport failed, falling back to SSE:", error);
          transport = new SSEClientTransport(url, {
            authProvider,
            requestInit: { headers },
          });
        }
        break;

      default:
        throw new Error(`Unknown transport strategy: ${transportStrategy}`);
    }

    return transport;
  }
}

/**
 * Creates an MCP proxy that forwards requests to a stdio process.
 * Maintains a mapping of sessionId -> StdioClientTransport for reuse.
 * If sessionId is provided, it is returned in the response header as mcp_session_id.
 * @param request The incoming HTTP request
 * @param command The command to execute for the stdio process
 * @param args Arguments for the command
 * @param options Optional configuration for the proxy
 * @param sessionId Optional session id for transport reuse
 * @returns Promise that resolves to the HTTP response
 */
// Track both the transport and its last used timestamp
type StdioTransportEntry = {
  transport: StdioClientTransport;
  lastUsed: number; // ms since epoch
};

const stdioTransports: Map<string, StdioTransportEntry> = new Map();

/**
 * Cleans up any stdio transports that have not been used in the last 5 minutes.
 * Closes and removes them from the map.
 */
function cleanupOldStdioTransports() {
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  for (const [sessionId, entry] of stdioTransports.entries()) {
    if (now - entry.lastUsed > FIVE_MINUTES) {
      try {
        entry.transport.close?.();
      } catch (err) {
        // ignore
      }
      stdioTransports.delete(sessionId);
    }
  }
}

export function createMCPStdioProxy(
  request: Request,
  command: string,
  args?: string[],
  options?: {
    /** Enable debug logging */
    debug?: boolean;
    /** Environment variables to pass to the process */
    env?: Record<string, string>;
    /** Custom header-to-environment variable mapping */
    headerMapping?: Record<string, string>;
    /** Optional session id for transport reuse */
    sessionId?: string;
  }
): Promise<Response> {
  return new Promise<Response>(async (resolve) => {
    let bridge: any = null;
    let serverTransport: StdioClientTransport | undefined;
    let sessionId: string | undefined =
      options?.sessionId || request.headers.get("Mcp-Session-Id") || undefined;

    // Clean up old transports before handling new connection
    cleanupOldStdioTransports();

    try {
      // Extract headers from the incoming request and convert to environment variables
      const env = createEnvironmentFromRequest(
        request,
        options?.env || {},
        options?.headerMapping || {}
      );

      // If sessionId is provided, try to reuse the transport
      let entry: StdioTransportEntry | undefined;
      if (sessionId) {
        entry = stdioTransports.get(sessionId);
        if (entry) {
          serverTransport = entry.transport;
          entry.lastUsed = Date.now();
        }
      }

      // If no transport exists for this sessionId, create a new one and store it
      if (!serverTransport) {
        serverTransport = new StdioClientTransport({
          command,
          args: args || [],
          env,
        });
        await serverTransport.start();
        if (sessionId) {
          stdioTransports.set(sessionId, {
            transport: serverTransport,
            lastUsed: Date.now(),
          });
        }
      }

      // Create Remix transport (converts HTTP to MCP messages)
      // We need to wrap resolve to inject the sessionId header if present
      const resolveWithSessionId = (response: Response) => {
        if (sessionId) {
          // Clone the response and add the mcp_session_id header
          const headers = new Headers(response.headers);
          headers.set("mcp-session-id", sessionId);
          resolve(
            new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            })
          );
        } else {
          resolve(response);
        }
      };

      const clientTransport = new RemixMCPTransport(request, resolveWithSessionId);

      // Bridge the transports
      const bridgeOptions: any = {
        debug: options?.debug || false,
        onError: (error: Error, source: string) => {
          console.error(`[MCP Stdio Bridge] ${source} error:`, error);
        },
      };

      if (options?.debug) {
        bridgeOptions.onMessage = (direction: string, message: any) => {
          console.log(`[MCP Stdio Bridge] ${direction}:`, message.method || message.id);
        };
      }

      bridge = createMCPTransportBridge(
        clientTransport as any,
        serverTransport as any,
        bridgeOptions
      );

      // Start only the client transport (server is already started)
      await clientTransport.start();
    } catch (error) {
      console.error("MCP Stdio Proxy Error:", error);

      if (bridge) {
        bridge.close().catch(console.error);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      // Always include mcp_session_id header if sessionId is present
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionId) {
        headers["mcp-session-id"] = sessionId;
      }
      resolve(
        new Response(
          JSON.stringify({
            error: `Stdio proxy error: ${errorMessage}`,
          }),
          {
            status: 500,
            headers,
          }
        )
      );
    }
  });
}

/**
 * Creates environment variables from request headers
 */
function createEnvironmentFromRequest(
  request: Request,
  baseEnv: Record<string, string>,
  headerMapping: Record<string, string>
): Record<string, string> {
  // Start with base environment (inherit safe environment variables)
  const env: Record<string, string> = {
    ...getDefaultEnvironment(),
    ...baseEnv,
  };

  // Add standard MCP headers as environment variables
  const sessionId = request.headers.get("Mcp-Session-Id");
  const lastEventId = request.headers.get("Last-Event-Id");
  const contentType = request.headers.get("Content-Type");
  const userAgent = request.headers.get("User-Agent");

  if (sessionId) {
    env["MCP_SESSION_ID"] = sessionId;
  }
  if (lastEventId) {
    env["MCP_LAST_EVENT_ID"] = lastEventId;
  }
  if (contentType) {
    env["MCP_CONTENT_TYPE"] = contentType;
  }
  if (userAgent) {
    env["MCP_USER_AGENT"] = userAgent;
  }

  // Apply custom header-to-environment variable mapping
  for (const [headerName, envVarName] of Object.entries(headerMapping)) {
    const headerValue = request.headers.get(headerName);
    if (headerValue) {
      env[envVarName] = headerValue;
    }
  }

  return env;
}

/**
 * Returns a default environment object including only environment variables deemed safe to inherit.
 */
function getDefaultEnvironment(): Record<string, string> {
  const DEFAULT_INHERITED_ENV_VARS =
    process.platform === "win32"
      ? [
          "APPDATA",
          "HOMEDRIVE",
          "HOMEPATH",
          "LOCALAPPDATA",
          "PATH",
          "PROCESSOR_ARCHITECTURE",
          "SYSTEMDRIVE",
          "SYSTEMROOT",
          "TEMP",
          "USERNAME",
          "USERPROFILE",
        ]
      : ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"];

  const env: Record<string, string> = {};

  for (const key of DEFAULT_INHERITED_ENV_VARS) {
    const value = process.env[key];
    if (value === undefined) {
      continue;
    }

    if (value.startsWith("()")) {
      // Skip functions, which are a security risk.
      continue;
    }

    env[key] = value;
  }

  return env;
}

export class MCPAuthenticationClient {
  private serverUrlHash: string;
  private authProvider: NodeOAuthClientProvider | null = null;
  private client: Client | null = null;

  constructor(private config: MCPRemoteClientConfig) {
    this.serverUrlHash = getServerUrlHash(config.serverUrl);

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
