import { OAuthTokens, OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

/**
 * Configuration for MCP Remote Client authentication
 */
export interface MCPRemoteClientConfig {
  /** The MCP server URL (e.g., https://mcp.linear.com/sse) */
  serverUrl: string;

  /** Host for OAuth callback (default: localhost) */
  redirectUrl: string;

  /** Client name for OAuth registration */
  clientName?: string;

  /** Additional headers to send with requests */
  headers?: Record<string, string>;

  /** Transport strategy for connection */
  transportStrategy?: TransportStrategy;

  /** Static OAuth client metadata if using pre-registered client */
  staticOAuthClientMetadata?: StaticOAuthClientMetadata;

  /** Static OAuth client information if using pre-registered client */
  staticOAuthClientInfo?: StaticOAuthClientInformationFull;

  /** Resource to authorize (optional) */
  authorizeResource?: string;
}

/**
 * Configuration for MCP Proxy connection
 */
export interface ProxyConnectionConfig {
  /** The MCP server URL to proxy to */
  serverUrl: string;

  /** Additional headers to send with requests */
  headers?: Record<string, string>;

  /** Transport strategy (sse-first, http-first, sse-only, http-only) */
  transportStrategy?: TransportStrategy;

  redirectUrl: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Transport strategy options
 */
export type TransportStrategy = "sse-only" | "http-only" | "sse-first" | "http-first";

/**
 * Static OAuth client metadata
 */
export type StaticOAuthClientMetadata = Record<string, any> | null;

/**
 * Static OAuth client information
 */
export type StaticOAuthClientInformationFull = Record<string, any> | null;

/**
 * Stored credential data that gets passed to the callback
 */
export interface StoredCredentials {
  /** The MCP server URL these credentials are for */
  serverUrl: string;

  /** OAuth tokens */
  tokens: OAuthTokens;

  /** When the tokens expire */
  expiresAt: Date;

  /** OAuth client information (optional, for reuse) */
  clientInfo?: OAuthClientInformationFull;

  /** PKCE code verifier (optional, for debugging) */
  codeVerifier?: string;
}

/**
 * Minimal credential data needed for proxy operations
 */
export interface ProxyCredentials {
  /** The MCP server URL these credentials are for */
  serverUrl: string;

  /** OAuth tokens */
  tokens: OAuthTokens;

  /** When the tokens expire */
  expiresAt: Date;
}

/**
 * Result of authentication process
 */
export interface AuthenticationResult {
  /** Whether authentication was successful */
  success: boolean;

  /** Error message if authentication failed */
  error?: string;

  serverUrl?: string;

  /** OAuth tokens */
  tokens?: OAuthTokens;

  /** When the tokens expire */
  expiresAt?: Date;

  /** OAuth client information (optional, for reuse) */
  clientInfo?: OAuthClientInformationFull;

  /** PKCE code verifier (optional, for debugging) */
  codeVerifier?: string;
}

/**
 * Callback function type for saving credentials to your database
 * @param credentials The credentials to save
 * @returns Promise that resolves when credentials are saved
 */
export type CredentialSaveCallback = (credentials: StoredCredentials) => Promise<void>;

/**
 * Callback function type for loading credentials from your database
 * @param userApiKey The user's API key
 * @param serverUrl The MCP server URL to get credentials for
 * @returns Promise that resolves to proxy credentials or null if not found
 */
export type CredentialLoadCallback = (
  userApiKey: string,
  serverUrl: string
) => Promise<ProxyCredentials | null>;

/**
 * OAuth flow initiation result
 */
export interface OAuthFlowResult {
  /** Authorization URL to redirect user to */
  authUrl: string;

  /** State parameter for OAuth flow (save this for step 2) */
  state: string;
}

/**
 * OAuth callback data received from the authorization server
 */
export interface OAuthCallbackData {
  /** Authorization code from OAuth callback */
  code: string;

  /** State parameter from OAuth callback (must match initiation) */
  state: string;
}

/**
 * MCP message format for transport
 */
export interface MCPMessage {
  /** HTTP method */
  method: string;

  /** Request headers */
  headers: Record<string, string>;

  /** Request body (parsed JSON) */
  body?: any;

  /** Request URL */
  url: string;
}

/**
 * MCP response format
 */
export interface MCPResponse {
  /** Response status code */
  status?: number;

  /** Response headers */
  headers?: Record<string, string>;

  /** Response body */
  body?: any;
}

/**
 * Error types that can be thrown by the MCP client
 */
export interface MCPClientError {
  /** Error message */
  message: string;

  /** Error code */
  code: string;

  /** Original error if available */
  originalError?: Error;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  /** Whether the connection test passed */
  success: boolean;

  /** Error message if test failed */
  error?: string;

  /** Additional details about the test */
  details?: Record<string, any>;
}

/**
 * Proxy handler configuration
 */
export interface ProxyHandlerConfig {
  /** Maximum number of concurrent connections */
  maxConnections?: number;

  /** Connection pool timeout */
  poolTimeout?: number;

  /** Enable request/response logging */
  enableLogging?: boolean;

  /** Custom error handler */
  errorHandler?: (error: Error, request: Request) => Response;
}

/**
 * Transport connection info
 */
export interface TransportConnection {
  /** Connection ID */
  id: string;

  /** Server URL */
  serverUrl: string;

  /** Transport type used */
  transportType: "sse" | "http";

  /** When connection was established */
  connectedAt: Date;

  /** Last activity timestamp */
  lastActivity: Date;

  /** Connection status */
  status: "connected" | "disconnected" | "error";
}

/**
 * MCP Proxy function type
 */
export type MCPProxyFunction = (request: Request, userApiKey: string) => Promise<Response>;
