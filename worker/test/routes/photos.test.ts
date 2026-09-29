import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import photosRouter from '../../src/routes/photos';

vi.mock('../../src/lib/auth', () => ({ requireUser: vi.fn() }));
vi.mock('../../src/lib/icloud', () => ({ fetchSharedAlbum: vi.fn() }));
import { requireUser } from '../../src/lib/auth';
import { fetchSharedAlbum } from '../../src/lib/icloud';

function fakeSupabase(
  overrides: {
    albumLookup?: { data: { icloud_album_token: string } | null; error: { message: string } | null };
    photoRows?: any[] | null;
    upsertResult?: { error: { message: string } | null };
    updateResult?: { error: { message: string } | null };
  } = {}
) {
  const upserted: any[] = [];
  const updates: any[] = [];

  return {
    from: vi.fn((table: string) => {
      if (table === 'albums') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => overrides.albumLookup ?? { data: { icloud_album_token: 'TOKEN1' }, error: null }),
            })),
          })),
        };
      }

      if (table === 'photos') {
        return {
          upsert: vi.fn((rows: any[]) => {
            upserted.push(...rows);
            return Promise.resolve(overrides.upsertResult ?? { error: null });
          }),
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: overrides.photoRows ?? upserted,
              error: null,
            })),
          })),
          update: vi.fn((payload: any) => {
            updates.push(payload);
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(async () => overrides.updateResult ?? { error: null }),
              })),
            };
          }),
        };
      }

      throw new Error(`unexpected table ${table}`);
    }),
    _upserted: upserted,
    _updates: updates,
  };
}

describe('photos routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('syncs iCloud photos and returns a clear error if the album is unreachable', async () => {
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase: fakeSupabase() });
    (fetchSharedAlbum as any).mockRejectedValue(new Error('icloud_album_unreachable'));

    const app = new Hono();
    app.route('/albums/:albumId/photos', photosRouter);
    const res = await app.request('/albums/album-1/photos');

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'icloud_album_unreachable' });
  });

  it('stores photos with no image derivative without throwing', async () => {
    const supabase = fakeSupabase();
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });
    (fetchSharedAlbum as any).mockResolvedValue([
      { photoGuid: 'g1', caption: '', dateCreated: null, mediaAssetType: 'video', thumbUrl: null, fullUrl: null },
    ]);

    const app = new Hono();
    app.route('/albums/:albumId/photos', photosRouter);
    const res = await app.request('/albums/album-1/photos');

    expect(res.status).toBe(200);
    expect(supabase._upserted[0]).toMatchObject({
      album_id: 'album-1',
      photo_guid: 'g1',
      thumb_url: null,
      full_url: null,
      media_asset_type: 'video',
    });
  });

  it('updates the location manually for a photo', async () => {
    const supabase = fakeSupabase();
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/albums/:albumId/photos', photosRouter);
    const res = await app.request('/albums/album-1/photos/g1/location', {
      method: 'PATCH',
      body: JSON.stringify({ latitude: 41.9, longitude: 12.5, locationLabel: 'Roma' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(supabase._updates[0]).toMatchObject({
      latitude: 41.9,
      longitude: 12.5,
      location_label: 'Roma',
      location_source: 'manual',
      updated_by: 'user-1',
    });
    expect(typeof supabase._updates[0].updated_at).toBe('string');
  });
});
