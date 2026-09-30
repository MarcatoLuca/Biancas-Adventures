import { describe, it, expect, vi, afterEach } from 'vitest';
import { reverseGeocode } from '../../src/lib/nominatim';

describe('reverseGeocode', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('builds a short label from city and country', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { city: 'Roma', country: 'Italia' } }),
    }) as any;

    const label = await reverseGeocode(41.9, 12.5);
    expect(label).toBe('Roma, Italia');
  });

  it('falls back to town/village when city is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { village: 'Positano', country: 'Italia' } }),
    }) as any;

    const label = await reverseGeocode(40.6, 14.5);
    expect(label).toBe('Positano, Italia');
  });

  it('returns null when Nominatim errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as any;
    const label = await reverseGeocode(0, 0);
    expect(label).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as any;
    const label = await reverseGeocode(0, 0);
    expect(label).toBeNull();
  });
});
