import { Hono } from 'hono';
import { generateCityTheme } from '../lib/geminiCityTheme';
import { requireUser } from '../lib/auth';
import type { Env } from '../index';

const cityThemeRoutes = new Hono<{ Bindings: Env }>();

cityThemeRoutes.get('/city-themes/:cityLabel', async (c) => {
  const { supabase } = await requireUser(c);
  const cityLabel = decodeURIComponent(c.req.param('cityLabel'));

  const { data: existing } = await supabase
    .from('city_themes')
    .select('*')
    .ilike('city_label', cityLabel)
    .maybeSingle();

  if (existing) {
    return c.json({ theme: existing });
  }

  const theme = await generateCityTheme(c.env.GEMINI_API_KEY, cityLabel);
  if (!theme) {
    return c.json({ theme: null });
  }

  const { data: inserted } = await supabase
    .from('city_themes')
    .insert({
      city_label: cityLabel,
      color_1: theme.primary,
      color_2: theme.secondary,
      color_3: theme.accent,
      reasoning: theme.reasoning,
    })
    .select()
    .single();

  return c.json({ theme: inserted });
});

export default cityThemeRoutes;
