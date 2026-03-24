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

describe('OpenAlexClient ID normalization', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupClient() {
    fetchSpy = vi.fn().mockResolvedValue(mockFetchResponse({ id: 'W12345' }));
    vi.stubGlobal('fetch', fetchSpy);
    return new OpenAlexClient({ enableCache: false });
  }

  function getCalledUrl(): string {
    return fetchSpy.mock.calls[0][0];
  }

  it('should pass OpenAlex IDs as-is', async () => {
    const client = setupClient();
    await client.getEntity('works', 'W12345');
    expect(getCalledUrl()).toContain('/works/W12345');
  });

  it('should prefix bare DOIs with "doi:" to prevent path splitting', async () => {
    const client = setupClient();
    await client.getEntity('works', '10.48550/arXiv.2403.13093');
    expect(getCalledUrl()).toContain('/works/doi:10.48550/arXiv.2403.13093');
  });

  it('should prefix standard DOIs with "doi:"', async () => {
    const client = setupClient();
    await client.getEntity('works', '10.1371/journal.pone.0000000');
    expect(getCalledUrl()).toContain('/works/doi:10.1371/journal.pone.0000000');
  });

  it('should encode full DOI URLs to prevent absolute URL bypass', async () => {
    const client = setupClient();
    await client.getEntity('works', 'https://doi.org/10.48550/arXiv.2403.13093');
    const encoded = encodeURIComponent('https://doi.org/10.48550/arXiv.2403.13093');
    expect(getCalledUrl()).toContain(`/works/${encoded}`);
  });

  it('should encode arbitrary HTTPS URLs', async () => {
    const client = setupClient();
    await client.getEntity('works', 'https://proceedings.mlr.press/v206/pattathil23a.html');
    const encoded = encodeURIComponent('https://proceedings.mlr.press/v206/pattathil23a.html');
    expect(getCalledUrl()).toContain(`/works/${encoded}`);
  });

  it('should leave "doi:" prefixed IDs as-is', async () => {
    const client = setupClient();
    await client.getEntity('works', 'doi:10.48550/arXiv.2403.13093');
    expect(getCalledUrl()).toContain('/works/doi:10.48550/arXiv.2403.13093');
  });
});
