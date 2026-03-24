#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OpenAlexClient } from './openalex-client.js';
import { CONFIG } from './config.js';
import { createServer } from './server.js';
import { runSetup } from './setup.js';

// Handle `openalex-research-mcp setup [flags]` before starting the MCP server
if (process.argv[2] === 'setup') {
  runSetup(process.argv.slice(3)).then(() => process.exit(0)).catch(err => {
    console.error('Setup failed:', err.message);
    process.exit(1);
  });
} else {

// Debug logging
console.error('OpenAlex MCP Server starting...');
console.error('Email:', process.env.OPENALEX_EMAIL);
console.error('API Key:', process.env.OPENALEX_API_KEY ? 'Set' : 'Not set');

// Initialize OpenAlex client with env vars
const openAlexClient = new OpenAlexClient({
  email: process.env.OPENALEX_EMAIL,
  apiKey: process.env.OPENALEX_API_KEY,
});

const DEFAULT_PAGE_SIZE = parseInt(process.env.MCP_DEFAULT_PAGE_SIZE || String(CONFIG.MCP.DEFAULT_PAGE_SIZE), 10);

const server = createServer(openAlexClient, DEFAULT_PAGE_SIZE);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenAlex MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
}
