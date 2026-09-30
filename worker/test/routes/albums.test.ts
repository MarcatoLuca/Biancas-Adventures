import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import albumsRouter, { extractIcloudToken } from '../../src/routes/albums';

vi.mock('../../src/lib/auth', () => ({
  requireUser: vi.fn(),
}));
import { requireUser } from '../../src/lib/auth';

function fakeSupabase(
  overrides: {
    insertResult?: { data: { id: string } | null; error: { message: string } | null };
    listResult?: { data: any[] | null; error: { message: string } | null };
    rpcResult?: { data: string | null; error: { message: string } | null };
    memberInsertResult?: { error: { message: string } | null };
    regenerateResult?: { data: { invite_code: string } | null; error: { message: string } | null };
    renameResult?: { data: { id: string; name: string } | null; error: { message: string } | null };
  } = {}
) {
  const calls = {
    albumInsert: [] as any[],
    memberInsert: [] as any[],
    albumUpdate: [] as any[],
    rpc: [] as any[],
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'albums') {
        return {
          insert: vi.fn((payload: any) => {
            calls.albumInsert.push(payload);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => overrides.insertResult ?? { data: { id: 'album-1' }, error: null }),
              })),
            };
          }),
          update: vi.fn((payload: any) => {
            calls.albumUpdate.push(payload);
            const result =
              'name' in payload
                ? overrides.renameResult ?? { data: { id: 'album-1', name: payload.name }, error: null }
                : overrides.regenerateResult ?? { data: { invite_code: 'NEWCODE1' }, error: null };
            return {
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => result),
                })),
              })),
            };
          }),
        };
      }

      if (table === 'album_members') {
        return {
          insert: vi.fn((payload: any) => {
            calls.memberInsert.push(payload);
            return Promise.resolve(overrides.memberInsertResult ?? { error: null });
          }),
          select: vi.fn(() => ({
            eq: vi.fn(async () =>
              overrides.listResult ?? {
                data: [{ album_id: 'album-1', role: 'owner', albums: { id: 'album-1', name: 'Family' } }],
                error: null,
              }
            ),
          })),
        };
      }

      throw new Error(`unexpected table ${table}`);
    }),
    rpc: vi.fn(async (...args: any[]) => {
      calls.rpc.push(args);
      return overrides.rpcResult ?? { data: 'album-1', error: null };
    }),
    _calls: calls,
  };
}

describe('extractIcloudToken', () => {
  it('extracts the token from a full share URL', () => {
    expect(extractIcloudToken('https://www.icloud.com/sharedalbum/#B0z5qAGN1JIFd3y')).toBe(
      'B0z5qAGN1JIFd3y'
    );
  });

  it('returns the input unchanged if it is already a bare token', () => {
    expect(extractIcloudToken('B0z5qAGN1JIFd3y')).toBe('B0z5qAGN1JIFd3y');
  });

  it('throws for an empty string', () => {
    expect(() => extractIcloudToken('')).toThrow('invalid_icloud_link');
  });
});

describe('albums routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an album and returns its id', async () => {
    const supabase = fakeSupabase();
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums', {
      method: 'POST',
      body: JSON.stringify({ name: 'Family', icloudAlbumUrl: 'https://www.icloud.com/sharedalbum/#TOKEN1' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ albumId: 'album-1' });
    expect(supabase._calls.albumInsert[0]).toMatchObject({
      name: 'Family',
      icloud_album_token: 'TOKEN1',
      owner_user_id: 'user-1',
    });
    expect(supabase._calls.memberInsert[0]).toEqual({
      album_id: 'album-1',
      user_id: 'user-1',
      role: 'owner',
    });
  });

  it('returns 400 with a clear message for an unknown invite code', async () => {
    const supabase = fakeSupabase({ rpcResult: { data: null, error: { message: 'invalid_invite_code' } } });
    (requireUser as any).mockResolvedValue({ userId: 'user-2', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'nope' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_invite_code' });
  });

  it('lists the caller albums', async () => {
    const supabase = fakeSupabase({
      listResult: {
        data: [{ album_id: 'album-9', role: 'member', albums: { id: 'album-9', name: 'Holidays' } }],
        error: null,
      },
    });
    (requireUser as any).mockResolvedValue({ userId: 'user-3', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      albums: [{ album_id: 'album-9', role: 'member', albums: { id: 'album-9', name: 'Holidays' } }],
    });
  });

  it('regenerates the invite code for the owner', async () => {
    const supabase = fakeSupabase({
      regenerateResult: { data: { invite_code: 'FRESH123' }, error: null },
    });
    (requireUser as any).mockResolvedValue({ userId: 'owner-1', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums/album-1/invite/regenerate', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ inviteCode: 'FRESH123' });
    expect(supabase._calls.albumUpdate[0]).toHaveProperty('invite_code');
  });

  it('returns 404 when a non-owner tries to regenerate the invite code', async () => {
    const supabase = fakeSupabase({
      regenerateResult: { data: null, error: null },
    });
    (requireUser as any).mockResolvedValue({ userId: 'member-1', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums/album-1/invite/regenerate', {
      method: 'POST',
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'album_not_found_or_not_owner' });
  });

  it('renames the album for the owner', async () => {
    const supabase = fakeSupabase({
      renameResult: { data: { id: 'album-1', name: 'New name' }, error: null },
    });
    (requireUser as any).mockResolvedValue({ userId: 'owner-1', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums/album-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New name' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ album: { id: 'album-1', name: 'New name' } });
    expect(supabase._calls.albumUpdate[0]).toEqual({ name: 'New name' });
  });

  it('returns 404 when a non-owner tries to rename the album', async () => {
    const supabase = fakeSupabase({
      renameResult: { data: null, error: null },
    });
    (requireUser as any).mockResolvedValue({ userId: 'member-1', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums/album-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New name' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'album_not_found_or_not_owner' });
  });
});
