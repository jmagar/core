import { LockfileData, globalLockManager } from "./in-memory-auth-storage.js";
import { EventEmitter } from "events";
import { log, debugLog, DEBUG } from "./utils.js";
import { Server } from "http";

export type AuthCoordinator = {
  initializeAuth: () => Promise<{
    server: any;
    waitForAuthCode: () => Promise<string>;
    skipBrowserAuth: boolean;
  }>;
};

/**
 * Checks if a process with the given PID is running
 */
export async function isPidRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0); // Doesn't kill the process, just checks if it exists
    if (DEBUG) debugLog(`Process ${pid} is running`);
    return true;
  } catch (err) {
    if (DEBUG) debugLog(`Process ${pid} is not running`, err);
    return false;
  }
}

/**
 * Checks if a lockfile is valid (process running and endpoint accessible)
 */
export async function isLockValid(lockData: LockfileData): Promise<boolean> {
  if (DEBUG) debugLog("Checking if lockfile is valid", lockData);

  // Check if the lockfile is too old (over 30 minutes)
  const MAX_LOCK_AGE = 30 * 60 * 1000; // 30 minutes
  if (Date.now() - lockData.timestamp > MAX_LOCK_AGE) {
    log("Lockfile is too old");
    if (DEBUG)
      debugLog("Lockfile is too old", {
        age: Date.now() - lockData.timestamp,
        maxAge: MAX_LOCK_AGE,
      });
    return false;
  }

  // Check if the process is still running
  if (!(await isPidRunning(lockData.pid))) {
    log("Process from lockfile is not running");
    if (DEBUG)
      debugLog("Process from lockfile is not running", { pid: lockData.pid });
    return false;
  }

  // Check if the endpoint is accessible
  try {
    if (DEBUG)
      debugLog("Checking if endpoint is accessible", { port: lockData.port });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(
      `http://127.0.0.1:${lockData.port}/wait-for-auth?poll=false`,
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    const isValid = response.status === 200 || response.status === 202;
    if (DEBUG)
      debugLog(`Endpoint check result: ${isValid ? "valid" : "invalid"}`, {
        status: response.status,
      });
    return isValid;
  } catch (error) {
    log(`Error connecting to auth server: ${(error as Error).message}`);
    if (DEBUG) debugLog("Error connecting to auth server", error);
    return false;
  }
}

/**
 * Waits for authentication from another server instance
 */
export async function waitForAuthentication(port: number): Promise<boolean> {
  log(`Waiting for authentication from the server on port ${port}...`);

  try {
    let attempts = 0;
    while (true) {
      attempts++;
      const url = `http://127.0.0.1:${port}/wait-for-auth`;
      log(`Querying: ${url}`);
      if (DEBUG) debugLog(`Poll attempt ${attempts}`);

      try {
        const response = await fetch(url);
        if (DEBUG) debugLog(`Poll response status: ${response.status}`);

        if (response.status === 200) {
          // Auth completed, but we don't return the code anymore
          log(`Authentication completed by other instance`);
          return true;
        } else if (response.status === 202) {
          // Continue polling
          log(`Authentication still in progress`);
          if (DEBUG) debugLog(`Will retry in 1s`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          log(`Unexpected response status: ${response.status}`);
          return false;
        }
      } catch (fetchError) {
        if (DEBUG) debugLog(`Fetch error during poll`, fetchError);
        // If we can't connect, we'll try again after a delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    log(`Error waiting for authentication: ${(error as Error).message}`);
    if (DEBUG) debugLog(`Error waiting for authentication`, error);
    return false;
  }
}

/**
 * Creates a lazy auth coordinator that will only initiate auth when needed
 */
export function createLazyAuthCoordinator(
  serverUrlHash: string,
  callbackPort: number,
  events: EventEmitter
): AuthCoordinator {
  let authState: {
    server: Server;
    waitForAuthCode: () => Promise<string>;
    skipBrowserAuth: boolean;
  } | null = null;

  return {
    initializeAuth: async () => {
      // If auth has already been initialized, return the existing state
      if (authState) {
        if (DEBUG) debugLog("Auth already initialized, reusing existing state");
        return authState;
      }

      log("Initializing auth coordination on-demand");
      if (DEBUG)
        debugLog("Initializing auth coordination on-demand", {
          serverUrlHash,
          callbackPort,
        });

      // Initialize auth using the existing coordinateAuth logic
      authState = await coordinateAuth(serverUrlHash, callbackPort, events);
      if (DEBUG)
        debugLog("Auth coordination completed", {
          skipBrowserAuth: authState.skipBrowserAuth,
        });
      return authState;
    },
  };
}

/**
 * Coordinates authentication between multiple instances of the client/proxy
 */
export async function coordinateAuth(
  serverUrlHash: string,
  callbackPort: number,
  events: EventEmitter
): Promise<{
  server: Server;
  waitForAuthCode: () => Promise<string>;
  skipBrowserAuth: boolean;
}> {
  if (DEBUG)
    debugLog("Coordinating authentication", { serverUrlHash, callbackPort });

  // Check for a lockfile (disabled on Windows for the time being)
  const lockData =
    process.platform === "win32"
      ? null
      : await globalLockManager.checkLockfile(serverUrlHash);

  if (DEBUG) {
    if (process.platform === "win32") {
      debugLog("Skipping lockfile check on Windows");
    } else {
      debugLog("Lockfile check result", { found: !!lockData, lockData });
    }
  }

  // If there's a valid lockfile, try to use the existing auth process
  if (lockData && (await isLockValid(lockData))) {
    log(
      `Another instance is handling authentication on port ${lockData.port} (pid: ${lockData.pid})`
    );

    try {
      // Try to wait for the authentication to complete
      if (DEBUG) debugLog("Waiting for authentication from other instance");
      const authCompleted = await waitForAuthentication(lockData.port);

      if (authCompleted) {
        log(
          "Authentication completed by another instance. Using tokens from disk"
        );

        // OAuth handled externally, no server needed for secondary instance
        if (DEBUG) debugLog("Secondary instance, OAuth handled externally");

        // This shouldn't actually be called in normal operation, but provide it for API compatibility
        const dummyWaitForAuthCode = () => {
          log(
            "WARNING: waitForAuthCode called in secondary instance - this is unexpected"
          );
          // Return a promise that never resolves - the client should use the tokens from disk instead
          return new Promise<string>(() => {});
        };

        return {
          server: null as any, // OAuth handled externally
          waitForAuthCode: dummyWaitForAuthCode,
          skipBrowserAuth: true,
        };
      } else {
        log("Taking over authentication process...");
      }
    } catch (error) {
      log(`Error waiting for authentication: ${error}`);
      if (DEBUG) debugLog("Error waiting for authentication", error);
    }

    // If we get here, the other process didn't complete auth successfully
    if (DEBUG)
      debugLog(
        "Other instance did not complete auth successfully, deleting lockfile"
      );
    await globalLockManager.deleteLockfile(serverUrlHash);
  } else if (lockData) {
    // Invalid lockfile, delete it
    log("Found invalid lockfile, deleting it");
    await globalLockManager.deleteLockfile(serverUrlHash);
  }

  // OAuth callback is handled externally, no need for internal server
  if (DEBUG)
    debugLog("OAuth handled externally, skipping server setup", {
      port: callbackPort,
    });

  // Use the provided callback port directly
  const actualPort = callbackPort;
  if (DEBUG)
    debugLog("Using external OAuth callback port", { port: actualPort });

  log(
    `Creating lockfile for server ${serverUrlHash} with process ${process.pid} on port ${actualPort}`
  );
  await globalLockManager.createLockfile(
    serverUrlHash,
    process.pid,
    actualPort
  );

  // Dummy function since OAuth callback is handled externally
  const waitForAuthCode = (): Promise<string> => {
    log("OAuth callback should be handled externally (e.g., by Remix)");
    return Promise.reject(
      new Error("OAuth callback should be handled externally")
    );
  };

  // Make sure lockfile is deleted on process exit
  const cleanupHandler = async () => {
    try {
      log(`Cleaning up lockfile for server ${serverUrlHash}`);
      await globalLockManager.deleteLockfile(serverUrlHash);
    } catch (error) {
      log(`Error cleaning up lockfile: ${error}`);
      if (DEBUG) debugLog("Error cleaning up lockfile", error);
    }
  };

  process.once("exit", () => {
    try {
      // Synchronous cleanup for in-memory storage
      globalLockManager.deleteLockfile(serverUrlHash);
      if (DEBUG)
        console.error(`[DEBUG] Removed lockfile on exit for: ${serverUrlHash}`);
    } catch (error) {
      if (DEBUG)
        console.error(`[DEBUG] Error removing lockfile on exit:`, error);
    }
  });

  // Also handle SIGINT separately
  process.once("SIGINT", async () => {
    if (DEBUG) debugLog("Received SIGINT signal, cleaning up");
    await cleanupHandler();
  });

  if (DEBUG)
    debugLog("Auth coordination complete, returning primary instance handlers");
  return {
    server: null as any, // OAuth callback handled externally
    waitForAuthCode,
    skipBrowserAuth: false,
  };
}
