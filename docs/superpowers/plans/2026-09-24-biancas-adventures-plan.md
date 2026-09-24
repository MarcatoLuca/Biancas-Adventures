# Bianca's Adventures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, installable-as-PWA world-map app where members of a shared iCloud
Album collaboratively assign locations to photos (manually, assisted by Gemini AI), see them
grouped on a stylized game-like map, with multi-user login and shared "Album" workspaces.

**Architecture:** A React/Vite PWA (full-screen MapLibre map) talks only to a Cloudflare
Worker (Hono), which is the sole caller of the public iCloud Shared Album endpoint, Gemini,
and Nominatim, and which reads/writes Supabase Postgres using the requesting user's own
Supabase JWT so Row Level Security is the single source of truth for authorization. No
secret ever reaches the frontend bundle.

**Tech Stack:** React + TypeScript + Vite (`vite-plugin-pwa`), MapLibre GL JS, Framer Motion,
Cloudflare Workers (Hono), Supabase (Postgres + Auth), Google Gemini API (free tier),
Nominatim (OpenStreetMap), Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-24-biancas-adventures-design.md`

## Global Constraints

- Every service used must have a permanent free tier for personal/low-volume use; no paid
  feature anywhere in the product (spec §1, §11).
- No native/cross-platform compiled app; the product is a PWA installed via Safari "Add to
  Home Screen" (spec §2).
- Photos never carry GPS/EXIF from the source; `location_source` is only `manual` or
  `ai_accepted`, never `exif` (spec §2, §6).
- One "Album" app entity = exactly one iCloud Shared Album token; no multi-album merging
  (spec §2, §12).
- `photoGuid` (scoped to `album_id`) is the stable identity for a photo across syncs
  (spec §5).
- Gemini is called at most once per photo (cached in `ai_suggestions`) and at most once per
  unique city label (cached in `city_themes`) — never re-called automatically after a
  cached row exists (spec §6, §7).
- No API key or secret (Gemini, Supabase service role) is ever sent to or embedded in the
  frontend bundle; only the Cloudflare Worker holds secrets (spec §3, §4).
- Authorization is enforced by Postgres Row Level Security via `album_members`, not only by
  application code (spec §4).
- All members of an Album can add/edit photo positions; only the `owner` can rename the
  Album, change its iCloud token, or regenerate its invite code (spec §4).

## Review Focus

- Invalid, private, or malformed iCloud Shared Album link/token → sync must return a clear
  error the UI can show, never crash or silently show zero photos as if the album were
  empty (spec §5).
- Using an invite code twice (already a member) or an unknown invite code → joining must be
  idempotent for the former (no duplicate membership, no error) and must return a clear
  "invalid code" error for the latter, never a raw 500 (spec §4).
- A user who is not a member of an Album must never be able to read or write that Album's
  `photos`/`ai_suggestions` via the Worker API, even with a syntactically valid `album_id`
  (spec §4).
- A photo whose only derivative is a video (`mediaAssetType: 'video'`) or that has no
  derivatives at all must render a sane fallback in the gallery/detail view, never a broken
  `<img>` or a crash (spec §5, §9 — Shared Album items are not guaranteed to be static
  images).
- Two members confirming a location for the same photo at nearly the same time (double
  "Accetta"/manual save) must not crash on a duplicate-key error and must leave the photo in
  a single consistent state (spec §7 point 5, §4 "piena collaborazione").

---

## File Structure

```
Bianca's Adventures/
  package.json                     # npm workspaces root
  .gitignore
  supabase/
    migrations/
      0001_init.sql                # tables, enums, RLS policies, RPC functions
  worker/
    package.json
    wrangler.toml
    src/
      index.ts                     # Hono app + route mounting
      lib/
        auth.ts                    # verify Supabase JWT, build per-request client
        icloud.ts                  # public Shared Album webstream client
        gemini.ts                  # Gemini location-suggestion vision/text call
        geminiCityTheme.ts         # Gemini per-city 3-color palette call
        nominatim.ts               # reverse geocoding
      routes/
        albums.ts                  # create/join/list/regenerate-invite
        photos.ts                  # sync + manual location update
        aiSuggest.ts               # AI location suggestion
        cityTheme.ts               # AI city palette (ensure-exists)
    test/
      lib/icloud.test.ts
      lib/gemini.test.ts
      lib/geminiCityTheme.test.ts
      lib/nominatim.test.ts
      routes/albums.test.ts
      routes/photos.test.ts
      routes/aiSuggest.test.ts
      routes/cityTheme.test.ts
  frontend/
    package.json
    vite.config.ts
    index.html
    public/
      icons/icon-192.png
      icons/icon-512.png
      # manifest.webmanifest is generated at build time by vite-plugin-pwa (Task 18),
      # not hand-authored
    src/
      main.tsx
      App.tsx
      lib/
        supabaseClient.ts
        workerApi.ts
      auth/
        LoginScreen.tsx
        useAuth.ts
      albums/
        useAlbums.ts
        AlbumSwitcher.tsx
        CreateAlbumModal.tsx
        JoinAlbumModal.tsx
      photos/
        usePhotos.ts
        PhotoGalleryPanel.tsx
        PhotoDetailView.tsx
        UnplacedQueuePanel.tsx
        LocationPickerMap.tsx
        AiSuggestionBanner.tsx
        useAiSuggestion.ts
      map/
        MapView.tsx
        mapStyle.ts
        useClusteredPhotos.ts
        AlbumMarker.tsx
        CityThemeOverlay.tsx
        useCityThemes.ts
      hud/
        HudButton.tsx
        HudLayer.tsx
      settings/
        AlbumSettingsScreen.tsx
      pwa/
        manifest.ts
    test/
      setupTests.ts
      auth/LoginScreen.test.tsx
      albums/AlbumSwitcher.test.tsx
      photos/usePhotos.test.ts
      photos/PhotoDetailView.test.tsx
      map/useClusteredPhotos.test.ts
```

Responsibility summary: `worker/src/lib/*` each wraps exactly one external system
(iCloud, Gemini, Nominatim, Supabase auth) behind a small typed function so routes stay
thin and testable with mocks. `frontend/src/*` is split by feature folder (auth, albums,
photos, map, hud, settings), each folder owning its own hooks + components so a reviewer
can approve one feature without reading the others.

---

### Task 1: Monorepo scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/wrangler.toml`
- Create: `frontend/package.json` (via Vite scaffold, then edited)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: two npm workspaces (`worker`, `frontend`) that later tasks add files into;
  `npm test --workspace=worker` and `npm test --workspace=frontend` as the test commands
  every later task's steps assume.

- [ ] **Step 1: Create root workspace `package.json`**

```json
{
  "name": "biancas-adventures",
  "private": true,
  "workspaces": ["worker", "frontend"],
  "scripts": {
    "test:worker": "npm test --workspace=worker",
    "test:frontend": "npm test --workspace=frontend"
  }
}
```

- [ ] **Step 2: Create root `.gitignore`**

```
node_modules/
dist/
.wrangler/
.env
.env.local
*.local
```

- [ ] **Step 3: Scaffold the worker package**

Run:
```
cd worker
npm init -y
npm install hono @supabase/supabase-js jose
npm install -D typescript vitest wrangler @cloudflare/workers-types
```

Create `worker/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types", "vitest/globals"],
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src", "test"]
}
```

Create `worker/wrangler.toml`:
```toml
name = "biancas-adventures-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[vars]
SUPABASE_URL = ""

# Secrets set via `wrangler secret put`, never committed:
# SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, GEMINI_API_KEY
```

Edit `worker/package.json` to add scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  }
}
```

- [ ] **Step 4: Scaffold the frontend package**

Run:
```
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install maplibre-gl framer-motion @supabase/supabase-js
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom vite-plugin-pwa
```

Edit `frontend/package.json` scripts to include:
```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

Create `frontend/test/setupTests.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

Edit `frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setupTests.ts'],
    globals: true,
  },
});
```

- [ ] **Step 5: Verify both workspaces run their (empty) test suites**

Run: `npm run test:worker` and `npm run test:frontend` from the repo root.
Expected: both report "No test files found" (or pass with zero tests) — not an error
about missing config.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore worker frontend
git commit -m "chore: scaffold worker and frontend workspaces"
```

---

### Task 2: Supabase schema, RLS policies, and invite RPCs

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Test: `supabase/test/rls.test.ts` (run against local Supabase via `supabase start`)
- Create: `supabase/package.json` (test runner deps for this folder)

**Interfaces:**
- Consumes: nothing.
- Produces: tables `albums`, `album_members`, `photos`, `ai_suggestions`, `city_themes`;
  RPC functions `join_album_via_invite(p_invite_code text) returns uuid` and
  `is_album_member(target_album_id uuid) returns boolean`, which Task 4 and later Worker
  routes call by name.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_init.sql`:
```sql
create extension if not exists "uuid-ossp";

create table albums (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  icloud_album_token text not null,
  owner_user_id uuid not null references auth.users(id),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create type album_role as enum ('owner', 'member');

create table album_members (
  album_id uuid not null references albums(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role album_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

create type location_source as enum ('manual', 'ai_accepted');

create table photos (
  album_id uuid not null references albums(id) on delete cascade,
  photo_guid text not null,
  date_created timestamptz,
  caption text,
  media_asset_type text,
  thumb_url text,
  full_url text,
  latitude double precision,
  longitude double precision,
  location_source location_source,
  location_label text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (album_id, photo_guid)
);

create type suggestion_status as enum ('pending', 'accepted', 'rejected');

create table ai_suggestions (
  album_id uuid not null,
  photo_guid text not null,
  suggested_lat double precision not null,
  suggested_lng double precision not null,
  suggested_label text,
  reasoning text,
  status suggestion_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (album_id, photo_guid),
  foreign key (album_id, photo_guid) references photos(album_id, photo_guid) on delete cascade
);

create table city_themes (
  city_label text primary key,
  color_1 text not null,
  color_2 text not null,
  color_3 text not null,
  reasoning text,
  created_at timestamptz not null default now()
);

alter table albums enable row level security;
alter table album_members enable row level security;
alter table photos enable row level security;
alter table ai_suggestions enable row level security;
alter table city_themes enable row level security;

create or replace function is_album_member(target_album_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from album_members
    where album_id = target_album_id and user_id = auth.uid()
  );
$$;

create policy "members can read their albums"
  on albums for select
  using (is_album_member(id));

create policy "authenticated users can create albums"
  on albums for insert
  with check (owner_user_id = auth.uid());

create policy "owner can update album"
  on albums for update
  using (owner_user_id = auth.uid());

create policy "members can read membership rows for their albums"
  on album_members for select
  using (is_album_member(album_id));

create policy "owner can insert the first membership row"
  on album_members for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from albums where id = album_id and owner_user_id = auth.uid())
  );

create policy "members can read photos"
  on photos for select
  using (is_album_member(album_id));

create policy "members can insert photos"
  on photos for insert
  with check (is_album_member(album_id));

create policy "members can update photos"
  on photos for update
  using (is_album_member(album_id));

create policy "members can read ai_suggestions"
  on ai_suggestions for select
  using (is_album_member(album_id));

create policy "members can write ai_suggestions"
  on ai_suggestions for all
  using (is_album_member(album_id))
  with check (is_album_member(album_id));

create policy "authenticated users can read city themes"
  on city_themes for select
  to authenticated
  using (true);

create policy "authenticated users can insert city themes"
  on city_themes for insert
  to authenticated
  with check (true);

create or replace function join_album_via_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_album_id uuid;
begin
  select id into v_album_id from albums where invite_code = p_invite_code;

  if v_album_id is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into album_members (album_id, user_id, role)
  values (v_album_id, auth.uid(), 'member')
  on conflict (album_id, user_id) do nothing;

  return v_album_id;
end;
$$;

grant execute on function join_album_via_invite(text) to authenticated;
grant execute on function is_album_member(uuid) to authenticated;
```

- [ ] **Step 2: Install the Supabase CLI and start the local stack**

Run (once, requires Docker Desktop running):
```
npm install -g supabase
supabase init
supabase start
```
Expected: prints local `API URL`, `anon key`, and `service_role key` — copy these into
`supabase/.env.test` (git-ignored) for the next step.

- [ ] **Step 3: Write the failing RLS test**

Create `supabase/package.json`:
```json
{
  "name": "supabase-tests",
  "private": true,
  "scripts": { "test": "vitest run" },
  "devDependencies": { "vitest": "^2.0.0", "@supabase/supabase-js": "^2.45.0", "dotenv": "^16.0.0" }
}
```

Create `supabase/test/rls.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
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

describe('album RLS isolation', () => {
  it('a non-member cannot read another album\'s photos', async () => {
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
```

- [ ] **Step 4: Run the test to verify it fails (migration not applied yet)**

Run:
```
cd supabase
npm install
supabase db reset
npm test
```
Expected: FAIL — `relation "photos" does not exist` (migration file present but not yet
picked up because `supabase db reset` had nothing to apply, or table missing) — confirms
the test actually exercises real schema, not a mock.

- [ ] **Step 5: Apply the migration and re-run**

Run:
```
supabase db reset
```
(This re-applies every file under `supabase/migrations/` in order, including
`0001_init.sql`.) Then export the printed local `API URL`/`anon key`/`service_role key`
into `supabase/.env.test` and run:
```
npm test
```
Expected: PASS — all three tests green.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat: add Supabase schema, RLS policies, and invite RPC"
```

---

### Task 3: Worker auth middleware (verify Supabase JWT)

**Files:**
- Create: `worker/src/lib/auth.ts`
- Create: `worker/src/index.ts`
- Test: `worker/test/lib/auth.test.ts`

**Interfaces:**
- Consumes: env vars `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`.
- Produces: `requireUser(c: Context): Promise<{ userId: string; supabase: SupabaseClient }>`
  — every later route (`albums.ts`, `photos.ts`, `aiSuggest.ts`, `cityTheme.ts`) calls this
  first and receives a `supabase` client already scoped to the caller's JWT so RLS applies.

- [ ] **Step 1: Write the failing test**

Create `worker/test/lib/auth.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
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
    await expect(requireUser(fakeContext(`Bearer ${token}x`))).rejects.toThrow('unauthorized');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/lib/auth.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/auth'".

- [ ] **Step 3: Implement `worker/src/lib/auth.ts`**

```ts
import { jwtVerify } from 'jose';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Context } from 'hono';

export interface AuthedRequest {
  userId: string;
  supabase: SupabaseClient;
}

export async function requireUser(c: Context): Promise<AuthedRequest> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new Error('unauthorized: missing bearer token');
  }
  const token = header.slice('Bearer '.length);

  let userId: string;
  try {
    const secret = new TextEncoder().encode(c.env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== 'string') throw new Error('no sub claim');
    userId = payload.sub;
  } catch {
    throw new Error('unauthorized: invalid token');
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: header } },
  });

  return { userId, supabase };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/lib/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the Hono app entrypoint**

Create `worker/src/index.ts`:
```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET: string;
  GEMINI_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());
app.get('/health', (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/lib/auth.ts worker/src/index.ts worker/test/lib/auth.test.ts
git commit -m "feat: verify Supabase JWT in the Worker"
```

---

### Task 4: Worker album routes (create, join, list, regenerate invite)

**Files:**
- Create: `worker/src/routes/albums.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/routes/albums.test.ts`

**Interfaces:**
- Consumes: `requireUser` from Task 3.
- Produces: `albumsRouter` (Hono `Hono` instance) mounted at `/albums`, exposing:
  `POST /albums` (create, body `{ name, icloudAlbumUrl }`), `POST /albums/join` (body
  `{ inviteCode }`), `GET /albums` (list caller's albums), `POST /albums/:id/invite/regenerate`.
  Later tasks (`photos.ts`, `aiSuggest.ts`) reuse the `extractIcloudToken` helper exported
  from this file.

- [ ] **Step 1: Write the failing test**

Create `worker/test/routes/albums.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import albumsRouter, { extractIcloudToken } from '../../src/routes/albums';

vi.mock('../../src/lib/auth', () => ({
  requireUser: vi.fn(),
}));
import { requireUser } from '../../src/lib/auth';

function fakeSupabase(overrides: Record<string, any> = {}) {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => overrides.insertResult ?? { data: { id: 'album-1' }, error: null }),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve(overrides.listResult ?? { data: [], error: null })),
      })),
    })),
    rpc: vi.fn(async () => overrides.rpcResult ?? { data: 'album-1', error: null }),
  };
}

describe('extractIcloudToken', () => {
  it('extracts the token from a full share URL', () => {
    expect(extractIcloudToken('https://www.icloud.com/sharedalbum/#B0z5qAGN1JIFd3y')).toBe(
      'B0z5qAGN1JIFd3y'
    );
  });

  it('returns the input unchanged if it is already a bare token', () => {
    expect(extractIcloudToken('B0z5qAGN1JIFd3y')).toBe('B0z5qAGN1JIFd3y');
  });

  it('throws for an empty string', () => {
    expect(() => extractIcloudToken('')).toThrow('invalid_icloud_link');
  });
});

describe('POST /albums', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an album and returns its id', async () => {
    const supabase = fakeSupabase();
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums', {
      method: 'POST',
      body: JSON.stringify({ name: 'Family', icloudAlbumUrl: 'https://www.icloud.com/sharedalbum/#TOKEN1' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.albumId).toBe('album-1');
  });
});

describe('POST /albums/join', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 with a clear message for an unknown invite code', async () => {
    const supabase = fakeSupabase({ rpcResult: { data: null, error: { message: 'invalid_invite_code' } } });
    (requireUser as any).mockResolvedValue({ userId: 'user-2', supabase });

    const app = new Hono();
    app.route('/albums', albumsRouter);
    const res = await app.request('/albums/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'nope' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_invite_code');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/routes/albums.test.ts`
Expected: FAIL with "Cannot find module '../../src/routes/albums'".

- [ ] **Step 3: Implement `worker/src/routes/albums.ts`**

```ts
import { Hono } from 'hono';
import { requireUser } from '../lib/auth';
import type { Env } from '../index';

const albumsRouter = new Hono<{ Bindings: Env }>();

export function extractIcloudToken(input: string): string {
  if (!input) throw new Error('invalid_icloud_link');
  const match = input.match(/sharedalbum\/#(.+)$/);
  const token = match ? match[1] : input;
  if (!token) throw new Error('invalid_icloud_link');
  return token;
}

function randomInviteCode(): string {
  return crypto.randomUUID().slice(0, 8);
}

albumsRouter.post('/', async (c) => {
  const { userId, supabase } = await requireUser(c);
  const body = await c.req.json<{ name: string; icloudAlbumUrl: string }>();

  let token: string;
  try {
    token = extractIcloudToken(body.icloudAlbumUrl);
  } catch {
    return c.json({ error: 'invalid_icloud_link' }, 400);
  }

  const { data: album, error } = await supabase
    .from('albums')
    .insert({
      name: body.name,
      icloud_album_token: token,
      owner_user_id: userId,
      invite_code: randomInviteCode(),
    })
    .select()
    .single();

  if (error || !album) {
    return c.json({ error: 'could_not_create_album' }, 500);
  }

  await supabase.from('album_members').insert({
    album_id: album.id,
    user_id: userId,
    role: 'owner',
  });

  return c.json({ albumId: album.id }, 201);
});

albumsRouter.post('/join', async (c) => {
  const { supabase } = await requireUser(c);
  const body = await c.req.json<{ inviteCode: string }>();

  const { data, error } = await supabase.rpc('join_album_via_invite', {
    p_invite_code: body.inviteCode,
  });

  if (error) {
    return c.json({ error: 'invalid_invite_code' }, 400);
  }

  return c.json({ albumId: data });
});

albumsRouter.get('/', async (c) => {
  const { userId, supabase } = await requireUser(c);
  const { data, error } = await supabase
    .from('album_members')
    .select('album_id, role, albums(id, name)')
    .eq('user_id', userId);

  if (error) return c.json({ error: 'could_not_list_albums' }, 500);
  return c.json({ albums: data });
});

export default albumsRouter;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/routes/albums.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Mount the router**

Modify `worker/src/index.ts`:
```ts
import albumsRouter from './routes/albums';
// ...after app.get('/health', ...):
app.route('/albums', albumsRouter);
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/albums.ts worker/src/index.ts worker/test/routes/albums.test.ts
git commit -m "feat: add album create/join/list routes"
```

---

### Task 5: iCloud Shared Album client + photo sync route

**Files:**
- Create: `worker/src/lib/icloud.ts`
- Create: `worker/src/routes/photos.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/lib/icloud.test.ts`, `worker/test/routes/photos.test.ts`

**Interfaces:**
- Consumes: `requireUser` (Task 3).
- Produces: `fetchSharedAlbum(token: string, fetchImpl?: typeof fetch): Promise<IcloudPhoto[]>`
  where `IcloudPhoto = { photoGuid: string; caption: string; dateCreated: string | null;
  mediaAssetType?: 'video'; thumbUrl: string | null; fullUrl: string | null }`; and
  `photosRouter` mounted at `/albums/:albumId/photos` exposing `GET /` (sync + list) and
  `PATCH /:photoGuid/location` (manual location update), reused by Task 12 (frontend) and
  referenced by Task 14 (AI suggestions read `photos` the same way).

- [ ] **Step 1: Write the failing test for the iCloud client**

Create `worker/test/lib/icloud.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchSharedAlbum } from '../../src/lib/icloud';

function mockFetchSequence(responses: Array<{ status: number; body: any }>) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return {
      status: r.status,
      json: async () => r.body,
    } as any;
  });
}

describe('fetchSharedAlbum', () => {
  it('parses photos from a direct (non-redirected) webstream response', async () => {
    const fetchImpl = mockFetchSequence([
      {
        status: 200,
        body: {
          photos: [
            {
              photoGuid: 'guid-1',
              caption: 'Sunset',
              dateCreated: '2024-07-12T18:00:00Z',
              derivatives: { '720': { checksum: 'abc' } },
            },
          ],
        },
      },
      { status: 200, body: { items: { abc: { url_location: 'cdn.example.com', url_path: '/abc.jpg' } } } },
    ]);

    const photos = await fetchSharedAlbum('TOKEN1', fetchImpl);

    expect(photos).toEqual([
      {
        photoGuid: 'guid-1',
        caption: 'Sunset',
        dateCreated: '2024-07-12T18:00:00Z',
        mediaAssetType: undefined,
        thumbUrl: 'https://cdn.example.com/abc.jpg',
        fullUrl: 'https://cdn.example.com/abc.jpg',
      },
    ]);
  });

  it('follows a 330 redirect to the host given in the response body', async () => {
    const fetchImpl = mockFetchSequence([
      { status: 330, body: { 'X-Apple-MMe-Host': 'p95-sharedstreams.icloud.com' } },
      { status: 200, body: { photos: [] } },
    ]);

    const photos = await fetchSharedAlbum('TOKEN2', fetchImpl);

    expect(photos).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((fetchImpl.mock.calls[1][0] as string)).toContain('p95-sharedstreams.icloud.com');
  });

  it('marks video items and tolerates photos with no derivatives', async () => {
    const fetchImpl = mockFetchSequence([
      {
        status: 200,
        body: {
          photos: [
            { photoGuid: 'guid-video', caption: '', dateCreated: null, mediaAssetType: 'video', derivatives: {} },
            { photoGuid: 'guid-empty', caption: '', dateCreated: null, derivatives: {} },
          ],
        },
      },
      { status: 200, body: { items: {} } },
    ]);

    const photos = await fetchSharedAlbum('TOKEN3', fetchImpl);

    expect(photos[0]).toMatchObject({ photoGuid: 'guid-video', mediaAssetType: 'video', thumbUrl: null });
    expect(photos[1]).toMatchObject({ photoGuid: 'guid-empty', thumbUrl: null, fullUrl: null });
  });

  it('throws a clear error for an invalid/unreachable album token', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network error');
    });

    await expect(fetchSharedAlbum('BADTOKEN', fetchImpl)).rejects.toThrow('icloud_album_unreachable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/lib/icloud.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/icloud'".

- [ ] **Step 3: Implement `worker/src/lib/icloud.ts`**

```ts
export interface IcloudPhoto {
  photoGuid: string;
  caption: string;
  dateCreated: string | null;
  mediaAssetType?: 'video';
  thumbUrl: string | null;
  fullUrl: string | null;
}

interface RawDerivative {
  checksum: string;
}

interface RawPhoto {
  photoGuid: string;
  caption?: string;
  dateCreated?: string | null;
  mediaAssetType?: 'video';
  derivatives?: Record<string, RawDerivative>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function postJson(url: string, body: unknown, fetchImpl: typeof fetch) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

export async function fetchSharedAlbum(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<IcloudPhoto[]> {
  let host = 'www.icloud.com';

  try {
    const streamUrl = `https://${host}/${token}/sharedstreams/webstream`;
    let response = await postJson(streamUrl, { streamCtag: null }, fetchImpl);

    if (response.status === 330) {
      host = (response.json as any)['X-Apple-MMe-Host'];
      response = await postJson(`https://${host}/${token}/sharedstreams/webstream`, { streamCtag: null }, fetchImpl);
    }

    const rawPhotos: RawPhoto[] = (response.json as any).photos ?? [];
    const checksums = rawPhotos
      .flatMap((p) => Object.values(p.derivatives ?? {}))
      .map((d) => d.checksum);

    const urlByChecksum: Record<string, string> = {};
    for (const batch of chunk(checksums, 25)) {
      if (batch.length === 0) continue;
      const assetRes = await postJson(
        `https://${host}/${token}/sharedstreams/webasseturls`,
        { photoGuids: rawPhotos.map((p) => p.photoGuid) },
        fetchImpl
      );
      const items = (assetRes.json as any).items ?? {};
      for (const [checksum, info] of Object.entries(items) as [string, any][]) {
        urlByChecksum[checksum] = `https://${info.url_location}${info.url_path}`;
      }
      void batch;
    }

    return rawPhotos.map((p) => {
      const derivatives = Object.values(p.derivatives ?? {});
      const firstUrl = derivatives.map((d) => urlByChecksum[d.checksum]).find(Boolean) ?? null;
      return {
        photoGuid: p.photoGuid,
        caption: p.caption ?? '',
        dateCreated: p.dateCreated ?? null,
        mediaAssetType: p.mediaAssetType,
        thumbUrl: firstUrl,
        fullUrl: firstUrl,
      };
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('icloud_')) throw err;
    throw new Error('icloud_album_unreachable');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/lib/icloud.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for the photos route**

Create `worker/test/routes/photos.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import photosRouter from '../../src/routes/photos';

vi.mock('../../src/lib/auth', () => ({ requireUser: vi.fn() }));
vi.mock('../../src/lib/icloud', () => ({ fetchSharedAlbum: vi.fn() }));
import { requireUser } from '../../src/lib/auth';
import { fetchSharedAlbum } from '../../src/lib/icloud';

function fakeSupabase() {
  const upserted: any[] = [];
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [{ icloud_album_token: 'TOKEN1' }], error: null })),
        single: vi.fn(() => Promise.resolve({ data: { icloud_album_token: 'TOKEN1' }, error: null })),
      })),
      upsert: vi.fn((rows: any[]) => {
        upserted.push(...rows);
        return Promise.resolve({ error: null });
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      })),
    })),
    _upserted: upserted,
  };
}

describe('GET /albums/:albumId/photos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('syncs iCloud photos and returns a clear error if the album is unreachable', async () => {
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase: fakeSupabase() });
    (fetchSharedAlbum as any).mockRejectedValue(new Error('icloud_album_unreachable'));

    const app = new Hono();
    app.route('/albums/:albumId/photos', photosRouter);
    const res = await app.request('/albums/album-1/photos');

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('icloud_album_unreachable');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd worker && npx vitest run test/routes/photos.test.ts`
Expected: FAIL with "Cannot find module '../../src/routes/photos'".

- [ ] **Step 7: Implement `worker/src/routes/photos.ts`**

```ts
import { Hono } from 'hono';
import { requireUser } from '../lib/auth';
import { fetchSharedAlbum } from '../lib/icloud';
import type { Env } from '../index';

const photosRouter = new Hono<{ Bindings: Env }>();

photosRouter.get('/', async (c) => {
  const { supabase } = await requireUser(c);
  const albumId = c.req.param('albumId');

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('icloud_album_token')
    .eq('id', albumId)
    .single();

  if (albumError || !album) {
    return c.json({ error: 'album_not_found_or_forbidden' }, 404);
  }

  let icloudPhotos;
  try {
    icloudPhotos = await fetchSharedAlbum(album.icloud_album_token);
  } catch {
    return c.json({ error: 'icloud_album_unreachable' }, 502);
  }

  await supabase.from('photos').upsert(
    icloudPhotos.map((p) => ({
      album_id: albumId,
      photo_guid: p.photoGuid,
      caption: p.caption,
      date_created: p.dateCreated,
      media_asset_type: p.mediaAssetType ?? null,
      thumb_url: p.thumbUrl,
      full_url: p.fullUrl,
    })),
    { onConflict: 'album_id,photo_guid', ignoreDuplicates: false }
  );

  const { data: rows } = await supabase.from('photos').select('*').eq('album_id', albumId);
  return c.json({ photos: rows ?? [] });
});

photosRouter.patch('/:photoGuid/location', async (c) => {
  const { userId, supabase } = await requireUser(c);
  const albumId = c.req.param('albumId');
  const photoGuid = c.req.param('photoGuid');
  const body = await c.req.json<{ latitude: number; longitude: number; locationLabel: string }>();

  const { error } = await supabase
    .from('photos')
    .update({
      latitude: body.latitude,
      longitude: body.longitude,
      location_label: body.locationLabel,
      location_source: 'manual',
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('album_id', albumId)
    .eq('photo_guid', photoGuid);

  if (error) return c.json({ error: 'could_not_update_location' }, 500);
  return c.json({ ok: true });
});

export default photosRouter;
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd worker && npx vitest run test/routes/photos.test.ts`
Expected: PASS.

- [ ] **Step 9: Mount the router with a video/no-derivative regression test**

Add to `worker/test/routes/photos.test.ts`:
```ts
it('stores photos with no image derivative without throwing', async () => {
  const supabase = fakeSupabase();
  (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });
  (fetchSharedAlbum as any).mockResolvedValue([
    { photoGuid: 'g1', caption: '', dateCreated: null, mediaAssetType: 'video', thumbUrl: null, fullUrl: null },
  ]);

  const app = new Hono();
  app.route('/albums/:albumId/photos', photosRouter);
  const res = await app.request('/albums/album-1/photos');

  expect(res.status).toBe(200);
  expect(supabase._upserted[0]).toMatchObject({ photo_guid: 'g1', thumb_url: null, full_url: null });
});
```
Run: `cd worker && npx vitest run test/routes/photos.test.ts` — expect PASS (2 tests).

Modify `worker/src/index.ts`:
```ts
import photosRouter from './routes/photos';
// ...
app.route('/albums/:albumId/photos', photosRouter);
```

- [ ] **Step 10: Commit**

```bash
git add worker/src/lib/icloud.ts worker/src/routes/photos.ts worker/src/index.ts worker/test/lib/icloud.test.ts worker/test/routes/photos.test.ts
git commit -m "feat: sync photos from iCloud Shared Album and support manual location updates"
```

---

### Task 6: Frontend Supabase client, auth hook, and login screen

**Files:**
- Create: `frontend/.env.local.example`
- Create: `frontend/src/lib/supabaseClient.ts`
- Create: `frontend/src/lib/workerApi.ts`
- Create: `frontend/src/auth/useAuth.ts`
- Create: `frontend/src/auth/LoginScreen.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/test/auth/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useAuth(): { user: User | null; loading: boolean; signInWithPassword(email,
  password): Promise<void>; signOut(): Promise<void> }` and `workerApi.request(path, init)`
  which automatically attaches the current session's access token as `Authorization:
  Bearer <token>` — every later frontend task (`useAlbums`, `usePhotos`, suggestion actions)
  calls `workerApi.request` instead of raw `fetch`.

- [ ] **Step 1: Add environment variable placeholders**

Create `frontend/.env.local.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_WORKER_URL=http://localhost:8787
```

- [ ] **Step 2: Create the Supabase client**

Create `frontend/src/lib/supabaseClient.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

- [ ] **Step 3: Create the Worker API client**

Create `frontend/src/lib/workerApi.ts`:
```ts
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
```

- [ ] **Step 4: Write the failing test for the login screen**

Create `frontend/test/auth/LoginScreen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginScreen } from '../../src/auth/LoginScreen';

describe('LoginScreen', () => {
  it('calls onSubmit with the entered email and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('a@b.com', 'secret123'));
  });

  it('shows an error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('invalid_credentials'));
    render(<LoginScreen onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /accedi/i }));

    expect(await screen.findByText(/invalid_credentials/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/auth/LoginScreen.test.tsx`
Expected: FAIL with "Cannot find module '../../src/auth/LoginScreen'".

- [ ] **Step 6: Implement `frontend/src/auth/LoginScreen.tsx`**

```tsx
import { useState, FormEvent } from 'react';

interface LoginScreenProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginScreen({ onSubmit }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Bianca's Adventures</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Accedi</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/auth/LoginScreen.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Implement `useAuth`**

Create `frontend/src/auth/useAuth.ts`:
```ts
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { user, loading, signInWithPassword, signOut };
}
```

- [ ] **Step 9: Wire into `App.tsx`**

Modify `frontend/src/App.tsx`:
```tsx
import { useAuth } from './auth/useAuth';
import { LoginScreen } from './auth/LoginScreen';

export default function App() {
  const { user, loading, signInWithPassword } = useAuth();

  if (loading) return <p>Caricamento...</p>;
  if (!user) return <LoginScreen onSubmit={signInWithPassword} />;

  return <div>Benvenuto, {user.email}</div>;
}
```

- [ ] **Step 10: Commit**

```bash
git add frontend/.env.local.example frontend/src/lib frontend/src/auth frontend/src/App.tsx frontend/test/auth/LoginScreen.test.tsx
git commit -m "feat: add Supabase auth hook, login screen, and worker API client"
```

---

### Task 7: Album switcher, create, and join UI

**Files:**
- Create: `frontend/src/albums/useAlbums.ts`
- Create: `frontend/src/albums/AlbumSwitcher.tsx`
- Create: `frontend/src/albums/CreateAlbumModal.tsx`
- Create: `frontend/src/albums/JoinAlbumModal.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/test/albums/AlbumSwitcher.test.tsx`

**Interfaces:**
- Consumes: `request` from `workerApi.ts` (Task 6).
- Produces: `useAlbums(): { albums: Album[]; activeAlbumId: string | null;
  setActiveAlbumId(id: string): void; createAlbum(name, icloudAlbumUrl): Promise<string>;
  joinAlbum(inviteCode): Promise<string>; reload(): Promise<void> }` where
  `Album = { id: string; name: string; role: 'owner' | 'member' }` — Task 8's `usePhotos`
  takes `activeAlbumId` as its argument.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/albums/AlbumSwitcher.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AlbumSwitcher } from '../../src/albums/AlbumSwitcher';

describe('AlbumSwitcher', () => {
  it('lists albums and calls onSelect when one is chosen', () => {
    const onSelect = vi.fn();
    render(
      <AlbumSwitcher
        albums={[
          { id: 'a1', name: 'Famiglia', role: 'owner' },
          { id: 'a2', name: 'Amici', role: 'member' },
        ]}
        activeAlbumId="a1"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText('Amici'));
    expect(onSelect).toHaveBeenCalledWith('a2');
  });

  it('renders a message when there are no albums yet', () => {
    render(<AlbumSwitcher albums={[]} activeAlbumId={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/nessun album/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/albums/AlbumSwitcher.test.tsx`
Expected: FAIL with "Cannot find module '../../src/albums/AlbumSwitcher'".

- [ ] **Step 3: Implement `AlbumSwitcher.tsx`**

```tsx
export interface Album {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

interface AlbumSwitcherProps {
  albums: Album[];
  activeAlbumId: string | null;
  onSelect: (albumId: string) => void;
}

export function AlbumSwitcher({ albums, activeAlbumId, onSelect }: AlbumSwitcherProps) {
  if (albums.length === 0) {
    return <p>Nessun album ancora: creane uno o unisciti con un codice invito.</p>;
  }

  return (
    <ul>
      {albums.map((album) => (
        <li key={album.id}>
          <button
            aria-pressed={album.id === activeAlbumId}
            onClick={() => onSelect(album.id)}
          >
            {album.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/albums/AlbumSwitcher.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `useAlbums`**

Create `frontend/src/albums/useAlbums.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import { request } from '../lib/workerApi';
import type { Album } from './AlbumSwitcher';

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await request<{ albums: { album_id: string; role: 'owner' | 'member'; albums: { id: string; name: string } }[] }>(
      '/albums'
    );
    const mapped = res.albums.map((row) => ({
      id: row.albums.id,
      name: row.albums.name,
      role: row.role,
    }));
    setAlbums(mapped);
    setActiveAlbumId((current) => current ?? mapped[0]?.id ?? null);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function createAlbum(name: string, icloudAlbumUrl: string) {
    const res = await request<{ albumId: string }>('/albums', {
      method: 'POST',
      body: JSON.stringify({ name, icloudAlbumUrl }),
    });
    await reload();
    setActiveAlbumId(res.albumId);
    return res.albumId;
  }

  async function joinAlbum(inviteCode: string) {
    const res = await request<{ albumId: string }>('/albums/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
    await reload();
    setActiveAlbumId(res.albumId);
    return res.albumId;
  }

  return { albums, activeAlbumId, setActiveAlbumId, createAlbum, joinAlbum, reload };
}
```

- [ ] **Step 6: Implement the create/join modals**

Create `frontend/src/albums/CreateAlbumModal.tsx`:
```tsx
import { useState, FormEvent } from 'react';

interface CreateAlbumModalProps {
  onCreate: (name: string, icloudAlbumUrl: string) => Promise<void>;
  onClose: () => void;
}

export function CreateAlbumModal({ onCreate, onClose }: CreateAlbumModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onCreate(name, url);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="album-name">Nome album</label>
      <input id="album-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="icloud-url">Link Album Condiviso iCloud</label>
      <input id="icloud-url" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button type="submit">Crea</button>
      <button type="button" onClick={onClose}>Annulla</button>
    </form>
  );
}
```

Create `frontend/src/albums/JoinAlbumModal.tsx`:
```tsx
import { useState, FormEvent } from 'react';

interface JoinAlbumModalProps {
  onJoin: (inviteCode: string) => Promise<void>;
  onClose: () => void;
}

export function JoinAlbumModal({ onJoin, onClose }: JoinAlbumModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await onJoin(inviteCode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="invite-code">Codice invito</label>
      <input id="invite-code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
      <button type="submit">Unisciti</button>
      <button type="button" onClick={onClose}>Annulla</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/albums frontend/test/albums
git commit -m "feat: add album switcher, create, and join UI"
```

---

### Task 8: `usePhotos` data-fetching hook

**Files:**
- Create: `frontend/src/photos/usePhotos.ts`
- Test: `frontend/test/photos/usePhotos.test.ts`

**Interfaces:**
- Consumes: `request` from `workerApi.ts` (Task 6).
- Produces: `usePhotos(albumId: string | null): { photos: Photo[]; unplaced: Photo[];
  loading: boolean; error: string | null; reload(): Promise<void>;
  updateLocation(photoGuid, lat, lng, label): Promise<void> }` where
  `Photo = { albumId: string; photoGuid: string; caption: string; dateCreated: string | null;
  thumbUrl: string | null; fullUrl: string | null; latitude: number | null; longitude: number
  | null; locationLabel: string | null; mediaAssetType?: 'video' }`. Task 10 (`MapView`),
  Task 11 (gallery), and Task 13 (unplaced queue) all consume this hook's return value.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/photos/usePhotos.test.ts`:
```ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));
import { request } from '../../src/lib/workerApi';
import { usePhotos } from '../../src/photos/usePhotos';

describe('usePhotos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('splits photos into placed and unplaced', async () => {
    (request as any).mockResolvedValue({
      photos: [
        { album_id: 'a1', photo_guid: 'g1', caption: '', date_created: null, thumb_url: null, full_url: null, latitude: 41.9, longitude: 12.5, location_label: 'Roma', media_asset_type: null },
        { album_id: 'a1', photo_guid: 'g2', caption: '', date_created: null, thumb_url: null, full_url: null, latitude: null, longitude: null, location_label: null, media_asset_type: null },
      ],
    });

    const { result } = renderHook(() => usePhotos('a1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.photos).toHaveLength(2);
    expect(result.current.unplaced).toEqual([expect.objectContaining({ photoGuid: 'g2' })]);
  });

  it('surfaces a clear error when the sync fails', async () => {
    (request as any).mockRejectedValue(new Error('icloud_album_unreachable'));

    const { result } = renderHook(() => usePhotos('a1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('icloud_album_unreachable');
    expect(result.current.photos).toEqual([]);
  });

  it('does nothing when albumId is null', () => {
    const { result } = renderHook(() => usePhotos(null));
    expect(result.current.loading).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/photos/usePhotos.test.ts`
Expected: FAIL with "Cannot find module '../../src/photos/usePhotos'".

- [ ] **Step 3: Implement `usePhotos.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { request } from '../lib/workerApi';

export interface Photo {
  albumId: string;
  photoGuid: string;
  caption: string;
  dateCreated: string | null;
  thumbUrl: string | null;
  fullUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  mediaAssetType?: 'video';
}

interface RawPhotoRow {
  album_id: string;
  photo_guid: string;
  caption: string;
  date_created: string | null;
  thumb_url: string | null;
  full_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  media_asset_type: string | null;
}

function toPhoto(row: RawPhotoRow): Photo {
  return {
    albumId: row.album_id,
    photoGuid: row.photo_guid,
    caption: row.caption,
    dateCreated: row.date_created,
    thumbUrl: row.thumb_url,
    fullUrl: row.full_url,
    latitude: row.latitude,
    longitude: row.longitude,
    locationLabel: row.location_label,
    mediaAssetType: row.media_asset_type === 'video' ? 'video' : undefined,
  };
}

export function usePhotos(albumId: string | null) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!albumId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request<{ photos: RawPhotoRow[] }>(`/albums/${albumId}/photos`);
      setPhotos(res.photos.map(toPhoto));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function updateLocation(photoGuid: string, latitude: number, longitude: number, locationLabel: string) {
    if (!albumId) return;
    await request(`/albums/${albumId}/photos/${photoGuid}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude, locationLabel }),
    });
    await reload();
  }

  const unplaced = photos.filter((p) => p.latitude === null || p.longitude === null);

  return { photos, unplaced, loading, error, reload, updateLocation };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/photos/usePhotos.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/photos/usePhotos.ts frontend/test/photos/usePhotos.test.ts
git commit -m "feat: add usePhotos data-fetching hook"
```

---

### Task 9: Full-screen stylized MapLibre canvas

**Files:**
- Create: `frontend/src/map/mapStyle.ts`
- Create: `frontend/src/map/MapView.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/test/map/mapStyle.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildMapStyle(): maplibregl.StyleSpecification` (pure data, easy to unit test)
  and `<MapView photos={Photo[]} onOpenAlbum={(lat, lng) => void} />` which Task 10 extends
  with clustering, and which owns the single full-screen `maplibregl.Map` instance every
  later map task (`AlbumMarker`, `CityThemeOverlay`, HUD) attaches layers/markers to via the
  `mapRef` it exposes.

- [ ] **Step 1: Write the failing test for the style builder**

Create `frontend/test/map/mapStyle.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildMapStyle } from '../../src/map/mapStyle';

describe('buildMapStyle', () => {
  it('uses the OpenFreeMap vector source', () => {
    const style = buildMapStyle();
    expect(style.sources.openfreemap).toMatchObject({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    });
  });

  it('defines flat, saturated biome colors for water and landcover layers', () => {
    const style = buildMapStyle();
    const water = style.layers.find((l) => l.id === 'water-fill');
    const forest = style.layers.find((l) => l.id === 'landcover-forest');
    expect(water).toBeDefined();
    expect(forest).toBeDefined();
    expect((water as any).paint['fill-color']).toMatch(/^#/);
    expect((forest as any).paint['fill-color']).toMatch(/^#/);
  });

  it('omits detailed road/POI label layers for a clean cartoon look', () => {
    const style = buildMapStyle();
    const hasRoadLabels = style.layers.some((l) => l.id.includes('road-label'));
    expect(hasRoadLabels).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/map/mapStyle.test.ts`
Expected: FAIL with "Cannot find module '../../src/map/mapStyle'".

- [ ] **Step 3: Implement `mapStyle.ts`**

```ts
import type { StyleSpecification } from 'maplibre-gl';

export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      openfreemap: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#bfe6ff' },
      },
      {
        id: 'landcover-forest',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': '#3f8f4f' },
      },
      {
        id: 'landuse-sand',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'sand'],
        paint: { 'fill-color': '#f4d35e' },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'grass'],
        paint: { 'fill-color': '#8fce6b' },
      },
      {
        id: 'water-fill',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'water',
        paint: { 'fill-color': '#4aa8d8' },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openfreemap',
        'source-layer': 'building',
        paint: { 'fill-color': '#d9a679', 'fill-outline-color': '#8a5a35' },
      },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/map/mapStyle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the full-screen `MapView`**

Create `frontend/src/map/MapView.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle } from './mapStyle';

interface MapViewProps {
  onMapReady: (map: maplibregl.Map) => void;
}

export function MapView({ onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(),
      center: [12.5, 41.9],
      zoom: 2,
    });
    mapRef.current = map;
    map.on('load', () => onMapReady(map));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onMapReady]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
    />
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/map/mapStyle.ts frontend/src/map/MapView.tsx frontend/test/map/mapStyle.test.ts
git commit -m "feat: add full-screen stylized MapLibre canvas"
```

---

### Task 10: Photo clustering and "polaroid" album markers

**Files:**
- Create: `frontend/src/map/useClusteredPhotos.ts`
- Create: `frontend/src/map/AlbumMarker.tsx`
- Modify: `frontend/src/map/MapView.tsx`
- Test: `frontend/test/map/useClusteredPhotos.test.ts`

**Interfaces:**
- Consumes: `Photo[]` (Task 8).
- Produces: `useClusteredPhotos(photos: Photo[], zoom: number, bounds: [number, number,
  number, number]): Cluster[]` where `Cluster = { id: string; latitude: number; longitude:
  number; photos: Photo[]; isCluster: boolean }` (a single-photo location has
  `isCluster: false` and one entry in `photos`); Task 11 reads `cluster.photos` to open the
  gallery panel when a marker is tapped.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/map/useClusteredPhotos.test.ts`:
```ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useClusteredPhotos } from '../../src/map/useClusteredPhotos';
import type { Photo } from '../../src/photos/usePhotos';

function photo(guid: string, lat: number | null, lng: number | null): Photo {
  return {
    albumId: 'a1',
    photoGuid: guid,
    caption: '',
    dateCreated: null,
    thumbUrl: null,
    fullUrl: null,
    latitude: lat,
    longitude: lng,
    locationLabel: null,
  };
}

describe('useClusteredPhotos', () => {
  it('ignores photos without coordinates', () => {
    const { result } = renderHook(() =>
      useClusteredPhotos([photo('g1', null, null)], 4, [-180, -85, 180, 85])
    );
    expect(result.current).toHaveLength(0);
  });

  it('groups two nearby photos into one cluster at low zoom', () => {
    const photos = [photo('g1', 41.9, 12.5), photo('g2', 41.91, 12.51)];
    const { result } = renderHook(() => useClusteredPhotos(photos, 3, [-180, -85, 180, 85]));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].isCluster).toBe(true);
    expect(result.current[0].photos).toHaveLength(2);
  });

  it('keeps far-apart photos as separate single markers', () => {
    const photos = [photo('g1', 41.9, 12.5), photo('g2', 40.7, -74.0)];
    const { result } = renderHook(() => useClusteredPhotos(photos, 3, [-180, -85, 180, 85]));
    expect(result.current).toHaveLength(2);
    expect(result.current.every((c) => !c.isCluster)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/map/useClusteredPhotos.test.ts`
Expected: FAIL with "Cannot find module '../../src/map/useClusteredPhotos'".

- [ ] **Step 3: Install supercluster and implement the hook**

Run: `cd frontend && npm install supercluster && npm install -D @types/supercluster`

Create `frontend/src/map/useClusteredPhotos.ts`:
```ts
import { useMemo } from 'react';
import Supercluster from 'supercluster';
import type { Photo } from '../photos/usePhotos';

export interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  photos: Photo[];
  isCluster: boolean;
}

export function useClusteredPhotos(
  photos: Photo[],
  zoom: number,
  bounds: [number, number, number, number]
): Cluster[] {
  return useMemo(() => {
    const placed = photos.filter(
      (p): p is Photo & { latitude: number; longitude: number } =>
        p.latitude !== null && p.longitude !== null
    );
    if (placed.length === 0) return [];

    const index = new Supercluster<{ photo: Photo }>({ radius: 60, maxZoom: 16 });
    index.load(
      placed.map((p) => ({
        type: 'Feature',
        properties: { photo: p },
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
      }))
    );

    const results = index.getClusters(bounds, Math.round(zoom));

    return results.map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      if (feature.properties.cluster) {
        const leaves = index.getLeaves(feature.properties.cluster_id, Infinity);
        return {
          id: `cluster-${feature.properties.cluster_id}`,
          latitude,
          longitude,
          photos: leaves.map((leaf) => leaf.properties.photo),
          isCluster: true,
        };
      }
      const photo = (feature.properties as { photo: Photo }).photo;
      return {
        id: `photo-${photo.photoGuid}`,
        latitude,
        longitude,
        photos: [photo],
        isCluster: false,
      };
    });
  }, [photos, zoom, bounds]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/map/useClusteredPhotos.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the "polaroid" album marker component**

Create `frontend/src/map/AlbumMarker.tsx`:
```tsx
import { motion } from 'framer-motion';
import type { Cluster } from './useClusteredPhotos';

interface AlbumMarkerProps {
  cluster: Cluster;
  onOpen: (cluster: Cluster) => void;
}

export function AlbumMarker({ cluster, onOpen }: AlbumMarkerProps) {
  const previewPhotos = cluster.photos.slice(0, 2);

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => onOpen(cluster)}
      style={{ position: 'relative', width: 72, height: 72, border: 'none', background: 'none' }}
      aria-label={cluster.isCluster ? `${cluster.photos.length} foto in questa zona` : 'Apri foto'}
    >
      {previewPhotos.map((photo, i) => (
        <img
          key={photo.photoGuid}
          src={photo.thumbUrl ?? undefined}
          alt=""
          style={{
            position: 'absolute',
            width: 56,
            height: 56,
            objectFit: 'cover',
            borderRadius: 8,
            border: '3px solid white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            transform: `rotate(${i === 0 ? -8 : 8}deg) translate(${i * 10}px, ${i * 6}px)`,
          }}
        />
      ))}
      {cluster.isCluster && (
        <span
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            background: '#2b5fad',
            color: 'white',
            borderRadius: 999,
            padding: '2px 6px',
            fontSize: 12,
          }}
        >
          {cluster.photos.length}
        </span>
      )}
    </motion.button>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/map/useClusteredPhotos.ts frontend/src/map/AlbumMarker.tsx frontend/test/map/useClusteredPhotos.test.ts frontend/package.json
git commit -m "feat: cluster photos into polaroid-style album markers"
```

---

### Task 11: Photo gallery panel and single-photo detail view

**Files:**
- Create: `frontend/src/photos/PhotoGalleryPanel.tsx`
- Create: `frontend/src/photos/PhotoDetailView.tsx`
- Test: `frontend/test/photos/PhotoDetailView.test.tsx`

**Interfaces:**
- Consumes: `Photo[]` (Task 8), `Cluster` (Task 10).
- Produces: `<PhotoGalleryPanel photos={Photo[]} onClose={() => void} onEditLocation=
  {(photo: Photo) => void} />` and `<PhotoDetailView photo={Photo} onEditLocation=
  {(photo: Photo) => void} />`, the latter reused by Task 15's AI suggestion flow for the
  "already placed → edit manually" path (spec §7 point 4).

- [ ] **Step 1: Write the failing test (covers the video/no-thumbnail fallback)**

Create `frontend/test/photos/PhotoDetailView.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PhotoDetailView } from '../../src/photos/PhotoDetailView';
import type { Photo } from '../../src/photos/usePhotos';

function makePhoto(overrides: Partial<Photo>): Photo {
  return {
    albumId: 'a1',
    photoGuid: 'g1',
    caption: 'Al mare',
    dateCreated: '2024-07-12T18:00:00Z',
    thumbUrl: 'https://example.com/thumb.jpg',
    fullUrl: 'https://example.com/full.jpg',
    latitude: 41.9,
    longitude: 12.5,
    locationLabel: 'Roma, Italia',
    ...overrides,
  };
}

describe('PhotoDetailView', () => {
  it('renders the full image when available', () => {
    render(<PhotoDetailView photo={makePhoto({})} onEditLocation={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/full.jpg');
  });

  it('shows a video placeholder instead of a broken image for video items', () => {
    render(
      <PhotoDetailView
        photo={makePhoto({ mediaAssetType: 'video', thumbUrl: null, fullUrl: null })}
        onEditLocation={vi.fn()}
      />
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/video non visualizzabile/i)).toBeInTheDocument();
  });

  it('shows a generic placeholder when there is no url and no video flag', () => {
    render(
      <PhotoDetailView photo={makePhoto({ thumbUrl: null, fullUrl: null })} onEditLocation={vi.fn()} />
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/anteprima non disponibile/i)).toBeInTheDocument();
  });

  it('calls onEditLocation when the edit button is pressed', () => {
    const onEditLocation = vi.fn();
    const photo = makePhoto({});
    render(<PhotoDetailView photo={photo} onEditLocation={onEditLocation} />);
    fireEvent.click(screen.getByRole('button', { name: /modifica posizione/i }));
    expect(onEditLocation).toHaveBeenCalledWith(photo);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/photos/PhotoDetailView.test.tsx`
Expected: FAIL with "Cannot find module '../../src/photos/PhotoDetailView'".

- [ ] **Step 3: Implement `PhotoDetailView.tsx`**

```tsx
import type { Photo } from './usePhotos';

interface PhotoDetailViewProps {
  photo: Photo;
  onEditLocation: (photo: Photo) => void;
}

export function PhotoDetailView({ photo, onEditLocation }: PhotoDetailViewProps) {
  return (
    <div>
      {photo.fullUrl ? (
        <img src={photo.fullUrl} alt={photo.caption || 'Foto'} style={{ maxWidth: '100%' }} />
      ) : photo.mediaAssetType === 'video' ? (
        <div role="img" aria-label="Video non visualizzabile in anteprima">
          Video non visualizzabile in anteprima
        </div>
      ) : (
        <div role="img" aria-label="Anteprima non disponibile">
          Anteprima non disponibile
        </div>
      )}
      <p>{photo.caption}</p>
      <p>{photo.locationLabel ?? 'Posizione non impostata'}</p>
      <button onClick={() => onEditLocation(photo)}>Modifica posizione</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/photos/PhotoDetailView.test.tsx`
Expected: PASS (4 tests). Note: the placeholder `div`s use `role="img"` with a distinct
`aria-label`, so `screen.queryByRole('img')` in the fallback tests must instead assert on
text content — this is intentional: adjust the test's video/no-url assertions to
`screen.getByLabelText(/video non visualizzabile/i)` /
`screen.getByLabelText(/anteprima non disponibile/i)` if the literal `queryByRole('img')`
check above does not fail as expected, since a `div` with `role="img"` is still an image
role. Re-run after adjusting; expected PASS (4 tests).

- [ ] **Step 5: Implement the gallery panel with spring-open animation**

Create `frontend/src/photos/PhotoGalleryPanel.tsx`:
```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'framer-motion' as unknown as typeof import('react');
import type { Photo } from './usePhotos';
import { PhotoDetailView } from './PhotoDetailView';

interface PhotoGalleryPanelProps {
  photos: Photo[];
  onClose: () => void;
  onEditLocation: (photo: Photo) => void;
}

export function PhotoGalleryPanel({ photos, onClose, onEditLocation }: PhotoGalleryPanelProps) {
  const [selected, setSelected] = useState<Photo | null>(null);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{ position: 'fixed', inset: 0, background: 'white', overflow: 'auto' }}
      >
        <button onClick={onClose}>Chiudi</button>
        {selected ? (
          <PhotoDetailView photo={selected} onEditLocation={onEditLocation} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {photos.map((photo) => (
              <button key={photo.photoGuid} onClick={() => setSelected(photo)}>
                {photo.thumbUrl ? (
                  <img src={photo.thumbUrl} alt={photo.caption || 'Foto'} style={{ width: '100%' }} />
                ) : (
                  <span>{photo.mediaAssetType === 'video' ? 'Video' : 'Foto'}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
```

Fix the incorrect import line before committing — replace:
```ts
import { useState } from 'framer-motion' as unknown as typeof import('react');
```
with:
```ts
import { useState } from 'react';
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/photos/PhotoGalleryPanel.tsx frontend/src/photos/PhotoDetailView.tsx frontend/test/photos/PhotoDetailView.test.tsx
git commit -m "feat: add photo gallery panel and detail view with media-type fallbacks"
```

---

### Task 12: Worker Nominatim reverse geocoding + manual location picker

**Files:**
- Create: `worker/src/lib/nominatim.ts`
- Test: `worker/test/lib/nominatim.test.ts`
- Create: `frontend/src/photos/LocationPickerMap.tsx`
- Test: `frontend/test/photos/LocationPickerMap.test.tsx`

**Interfaces:**
- Consumes (worker): global `fetch`.
- Produces (worker): `reverseGeocode(lat: number, lng: number): Promise<string | null>` —
  returns a short human label (e.g. "Roma, Italia") or `null` if Nominatim has no result or
  errors; called from the existing `PATCH /albums/:id/photos/:photoGuid/location` route
  (Task 5) whenever the caller omits `locationLabel`, so it never duplicates a label the
  user already typed.
- Produces (frontend): `<LocationPickerMap initialLat={number | null} initialLng={number |
  null} onConfirm={(lat, lng) => void} onCancel={() => void} />`, opened by
  `PhotoDetailView`'s "Modifica posizione" button (Task 11) and by the unplaced-queue panel
  (Task 13).

- [ ] **Step 1: Write the failing worker test**

Create `worker/test/lib/nominatim.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reverseGeocode } from '../../src/lib/nominatim';

describe('reverseGeocode', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('builds a short label from city and country', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { city: 'Roma', country: 'Italia' } }),
    }) as any;

    const label = await reverseGeocode(41.9, 12.5);
    expect(label).toBe('Roma, Italia');
  });

  it('falls back to town/village when city is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { village: 'Positano', country: 'Italia' } }),
    }) as any;

    const label = await reverseGeocode(40.6, 14.5);
    expect(label).toBe('Positano, Italia');
  });

  it('returns null when Nominatim errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as any;
    const label = await reverseGeocode(0, 0);
    expect(label).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as any;
    const label = await reverseGeocode(0, 0);
    expect(label).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/lib/nominatim.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/nominatim'".

- [ ] **Step 3: Implement `worker/src/lib/nominatim.ts`**

```ts
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BiancasAdventures/1.0 (personal, non-commercial)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string> };
    const address = data.address ?? {};
    const place = address.city ?? address.town ?? address.village ?? address.municipality;
    if (!place) return null;
    return address.country ? `${place}, ${address.country}` : place;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/lib/nominatim.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire `reverseGeocode` into the location-update route**

In `worker/src/routes/photos.ts` (from Task 5), find the `PATCH .../location` handler and,
when the request body has no `locationLabel`, call `reverseGeocode(latitude, longitude)` and
use its result (or `null`) as the label before writing to Supabase. Add a focused test in
`worker/test/routes/photos.test.ts` that mocks `reverseGeocode` and asserts it is called only
when `locationLabel` is omitted from the request body, and NOT called when the client already
supplied one.

Run: `cd worker && npx vitest run test/routes/photos.test.ts`
Expected: PASS (existing tests + 2 new ones).

- [ ] **Step 6: Write the failing frontend test**

Create `frontend/test/photos/LocationPickerMap.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('maplibre-gl', () => {
  const handlers: Record<string, (e: any) => void> = {};
  return {
    default: {
      Map: vi.fn().mockImplementation(() => ({
        on: (event: string, cb: (e: any) => void) => {
          handlers[event] = cb;
          if (event === 'load') cb({});
        },
        remove: vi.fn(),
        __handlers: handlers,
      })),
      Marker: vi.fn().mockImplementation(() => ({
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
    },
  };
});

import { LocationPickerMap } from '../../src/photos/LocationPickerMap';

describe('LocationPickerMap', () => {
  it('renders confirm and cancel controls', () => {
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /conferma/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /annulla/i })).toBeInTheDocument();
  });

  it('disables confirm until a point has been picked', () => {
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /conferma/i })).toBeDisabled();
  });

  it('enables confirm immediately when an initial position is provided', () => {
    render(<LocationPickerMap initialLat={41.9} initialLng={12.5} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /conferma/i })).not.toBeDisabled();
  });

  it('calls onCancel when cancel is pressed', () => {
    const onCancel = vi.fn();
    render(<LocationPickerMap initialLat={null} initialLng={null} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /annulla/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/photos/LocationPickerMap.test.tsx`
Expected: FAIL with "Cannot find module '../../src/photos/LocationPickerMap'".

- [ ] **Step 8: Implement `LocationPickerMap.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { buildMapStyle } from '../map/mapStyle';

interface LocationPickerMapProps {
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

export function LocationPickerMap({ initialLat, initialLng, onConfirm, onCancel }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [picked, setPicked] = useState<[number, number] | null>(
    initialLat !== null && initialLng !== null ? [initialLat, initialLng] : null
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(),
      center: [initialLng ?? 12.5, initialLat ?? 41.9],
      zoom: initialLat !== null ? 10 : 1.5,
    });
    mapRef.current = map;
    map.on('load', () => {
      map.on('click', (e: { lngLat: { lat: number; lng: number } }) => {
        const { lat, lng } = e.lngLat;
        setPicked([lat, lng]);
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
      });
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialLat, initialLng]);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button onClick={onCancel}>Annulla</button>
        <button disabled={!picked} onClick={() => picked && onConfirm(picked[0], picked[1])}>
          Conferma posizione
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/photos/LocationPickerMap.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add worker/src/lib/nominatim.ts worker/test/lib/nominatim.test.ts frontend/src/photos/LocationPickerMap.tsx frontend/test/photos/LocationPickerMap.test.tsx
git commit -m "feat: add reverse geocoding and manual location picker map"
```

---

### Task 13: Unplaced-photo queue panel and HUD overlay

**Files:**
- Create: `frontend/src/hud/HudButton.tsx`
- Create: `frontend/src/hud/HudLayer.tsx`
- Create: `frontend/src/photos/UnplacedQueuePanel.tsx`
- Test: `frontend/test/photos/UnplacedQueuePanel.test.tsx`

**Interfaces:**
- Consumes: `Photo[]` from `usePhotos().unplaced` (Task 8).
- Produces: `<UnplacedQueuePanel photos={Photo[]} onSelect={(photo: Photo) => void}
  onClose={() => void} />` and `<HudButton icon count={number} onClick={() => void} />`,
  composed inside `<HudLayer>` which `App.tsx` renders as a fixed overlay above `MapView`
  (game-style HUD, per spec §8).

- [ ] **Step 1: Write the failing test**

Create `frontend/test/photos/UnplacedQueuePanel.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UnplacedQueuePanel } from '../../src/photos/UnplacedQueuePanel';
import type { Photo } from '../../src/photos/usePhotos';

function photo(guid: string): Photo {
  return {
    albumId: 'a1',
    photoGuid: guid,
    caption: `Foto ${guid}`,
    dateCreated: null,
    thumbUrl: null,
    fullUrl: null,
    latitude: null,
    longitude: null,
    locationLabel: null,
  };
}

describe('UnplacedQueuePanel', () => {
  it('lists every unplaced photo', () => {
    render(<UnplacedQueuePanel photos={[photo('g1'), photo('g2')]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Foto g1')).toBeInTheDocument();
    expect(screen.getByText('Foto g2')).toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to place', () => {
    render(<UnplacedQueuePanel photos={[]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/tutte le foto sono posizionate/i)).toBeInTheDocument();
  });

  it('calls onSelect with the tapped photo', () => {
    const onSelect = vi.fn();
    const p1 = photo('g1');
    render(<UnplacedQueuePanel photos={[p1]} onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Foto g1'));
    expect(onSelect).toHaveBeenCalledWith(p1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/photos/UnplacedQueuePanel.test.tsx`
Expected: FAIL with "Cannot find module '../../src/photos/UnplacedQueuePanel'".

- [ ] **Step 3: Implement `UnplacedQueuePanel.tsx`**

```tsx
import type { Photo } from './usePhotos';

interface UnplacedQueuePanelProps {
  photos: Photo[];
  onSelect: (photo: Photo) => void;
  onClose: () => void;
}

export function UnplacedQueuePanel({ photos, onSelect, onClose }: UnplacedQueuePanelProps) {
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 320, background: 'white', overflow: 'auto' }}>
      <button onClick={onClose}>Chiudi</button>
      <h2>Da posizionare</h2>
      {photos.length === 0 ? (
        <p>Tutte le foto sono posizionate! 🎉</p>
      ) : (
        <ul>
          {photos.map((photo) => (
            <li key={photo.photoGuid}>
              <button onClick={() => onSelect(photo)}>{photo.caption || `Foto ${photo.photoGuid}`}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/photos/UnplacedQueuePanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the HUD button and layer (visual-only, no dedicated test)**

Create `frontend/src/hud/HudButton.tsx`:
```tsx
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface HudButtonProps {
  icon: ReactNode;
  count?: number;
  onClick: () => void;
  label: string;
}

export function HudButton({ icon, count, onClick, label }: HudButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: 16,
        border: 'none',
        background: 'rgba(20, 20, 30, 0.75)',
        color: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
      }}
    >
      {icon}
      {!!count && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: '#e0533d',
            borderRadius: 999,
            padding: '2px 6px',
            fontSize: 12,
          }}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
}
```

Create `frontend/src/hud/HudLayer.tsx`:
```tsx
import type { ReactNode } from 'react';

export function HudLayer({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hud frontend/src/photos/UnplacedQueuePanel.tsx frontend/test/photos/UnplacedQueuePanel.test.tsx
git commit -m "feat: add unplaced-photo queue panel and HUD overlay"
```

---

### Task 14: Worker AI location-suggestion route (Gemini)

**Files:**
- Create: `worker/src/lib/gemini.ts`
- Create: `worker/src/routes/aiSuggest.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/lib/gemini.test.ts`
- Test: `worker/test/routes/aiSuggest.test.ts`

**Interfaces:**
- Consumes: `env.GEMINI_API_KEY` (Worker secret, already declared in Task 1's `Env` type),
  `supabase-js` client scoped to the caller's JWT (pattern from Task 4/5), global `fetch`.
- Produces: `suggestLocation(apiKey, targetPhoto, contextPhotos): Promise<{ latitude: number;
  longitude: number; locationLabel: string; reasoning: string } | null>` in `gemini.ts`, and
  two routes in `aiSuggest.ts`:
  - `POST /albums/:id/photos/:photoGuid/ai-suggest` — returns a cached `ai_suggestions` row
    if one already exists for `(album_id, photo_guid)`, otherwise calls Gemini with the
    target photo plus up to 8 already-placed photos from the same album as context (spec §7
    point 3: similar clothing/scenery/nearby dates), stores the result with
    `status = 'pending'`, and returns it. Never calls Gemini twice for the same photo.
  - `POST /albums/:id/photos/:photoGuid/ai-suggest/:suggestionId/respond` — body
    `{ action: 'accept' | 'reject' }`. On `accept`, atomically (via a Postgres RPC, to avoid
    the Review Focus race condition where two members accept concurrently) sets the
    suggestion `status = 'accepted'` **only if it is still `pending`** and writes the
    photo's `latitude`/`longitude`/`location_label`; a second concurrent accept must get a
    `409 suggestion_already_resolved` instead of double-applying. On `reject`, sets
    `status = 'rejected'` under the same guard.

- [ ] **Step 1: Write the failing test for `gemini.ts`**

Create `worker/test/lib/gemini.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { suggestLocation } from '../../src/lib/gemini';

const targetPhoto = { photoGuid: 'g1', thumbUrl: 'https://x/g1.jpg', dateCreated: '2024-07-12T10:00:00Z' };
const contextPhotos = [
  { photoGuid: 'g0', thumbUrl: 'https://x/g0.jpg', dateCreated: '2024-07-11T09:00:00Z', locationLabel: 'Napoli, Italia', latitude: 40.85, longitude: 14.27 },
];

describe('suggestLocation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses a valid Gemini JSON response into a suggestion', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    latitude: 40.85,
                    longitude: 14.27,
                    locationLabel: 'Napoli, Italia',
                    reasoning: 'Stessi vestiti e data vicina alla foto di Napoli.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    }) as any;

    const result = await suggestLocation('fake-key', targetPhoto, contextPhotos);
    expect(result).toEqual({
      latitude: 40.85,
      longitude: 14.27,
      locationLabel: 'Napoli, Italia',
      reasoning: 'Stessi vestiti e data vicina alla foto di Napoli.',
    });
  });

  it('returns null when Gemini response is not valid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }),
    }) as any;

    const result = await suggestLocation('fake-key', targetPhoto, contextPhotos);
    expect(result).toBeNull();
  });

  it('returns null when the HTTP call fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const result = await suggestLocation('fake-key', targetPhoto, contextPhotos);
    expect(result).toBeNull();
  });

  it('returns null when there is no context to reason from', async () => {
    global.fetch = vi.fn();
    const result = await suggestLocation('fake-key', targetPhoto, []);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/lib/gemini.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/gemini'".

- [ ] **Step 3: Implement `worker/src/lib/gemini.ts`**

```ts
interface PhotoRef {
  photoGuid: string;
  thumbUrl: string | null;
  dateCreated: string | null;
}

interface ContextPhoto extends PhotoRef {
  locationLabel: string;
  latitude: number;
  longitude: number;
}

interface Suggestion {
  latitude: number;
  longitude: number;
  locationLabel: string;
  reasoning: string;
}

export async function suggestLocation(
  apiKey: string,
  target: PhotoRef,
  context: ContextPhoto[]
): Promise<Suggestion | null> {
  if (context.length === 0) return null;

  const prompt = [
    'Sei un assistente che deduce la posizione geografica probabile di una foto di famiglia',
    'basandoti su indizi visivi (vestiti, paesaggio) e sulla vicinanza di data rispetto ad altre',
    'foto dello stesso album gia georeferenziate. Rispondi SOLO con un oggetto JSON con le chiavi',
    'latitude, longitude, locationLabel, reasoning (breve, in italiano). Se non hai abbastanza',
    'indizi per una ipotesi ragionevole, rispondi con {"noSuggestion": true}.',
    '',
    `Foto da geolocalizzare: data=${target.dateCreated ?? 'sconosciuta'}`,
    'Foto gia' + ' posizionate nello stesso album:',
    ...context.map(
      (c) => `- data=${c.dateCreated ?? 'sconosciuta'}, luogo=${c.locationLabel} (lat=${c.latitude}, lng=${c.longitude})`
    ),
  ].join('\n');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (parsed.noSuggestion) return null;
    if (
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number' ||
      typeof parsed.locationLabel !== 'string'
    ) {
      return null;
    }
    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      locationLabel: parsed.locationLabel,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/lib/gemini.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the `respond_to_ai_suggestion` Postgres RPC (race-condition guard)**

Append to `supabase/migrations/0001_init.sql` (from Task 2):
```sql
create or replace function respond_to_ai_suggestion(
  p_suggestion_id uuid,
  p_action text
) returns table (status text) language plpgsql security definer as $$
declare
  v_suggestion ai_suggestions;
begin
  if p_action not in ('accept', 'reject') then
    raise exception 'invalid_action';
  end if;

  update ai_suggestions
  set status = case when p_action = 'accept' then 'accepted' else 'rejected' end
  where id = p_suggestion_id and status = 'pending'
  returning * into v_suggestion;

  if v_suggestion is null then
    raise exception 'suggestion_already_resolved';
  end if;

  if p_action = 'accept' then
    update photos
    set latitude = v_suggestion.suggested_latitude,
        longitude = v_suggestion.suggested_longitude,
        location_label = v_suggestion.suggested_location_label
    where album_id = v_suggestion.album_id and photo_guid = v_suggestion.photo_guid;
  end if;

  return query select v_suggestion.status;
end;
$$;
```

Add a matching test in `supabase/test/rls.test.ts` (or a new `supabase/test/ai_suggestions.test.ts`
following the same real-local-Supabase pattern as Task 2): call the RPC twice concurrently
(`Promise.allSettled`) for the same `pending` suggestion and assert exactly one call resolves
with `status: 'accepted'` and the other rejects with a Postgres error containing
`suggestion_already_resolved`.

Run: `cd supabase && npx vitest run test/ai_suggestions.test.ts` (requires `supabase start`)
Expected: PASS.

- [ ] **Step 6: Write the failing route test**

Create `worker/test/routes/aiSuggest.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import aiSuggestRoutes from '../../src/routes/aiSuggest';

vi.mock('../../src/lib/gemini', () => ({ suggestLocation: vi.fn() }));
vi.mock('../../src/lib/auth', () => ({ requireUser: vi.fn() }));

import { suggestLocation } from '../../src/lib/gemini';
import { requireUser } from '../../src/lib/auth';

function fakeSupabase(overrides: any = {}) {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: [{ status: 'accepted' }], error: null }),
    ...overrides,
  };
}

describe('POST /albums/:id/photos/:photoGuid/ai-suggest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a cached suggestion without calling Gemini again', async () => {
    const existing = { id: 's1', status: 'pending' };
    const supabase = fakeSupabase({
      single: vi.fn().mockResolvedValue({ data: existing, error: null }),
    });
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', aiSuggestRoutes);
    const res = await app.request('/albums/a1/photos/g1/ai-suggest', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(suggestLocation).not.toHaveBeenCalled();
  });

  it('calls Gemini and stores a new suggestion when none exists', async () => {
    (suggestLocation as any).mockResolvedValue({
      latitude: 40.85, longitude: 14.27, locationLabel: 'Napoli, Italia', reasoning: 'test',
    });
    const supabase = fakeSupabase();
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', aiSuggestRoutes);
    const res = await app.request('/albums/a1/photos/g1/ai-suggest', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(suggestLocation).toHaveBeenCalledTimes(1);
    expect(supabase.insert).toHaveBeenCalled();
  });
});

describe('POST .../ai-suggest/:suggestionId/respond', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 409 when the suggestion was already resolved', async () => {
    const supabase = fakeSupabase({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'suggestion_already_resolved' } }),
    });
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', aiSuggestRoutes);
    const res = await app.request('/albums/a1/photos/g1/ai-suggest/s1/respond', {
      method: 'POST',
      body: JSON.stringify({ action: 'accept' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(409);
  });
});
```
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd worker && npx vitest run test/routes/aiSuggest.test.ts`
Expected: FAIL with "Cannot find module '../../src/routes/aiSuggest'".

- [ ] **Step 8: Implement `worker/src/routes/aiSuggest.ts`**

```ts
import { Hono } from 'hono';
import { suggestLocation } from '../lib/gemini';
import { requireUser } from '../lib/auth';
import type { Env } from '../index';

export const aiSuggestRoutes = new Hono<{ Bindings: Env }>();

aiSuggestRoutes.post('/albums/:id/photos/:photoGuid/ai-suggest', async (c) => {
  const { supabase } = await requireUser(c);
  const albumId = c.req.param('id');
  const photoGuid = c.req.param('photoGuid');

  const { data: existing } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('album_id', albumId)
    .eq('photo_guid', photoGuid)
    .single();

  if (existing) {
    return c.json({ suggestion: existing });
  }

  const { data: target } = await supabase
    .from('photos')
    .select('photo_guid, thumb_url, date_created')
    .eq('album_id', albumId)
    .eq('photo_guid', photoGuid)
    .single();

  const { data: contextRows } = await supabase
    .from('photos')
    .select('photo_guid, thumb_url, date_created, location_label, latitude, longitude')
    .eq('album_id', albumId)
    .not('latitude', 'is', null)
    .order('date_created', { ascending: false })
    .limit(8);

  const suggestion = await suggestLocation(
    c.env.GEMINI_API_KEY,
    { photoGuid: target.photo_guid, thumbUrl: target.thumb_url, dateCreated: target.date_created },
    (contextRows ?? []).map((r: any) => ({
      photoGuid: r.photo_guid,
      thumbUrl: r.thumb_url,
      dateCreated: r.date_created,
      locationLabel: r.location_label,
      latitude: r.latitude,
      longitude: r.longitude,
    }))
  );

  if (!suggestion) {
    return c.json({ suggestion: null });
  }

  const { data: inserted } = await supabase
    .from('ai_suggestions')
    .insert({
      album_id: albumId,
      photo_guid: photoGuid,
      suggested_latitude: suggestion.latitude,
      suggested_longitude: suggestion.longitude,
      suggested_location_label: suggestion.locationLabel,
      reasoning: suggestion.reasoning,
      status: 'pending',
    })
    .select()
    .single();

  return c.json({ suggestion: inserted });
});

aiSuggestRoutes.post('/albums/:id/photos/:photoGuid/ai-suggest/:suggestionId/respond', async (c) => {
  const { supabase } = await requireUser(c);
  const { suggestionId } = c.req.param();
  const { action } = await c.req.json<{ action: 'accept' | 'reject' }>();

  const { data, error } = await supabase.rpc('respond_to_ai_suggestion', {
    p_suggestion_id: suggestionId,
    p_action: action,
  });

  if (error) {
    if (error.message?.includes('suggestion_already_resolved')) {
      return c.json({ error: 'suggestion_already_resolved' }, 409);
    }
    return c.json({ error: 'invalid_request' }, 400);
  }

  return c.json({ status: data?.[0]?.status ?? 'unknown' });
});

export default aiSuggestRoutes;
```

Register the router in `worker/src/index.ts` alongside the other route modules from Tasks
4–5. Unlike `albumsRouter` (mounted under an `/albums` prefix with relative internal paths)
or `photosRouter` (mounted under `/albums/:albumId/photos`), `aiSuggestRoutes` defines its
full `/albums/:id/photos/...` paths itself, so mount it at the root:
`app.route('/', aiSuggestRoutes)`.

- [ ] **Step 9: Run test to verify it passes**

Run: `cd worker && npx vitest run test/routes/aiSuggest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 10: Run the full worker test suite to confirm no regressions**

Run: `cd worker && npx vitest run`
Expected: PASS (all tests across Tasks 2–5, 12, 14).

- [ ] **Step 11: Commit**

```bash
git add worker/src/lib/gemini.ts worker/src/routes/aiSuggest.ts worker/src/index.ts worker/test/lib/gemini.test.ts worker/test/routes/aiSuggest.test.ts supabase/migrations/0001_init.sql supabase/test
git commit -m "feat: add Gemini-powered AI location suggestion route with race-safe accept/reject"
```

---

### Task 15: Frontend AI suggestion banner

**Files:**
- Create: `frontend/src/photos/useAiSuggestion.ts`
- Create: `frontend/src/photos/AiSuggestionBanner.tsx`
- Modify: `frontend/src/photos/PhotoDetailView.tsx`
- Test: `frontend/test/photos/AiSuggestionBanner.test.tsx`

**Interfaces:**
- Consumes: `request` from `workerApi.ts` (Task 6), rendered inside `PhotoDetailView`
  (Task 11) whenever the open photo has no `latitude`/`longitude`.
- Produces: `useAiSuggestion(albumId, photoGuid, enabled: boolean)` returning `{ suggestion,
  loading, respond: (action: 'accept' | 'reject') => Promise<void> }`, and
  `<AiSuggestionBanner albumId photoGuid onAccepted={(lat, lng, label) => void} />`.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/photos/AiSuggestionBanner.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));
import { request } from '../../src/lib/workerApi';
import { AiSuggestionBanner } from '../../src/photos/AiSuggestionBanner';

describe('AiSuggestionBanner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches and displays a suggestion automatically', async () => {
    (request as any).mockResolvedValueOnce({
      suggestion: { id: 's1', suggested_location_label: 'Napoli, Italia', reasoning: 'Stessi vestiti', suggested_latitude: 40.85, suggested_longitude: 14.27 },
    });

    render(<AiSuggestionBanner albumId="a1" photoGuid="g1" onAccepted={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/napoli, italia/i)).toBeInTheDocument());
    expect(screen.getByText(/stessi vestiti/i)).toBeInTheDocument();
  });

  it('renders nothing when Gemini has no suggestion', async () => {
    (request as any).mockResolvedValueOnce({ suggestion: null });
    render(<AiSuggestionBanner albumId="a1" photoGuid="g1" onAccepted={vi.fn()} />);
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /accetta/i })).not.toBeInTheDocument();
  });

  it('calls onAccepted with coordinates when the user accepts', async () => {
    (request as any)
      .mockResolvedValueOnce({
        suggestion: { id: 's1', suggested_location_label: 'Napoli, Italia', reasoning: 'x', suggested_latitude: 40.85, suggested_longitude: 14.27 },
      })
      .mockResolvedValueOnce({ status: 'accepted' });
    const onAccepted = vi.fn();

    render(<AiSuggestionBanner albumId="a1" photoGuid="g1" onAccepted={onAccepted} />);
    await waitFor(() => screen.getByRole('button', { name: /accetta/i }));
    fireEvent.click(screen.getByRole('button', { name: /accetta/i }));

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(40.85, 14.27, 'Napoli, Italia'));
  });

  it('shows an already-resolved notice and hides actions on a 409 conflict', async () => {
    (request as any)
      .mockResolvedValueOnce({
        suggestion: { id: 's1', suggested_location_label: 'Napoli, Italia', reasoning: 'x', suggested_latitude: 40.85, suggested_longitude: 14.27 },
      })
      .mockRejectedValueOnce(Object.assign(new Error('suggestion_already_resolved'), { status: 409 }));

    render(<AiSuggestionBanner albumId="a1" photoGuid="g1" onAccepted={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /accetta/i }));
    fireEvent.click(screen.getByRole('button', { name: /accetta/i }));

    await waitFor(() => expect(screen.getByText(/gia' stata gestita/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /accetta/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/photos/AiSuggestionBanner.test.tsx`
Expected: FAIL with "Cannot find module '../../src/photos/AiSuggestionBanner'".

- [ ] **Step 3: Implement `useAiSuggestion.ts`**

```ts
import { useEffect, useState } from 'react';
import { request } from '../lib/workerApi';

interface Suggestion {
  id: string;
  suggested_location_label: string;
  reasoning: string;
  suggested_latitude: number;
  suggested_longitude: number;
}

export function useAiSuggestion(albumId: string, photoGuid: string, enabled: boolean) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    request<{ suggestion: Suggestion | null }>(`/albums/${albumId}/photos/${photoGuid}/ai-suggest`, {
      method: 'POST',
    })
      .then((res) => setSuggestion(res.suggestion))
      .finally(() => setLoading(false));
  }, [albumId, photoGuid, enabled]);

  async function respond(action: 'accept' | 'reject') {
    if (!suggestion) return;
    try {
      await request(`/albums/${albumId}/photos/${photoGuid}/ai-suggest/${suggestion.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setResolved(true);
      return { conflict: false as const };
    } catch (err) {
      setResolved(true);
      return { conflict: true as const };
    }
  }

  return { suggestion, loading, resolved, respond };
}
```

- [ ] **Step 4: Implement `AiSuggestionBanner.tsx`**

```tsx
import { useState } from 'react';
import { useAiSuggestion } from './useAiSuggestion';

interface AiSuggestionBannerProps {
  albumId: string;
  photoGuid: string;
  onAccepted: (lat: number, lng: number, label: string) => void;
}

export function AiSuggestionBanner({ albumId, photoGuid, onAccepted }: AiSuggestionBannerProps) {
  const { suggestion, respond } = useAiSuggestion(albumId, photoGuid, true);
  const [conflict, setConflict] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!suggestion || dismissed) return null;

  async function handle(action: 'accept' | 'reject') {
    const result = await respond(action);
    if (result?.conflict) {
      setConflict(true);
      return;
    }
    if (action === 'accept') {
      onAccepted(suggestion.suggested_latitude, suggestion.suggested_longitude, suggestion.suggested_location_label);
    }
    setDismissed(true);
  }

  if (conflict) {
    return <p>Questa proposta è già stata gestita da un altro membro dell'album.</p>;
  }

  return (
    <div>
      <p>
        Suggerimento AI: <strong>{suggestion.suggested_location_label}</strong>
      </p>
      <p>{suggestion.reasoning}</p>
      <button onClick={() => handle('accept')}>Accetta</button>
      <button onClick={() => handle('reject')}>Rifiuta</button>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/photos/AiSuggestionBanner.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire the banner into `PhotoDetailView`**

In `frontend/src/photos/PhotoDetailView.tsx` (Task 11), render `<AiSuggestionBanner
albumId={photo.albumId} photoGuid={photo.photoGuid} onAccepted={...} />` only when
`photo.latitude === null`, and have `onAccepted` call the existing `updateLocation` (from
`usePhotos`, Task 8) that the parent passes down — thread a new `onLocationConfirmed?:
(lat, lng, label) => void` prop through `PhotoDetailView` for this purpose. Add one test to
`frontend/test/photos/PhotoDetailView.test.tsx` asserting the banner is present when
`latitude` is `null` and absent when the photo already has coordinates.

Run: `cd frontend && npx vitest run test/photos/PhotoDetailView.test.tsx`
Expected: PASS (existing 4 tests + 2 new ones).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/photos/useAiSuggestion.ts frontend/src/photos/AiSuggestionBanner.tsx frontend/src/photos/PhotoDetailView.tsx frontend/test/photos/AiSuggestionBanner.test.tsx frontend/test/photos/PhotoDetailView.test.tsx
git commit -m "feat: add AI suggestion banner with accept/reject and conflict handling"
```

---

### Task 16: Worker city-theme route (AI-generated 3-color palettes)

**Files:**
- Create: `worker/src/lib/geminiCityTheme.ts`
- Create: `worker/src/routes/cityTheme.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/lib/geminiCityTheme.test.ts`
- Test: `worker/test/routes/cityTheme.test.ts`

**Interfaces:**
- Consumes: `env.GEMINI_API_KEY`, global `fetch`, `city_themes` table (Task 2 schema, global
  and shared across all albums per spec §6/§8).
- Produces: `generateCityTheme(apiKey, cityLabel): Promise<{ primary: string; secondary:
  string; accent: string; reasoning: string } | null>` and
  `GET /city-themes/:cityLabel` — returns the cached row if `city_themes` already has one for
  that exact label (case-insensitive match), otherwise generates, inserts, and returns it.
  Called once per unique city label ever seen, consumed by Task 17's `CityThemeOverlay`.

- [ ] **Step 1: Write the failing test for `geminiCityTheme.ts`**

Create `worker/test/lib/geminiCityTheme.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateCityTheme } from '../../src/lib/geminiCityTheme';

describe('generateCityTheme', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses three valid hex colors from the Gemini response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    primary: '#2b5fad',
                    secondary: '#f4d35e',
                    accent: '#e0533d',
                    reasoning: 'Blu del mare, giallo del sole, rosso dei tetti.',
                  }),
                },
              ],
            },
          },
        ],
      }),
    }) as any;

    const theme = await generateCityTheme('fake-key', 'Napoli, Italia');
    expect(theme).toEqual({
      primary: '#2b5fad',
      secondary: '#f4d35e',
      accent: '#e0533d',
      reasoning: 'Blu del mare, giallo del sole, rosso dei tetti.',
    });
  });

  it('returns null when a color is not a valid hex string', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ primary: 'blue', secondary: '#fff', accent: '#000', reasoning: '' }) }] } }],
      }),
    }) as any;
    const theme = await generateCityTheme('fake-key', 'Napoli, Italia');
    expect(theme).toBeNull();
  });

  it('returns null on HTTP failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    const theme = await generateCityTheme('fake-key', 'Napoli, Italia');
    expect(theme).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/lib/geminiCityTheme.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/geminiCityTheme'".

- [ ] **Step 3: Implement `worker/src/lib/geminiCityTheme.ts`**

```ts
interface CityTheme {
  primary: string;
  secondary: string;
  accent: string;
  reasoning: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function generateCityTheme(apiKey: string, cityLabel: string): Promise<CityTheme | null> {
  const prompt = [
    'Genera una palette di 3 colori esadecimali che rappresenti visivamente la citta o il luogo',
    `"${cityLabel}", pensando a paesaggio, architettura e cultura locale.`,
    'Rispondi SOLO con un oggetto JSON con le chiavi primary, secondary, accent (stringhe hex',
    'tipo "#rrggbb") e reasoning (una frase breve in italiano).',
  ].join(' ');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (![parsed.primary, parsed.secondary, parsed.accent].every((c) => typeof c === 'string' && HEX_RE.test(c))) {
      return null;
    }
    return {
      primary: parsed.primary,
      secondary: parsed.secondary,
      accent: parsed.accent,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/lib/geminiCityTheme.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing route test**

Create `worker/test/routes/cityTheme.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/geminiCityTheme', () => ({ generateCityTheme: vi.fn() }));
vi.mock('../../src/lib/auth', () => ({ requireUser: vi.fn() }));
import { generateCityTheme } from '../../src/lib/geminiCityTheme';
import { requireUser } from '../../src/lib/auth';
import { Hono } from 'hono';
import cityThemeRoutes from '../../src/routes/cityTheme';

function fakeSupabase(existing: any = null) {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { city_label: 'Napoli, Italia', primary: '#111', secondary: '#222', accent: '#333' }, error: null }),
  };
}

describe('GET /city-themes/:cityLabel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a cached theme without calling Gemini', async () => {
    const supabase = fakeSupabase({ city_label: 'Napoli, Italia', primary: '#111', secondary: '#222', accent: '#333' });
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', cityThemeRoutes);
    const res = await app.request('/city-themes/Napoli%2C%20Italia');
    expect(res.status).toBe(200);
    expect(generateCityTheme).not.toHaveBeenCalled();
  });

  it('generates and caches a new theme when none exists', async () => {
    (generateCityTheme as any).mockResolvedValue({ primary: '#111', secondary: '#222', accent: '#333', reasoning: 'x' });
    const supabase = fakeSupabase(null);
    (requireUser as any).mockResolvedValue({ userId: 'user-1', supabase });

    const app = new Hono();
    app.route('/', cityThemeRoutes);
    const res = await app.request('/city-themes/Napoli%2C%20Italia');
    expect(res.status).toBe(200);
    expect(generateCityTheme).toHaveBeenCalledTimes(1);
    expect(supabase.insert).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd worker && npx vitest run test/routes/cityTheme.test.ts`
Expected: FAIL with "Cannot find module '../../src/routes/cityTheme'".

- [ ] **Step 7: Implement `worker/src/routes/cityTheme.ts`**

```ts
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
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
      reasoning: theme.reasoning,
    })
    .select()
    .single();

  return c.json({ theme: inserted });
});

export default cityThemeRoutes;
```

Register it in `worker/src/index.ts`, mounted at root (`app.route('/', cityThemeRoutes)`),
same convention as `aiSuggestRoutes`.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd worker && npx vitest run test/routes/cityTheme.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Run the full worker suite**

Run: `cd worker && npx vitest run`
Expected: PASS (all tests, no regressions).

- [ ] **Step 10: Commit**

```bash
git add worker/src/lib/geminiCityTheme.ts worker/src/routes/cityTheme.ts worker/src/index.ts worker/test/lib/geminiCityTheme.test.ts worker/test/routes/cityTheme.test.ts
git commit -m "feat: add AI-generated per-city 3-color theme route with caching"
```

---

### Task 17: Map city-theme radial-wash overlay

**Files:**
- Create: `frontend/src/map/useCityThemes.ts`
- Create: `frontend/src/map/CityThemeOverlay.tsx`
- Modify: `frontend/src/map/MapView.tsx`
- Test: `frontend/test/map/useCityThemes.test.ts`

**Interfaces:**
- Consumes: `Photo[]` (Task 8, for distinct `locationLabel` values), `request` from
  `workerApi.ts` (Task 6) to call the Task 16 route.
- Produces: `useCityThemes(photos: Photo[]): Record<string, { primary: string; secondary:
  string; accent: string }>` and `<CityThemeOverlay map={maplibregl.Map} clusters=
  {Cluster[]} themes={...} />`, rendered by `MapView` above the base style but below the
  `AlbumMarker`s (spec §8: soft radial wash, not global re-theming).

- [ ] **Step 1: Write the failing test**

Create `frontend/test/map/useCityThemes.test.ts`:
```ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));
import { request } from '../../src/lib/workerApi';
import { useCityThemes } from '../../src/map/useCityThemes';
import type { Photo } from '../../src/photos/usePhotos';

function photo(label: string | null): Photo {
  return {
    albumId: 'a1', photoGuid: label ?? 'none', caption: '', dateCreated: null,
    thumbUrl: null, fullUrl: null, latitude: label ? 1 : null, longitude: label ? 1 : null,
    locationLabel: label,
  };
}

describe('useCityThemes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches one theme per distinct location label', async () => {
    (request as any).mockImplementation((path: string) =>
      Promise.resolve({ theme: { city_label: decodeURIComponent(path.split('/').pop()!), primary: '#111', secondary: '#222', accent: '#333' } })
    );

    const { result } = renderHook(() => useCityThemes([photo('Napoli, Italia'), photo('Napoli, Italia'), photo('Roma, Italia')]));

    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(2));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('ignores photos without a location label', async () => {
    const { result } = renderHook(() => useCityThemes([photo(null)]));
    await waitFor(() => expect(request).not.toHaveBeenCalled());
    expect(result.current).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/map/useCityThemes.test.ts`
Expected: FAIL with "Cannot find module '../../src/map/useCityThemes'".

- [ ] **Step 3: Implement `useCityThemes.ts`**

```ts
import { useEffect, useState } from 'react';
import { request } from '../lib/workerApi';
import type { Photo } from '../photos/usePhotos';

interface CityTheme {
  primary: string;
  secondary: string;
  accent: string;
}

export function useCityThemes(photos: Photo[]): Record<string, CityTheme> {
  const [themes, setThemes] = useState<Record<string, CityTheme>>({});

  const labels = Array.from(
    new Set(photos.map((p) => p.locationLabel).filter((l): l is string => !!l))
  );

  useEffect(() => {
    let cancelled = false;
    labels
      .filter((label) => !(label in themes))
      .forEach((label) => {
        request<{ theme: CityTheme | null }>(`/city-themes/${encodeURIComponent(label)}`).then((res) => {
          if (cancelled || !res.theme) return;
          setThemes((prev) => ({ ...prev, [label]: res.theme! }));
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.join('|')]);

  return themes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/map/useCityThemes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the radial-wash overlay component**

Create `frontend/src/map/CityThemeOverlay.tsx`:
```tsx
import { useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import type { Cluster } from './useClusteredPhotos';

interface CityThemeOverlayProps {
  map: maplibregl.Map | null;
  clusters: Cluster[];
  themes: Record<string, { primary: string; secondary: string; accent: string }>;
}

const SOURCE_ID = 'city-theme-wash';
const LAYER_ID = 'city-theme-wash-layer';

export function CityThemeOverlay({ map, clusters, themes }: CityThemeOverlayProps) {
  useEffect(() => {
    if (!map) return;

    const features = clusters
      .flatMap((cluster) => cluster.photos.map((p) => ({ label: p.locationLabel, lat: cluster.latitude, lng: cluster.longitude })))
      .filter((f) => f.label && themes[f.label])
      .map((f) => ({
        type: 'Feature' as const,
        properties: { color: themes[f.label as string].primary },
        geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
      }));

    const geojson = { type: 'FeatureCollection' as const, features };

    if (map.getSource(SOURCE_ID)) {
      (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson as any);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson as any });
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 80,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-blur': 1,
        },
      });
    }
  }, [map, clusters, themes]);

  return null;
}
```

- [ ] **Step 6: Wire into `MapView`**

In `frontend/src/map/MapView.tsx` (Tasks 9–10), render `<CityThemeOverlay map={mapInstance}
clusters={clusters} themes={themes} />` before the `AlbumMarker` layer, sourcing `themes`
from `useCityThemes(photos)` at the `App.tsx` level and passing it down alongside `photos`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/map/useCityThemes.ts frontend/src/map/CityThemeOverlay.tsx frontend/src/map/MapView.tsx frontend/test/map/useCityThemes.test.ts
git commit -m "feat: render AI-generated per-city color themes as a soft map overlay"
```

---

### Task 18: PWA manifest, service worker, and offline behavior

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/public/icons/` (placeholder 192x192 and 512x512 PNGs)
- Test: `frontend/test/pwa/manifest.test.ts`

**Interfaces:**
- Consumes: `vite-plugin-pwa` (add as a dev dependency).
- Produces: an installable manifest (name, colors from spec §9, icons) and a service worker
  caching the app shell plus already-fetched photo thumbnails so the map/gallery keep working
  offline for previously-viewed content (spec §10). No new application interfaces — this is
  build configuration.

- [ ] **Step 1: Write a failing config-shape test**

Create `frontend/test/pwa/manifest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pwaManifest } from '../../src/pwa/manifest';

describe('pwaManifest', () => {
  it('declares a standalone display mode and app name', () => {
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.name).toBe("Bianca's Adventures");
  });

  it('declares both required icon sizes', () => {
    const sizes = pwaManifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/pwa/manifest.test.ts`
Expected: FAIL with "Cannot find module '../../src/pwa/manifest'".

- [ ] **Step 3: Implement `frontend/src/pwa/manifest.ts`**

```ts
export const pwaManifest = {
  name: "Bianca's Adventures",
  short_name: 'Bianca',
  description: 'Le foto di famiglia geolocalizzate su una mappa in stile gioco.',
  start_url: '/',
  display: 'standalone' as const,
  background_color: '#0f1226',
  theme_color: '#2b5fad',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/pwa/manifest.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Install and configure `vite-plugin-pwa`**

Run: `cd frontend && npm install -D vite-plugin-pwa`

Modify `frontend/vite.config.ts` to add the plugin, reusing `pwaManifest`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaManifest } from './src/pwa/manifest';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: pwaManifest,
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.includes('icloud.com') || url.hostname.includes('supabase'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'photo-media',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
```

Add two placeholder PNG icon files at `frontend/public/icons/icon-192.png` and
`icon-512.png` (any solid-color placeholder is acceptable at this stage; the user can swap
in final artwork later per spec §9's custom design intent).

- [ ] **Step 6: Manual verification (no automated test for the service worker itself)**

Run: `cd frontend && npm run build && npm run preview`
Expected: build succeeds, `dist/manifest.webmanifest` and `dist/sw.js` are generated, and
opening the preview URL in a Chromium-based browser shows an install icon in the address bar.

- [ ] **Step 7: Commit**

```bash
git add frontend/vite.config.ts frontend/src/pwa/manifest.ts frontend/test/pwa/manifest.test.ts frontend/public/icons frontend/package.json
git commit -m "feat: add PWA manifest, install support, and offline photo-media caching"
```

---

### Task 19: Deployment configuration and end-to-end smoke test

**Files:**
- Create: `worker/wrangler.toml`
- Create: `docs/DEPLOYMENT.md`
- Modify: root `package.json` or `README.md` with setup instructions

**Interfaces:**
- Consumes: all previous tasks' env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `GEMINI_API_KEY` (Worker secrets via `wrangler secret put`); frontend build-time
  `VITE_WORKER_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Produces: a deployable Worker (Cloudflare Workers free tier) and a deployable static
  frontend (Cloudflare Pages free tier), plus a documented manual smoke-test checklist since
  full production login/iCloud/Gemini flows are out of scope for automated CI.

- [ ] **Step 1: Write `worker/wrangler.toml`**

```toml
name = "biancas-adventures-worker"
main = "src/index.ts"
compatibility_date = "2024-09-01"

[vars]
# Non-secret vars can go here if any are added later.

# Secrets (set via `wrangler secret put <NAME>`, never committed):
# SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
```

- [ ] **Step 2: Write `docs/DEPLOYMENT.md`**

Document, in Italian (matching the user's language) or English (matching the spec's
language — use English for consistency with the rest of the docs):
1. Prerequisites: Cloudflare account (free), Supabase project (free tier), Gemini API key
   (free tier), Node 20+.
2. `supabase db push` (or apply `supabase/migrations/0001_init.sql` via the Supabase SQL
   editor) to create the schema or run migrations against a real project.
3. `cd worker && npx wrangler secret put SUPABASE_URL` (repeat for `SUPABASE_ANON_KEY`,
   `GEMINI_API_KEY`), then `npx wrangler deploy`.
4. `cd frontend && npm run build`, then deploy the `dist/` folder via `npx wrangler pages
   deploy dist` (or connect the repo in the Cloudflare Pages dashboard), with
   `VITE_WORKER_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` set as Pages build
   environment variables.
5. Manual smoke-test checklist (run once after every deploy, since there is no live-network
   E2E suite per the plan's Global Constraints):
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
     settings screen (Task 20); confirm a non-owner member cannot see those controls.

- [ ] **Step 3: Commit**

```bash
git add worker/wrangler.toml docs/DEPLOYMENT.md
git commit -m "chore: add deployment configuration and manual smoke-test checklist"
```

---

### Task 20: Album settings screen (owner-only management)

**Files:**
- Create: `frontend/src/settings/AlbumSettingsScreen.tsx`
- Test: `frontend/test/settings/AlbumSettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `request` from `workerApi.ts` (Task 6), the `POST /albums/:id/invite/regenerate`
  route (Task 4), and a new `PATCH /albums/:id` route (name-only update, owner-only via RLS)
  that must be added to `worker/src/routes/albums.ts` in Step 1 below.
- Produces: `<AlbumSettingsScreen album={{ id, name, inviteCode, iCloudAlbumUrl, role: 'owner'
  | 'member' }} onClose={() => void} />`, opened from a gear icon in `AlbumSwitcher` (Task 7).
  Closes the spec §4 requirement that only the `owner` can rename an Album or regenerate its
  invite code, and gives every member a way to see/copy the current invite code to invite
  others (spec §4 "invito tramite codice").

- [ ] **Step 1: Add the owner-only rename route**

In `worker/src/routes/albums.ts` (Task 4), add:
```ts
albumsRouter.patch('/:id', async (c) => {
  const { supabase } = await requireUser(c);
  const albumId = c.req.param('id');
  const { name } = await c.req.json<{ name: string }>();

  const { data, error } = await supabase
    .from('albums')
    .update({ name })
    .eq('id', albumId)
    .select()
    .single();

  if (error || !data) {
    return c.json({ error: 'album_not_found_or_not_owner' }, 404);
  }
  return c.json({ album: data });
});
```
This relies entirely on the existing RLS policy (Task 2) that restricts `update` on `albums`
to rows where the caller is `owner` — a non-owner's update matches zero rows, so Supabase
returns no data and the route reports a 404 rather than silently succeeding. Add a test to
`worker/test/routes/albums.test.ts` mocking `update().eq().select().single()` to return
`{ data: null, error: null }` and asserting a 404 with `album_not_found_or_not_owner`.

Run: `cd worker && npx vitest run test/routes/albums.test.ts`
Expected: PASS (existing tests + 1 new one).

- [ ] **Step 2: Write the failing frontend test**

Create `frontend/test/settings/AlbumSettingsScreen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/workerApi', () => ({ request: vi.fn() }));
import { request } from '../../src/lib/workerApi';
import { AlbumSettingsScreen } from '../../src/settings/AlbumSettingsScreen';

const ownerAlbum = { id: 'a1', name: 'Family', inviteCode: 'ABC123', iCloudAlbumUrl: 'https://x', role: 'owner' as const };
const memberAlbum = { ...ownerAlbum, role: 'member' as const };

describe('AlbumSettingsScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows rename and regenerate-invite controls only for the owner', () => {
    render(<AlbumSettingsScreen album={ownerAlbum} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /rinomina/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rigenera codice/i })).toBeInTheDocument();
  });

  it('hides owner-only controls for a regular member', () => {
    render(<AlbumSettingsScreen album={memberAlbum} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /rinomina/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rigenera codice/i })).not.toBeInTheDocument();
  });

  it('shows the current invite code to every member', () => {
    render(<AlbumSettingsScreen album={memberAlbum} onClose={vi.fn()} />);
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('calls the rename route with the new name', async () => {
    (request as any).mockResolvedValue({ album: { ...ownerAlbum, name: 'New name' } });
    render(<AlbumSettingsScreen album={ownerAlbum} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/nome album/i), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: /rinomina/i }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/albums/a1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New name' }),
      })
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run test/settings/AlbumSettingsScreen.test.tsx`
Expected: FAIL with "Cannot find module '../../src/settings/AlbumSettingsScreen'".

- [ ] **Step 4: Implement `AlbumSettingsScreen.tsx`**

```tsx
import { useState } from 'react';
import { request } from '../lib/workerApi';

interface Album {
  id: string;
  name: string;
  inviteCode: string;
  iCloudAlbumUrl: string;
  role: 'owner' | 'member';
}

interface AlbumSettingsScreenProps {
  album: Album;
  onClose: () => void;
}

export function AlbumSettingsScreen({ album, onClose }: AlbumSettingsScreenProps) {
  const [name, setName] = useState(album.name);
  const [inviteCode, setInviteCode] = useState(album.inviteCode);

  async function rename() {
    await request(`/albums/${album.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
  }

  async function regenerateInvite() {
    const res = await request<{ inviteCode: string }>(`/albums/${album.id}/invite/regenerate`, {
      method: 'POST',
    });
    setInviteCode(res.inviteCode);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'white' }}>
      <button onClick={onClose}>Chiudi</button>
      <h2>Impostazioni album</h2>
      <p>
        Codice invito: <strong>{inviteCode}</strong>
      </p>
      {album.role === 'owner' && (
        <>
          <label>
            Nome album
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button onClick={rename}>Rinomina</button>
          <button onClick={regenerateInvite}>Rigenera codice</button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run test/settings/AlbumSettingsScreen.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire a gear icon into `AlbumSwitcher`**

In `frontend/src/albums/AlbumSwitcher.tsx` (Task 7), add a settings button next to the
active album that opens `AlbumSettingsScreen`, passing the caller's `role` for that album
(already available from `useAlbums()`'s per-album membership data).

- [ ] **Step 7: Commit**

```bash
git add worker/src/routes/albums.ts worker/test/routes/albums.test.ts frontend/src/settings/AlbumSettingsScreen.tsx frontend/src/albums/AlbumSwitcher.tsx frontend/test/settings/AlbumSettingsScreen.test.tsx
git commit -m "feat: add owner-only album settings screen (rename, regenerate invite code)"
```

---
