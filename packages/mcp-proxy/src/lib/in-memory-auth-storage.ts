import {
  OAuthTokens,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * In-memory storage for OAuth data during authentication flow
 * with automatic persistence to temp files as fallback
 */
export class InMemoryAuthStorage {
  private clientInfo = new Map<string, OAuthClientInformationFull>();
  private tokens = new Map<string, OAuthTokens>();
  private codeVerifiers = new Map<string, string>();
  private states = new Map<string, any>();
  private tempDir: string;

  constructor() {
    this.tempDir = join(tmpdir(), "mcp-auth-proxy");
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private getTempFilePath(serverUrlHash: string, type: string): string {
    return join(this.tempDir, `${serverUrlHash}_${type}.json`);
  }

  private saveTempFile(serverUrlHash: string, type: string, data: any): void {
    try {
      const filePath = this.getTempFilePath(serverUrlHash, type);
      writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
      console.warn(`Failed to save temp file for ${type}:`, error);
    }
  }

  private loadTempFile<T>(serverUrlHash: string, type: string): T | null {
    try {
      const filePath = this.getTempFilePath(serverUrlHash, type);
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, "utf8");
        return JSON.parse(data) as T;
      }
    } catch (error) {
      console.warn(`Failed to load temp file for ${type}:`, error);
    }
    return null;
  }

  private deleteTempFile(serverUrlHash: string, type: string): void {
    try {
      const filePath = this.getTempFilePath(serverUrlHash, type);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`Failed to delete temp file for ${type}:`, error);
    }
  }

  // Client Information
  async saveClientInformation(
    serverUrlHash: string,
    clientInformation: OAuthClientInformationFull
  ): Promise<void> {
    this.clientInfo.set(serverUrlHash, clientInformation);
    this.saveTempFile(serverUrlHash, "clientInfo", clientInformation);
  }

  async getClientInformation(
    serverUrlHash: string
  ): Promise<OAuthClientInformationFull | undefined> {
    let clientInfo = this.clientInfo.get(serverUrlHash);
    if (!clientInfo) {
      // Try to load from temp file
      clientInfo = this.loadTempFile<OAuthClientInformationFull>(
        serverUrlHash,
        "clientInfo"
      ) as any;
      if (clientInfo) {
        this.clientInfo.set(serverUrlHash, clientInfo);
      }
    }
    return clientInfo || undefined;
  }

  // OAuth Tokens
  async saveTokens(serverUrlHash: string, tokens: OAuthTokens): Promise<void> {
    this.tokens.set(serverUrlHash, tokens);
    this.saveTempFile(serverUrlHash, "tokens", tokens);
  }

  async getTokens(serverUrlHash: string): Promise<OAuthTokens | null> {
    let tokens = this.tokens.get(serverUrlHash);
    if (!tokens) {
      // Try to load from temp file
      tokens = this.loadTempFile<OAuthTokens>(serverUrlHash, "tokens") as any;
      if (tokens) {
        this.tokens.set(serverUrlHash, tokens);
      }
    }
    return tokens || null;
  }

  // Code Verifiers (PKCE)
  async saveCodeVerifier(
    serverUrlHash: string,
    codeVerifier: string
  ): Promise<void> {
    this.codeVerifiers.set(serverUrlHash, codeVerifier);
    this.saveTempFile(serverUrlHash, "codeVerifier", codeVerifier);
  }

  async getCodeVerifier(serverUrlHash: string): Promise<string | null> {
    let codeVerifier = this.codeVerifiers.get(serverUrlHash);
    if (!codeVerifier) {
      // Try to load from temp file
      codeVerifier = this.loadTempFile<string>(
        serverUrlHash,
        "codeVerifier"
      ) as string;
      if (codeVerifier) {
        this.codeVerifiers.set(serverUrlHash, codeVerifier);
      }
    }
    return codeVerifier || null;
  }

  // OAuth States
  async saveState(state: string, data: any): Promise<void> {
    this.states.set(state, data);
    this.saveTempFile(state, "state", data);
  }

  async getState(state: string): Promise<any | null> {
    let stateData = this.states.get(state);
    if (!stateData) {
      // Try to load from temp file
      stateData = this.loadTempFile<any>(state, "state");
      if (stateData) {
        this.states.set(state, stateData);
      }
    }
    return stateData || null;
  }

  async deleteState(state: string): Promise<void> {
    this.states.delete(state);
    this.deleteTempFile(state, "state");
  }

  // Cleanup methods
  async invalidateCredentials(
    serverUrlHash: string,
    scope: "all" | "client" | "tokens" | "verifier"
  ): Promise<void> {
    switch (scope) {
      case "all":
        this.clientInfo.delete(serverUrlHash);
        this.tokens.delete(serverUrlHash);
        this.codeVerifiers.delete(serverUrlHash);
        this.deleteTempFile(serverUrlHash, "clientInfo");
        this.deleteTempFile(serverUrlHash, "tokens");
        this.deleteTempFile(serverUrlHash, "codeVerifier");
        break;
      case "client":
        this.clientInfo.delete(serverUrlHash);
        this.deleteTempFile(serverUrlHash, "clientInfo");
        break;
      case "tokens":
        this.tokens.delete(serverUrlHash);
        this.deleteTempFile(serverUrlHash, "tokens");
        break;
      case "verifier":
        this.codeVerifiers.delete(serverUrlHash);
        this.deleteTempFile(serverUrlHash, "codeVerifier");
        break;
    }
  }

  // Get all stored data for a server (useful for the callback)
  async getAllDataForServer(serverUrlHash: string): Promise<{
    clientInfo: OAuthClientInformationFull | undefined;
    tokens: OAuthTokens | undefined;
    codeVerifier: string | undefined;
  }> {
    return {
      clientInfo: this.clientInfo.get(serverUrlHash),
      tokens: this.tokens.get(serverUrlHash),
      codeVerifier: this.codeVerifiers.get(serverUrlHash),
    };
  }

  // Clear all data for a server
  async clearServerData(serverUrlHash: string): Promise<void> {
    this.clientInfo.delete(serverUrlHash);
    this.tokens.delete(serverUrlHash);
    this.codeVerifiers.delete(serverUrlHash);
    this.deleteTempFile(serverUrlHash, "clientInfo");
    this.deleteTempFile(serverUrlHash, "tokens");
    this.deleteTempFile(serverUrlHash, "codeVerifier");
  }

  // Clear all data
  async clearAll(): Promise<void> {
    this.clientInfo.clear();
    this.tokens.clear();
    this.codeVerifiers.clear();
    this.states.clear();

    // Clear all temp files
    try {
      if (existsSync(this.tempDir)) {
        const files = readdirSync(this.tempDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            unlinkSync(join(this.tempDir, file));
          }
        }
      }
    } catch (error) {
      console.warn("Failed to clear temp files:", error);
    }
  }
}

// Lockfile management
export interface LockfileData {
  pid: number;
  port: number;
  timestamp: number;
}

class InMemoryLockManager {
  private locks = new Map<string, LockfileData>();

  async createLockfile(
    serverUrlHash: string,
    pid: number,
    port: number
  ): Promise<void> {
    this.locks.set(serverUrlHash, {
      pid,
      port,
      timestamp: Date.now(),
    });
  }

  async checkLockfile(serverUrlHash: string): Promise<LockfileData | null> {
    return this.locks.get(serverUrlHash) || null;
  }

  async deleteLockfile(serverUrlHash: string): Promise<void> {
    this.locks.delete(serverUrlHash);
  }

  async clearAll(): Promise<void> {
    this.locks.clear();
  }
}

// Global instances
export const globalAuthStorage = new InMemoryAuthStorage();
export const globalLockManager = new InMemoryLockManager();
