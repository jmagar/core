import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * MCP Transport that adapts HTTP Request/Response to MCP Transport interface
 * for use in Remix API routes
 */
export class RemixMCPTransport implements Transport {
  private _closed = false;
  private _started = false;

  constructor(
    private request: Request,
    private sendResponse: (response: Response) => void
  ) {}

  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  async start(): Promise<void> {
    if (this._started) return;
    this._started = true;

    // Parse the incoming MCP message from the request
    try {
      const body = await this.request.text();
      if (!body.trim()) {
        throw new Error("Empty request body");
      }

      const message = JSON.parse(body);

      // Validate basic MCP message structure
      if (!message.jsonrpc || message.jsonrpc !== "2.0") {
        throw new Error("Invalid JSON-RPC message");
      }

      if (message.method.includes("notifications")) {
        this.send({});
        return;
      }

      if (Object.keys(message).length === 0) {
        this.send({});
      } else {
        // Emit the message to handler
        if (this.onmessage) {
          try {
            this.onmessage(message);
          } catch (error) {
            if (this.onerror) {
              this.onerror(error as Error);
            }
          }
        }
      }
    } catch (error) {
      if (this.onerror) {
        this.onerror(error as Error);
      }
    }
  }

  async send(message: any): Promise<void> {
    if (this._closed) {
      throw new Error("Transport is closed");
    }

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Send the MCP response back as HTTP response
    const response = new Response(JSON.stringify(message), {
      status: 200,
      headers,
    });

    this.sendResponse(response);
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    if (this.onclose) {
      try {
        this.onclose();
      } catch (error) {
        console.error("Error in close handler:", error);
      }
    }
  }

  onmessage: (message: any) => void = () => {};
  onclose: () => void = () => {};
  async onerror(error: Error) {
    console.log(error);
  }
}
