import { type StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";

export interface IntegrationTransport {
  client: McpClient;
  transport: StreamableHTTPClientTransport;
  integrationAccountId: string;
  slug: string;
  url: string;
}

export interface SessionTransports {
  mainTransport?: StreamableHTTPServerTransport;
  integrationTransports: Map<string, IntegrationTransport>;
  createdAt: number;
}

/**
 * Manages MCP transports for sessions and integrations
 */
export class TransportManager {
  private static transports = new Map<string, SessionTransports>();

  /**
   * Create or get session transports
   */
  static getOrCreateSession(sessionId: string): SessionTransports {
    let session = this.transports.get(sessionId);

    if (!session) {
      session = {
        integrationTransports: new Map(),
        createdAt: Date.now(),
      };
      this.transports.set(sessionId, session);
    }

    return session;
  }

  /**
   * Set the main server transport for a session
   */
  static setMainTransport(
    sessionId: string,
    transport: StreamableHTTPServerTransport,
  ): void {
    const session = this.getOrCreateSession(sessionId);
    session.mainTransport = transport;

    // Setup cleanup on transport close
    transport.onclose = () => {
      this.cleanupSession(sessionId);
    };
  }

  /**
   * Add an integration transport to a session
   */
  static async addIntegrationTransport(
    sessionId: string,
    integrationAccountId: string,
    slug: string,
    url: string,
    accessToken?: string,
  ): Promise<IntegrationTransport> {
    const session = this.getOrCreateSession(sessionId);

    // Create HTTP transport for the integration
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : {},
      },
    });

    // Create MCP client
    const client = new McpClient({
      name: `core-client-${slug}`,
      version: "1.0.0",
    });

    // Connect client to transport
    await client.connect(transport);

    const integrationTransport: IntegrationTransport = {
      client,
      transport,
      integrationAccountId,
      slug,
      url,
    };

    session.integrationTransports.set(
      integrationAccountId,
      integrationTransport,
    );
    return integrationTransport;
  }

  /**
   * Get integration transport by account ID
   */
  static getIntegrationTransport(
    sessionId: string,
    integrationAccountId: string,
  ): IntegrationTransport | undefined {
    const session = this.transports.get(sessionId);
    return session?.integrationTransports.get(integrationAccountId);
  }

  /**
   * Get all integration transports for a session
   */
  static getSessionIntegrationTransports(
    sessionId: string,
  ): IntegrationTransport[] {
    const session = this.transports.get(sessionId);
    return session ? Array.from(session.integrationTransports.values()) : [];
  }

  /**
   * Remove an integration transport
   */
  static async removeIntegrationTransport(
    sessionId: string,
    integrationAccountId: string,
  ): Promise<void> {
    const session = this.transports.get(sessionId);
    if (!session) return;

    const integrationTransport =
      session.integrationTransports.get(integrationAccountId);
    if (integrationTransport) {
      // Close the transport
      await integrationTransport.transport.close();
      // Remove from map
      session.integrationTransports.delete(integrationAccountId);
    }
  }

  /**
   * Clean up entire session and all its transports
   */
  static async cleanupSession(sessionId: string): Promise<void> {
    const session = this.transports.get(sessionId);
    if (!session) return;

    // Close all integration transports
    for (const [
      accountId,
      integrationTransport,
    ] of session.integrationTransports) {
      try {
        await integrationTransport.transport.close();
      } catch (error) {
        console.error(
          `Error closing integration transport ${accountId}:`,
          error,
        );
      }
    }

    // Close main transport if exists
    if (session.mainTransport) {
      try {
        session.mainTransport.close();
      } catch (error) {
        console.error(
          `Error closing main transport for session ${sessionId}:`,
          error,
        );
      }
    }

    // Remove from map
    this.transports.delete(sessionId);
  }

  /**
   * Get session info
   */
  static getSessionInfo(sessionId: string): {
    exists: boolean;
    integrationCount: number;
    createdAt?: number;
    mainTransport?: StreamableHTTPServerTransport;
  } {
    const session = this.transports.get(sessionId);

    return {
      exists: !!session,
      integrationCount: session?.integrationTransports.size || 0,
      createdAt: session?.createdAt,
      mainTransport: session?.mainTransport,
    };
  }

  /**
   * Clean up old sessions (older than specified time)
   */
  static async cleanupOldSessions(
    maxAgeMs: number = 24 * 60 * 60 * 1000,
  ): Promise<number> {
    const now = Date.now();
    const sessionsToCleanup: string[] = [];

    for (const [sessionId, session] of this.transports) {
      if (now - session.createdAt > maxAgeMs) {
        sessionsToCleanup.push(sessionId);
      }
    }

    for (const sessionId of sessionsToCleanup) {
      await this.cleanupSession(sessionId);
    }

    return sessionsToCleanup.length;
  }

  /**
   * Get all active sessions
   */
  static getActiveSessions(): string[] {
    return Array.from(this.transports.keys());
  }
}
