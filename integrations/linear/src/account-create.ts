export async function integrationCreate({ apiKey }: { apiKey: string }) {
  // Fetch the Linear user info using the GraphQL API
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      Authorization: `${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'query { viewer { id name email } }',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Linear user: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const viewer = result?.data?.viewer;
  const userId = viewer?.id;

  if (!userId) {
    throw new Error('Could not extract userId from Linear GraphQL API response');
  }

  return [
    {
      type: 'account',
      data: {
        settings: {
          user: {
            id: viewer.id,
            name: viewer.name,
            email: viewer.email,
          },
        },
        accountId: userId,
        config: { apiKey },
      },
    },
  ];
}

interface MCPIntegrationCreateData {
  oauthResponse: {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    [key: string]: any;
  };
  mcp: boolean;
}

export async function integrationCreateForMCP(data: MCPIntegrationCreateData) {
  return [
    {
      type: 'account',
      data: {
        mcp: true,
        config: data.oauthResponse,
      },
    },
  ];
}
