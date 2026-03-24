import { describe, it, expect } from 'vitest';
import { summarizeTopic } from '../src/server.js';

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
