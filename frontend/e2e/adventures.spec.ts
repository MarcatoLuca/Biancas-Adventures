import { expect, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import axe from 'axe-core';

declare global {
  interface Window { axe: typeof axe }
}

const userId = '00000000-0000-4000-8000-000000000001';
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#b9dfed"/><circle cx="460" cy="90" r="44" fill="#ffcc57"/><path d="M0 450L190 140L400 450M200 450L420 220L600 450" fill="#6d9170"/></svg>')}`;

async function prepare(page: Page, role: 'owner' | 'member' = 'owner') {
  const album = { id: 'a1', name: 'Estate in famiglia', invite_code: 'ABC12345', icloud_album_token: 'test-token' };
  const albums = [album];
  const photos = [
    { album_id: 'a1', photo_guid: 'p1', caption: 'Un giorno al mare', date_created: '2026-07-12T12:00:00Z', thumb_url: image, full_url: image, latitude: 41.9, longitude: 12.5, location_label: 'Roma', media_asset_type: null },
    { album_id: 'a1', photo_guid: 'p2', caption: 'La prima escursione', date_created: '2026-07-13T12:00:00Z', thumb_url: image, full_url: image, latitude: null as number | null, longitude: null as number | null, location_label: null as string | null, media_asset_type: null },
  ];
  const forbiddenCalls: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers, json: body });
    if (url.hostname === 'example.supabase.co') {
      if (request.method() === 'OPTIONS') return json({});
      if (url.pathname.endsWith('/logout')) return json({});
      const payload = { sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.test-signature`;
      return json({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: { id: userId, email: 'explorer@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } });
    }
    if (url.port === '8789') {
      if (request.method() === 'OPTIONS') return json({});
      if (url.pathname.includes('suggest') || url.pathname.includes('city-themes')) {
        forbiddenCalls.push(url.pathname);
        return json({ error: 'Gemini must not be used' }, 500);
      }
      if (url.pathname === '/albums' && request.method() === 'GET') return json({ albums: albums.map((item) => ({ album_id: item.id, role, albums: item })) });
      if (url.pathname === '/albums' && request.method() === 'POST') {
        const body = request.postDataJSON();
        const created = { ...album, id: 'a2', name: body.name };
        albums.push(created);
        return json({ albumId: created.id }, 201);
      }
      if (url.pathname === '/albums/join') return json({ albumId: 'a1' });
      if (url.pathname.endsWith('/invite/regenerate')) {
        album.invite_code = 'NEW12345';
        return json({ inviteCode: album.invite_code });
      }
      if (url.pathname === '/albums/a1' && request.method() === 'PATCH') {
        album.name = request.postDataJSON().name;
        return json({ album });
      }
      if (url.pathname.endsWith('/location')) {
        const body = request.postDataJSON();
        Object.assign(photos[1], { latitude: body.latitude, longitude: body.longitude, location_label: 'Nuova posizione' });
        return json({ ok: true });
      }
      if (url.pathname.endsWith('/photos')) return json({ photos: url.pathname.includes('/a1/') ? photos : [] });
      return json({ error: 'unexpected_test_request' }, 500);
    }
    if (url.hostname === 'tiles.openfreemap.org') {
      if (url.pathname === '/planet') return json({ tilejson: '3.0.0', tiles: ['http://127.0.0.1:4179/test-tiles/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, attribution: 'Map data © OpenStreetMap' });
      return route.fulfill({ body: Buffer.alloc(0), contentType: 'application/x-protobuf', headers });
    }
    if (url.pathname.startsWith('/test-tiles/')) return route.fulfill({ body: Buffer.alloc(0), contentType: 'application/x-protobuf' });
    if (url.hostname === 'nominatim.openstreetmap.org' && url.pathname === '/search') {
      return json([{ lat: '45.4642', lon: '9.19', display_name: 'Milano, Lombardia, Italia' }]);
    }
    if (url.origin === 'http://127.0.0.1:4179') return route.continue();
    return route.abort();
  });
  return { forbiddenCalls, pageErrors };
}

async function accessible(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }));
  });
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function login(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('explorer@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estate in famiglia', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /sincronizza foto/i })).toBeEnabled();
}

for (const width of [1440, 390, 320]) {
  test(`flows, keyboard and accessibility at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await prepare(page);
    await page.goto('/');
    await accessible(page);
    await login(page);
    await accessible(page);
    await page.screenshot({ path: testInfo.outputPath('workspace.png'), fullPage: true });

    const mapBounds = await page.getByRole('region', { name: /mappa delle foto/i }).boundingBox();
    expect(mapBounds).not.toBeNull();
    expect(mapBounds!.x).toBe(0);
    expect(mapBounds!.y).toBe(0);
    expect(mapBounds!.width).toBe(width);
    expect(mapBounds!.height).toBe(900);
    const title = await page.locator('.hud-title').boundingBox();
    expect(title).not.toBeNull();
    expect(title!.x).toBeGreaterThanOrEqual(0);
    expect(title!.y).toBeGreaterThanOrEqual(0);
    expect(title!.x + title!.width).toBeLessThanOrEqual(width);
    const controls = page.locator('.hud-button');
    const boxes = [];
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThan(450);
      boxes.push(box!);
    }
    const hudBoxes = [title!, ...boxes];
    for (let i = 0; i < hudBoxes.length; i++) {
      for (let j = i + 1; j < hudBoxes.length; j++) {
        const a = hudBoxes[i];
        const b = hudBoxes[j];
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
      }
    }
    await page.getByRole('button', { name: 'Album e account', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Avvicina', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Avvicina', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Album e account', exact: true }).click();
    await page.getByRole('button', { name: 'Crea album', exact: true }).click();
    await expect(page.getByLabel('Nome album', { exact: true })).toBeFocused();
    await accessible(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Crea album', exact: true })).toBeFocused();

    await page.getByRole('button', { name: 'Unisciti con codice' }).click();
    await accessible(page);
    await page.getByLabel('Codice invito', { exact: true }).fill('ABC12345');
    await page.getByRole('button', { name: 'Unisciti', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: /impostazioni album/i }).click();
    await accessible(page);
    await page.getByLabel('Nome album', { exact: true }).fill('I nostri viaggi');
    await page.getByRole('button', { name: 'Rinomina', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('salvato');
    await page.getByRole('button', { name: 'Rigenera codice', exact: true }).click();
    await expect(page.getByLabel('Codice invito', { exact: true })).toHaveValue('NEW12345');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'I nostri viaggi', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /tutte le foto/i }).click();
    await accessible(page);
    const photo = page.getByRole('button', { name: /apri la prima escursione/i });
    await photo.click();
    await accessible(page);
    await page.getByRole('button', { name: /modifica posizione/i }).click();
    const picker = page.getByRole('dialog', { name: 'Scegli una posizione' });
    await accessible(page);
    await picker.getByLabel('Cerca località', { exact: true }).fill('Milano');
    await picker.getByRole('button', { name: 'Cerca', exact: true }).click();
    await picker.getByRole('button', { name: 'Milano, Lombardia, Italia', exact: true }).click();
    await expect(picker.getByLabel('Latitudine', { exact: true })).toHaveValue('45.4642');
    await expect(picker.getByLabel('Longitudine', { exact: true })).toHaveValue('9.19');
    await picker.getByLabel('Longitudine', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(picker).toHaveCount(0);
    await expect(page.getByRole('button', { name: /modifica posizione/i })).toBeFocused();
    await expect(page.getByText('Nuova posizione', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /torna alle foto/i }).click();
    await expect(photo).toBeFocused();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /da posizionare/i }).click();
    await expect(page.getByText(/tutte le foto sono posizionate/i)).toBeVisible();
    await accessible(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Album e account', exact: true }).click();
    await page.getByRole('button', { name: 'Crea album', exact: true }).click();
    await page.getByLabel('Nome album', { exact: true }).fill('Nuova avventura');
    await page.getByLabel('Link Album Condiviso iCloud').fill('https://www.icloud.com/sharedalbum/#TEST');
    await page.getByRole('button', { name: 'Crea', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nuova avventura', exact: true })).toBeVisible();
    await accessible(page);
    expect(state.forbiddenCalls).toEqual([]);
    expect(state.pageErrors).toEqual([]);
  });
}

test('member permissions and keyboard focus stay inside the top dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, 'member');
  await page.goto('/');
  await login(page);
  await page.getByRole('button', { name: /impostazioni album/i }).click();
  await expect(page.getByRole('button', { name: 'Rinomina', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rigenera codice', exact: true })).toHaveCount(0);
  await accessible(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /da posizionare/i }).click();
  await page.getByRole('button', { name: /la prima escursione/i }).click();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('dialog')?.getAttribute('aria-labelledby') === document.querySelectorAll('dialog[open]')[1]?.getAttribute('aria-labelledby'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /la prima escursione/i })).toBeFocused();
});

test('HUD stays inside a short landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 320 });
  await prepare(page);
  await page.goto('/');
  await login(page);
  for (const element of await page.locator('.hud-title, .hud-button').all()) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(667);
    expect(box!.y + box!.height).toBeLessThanOrEqual(320);
  }
});
