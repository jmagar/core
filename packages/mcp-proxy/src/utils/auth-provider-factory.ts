import { NodeOAuthClientProvider } from "../lib/node-oauth-client-provider.js";
import { MCPRemoteClientConfig, StoredCredentials } from "../types/remote-client.js";

/**
 * Configuration for creating an auth provider
 */
export interface AuthProviderConfig {
  serverUrl: string;
  redirectUrl: string;
  clientName?: string | undefined;
  staticOAuthClientMetadata?: any;
  staticOAuthClientInfo?: any;
  authorizeResource?: string | undefined;
}

/**
 * Creates a NodeOAuthClientProvider instance for authentication flows
 * This is the common factory used by both MCPAuthenticationClient and createMCPProxy
 */
export function createAuthProvider(config: AuthProviderConfig): NodeOAuthClientProvider {
  return new NodeOAuthClientProvider({
    serverUrl: config.serverUrl,
    redirectUrl: config.redirectUrl,
    clientName: config.clientName || "CORE",
    staticOAuthClientMetadata: config.staticOAuthClientMetadata || null,
    staticOAuthClientInfo: config.staticOAuthClientInfo || null,
    ...(config.authorizeResource !== undefined
      ? { authorizeResource: config.authorizeResource }
      : {}),
  });
}

/**
 * Creates an auth provider for proxy use with existing credentials
 * This sets up the provider with stored credentials for transport usage
 */
export async function createAuthProviderForProxy(
  serverUrl: string,
  credentials: StoredCredentials,
  redirectUrl: string
): Promise<NodeOAuthClientProvider> {
  const authProvider = createAuthProvider({
    serverUrl,
    redirectUrl,
    clientName: "CORE",
  });

  // Load the existing credentials
  await authProvider.saveTokens(credentials.tokens);
  if (credentials.clientInfo) {
    await authProvider.saveClientInformation(credentials.clientInfo);
  }
  if (credentials.codeVerifier) {
    await authProvider.saveCodeVerifier(credentials.codeVerifier);
  }

  return authProvider;
}

/**
 * Creates an auth provider from MCPRemoteClientConfig
 * This is used by MCPAuthenticationClient
 */
export function createAuthProviderFromConfig(
  config: MCPRemoteClientConfig
): NodeOAuthClientProvider {
  return createAuthProvider({
    serverUrl: config.serverUrl,
    redirectUrl: config.redirectUrl,
    clientName: config.clientName,
    staticOAuthClientMetadata: config.staticOAuthClientMetadata,
    staticOAuthClientInfo: config.staticOAuthClientInfo,
    authorizeResource: config.authorizeResource,
  });
}
