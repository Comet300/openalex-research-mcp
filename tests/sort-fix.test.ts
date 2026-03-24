import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAlexClient } from '../src/openalex-client.js';

function mockFetchResponse(data: any) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
  };
}

const emptyResponse = { meta: { count: 1, page: 1, per_page: 10 }, results: [] };

describe('Sort parameter normalization', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupClient() {
    fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse(emptyResponse));
    vi.stubGlobal('fetch', fetchSpy);
    return new OpenAlexClient({ email: 'test@example.com', enableCache: false });
  }

  function getCalledUrl(): URL {
    return new URL(fetchSpy.mock.calls[0][0]);
  }

  it('should append :desc to bare sort values like "relevance_score"', async () => {
    const client = setupClient();
    await client.getWorks({ search: 'machine learning', sort: 'relevance_score' });
    expect(getCalledUrl().searchParams.get('sort')).toBe('relevance_score:desc');
  });

  it('should append :desc to bare "cited_by_count"', async () => {
    const client = setupClient();
    await client.getWorks({ search: 'machine learning', sort: 'cited_by_count' });
    expect(getCalledUrl().searchParams.get('sort')).toBe('cited_by_count:desc');
  });

  it('should preserve sort values that already have a direction suffix', async () => {
    const client = setupClient();
    await client.getWorks({ search: 'machine learning', sort: 'publication_year:asc' });
    expect(getCalledUrl().searchParams.get('sort')).toBe('publication_year:asc');
  });

  it('should not set sort param when sort is not provided', async () => {
    const client = setupClient();
    await client.getWorks({ search: 'machine learning' });
    expect(getCalledUrl().searchParams.get('sort')).toBeNull();
  });
});
