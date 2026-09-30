import { supabase } from './supabaseClient';

const BASE_URL = import.meta.env.VITE_WORKER_URL as string;

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error ?? 'request_failed');
  }
  return body as T;
}
