import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import aiSuggestRoutes from '../../src/routes/aiSuggest';

vi.mock('../../src/lib/gemini', () => ({ suggestLocation: vi.fn() }));
vi.mock('../../src/lib/auth', () => ({ requireUser: vi.fn() }));

import { suggestLocation } from '../../src/lib/gemini';
import { requireUser } from '../../src/lib/auth';

function fakeSupabase(overrides: any = {}) {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: [{ status: 'accepted' }], error: null }),
    ...overrides,
  };
}

describe('POST /albums/:id/photos/:photoGuid/ai-suggest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a cached suggestion without calling Gemini again', async () => {
    const existing = { album_id: 'a1', photo_guid: 'g1', status: 'pending' };
    const supabase = fakeSupabase({
      single: vi.fn().mockResolvedValue({ data: existing, error: null }),
    });
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', aiSuggestRoutes);
    const res = await app.request('/albums/a1/photos/g1/ai-suggest', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(suggestLocation).not.toHaveBeenCalled();
  });

  it('calls Gemini and stores a new suggestion when none exists', async () => {
    (suggestLocation as any).mockResolvedValue({
      latitude: 40.85, longitude: 14.27, locationLabel: 'Napoli, Italia', reasoning: 'test',
    });

    let singleCallCount = 0;
    const supabase = fakeSupabase({
      single: vi.fn().mockImplementation(() => {
        singleCallCount += 1;
        if (singleCallCount === 1) return Promise.resolve({ data: null, error: null });
        if (singleCallCount === 2) {
          return Promise.resolve({ data: { photo_guid: 'g1', thumb_url: null, date_created: null }, error: null });
        }
        return Promise.resolve({
          data: { album_id: 'a1', photo_guid: 'g1', status: 'pending' },
          error: null,
        });
      }),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            photo_guid: 'g0',
            thumb_url: null,
            date_created: '2024-07-11T09:00:00Z',
            location_label: 'Napoli, Italia',
            latitude: 40.85,
            longitude: 14.27,
          },
        ],
        error: null,
      }),
    });
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', aiSuggestRoutes);
    const res = await app.request(
      '/albums/a1/photos/g1/ai-suggest',
      { method: 'POST' },
      { GEMINI_API_KEY: 'fake-key' }
    );
    expect(res.status).toBe(200);
    expect(suggestLocation).toHaveBeenCalledTimes(1);
    expect(supabase.insert).toHaveBeenCalled();
  });
});

describe('POST .../ai-suggest/respond', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 409 when the suggestion was already resolved', async () => {
    const supabase = fakeSupabase({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'suggestion_already_resolved' } }),
    });
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', aiSuggestRoutes);
    const res = await app.request('/albums/a1/photos/g1/ai-suggest/respond', {
      method: 'POST',
      body: JSON.stringify({ action: 'accept' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(409);
  });

  it('returns the resolved status on success', async () => {
    const supabase = fakeSupabase();
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', aiSuggestRoutes);
    const res = await app.request('/albums/a1/photos/g1/ai-suggest/respond', {
      method: 'POST',
      body: JSON.stringify({ action: 'accept' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('accepted');
  });
});
