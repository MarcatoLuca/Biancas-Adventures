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

describe('album RLS isolation', () => {
  it("a non-member cannot read another album's photos", async () => {
    const owner = await createTestUser(`owner-${Date.now()}@test.local`);
    const outsider = await createTestUser(`outsider-${Date.now()}@test.local`);

    const ownerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${owner.accessToken}` } },
    });
    const { data: album, error: albumError } = await ownerClient
      .from('albums')
      .insert({
        name: 'Test Album',
        icloud_album_token: 'TESTTOKEN',
        owner_user_id: owner.userId,
        invite_code: `invite-${Date.now()}`,
      })
      .select()
      .single();
    expect(albumError).toBeNull();

    await ownerClient
      .from('album_members')
      .insert({ album_id: album!.id, user_id: owner.userId, role: 'owner' });

    await ownerClient.from('photos').insert({
      album_id: album!.id,
      photo_guid: 'guid-1',
      caption: 'test photo',
    });

    const outsiderClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${outsider.accessToken}` } },
    });
    const { data: leakedPhotos } = await outsiderClient
      .from('photos')
      .select('*')
      .eq('album_id', album!.id);

    expect(leakedPhotos).toEqual([]);
  });

  it('joining twice with the same invite code does not duplicate membership', async () => {
    const owner = await createTestUser(`owner2-${Date.now()}@test.local`);
    const joiner = await createTestUser(`joiner-${Date.now()}@test.local`);
    const inviteCode = `invite-${Date.now()}`;

    const ownerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${owner.accessToken}` } },
    });
    const { data: album } = await ownerClient
      .from('albums')
      .insert({
        name: 'Shared Album',
        icloud_album_token: 'TESTTOKEN2',
        owner_user_id: owner.userId,
        invite_code: inviteCode,
      })
      .select()
      .single();
    await ownerClient
      .from('album_members')
      .insert({ album_id: album!.id, user_id: owner.userId, role: 'owner' });

    const joinerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${joiner.accessToken}` } },
    });

    await joinerClient.rpc('join_album_via_invite', { p_invite_code: inviteCode });
    await joinerClient.rpc('join_album_via_invite', { p_invite_code: inviteCode });

    const { data: memberships } = await ownerClient
      .from('album_members')
      .select('*')
      .eq('album_id', album!.id)
      .eq('user_id', joiner.userId);

    expect(memberships).toHaveLength(1);
  });

  it('an unknown invite code raises a clear error', async () => {
    const user = await createTestUser(`lonely-${Date.now()}@test.local`);
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${user.accessToken}` } },
    });

    const { error } = await client.rpc('join_album_via_invite', {
      p_invite_code: 'does-not-exist',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('invalid_invite_code');
  });
});
