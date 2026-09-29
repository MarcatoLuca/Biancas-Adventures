import { cors } from 'hono/cors';
import { Hono } from 'hono';
import albumsRouter from './routes/albums';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET: string;
  GEMINI_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());
app.get('/health', (c) => c.json({ ok: true }));
app.route('/albums', albumsRouter);

export default app;
