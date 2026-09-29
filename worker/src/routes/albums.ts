import { Hono } from 'hono';
import { requireUser } from '../lib/auth';
import type { Env } from '../index';

const ICLOUD_TOKEN_REGEX = /sharedalbum\/#(.+)$/;

const albumsRouter = new Hono<{ Bindings: Env }>();

export function extractIcloudToken(input: string): string {
  if (!input) {
    throw new Error('invalid_icloud_link');
  }

  const trimmed = input.trim();
  const match = trimmed.match(ICLOUD_TOKEN_REGEX);
  const token = match ? match[1] : trimmed;

  if (!token) {
    throw new Error('invalid_icloud_link');
  }

  return token;
}

function randomInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

albumsRouter.post('/', async (c) => {
  const { userId, supabase } = await requireUser(c);
  const body = await c.req.json<{ name: string; icloudAlbumUrl: string }>();

  let token: string;
  try {
    token = extractIcloudToken(body.icloudAlbumUrl);
  } catch {
    return c.json({ error: 'invalid_icloud_link' }, 400);
  }

  const inviteCode = randomInviteCode();
  const { data: album, error } = await supabase
    .from('albums')
    .insert({
      name: body.name,
      icloud_album_token: token,
      owner_user_id: userId,
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (error || !album) {
    return c.json({ error: 'could_not_create_album' }, 500);
  }

  const { error: memberError } = await supabase.from('album_members').insert({
    album_id: album.id,
    user_id: userId,
    role: 'owner',
  });

  if (memberError) {
    return c.json({ error: 'could_not_create_album' }, 500);
  }

  return c.json({ albumId: album.id }, 201);
});

albumsRouter.post('/join', async (c) => {
  const { supabase } = await requireUser(c);
  const body = await c.req.json<{ inviteCode: string }>();

  const { data, error } = await supabase.rpc('join_album_via_invite', {
    p_invite_code: body.inviteCode,
  });

  if (error || !data) {
    return c.json({ error: 'invalid_invite_code' }, 400);
  }

  return c.json({ albumId: data });
});

albumsRouter.get('/', async (c) => {
  const { userId, supabase } = await requireUser(c);
  const { data, error } = await supabase
    .from('album_members')
    .select('album_id, role, albums(id, name)')
    .eq('user_id', userId);

  if (error) {
    return c.json({ error: 'could_not_list_albums' }, 500);
  }

  return c.json({ albums: data ?? [] });
});

albumsRouter.post('/:id/invite/regenerate', async (c) => {
  const { supabase } = await requireUser(c);
  const albumId = c.req.param('id');
  const { data, error } = await supabase
    .from('albums')
    .update({ invite_code: randomInviteCode() })
    .eq('id', albumId)
    .select('invite_code')
    .single();

  if (error) {
    return c.json({ error: 'could_not_regenerate_invite' }, 500);
  }

  if (!data) {
    return c.json({ error: 'album_not_found_or_not_owner' }, 404);
  }

  return c.json({ inviteCode: data.invite_code });
});

export default albumsRouter;
