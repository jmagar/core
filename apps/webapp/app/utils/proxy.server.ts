export async function proxyRequest(
  request: Request,
  targetUrl: string,
  token: string,
): Promise<Response> {
  try {
    const targetURL = new URL(targetUrl);

    const headers = new Headers();

    // Copy relevant headers from the original request
    const headersToProxy = [
      "content-type",
      "user-agent",
      "accept",
      "accept-language",
      "accept-encoding",
      "mcp-session-id",
      "last-event-id",
    ];

    headersToProxy.forEach((headerName) => {
      const value = request.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    });

    headers.set("Authorization", `Bearer ${token}`);

    const body =
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.arrayBuffer()
        : undefined;

    const response = await fetch(targetURL.toString(), {
      method: request.method,
      headers,
      body,
    });

    // Create response headers, excluding hop-by-hop headers
    const responseHeaders = new Headers();
    const headersToExclude = [
      "connection",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailers",
      "transfer-encoding",
      "upgrade",
    ];

    response.headers.forEach((value, key) => {
      if (!headersToExclude.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy request failed:", error);
    return new Response(JSON.stringify({ error: "Proxy request failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
