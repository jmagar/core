import { prisma } from "~/db.server";

export interface MCPSessionData {
  id: string;
  source: string;
  integrations: string[];
  createdAt: Date;
  deleted?: Date;
  workspaceId?: string;
}

export class MCPSessionManager {
  /**
   * Create or update an MCP session
   */
  static async upsertSession(
    sessionId: string,
    workspaceId: string,
    source: string,
    integrations: string[],
  ): Promise<MCPSessionData> {
    // Try to find existing session
    let session = await prisma.mCPSession.findUnique({
      where: { id: sessionId },
    });

    if (session) {
      // Update existing session
      session = await prisma.mCPSession.update({
        where: { id: sessionId },
        data: {
          source,
          integrations,
          workspaceId,
        },
      });
    } else {
      // Create new session
      session = await prisma.mCPSession.create({
        data: {
          id: sessionId,
          source,
          integrations,
          workspaceId,
        },
      });
    }

    return {
      id: session.id,
      source: session.source,
      integrations: session.integrations,
      createdAt: session.createdAt,
      workspaceId: session.workspaceId as string,
      deleted: session.deleted || undefined,
    };
  }

  /**
   * Mark a session as deleted
   */
  static async deleteSession(sessionId: string): Promise<void> {
    await prisma.mCPSession.update({
      where: { id: sessionId },
      data: {
        deleted: new Date(),
      },
    });
  }

  /**
   * Get session data
   */
  static async getSession(sessionId: string): Promise<MCPSessionData | null> {
    const session = await prisma.mCPSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return null;

    return {
      id: session.id,
      source: session.source,
      integrations: session.integrations,
      noIntegrations: session.noIntegrations,
      createdAt: session.createdAt,
      deleted: session.deleted || undefined,
      workspaceId: session.workspaceId || undefined,
    };
  }

  /**
   * Get all active sessions (not deleted)
   */
  static async getActiveSessions(): Promise<MCPSessionData[]> {
    const sessions = await prisma.mCPSession.findMany({
      where: {
        deleted: null,
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      source: session.source,
      integrations: session.integrations,
      createdAt: session.createdAt,
    }));
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  static async cleanupOldSessions(workspaceId: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.mCPSession.updateMany({
      where: {
        createdAt: { lt: twentyFourHoursAgo },
        deleted: null,
        workspaceId,
      },
      data: {
        deleted: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Check if session is active (not deleted)
   */
  static async isSessionActive(
    sessionId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const session = await prisma.mCPSession.findUnique({
      where: { id: sessionId, workspaceId },
      select: { deleted: true },
    });

    return session ? !session.deleted : false;
  }
}
