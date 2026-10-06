import type { Context } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AuthedRequest {
  userId: string;
  supabase: SupabaseClient;
}

type AuthEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  // Legacy projects: shared HS256 secret (Project Settings > API > JWT Settings).
  SUPABASE_JWT_SECRET?: string;
  // Newer projects (publishable/secret key pairs): asymmetric keys verified via JWKS.
  SUPABASE_JWKS_URL?: string;
};

// Cached across invocations so we don't refetch the JWKS on every request.
let cachedJwks: { url: string; keySet: JWTVerifyGetKey } | null = null;

function getRemoteJwks(jwksUrl: string): JWTVerifyGetKey {
  if (!cachedJwks || cachedJwks.url !== jwksUrl) {
    cachedJwks = { url: jwksUrl, keySet: createRemoteJWKSet(new URL(jwksUrl)) };
  }
  return cachedJwks.keySet;
}

export async function requireUser(c: Context<{ Bindings: AuthEnv }>): Promise<AuthedRequest> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new Error('unauthorized: missing bearer token');
  }

  const token = header.slice('Bearer '.length);

  let userId: string;
  try {
    const payload = c.env.SUPABASE_JWT_SECRET
      ? (await jwtVerify(token, new TextEncoder().encode(c.env.SUPABASE_JWT_SECRET))).payload
      : (await jwtVerify(token, getRemoteJwks(c.env.SUPABASE_JWKS_URL!))).payload;

    if (typeof payload.sub !== 'string') {
      throw new Error('no sub claim');
    }
    userId = payload.sub;
  } catch {
    throw new Error('unauthorized: invalid token');
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: header } },
  });

  return { userId, supabase };
}
