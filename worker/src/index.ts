import { cors } from 'hono/cors';
import { Hono } from 'hono';
import albumsRouter from './routes/albums';
import photosRouter from './routes/photos';
import aiSuggestRoutes from './routes/aiSuggest';
import cityThemeRoutes from './routes/cityTheme';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_JWKS_URL?: string;
  GEMINI_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());
app.get('/health', (c) => c.json({ ok: true }));
app.route('/albums', albumsRouter);
app.route('/albums/:albumId/photos', photosRouter);
app.route('/', aiSuggestRoutes);
app.route('/', cityThemeRoutes);

// Ensure every error response is JSON, never Hono/Workers' default plain-text body,
// so the frontend's `res.json()` never throws "... is not valid JSON".
app.onError((err, c) => {
  const message = err.message ?? 'internal_error';
  const status = message.startsWith('unauthorized') ? 401 : 500;
  return c.json({ error: message }, status);
});

export default app;
