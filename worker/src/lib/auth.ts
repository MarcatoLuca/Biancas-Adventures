import type { Context } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

export interface AuthedRequest {
  userId: string;
  supabase: SupabaseClient;
}

type AuthEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET: string;
};

export async function requireUser(c: Context<{ Bindings: AuthEnv }>): Promise<AuthedRequest> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new Error('unauthorized: missing bearer token');
  }

  const token = header.slice('Bearer '.length);

  let userId: string;
  try {
    const secret = new TextEncoder().encode(c.env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
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
