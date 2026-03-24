import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { summarizeTopic, createServer } from '../src/server.js';
import { OpenAlexClient } from '../src/openalex-client.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

describe('summarizeTopic', () => {
  it('should extract compact fields from raw topic response', () => {
    const rawTopic = {
      id: 'https://openalex.org/T10315',
      display_name: 'Decision-Making and Behavioral Economics',
      description: 'This cluster of papers focuses on decision-making...',
      works_count: 84521,
      cited_by_count: 2345678,
      keywords: [{ display_name: 'anchoring' }, { display_name: 'heuristics' }],
      subfield: { display_name: 'Applied Psychology' },
      field: { display_name: 'Psychology' },
      domain: { display_name: 'Social Sciences' },
      siblings: [],
      ids: { openalex: 'https://openalex.org/T10315' },
      works_api_url: 'https://api.openalex.org/works?filter=topics.id:T10315',
    };

    const result = summarizeTopic(rawTopic);

    expect(result).toEqual({
      id: 'https://openalex.org/T10315',
      display_name: 'Decision-Making and Behavioral Economics',
      description: 'This cluster of papers focuses on decision-making...',
      works_count: 84521,
      subfield: 'Applied Psychology',
      field: 'Psychology',
      domain: 'Social Sciences',
    });
  });

  it('should handle missing nested fields gracefully', () => {
    const rawTopic = {
      id: 'https://openalex.org/T99999',
      display_name: 'Unknown Topic',
      description: null,
      works_count: 0,
      subfield: null,
      field: null,
      domain: null,
    };

    const result = summarizeTopic(rawTopic);

    expect(result).toEqual({
      id: 'https://openalex.org/T99999',
      display_name: 'Unknown Topic',
      description: null,
      works_count: 0,
      subfield: null,
      field: null,
      domain: null,
    });
  });
});

describe('buildFilter topic ID support (via MCP handler)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  function mockFetchResponse(data: any) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(data),
    };
  }

  const emptyWorksResponse = {
    meta: { count: 0, page: 1, per_page: 10 },
    results: [],
  };

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(emptyWorksResponse));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function callTool(server: Server, toolName: string, args: Record<string, any>) {
    const handlers = (server as any)._requestHandlers;
    const handler = handlers?.get('tools/call');
    if (!handler) throw new Error('No tools/call handler found');
    return handler({ method: 'tools/call', params: { name: toolName, arguments: args } });
  }

  it('should map topic_id to topics.id filter in API URL', async () => {
    const client = new OpenAlexClient({ email: 'test@test.com', enableCache: false });
    const server = createServer(client, 10);

    await callTool(server, 'search_works', {
      query: 'anchoring',
      topic_id: 'https://openalex.org/T10315',
    });

    const url = new URL(fetchSpy.mock.calls[0][0]);
    expect(url.searchParams.get('filter')).toContain('topics.id:https://openalex.org/T10315');
  });

  it('should map primary_topic_id to primary_topic.id filter in API URL', async () => {
    const client = new OpenAlexClient({ email: 'test@test.com', enableCache: false });
    const server = createServer(client, 10);

    await callTool(server, 'search_works', {
      query: 'anchoring',
      primary_topic_id: 'https://openalex.org/T10315',
    });

    const url = new URL(fetchSpy.mock.calls[0][0]);
    expect(url.searchParams.get('filter')).toContain('primary_topic.id:https://openalex.org/T10315');
  });

  it('should combine topic_id with other filters', async () => {
    const client = new OpenAlexClient({ email: 'test@test.com', enableCache: false });
    const server = createServer(client, 10);

    await callTool(server, 'search_works', {
      query: 'anchoring',
      topic_id: 'https://openalex.org/T10315',
      from_publication_year: 2020,
    });

    const url = new URL(fetchSpy.mock.calls[0][0]);
    const filter = url.searchParams.get('filter') || '';
    expect(filter).toContain('topics.id:https://openalex.org/T10315');
    expect(filter).toContain('publication_year');
  });
});
