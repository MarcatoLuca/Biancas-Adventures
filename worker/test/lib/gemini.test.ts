import { describe, it, expect, vi, afterEach } from 'vitest';
import { suggestLocation } from '../../src/lib/gemini';

const targetPhoto = { photoGuid: 'g1', thumbUrl: 'https://x/g1.jpg', dateCreated: '2024-07-12T10:00:00Z' };
const contextPhotos = [
  { photoGuid: 'g0', thumbUrl: 'https://x/g0.jpg', dateCreated: '2024-07-11T09:00:00Z', locationLabel: 'Napoli, Italia', latitude: 40.85, longitude: 14.27 },
];

describe('suggestLocation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses a valid Gemini JSON response into a suggestion', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    latitude: 40.85,
                    longitude: 14.27,
                    locationLabel: 'Napoli, Italia',
                    reasoning: 'Stessi vestiti e data vicina alla foto di Napoli.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    }) as any;

    const result = await suggestLocation('fake-key', targetPhoto, contextPhotos);
    expect(result).toEqual({
      latitude: 40.85,
      longitude: 14.27,
      locationLabel: 'Napoli, Italia',
      reasoning: 'Stessi vestiti e data vicina alla foto di Napoli.',
    });
  });

  it('returns null when Gemini response is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }),
    }) as any;

    const result = await suggestLocation('fake-key', targetPhoto, contextPhotos);
    expect(result).toBeNull();
  });

  it('returns null when the HTTP call fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const result = await suggestLocation('fake-key', targetPhoto, contextPhotos);
    expect(result).toBeNull();
  });

  it('returns null when there is no context to reason from', async () => {
    global.fetch = vi.fn();
    const result = await suggestLocation('fake-key', targetPhoto, []);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
