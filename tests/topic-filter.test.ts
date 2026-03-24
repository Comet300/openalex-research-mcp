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

describe('search_by_topic auto-resolution (via MCP handler)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  function mockFetchResponse(data: any) {
    return { ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(data) };
  }

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  async function callTool(server: any, toolName: string, args: Record<string, any>) {
    const handlers = (server as any)._requestHandlers;
    const handler = handlers?.get('tools/call');
    if (!handler) throw new Error('No tools/call handler found');
    return handler({ method: 'tools/call', params: { name: toolName, arguments: args } });
  }

  it('should auto-resolve topic and include resolved_topic in response', async () => {
    const client = new OpenAlexClient({ email: 'test@test.com', enableCache: false });

    // First call: getTopics returns a match
    // Second call: getWorks with topic filter
    fetchSpy
      .mockResolvedValueOnce(mockFetchResponse({
        meta: { count: 1, page: 1, per_page: 5 },
        results: [{
          id: 'https://openalex.org/T10315',
          display_name: 'Decision-Making and Behavioral Economics',
          description: 'Focuses on decision-making',
          works_count: 84521,
          subfield: { display_name: 'Applied Psychology' },
          field: { display_name: 'Psychology' },
          domain: { display_name: 'Social Sciences' },
        }],
      }))
      .mockResolvedValueOnce(mockFetchResponse({
        meta: { count: 100, page: 1, per_page: 10 },
        results: [{
          id: 'W1', title: 'Anchoring in Negotiations',
          publication_year: 2023, cited_by_count: 45, type: 'article',
          authorships: [], primary_topic: null, open_access: {}, primary_location: {},
        }],
      }));

    const server = createServer(client, 10);
    const result = await callTool(server, 'search_by_topic', { topic: 'decision making' });

    // Verify two fetch calls: topics, then works
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const topicsUrl = new URL(fetchSpy.mock.calls[0][0]);
    expect(topicsUrl.pathname).toBe('/topics');

    const worksUrl = new URL(fetchSpy.mock.calls[1][0]);
    expect(worksUrl.pathname).toBe('/works');
    expect(worksUrl.searchParams.get('filter')).toContain('primary_topic.id:https://openalex.org/T10315');

    // Verify response includes topic resolution metadata
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.topic_match).toBe('auto_resolved');
    expect(parsed.resolved_topic).toEqual({
      id: 'https://openalex.org/T10315',
      name: 'Decision-Making and Behavioral Economics',
    });
    expect(parsed.candidate_topics).toHaveLength(1);
  });

  it('should fall back to free-text when no topics match', async () => {
    const client = new OpenAlexClient({ email: 'test@test.com', enableCache: false });

    fetchSpy
      .mockResolvedValueOnce(mockFetchResponse({
        meta: { count: 0, page: 1, per_page: 5 },
        results: [],
      }))
      .mockResolvedValueOnce(mockFetchResponse({
        meta: { count: 50, page: 1, per_page: 10 },
        results: [],
      }));

    const server = createServer(client, 10);
    const result = await callTool(server, 'search_by_topic', { topic: 'xyznonexistent' });

    // Verify works URL has no topic filter
    const worksUrl = new URL(fetchSpy.mock.calls[1][0]);
    const filter = worksUrl.searchParams.get('filter');
    expect(filter === null || !filter.includes('primary_topic.id')).toBe(true);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.topic_match).toBe('none');
    expect(parsed.resolved_topic).toBeNull();
    expect(parsed.candidate_topics).toEqual([]);
  });

  it('should skip auto-resolution when topic_id is provided directly', async () => {
    const client = new OpenAlexClient({ email: 'test@test.com', enableCache: false });

    fetchSpy.mockResolvedValue(mockFetchResponse({
      meta: { count: 50, page: 1, per_page: 10 },
      results: [],
    }));

    const server = createServer(client, 10);
    const result = await callTool(server, 'search_by_topic', {
      topic: 'anchoring',
      topic_id: 'https://openalex.org/T10315',
    });

    // Only ONE fetch call (no topics lookup)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const worksUrl = new URL(fetchSpy.mock.calls[0][0]);
    expect(worksUrl.pathname).toBe('/works');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.topic_match).toBe('direct');
  });
});

describe('find_topics tool handler', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  function mockFetchResponse(data: any) {
    return { ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(data) };
  }

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  async function callTool(server: any, toolName: string, args: Record<string, any>) {
    const handlers = (server as any)._requestHandlers;
    const handler = handlers?.get('tools/call');
    if (!handler) throw new Error('No tools/call handler found');
    return handler({ method: 'tools/call', params: { name: toolName, arguments: args } });
  }

  it('should call /topics endpoint and return summarized topics', async () => {
    const client = new OpenAlexClient({ email: 'test@test.com', enableCache: false });

    fetchSpy.mockResolvedValue(mockFetchResponse({
      meta: { count: 2, page: 1, per_page: 10 },
      results: [
        {
          id: 'https://openalex.org/T10315',
          display_name: 'Decision-Making and Behavioral Economics',
          description: 'Focuses on decision-making processes',
          works_count: 84521,
          subfield: { display_name: 'Applied Psychology' },
          field: { display_name: 'Psychology' },
          domain: { display_name: 'Social Sciences' },
          keywords: [], siblings: [],
        },
        {
          id: 'https://openalex.org/T11234',
          display_name: 'Consumer Behavior',
          description: 'Studies of consumer choices',
          works_count: 42000,
          subfield: { display_name: 'Marketing' },
          field: { display_name: 'Business' },
          domain: { display_name: 'Social Sciences' },
          keywords: [], siblings: [],
        },
      ],
    }));

    const server = createServer(client, 10);
    const result = await callTool(server, 'find_topics', { query: 'behavioral economics' });

    // Verify it called /topics
    const url = new URL(fetchSpy.mock.calls[0][0]);
    expect(url.pathname).toBe('/topics');
    expect(url.searchParams.get('search')).toBe('behavioral economics');

    // Verify response structure
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.meta.count).toBe(2);
    expect(parsed.topics).toHaveLength(2);
    expect(parsed.topics[0]).toEqual({
      id: 'https://openalex.org/T10315',
      display_name: 'Decision-Making and Behavioral Economics',
      description: 'Focuses on decision-making processes',
      works_count: 84521,
      subfield: 'Applied Psychology',
      field: 'Psychology',
      domain: 'Social Sciences',
    });
  });
});
