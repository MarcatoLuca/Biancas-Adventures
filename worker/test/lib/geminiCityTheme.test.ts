import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateCityTheme } from '../../src/lib/geminiCityTheme';

describe('generateCityTheme', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses three valid hex colors from the Gemini response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    primary: '#2b5fad',
                    secondary: '#f4d35e',
                    accent: '#e0533d',
                    reasoning: 'Blu del mare, giallo del sole, rosso dei tetti.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    }) as any;

    const theme = await generateCityTheme('fake-key', 'Napoli, Italia');
    expect(theme).toEqual({
      primary: '#2b5fad',
      secondary: '#f4d35e',
      accent: '#e0533d',
      reasoning: 'Blu del mare, giallo del sole, rosso dei tetti.',
    });
  });

  it('returns null when a color is not a valid hex string', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ primary: 'blue', secondary: '#fff', accent: '#000', reasoning: '' }) }] } }],
      }),
    }) as any;
    const theme = await generateCityTheme('fake-key', 'Napoli, Italia');
    expect(theme).toBeNull();
  });

  it('returns null on HTTP failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const theme = await generateCityTheme('fake-key', 'Napoli, Italia');
    expect(theme).toBeNull();
  });
});
