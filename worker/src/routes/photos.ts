import { Hono } from 'hono';
import { requireUser } from '../lib/auth';
import { fetchSharedAlbum } from '../lib/icloud';
import type { Env } from '../index';

const photosRouter = new Hono<{ Bindings: Env }>();

photosRouter.get('/', async (c) => {
  const { supabase } = await requireUser(c);
  const albumId = c.req.param('albumId');

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('icloud_album_token')
    .eq('id', albumId)
    .single();

  if (albumError || !album) {
    return c.json({ error: 'album_not_found_or_forbidden' }, 404);
  }

  let icloudPhotos;
  try {
    icloudPhotos = await fetchSharedAlbum(album.icloud_album_token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'icloud_album_unreachable';
    return c.json({ error: message === 'icloud_album_unreachable' ? message : 'icloud_album_unreachable' }, 502);
  }

  const { error: upsertError } = await supabase.from('photos').upsert(
    icloudPhotos.map((photo) => ({
      album_id: albumId,
      photo_guid: photo.photoGuid,
      caption: photo.caption,
      date_created: photo.dateCreated,
      media_asset_type: photo.mediaAssetType ?? null,
      thumb_url: photo.thumbUrl,
      full_url: photo.fullUrl,
    })),
    { onConflict: 'album_id,photo_guid', ignoreDuplicates: false }
  );

  if (upsertError) {
    return c.json({ error: 'could_not_sync_photos' }, 500);
  }

  const { data: rows, error: rowsError } = await supabase.from('photos').select('*').eq('album_id', albumId);
  if (rowsError) {
    return c.json({ error: 'could_not_list_photos' }, 500);
  }

  return c.json({ photos: rows ?? [] });
});

photosRouter.patch('/:photoGuid/location', async (c) => {
  const { userId, supabase } = await requireUser(c);
  const albumId = c.req.param('albumId');
  const photoGuid = c.req.param('photoGuid');
  const body = await c.req.json<{ latitude: number; longitude: number; locationLabel: string }>();

  const { error } = await supabase
    .from('photos')
    .update({
      latitude: body.latitude,
      longitude: body.longitude,
      location_label: body.locationLabel,
      location_source: 'manual',
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('album_id', albumId)
    .eq('photo_guid', photoGuid);

  if (error) {
    return c.json({ error: 'could_not_update_location' }, 500);
  }

  return c.json({ ok: true });
});

export default photosRouter;
