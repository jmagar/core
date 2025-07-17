import { type StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type RequestId,
  type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import { json } from "@remix-run/node";

const convertRemixRequestToTransport = (remixRequest: Request) => {
  return {
    method: remixRequest.method,
    url: remixRequest.url,
    headers: Object.fromEntries(remixRequest.headers.entries()),
  };
};

export const handleTransport = (
  transport: StreamableHTTPServerTransport,
  request: Request,
  body: any,
) => {
  let responseData: any;
  let responseStatus = 200;
  let responseHeaders: Record<string, string> = {};
  return new Promise<Response>(async (resolve) => {
    const captureResponse = {
      // Node.js ServerResponse methods required by StreamableHTTPServerTransport
      writeHead: (statusCode: number, headers?: Record<string, string>) => {
        responseStatus = statusCode;
        if (headers) {
          Object.assign(responseHeaders, headers);
        }
        return captureResponse;
      },

      end: (chunk?: any) => {
        responseData = chunk;

        if (responseStatus !== 200) {
          resolve(
            json(
              typeof responseData === "string"
                ? JSON.parse(responseData)
                : responseData,
              {
                status: responseStatus,
                headers: responseHeaders,
              },
            ),
          );
        }
        return captureResponse;
      },

      setHeader: (name: string, value: string) => {
        responseHeaders[name] = value;
        return captureResponse;
      },

      flushHeaders: () => {
        // No-op for our mock, but required by transport
        return captureResponse;
      },
      on: (event: string, callback: Function) => {
        // Mock event handling - transport uses this for 'close' events
        // In a real implementation, you'd want to handle cleanup
        return captureResponse;
      },

      // Properties that transport may access
      statusCode: responseStatus,
      headersSent: false,
      finished: false,
    };

    transport.send = async (
      message: JSONRPCMessage,
      options?: {
        relatedRequestId?: RequestId;
      },
    ) => {
      responseData = message;

      resolve(
        json(
          typeof responseData === "string"
            ? JSON.parse(responseData)
            : responseData,
          {
            status: responseStatus,
            headers: { ...responseHeaders, "Content-Type": "application/json" },
          },
        ),
      );
    };

    await transport.handleRequest(
      convertRemixRequestToTransport(request) as any,
      captureResponse as any,
      body,
    );
  });
};
