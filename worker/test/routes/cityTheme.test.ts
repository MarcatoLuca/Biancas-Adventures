import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/geminiCityTheme', () => ({ generateCityTheme: vi.fn() }));
vi.mock('../../src/lib/auth', () => ({ requireUser: vi.fn() }));
import { generateCityTheme } from '../../src/lib/geminiCityTheme';
import { requireUser } from '../../src/lib/auth';
import { Hono } from 'hono';
import cityThemeRoutes from '../../src/routes/cityTheme';

function fakeSupabase(existing: any = null) {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({ data: { city_label: 'Napoli, Italia', color_1: '#111', color_2: '#222', color_3: '#333' }, error: null }),
  };
}

describe('GET /city-themes/:cityLabel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a cached theme without calling Gemini', async () => {
    const supabase = fakeSupabase({ city_label: 'Napoli, Italia', color_1: '#111', color_2: '#222', color_3: '#333' });
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', cityThemeRoutes);
    const res = await app.request('/city-themes/Napoli%2C%20Italia', {}, { GEMINI_API_KEY: 'fake-key' });
    expect(res.status).toBe(200);
    expect(generateCityTheme).not.toHaveBeenCalled();
  });

  it('generates and caches a new theme when none exists', async () => {
    (generateCityTheme as any).mockResolvedValue({ primary: '#111', secondary: '#222', accent: '#333', reasoning: 'x' });
    const supabase = fakeSupabase(null);
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', cityThemeRoutes);
    const res = await app.request('/city-themes/Napoli%2C%20Italia', {}, { GEMINI_API_KEY: 'fake-key' });
    expect(res.status).toBe(200);
    expect(generateCityTheme).toHaveBeenCalledTimes(1);
    expect(supabase.insert).toHaveBeenCalled();
  });
});
