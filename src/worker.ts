import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { OpenAlexClient } from './openalex-client.js';
import { CONFIG } from './config.js';
import { createServer } from './server.js';

interface Env {
  OPENALEX_EMAIL?: string;
  OPENALEX_API_KEY?: string;
  MCP_DEFAULT_PAGE_SIZE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // Only handle /mcp path
    if (url.pathname !== '/mcp') {
      return new Response(JSON.stringify({ error: 'Not found. MCP endpoint is at /mcp' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openAlexClient = new OpenAlexClient({
      email: env.OPENALEX_EMAIL,
      apiKey: env.OPENALEX_API_KEY,
    });

    const defaultPageSize = parseInt(
      env.MCP_DEFAULT_PAGE_SIZE || String(CONFIG.MCP.DEFAULT_PAGE_SIZE),
      10
    );

    const server = createServer(openAlexClient, defaultPageSize);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });

    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // Add CORS headers to the response
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders())) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, mcp-protocol-version',
  };
}
