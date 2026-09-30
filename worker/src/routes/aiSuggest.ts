import { Hono } from 'hono';
import { suggestLocation } from '../lib/gemini';
import { requireUser } from '../lib/auth';
import type { Env } from '../index';

export const aiSuggestRoutes = new Hono<{ Bindings: Env }>();

aiSuggestRoutes.post('/albums/:id/photos/:photoGuid/ai-suggest', async (c) => {
  const { supabase } = await requireUser(c);
  const albumId = c.req.param('id');
  const photoGuid = c.req.param('photoGuid');

  const { data: existing } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('album_id', albumId)
    .eq('photo_guid', photoGuid)
    .single();

  if (existing) {
    return c.json({ suggestion: existing });
  }

  const { data: target } = await supabase
    .from('photos')
    .select('photo_guid, thumb_url, date_created')
    .eq('album_id', albumId)
    .eq('photo_guid', photoGuid)
    .single();

  if (!target) {
    return c.json({ error: 'photo_not_found' }, 404);
  }

  const { data: contextRows } = await supabase
    .from('photos')
    .select('photo_guid, thumb_url, date_created, location_label, latitude, longitude')
    .eq('album_id', albumId)
    .not('latitude', 'is', null)
    .order('date_created', { ascending: false })
    .limit(8);

  const suggestion = await suggestLocation(
    c.env.GEMINI_API_KEY,
    { photoGuid: target.photo_guid, thumbUrl: target.thumb_url, dateCreated: target.date_created },
    (contextRows ?? []).map((r: any) => ({
      photoGuid: r.photo_guid,
      thumbUrl: r.thumb_url,
      dateCreated: r.date_created,
      locationLabel: r.location_label,
      latitude: r.latitude,
      longitude: r.longitude,
    }))
  );

  if (!suggestion) {
    return c.json({ suggestion: null });
  }

  const { data: inserted } = await supabase
    .from('ai_suggestions')
    .insert({
      album_id: albumId,
      photo_guid: photoGuid,
      suggested_lat: suggestion.latitude,
      suggested_lng: suggestion.longitude,
      suggested_label: suggestion.locationLabel,
      reasoning: suggestion.reasoning,
      status: 'pending',
    })
    .select()
    .single();

  return c.json({ suggestion: inserted });
});

aiSuggestRoutes.post('/albums/:id/photos/:photoGuid/ai-suggest/respond', async (c) => {
  const { supabase } = await requireUser(c);
  const albumId = c.req.param('id');
  const photoGuid = c.req.param('photoGuid');
  const { action } = await c.req.json<{ action: 'accept' | 'reject' }>();

  const { data, error } = await supabase.rpc('respond_to_ai_suggestion', {
    p_album_id: albumId,
    p_photo_guid: photoGuid,
    p_action: action,
  });

  if (error) {
    if (error.message?.includes('suggestion_already_resolved')) {
      return c.json({ error: 'suggestion_already_resolved' }, 409);
    }
    return c.json({ error: 'invalid_request' }, 400);
  }

  return c.json({ status: data?.[0]?.status ?? 'unknown' });
});

export default aiSuggestRoutes;
