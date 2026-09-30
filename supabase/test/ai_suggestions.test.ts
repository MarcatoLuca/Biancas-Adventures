import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createTestUser(email: string) {
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password123!',
    email_confirm: true,
  });
  if (error) throw error;

  const client = createClient(url, anonKey);
  const { data: session, error: signInError } = await client.auth.signInWithPassword({
    email,
    password: 'password123!',
  });
  if (signInError) throw signInError;

  return { userId: data.user!.id, accessToken: session.session!.access_token };
}

beforeAll(() => {
  expect(url).toBeTruthy();
  expect(anonKey).toBeTruthy();
  expect(serviceKey).toBeTruthy();
});

describe('respond_to_ai_suggestion race guard', () => {
  it('resolves exactly one of two concurrent accept calls for the same pending suggestion', async () => {
    const owner = await createTestUser(`ai-owner-${Date.now()}@test.local`);
    const admin = createClient(url, serviceKey);

    const { data: album } = await admin
      .from('albums')
      .insert({
        name: 'AI Suggestion Album',
        icloud_album_token: 'AITOKEN',
        owner_user_id: owner.userId,
        invite_code: `ai-invite-${Date.now()}`,
      })
      .select()
      .single();

    await admin.from('album_members').insert({ album_id: album!.id, user_id: owner.userId, role: 'owner' });
    await admin.from('photos').insert({ album_id: album!.id, photo_guid: 'ai-guid-1', caption: 'test photo' });
    await admin.from('ai_suggestions').insert({
      album_id: album!.id,
      photo_guid: 'ai-guid-1',
      suggested_lat: 40.85,
      suggested_lng: 14.27,
      suggested_label: 'Napoli, Italia',
      reasoning: 'test',
      status: 'pending',
    });

    const ownerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${owner.accessToken}` } },
    });

    const results = await Promise.allSettled([
      ownerClient.rpc('respond_to_ai_suggestion', {
        p_album_id: album!.id,
        p_photo_guid: 'ai-guid-1',
        p_action: 'accept',
      }),
      ownerClient.rpc('respond_to_ai_suggestion', {
        p_album_id: album!.id,
        p_photo_guid: 'ai-guid-1',
        p_action: 'accept',
      }),
    ]);

    const accepted = results.filter(
      (r) => r.status === 'fulfilled' && !r.value.error && r.value.data?.[0]?.status === 'accepted'
    );
    const failed = results.filter(
      (r) =>
        r.status === 'fulfilled' &&
        r.value.error &&
        r.value.error.message.includes('suggestion_already_resolved')
    );

    expect(accepted).toHaveLength(1);
    expect(failed).toHaveLength(1);
  });
});
