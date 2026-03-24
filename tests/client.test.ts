import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAlexClient } from '../src/openalex-client.js';

describe('OpenAlexClient', () => {
  let client: OpenAlexClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  function mockFetchResponse(data: any, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(data),
    };
  }

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    client = new OpenAlexClient({
      email: 'test@example.com',
      enableCache: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with config', () => {
      expect(client).toBeDefined();
    });

    it('should be able to disable cache', () => {
      const noCacheClient = new OpenAlexClient({ enableCache: false });
      expect(noCacheClient).toBeDefined();
    });
  });

  describe('getEntity', () => {
    it('should fetch a work by ID', async () => {
      const mockWork = {
        id: 'W12345',
        title: 'Test Paper',
        publication_year: 2023,
      };

      fetchSpy.mockResolvedValue(mockFetchResponse(mockWork));

      const result = await client.getEntity('works', 'W12345');
      expect(result).toEqual(mockWork);
    });

    it('should handle errors gracefully', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));
      await expect(client.getEntity('works', 'W12345')).rejects.toThrow();
    });
  });

  describe('searchEntities', () => {
    it('should search for works with filters', async () => {
      const mockResponse = {
        meta: { count: 100, page: 1, per_page: 10 },
        results: [{ id: 'W1', title: 'Test' }],
      };

      fetchSpy.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.getWorks({ search: 'machine learning' });
      expect(result).toEqual(mockResponse);
      expect(result.meta.count).toBe(100);
      expect(result.results).toHaveLength(1);
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        meta: { count: 0, page: 1, per_page: 10 },
        results: [],
      };

      fetchSpy.mockResolvedValue(mockFetchResponse(mockResponse));

      const result = await client.getWorks({ search: 'nonexistent' });
      expect(result.results).toHaveLength(0);
    });
  });

  describe('autocomplete', () => {
    it('should get autocomplete suggestions', async () => {
      const mockResults = {
        results: [
          { id: 'W1', display_name: 'Machine Learning' },
          { id: 'W2', display_name: 'Deep Learning' },
        ],
      };

      fetchSpy.mockResolvedValue(mockFetchResponse(mockResults));

      const result = await client.autocomplete('works', 'machine');
      expect(result.results).toHaveLength(2);
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', async () => {
      const mockWork = { id: 'W12345', title: 'Test' };
      fetchSpy.mockResolvedValue(mockFetchResponse(mockWork));

      const cachedClient = new OpenAlexClient({ email: 'test@example.com', enableCache: true });

      await cachedClient.getEntity('works', 'W12345');
      await cachedClient.getEntity('works', 'W12345');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', async () => {
      fetchSpy.mockResolvedValue(mockFetchResponse({ id: 'W12345', title: 'Test' }));

      const cachedClient = new OpenAlexClient({ email: 'test@example.com', enableCache: true });

      await cachedClient.getEntity('works', 'W12345');
      expect(cachedClient.getCacheSize()).toBeGreaterThan(0);

      cachedClient.clearCache();
      expect(cachedClient.getCacheSize()).toBe(0);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      let attempts = 0;
      const mockWork = { id: 'W12345', title: 'Test' };

      fetchSpy.mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(mockFetchResponse(mockWork));
      });

      const result = await client.getEntity('works', 'W12345');
      expect(result).toEqual(mockWork);
      expect(attempts).toBe(2);
    });

    it('should fail after max retries', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));
      await expect(client.getEntity('works', 'W12345')).rejects.toThrow();
    });
  });
});
