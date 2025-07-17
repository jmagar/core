import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * Creates a bidirectional bridge between two MCP transports
 * Similar to the mcpProxy function in mcp-remote but for any transport pair
 */
export function createMCPTransportBridge(
  clientTransport: Transport,
  serverTransport: Transport,
  options: {
    debug?: boolean;
    onMessage?: (direction: "client-to-server" | "server-to-client", message: any) => void;
    onError?: (error: Error, source: "client" | "server") => void;
  } = {}
) {
  let clientClosed = false;
  let serverClosed = false;

  const { debug = false, onMessage, onError } = options;

  const log = debug ? console.log : () => {};
  const logError = debug ? console.error : () => {};

  // Forward messages from client to server
  clientTransport.onmessage = (message: any, extra: any) => {
    console.log(JSON.stringify(message));
    log("[Client→Server]", message.method || message.id);
    onMessage?.("client-to-server", message);

    // Forward any extra parameters (like resumption tokens) to the server
    const serverOptions: any = {};
    if (extra?.relatedRequestId) {
      serverOptions.relatedRequestId = extra.relatedRequestId;
    }

    serverTransport.send(message, serverOptions).catch((error) => {
      logError("Error sending to server:", error);
      onError?.(error, "server");
    });
  };

  // Forward messages from server to client
  serverTransport.onmessage = (message: any, extra: any) => {
    console.log(JSON.stringify(message), JSON.stringify(extra));
    log("[Server→Client]", message.method || message.id);
    onMessage?.("server-to-client", message);

    // Forward the server's session ID as resumption token to client
    const clientOptions: any = {};
    if (serverTransport.sessionId) {
      clientOptions.resumptionToken = serverTransport.sessionId;
    }
    if (extra?.relatedRequestId) {
      clientOptions.relatedRequestId = extra.relatedRequestId;
    }

    clientTransport.send(message, clientOptions).catch((error) => {
      logError("Error sending to client:", error);
      onError?.(error, "client");
    });
  };

  // Handle transport closures
  clientTransport.onclose = () => {
    if (serverClosed) return;
    clientClosed = true;
    log("Client transport closed, closing server transport");
    serverTransport.close().catch((error) => {
      logError("Error closing server transport:", error);
    });
  };

  serverTransport.onclose = () => {
    if (clientClosed) return;
    serverClosed = true;
    console.log("closing");
    log("Server transport closed, closing client transport");
    clientTransport.close().catch((error) => {
      logError("Error closing client transport:", error);
    });
  };

  // Error handling
  clientTransport.onerror = (error: Error) => {
    logError("Client transport error:", error);
    onError?.(error, "client");
  };

  serverTransport.onerror = (error: Error) => {
    logError("Server transport error:", error);
    onError?.(error, "server");
  };

  return {
    /**
     * Start both transports
     */
    start: async () => {
      try {
        await Promise.all([clientTransport.start(), serverTransport.start()]);
        log("MCP transport bridge started successfully");
      } catch (error) {
        logError("Error starting transport bridge:", error);
        throw error;
      }
    },

    /**
     * Close both transports
     */
    close: async () => {
      try {
        await Promise.all([clientTransport.close(), serverTransport.close()]);
        log("MCP transport bridge closed successfully");
      } catch (error) {
        logError("Error closing transport bridge:", error);
        throw error;
      }
    },

    /**
     * Check if the bridge is closed
     */
    get isClosed() {
      return clientClosed || serverClosed;
    },
  };
}
