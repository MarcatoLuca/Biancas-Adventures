# Deployment guide

## Prerequisites

- A Cloudflare account (free tier is enough for Workers + Pages).
- A Supabase project (free tier).
- A Gemini API key (free tier).
- Node.js 20+.

## 1. Database

Apply the schema and migrations to your Supabase project:

```bash
supabase db push
```

If you don't use the Supabase CLI locally, paste the contents of
`supabase/migrations/0001_init.sql` (and any subsequent `000N_*.sql` files) into the
Supabase project's SQL Editor and run them in order. Note: if the base schema is already
present, re-running `0001_init.sql` in full will fail with `relation "..." already exists`;
in that case only run the newer, not-yet-applied migration files.

## 2. Worker (API)

```bash
cd worker
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

`worker/wrangler.toml` defines the Worker name and compatibility date; secrets are never
committed to the repository.

## 3. Frontend (Pages)

```bash
cd frontend
npm run build
npx wrangler pages deploy dist
```

Or connect the repository in the Cloudflare Pages dashboard and set these build-time
environment variables:

- `VITE_WORKER_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 4. Manual smoke-test checklist

Run this checklist once after every deploy, since there is no live-network end-to-end
automated suite (per the project's global constraints: no real iCloud/Gemini/Supabase
calls in CI).

- [ ] Sign up / log in via Supabase Auth email link.
- [ ] Create a new album with a real Shared Album public link; confirm the invite code is
  generated.
- [ ] Join the same album from a second account using the invite code; confirm both
  accounts see the same synced photos.
- [ ] Open an unplaced photo; confirm the Gemini suggestion banner appears (or gracefully
  shows nothing) within a few seconds.
- [ ] Accept a suggestion; confirm the marker appears on the map and the city radial-wash
  theme renders.
- [ ] Manually place a different unplaced photo via the location picker; confirm the
  reverse-geocoded label appears.
- [ ] Edit the location of an already-placed photo manually; confirm the marker moves.
- [ ] Install the PWA (Chrome "Install app" prompt) and reload with network disabled;
  confirm previously-viewed photos/map still render.
- [ ] As the album owner, rename the album and regenerate its invite code from the
  settings screen; confirm a non-owner member cannot see those controls.
