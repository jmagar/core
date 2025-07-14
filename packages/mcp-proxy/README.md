# MCP Auth Proxy

A simplified, callback-based authentication and proxy library for Model Context Protocol (MCP) servers with OAuth support.

## Features

- **🔐 OAuth Authentication**: Handle OAuth flows for any MCP server
- **📦 In-Memory Processing**: No file storage - everything through callbacks
- **🔄 Generic Server Support**: Works with any MCP server URL
- **⚡ Transport Flexibility**: Supports both SSE and HTTP transports
- **🛡️ Callback-Based Storage**: You control how credentials are saved/loaded
- **🧹 Self-Contained**: No external dependencies on other packages

## Installation

```bash
npm install mcp-auth-proxy
```

## Quick Start

### 1. Authentication (Two-Step Process)

```typescript
import { createMCPAuthClient } from 'mcp-auth-proxy'

const authClient = createMCPAuthClient(
  {
    serverUrl: 'https://mcp.example.com/sse',
    clientName: 'My App'
  },
  // Callback to save credentials to your database
  async (credentials) => {
    await db.saveCredentials({
      serverUrl: credentials.serverUrl,
      accessToken: credentials.tokens.access_token,
      refreshToken: credentials.tokens.refresh_token,
      expiresAt: credentials.expiresAt
    })
  }
)

// Step 1: Get authorization URL
const authFlow = await authClient.initiateAuth()
console.log('Redirect user to:', authFlow.authUrl)
// Save authFlow.state - you'll need it for step 2

// Step 2: Complete authentication (in your OAuth callback route)
const result = await authClient.completeAuth({
  code: 'code_from_oauth_callback',
  state: authFlow.state  // Must match from step 1
})
```

### 2. Proxy

```typescript
import { createMCPProxy } from 'mcp-auth-proxy'

const mcpProxy = createMCPProxy(
  {
    serverUrl: 'https://mcp.example.com/sse'
  },
  // Callback to load credentials from your database
  async (userApiKey, serverUrl) => {
    const creds = await db.getCredentials(userApiKey, serverUrl)
    return creds ? {
      serverUrl: creds.serverUrl,
      tokens: {
        access_token: creds.accessToken,
        refresh_token: creds.refreshToken,
        token_type: 'Bearer',
        expires_in: Math.floor((creds.expiresAt.getTime() - Date.now()) / 1000)
      },
      expiresAt: creds.expiresAt
    } : null
  }
)

// Use in your API route
export async function POST(request: Request) {
  const userApiKey = getUserApiKey(request)
  return await mcpProxy(request, userApiKey)
}
```

## API Reference

### `createMCPAuthClient(config, onCredentialSave)`

Creates an authentication client for OAuth flows.

**Parameters:**
- `config: MCPRemoteClientConfig` - Configuration for the MCP server
- `onCredentialSave: (credentials: StoredCredentials) => Promise<void>` - Callback to save credentials

**Returns:** `MCPAuthenticationClient`

### `createMCPProxy(config, onCredentialLoad)`

Creates a proxy function for forwarding requests to MCP servers.

**Parameters:**
- `config: ProxyConnectionConfig` - Configuration for the proxy
- `onCredentialLoad: (userApiKey: string, serverUrl: string) => Promise<ProxyCredentials | null>` - Callback to load credentials

**Returns:** `MCPProxyFunction`

## Configuration Options

### MCPRemoteClientConfig

```typescript
interface MCPRemoteClientConfig {
  serverUrl: string                    // MCP server URL
  clientName?: string                  // OAuth client name
  callbackPort?: number               // OAuth callback port
  host?: string                       // Callback host (default: localhost)
  transportStrategy?: TransportStrategy // 'sse-first' | 'http-first' | 'sse-only' | 'http-only'
  headers?: Record<string, string>    // Additional headers
}
```

### ProxyConnectionConfig

```typescript
interface ProxyConnectionConfig {
  serverUrl: string                    // MCP server URL
  transportStrategy?: TransportStrategy // Transport preference
  timeout?: number                    // Request timeout (default: 30000ms)
  headers?: Record<string, string>    // Additional headers
}
```

## Error Handling

```typescript
import { 
  MCPAuthProxyError,
  InvalidCredentialsError,
  OAuthError,
  TransportError 
} from 'mcp-auth-proxy'

try {
  await authClient.authenticate()
} catch (error) {
  if (error instanceof OAuthError) {
    console.log('OAuth flow failed:', error.message)
  } else if (error instanceof TransportError) {
    console.log('Connection failed:', error.message)
  }
}
```

## Examples

- [Remix Integration](./REMIX_INTEGRATION.md) - Complete Remix.run integration guide
- [Simple Usage](./examples/simple-usage.ts) - Basic usage examples

## License

MIT