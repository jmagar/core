export class MCPAuthProxyError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'MCPAuthProxyError'
  }
}

export class InvalidCredentialsError extends MCPAuthProxyError {
  constructor() {
    super('Invalid or expired credentials', 'INVALID_CREDENTIALS')
  }
}

export class OAuthError extends MCPAuthProxyError {
  constructor(message: string) {
    super(message, 'OAUTH_ERROR')
  }
}

export class ProxyError extends MCPAuthProxyError {
  constructor(message: string) {
    super(message, 'PROXY_ERROR')
  }
}

export class TransportError extends MCPAuthProxyError {
  constructor(message: string) {
    super(message, 'TRANSPORT_ERROR')
  }
}