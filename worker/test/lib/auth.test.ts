import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { requireUser } from '../../src/lib/auth';

const JWT_SECRET = 'test-secret-at-least-32-bytes-long!!';

async function makeToken(sub: string) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

function fakeContext(authHeader?: string) {
  return {
    req: { header: (name: string) => (name === 'Authorization' ? authHeader : undefined) },
    env: {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_JWT_SECRET: JWT_SECRET,
    },
  } as any;
}

describe('requireUser', () => {
  it('extracts the user id from a valid bearer token', async () => {
    const token = await makeToken('user-123');
    const result = await requireUser(fakeContext(`Bearer ${token}`));

    expect(result.userId).toBe('user-123');
    expect(result.supabase).toBeDefined();
  });

  it('throws for a missing Authorization header', async () => {
    await expect(requireUser(fakeContext(undefined))).rejects.toThrow('unauthorized');
  });

  it('throws for a tampered token', async () => {
    const token = await makeToken('user-123');

    await expect(requireUser(fakeContext(`Bearer ${token}tampered`))).rejects.toThrow(
      'unauthorized',
    );
  });
});
