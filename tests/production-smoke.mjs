import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const base = 'http://localhost:3003';
async function server(local, run) {
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--port', '3003'],
    {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PG_BUILD_DIR: '.next-production-test',
        PG_DATA_DIR: '.local-data/smoke',
        OPENAI_API_KEY: '',
        OPENAI_BASE_URL: '',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        ALLOW_LOCAL_DEMO: String(local),
        APP_ORIGIN: base,
      },
    },
  );
  let logs = '';
  child.stdout.on('data', (d) => (logs += d));
  child.stderr.on('data', (d) => (logs += d));
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) throw new Error(logs);
      try {
        const r = await fetch(base);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, 'Production server should start');
    await run();
  } finally {
    child.kill();
    await Promise.race([once(child, 'exit'), new Promise((r) => setTimeout(r, 3000))]);
  }
}
await server(true, async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.getByLabel('Your display name', { exact: true }).fill('Nora');
    await page.screenshot({ path: 'artifacts/refined-production-welcome.png', fullPage: true });
    await page.getByRole('button', { name: 'Start My Shift', exact: true }).click();
    await page.waitForURL('**/review');
    await page.getByRole('button', { name: 'Match', exact: true }).click();
    await page.getByRole('heading', { name: 'Compare the procedure', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Match', exact: true }).click();
    await page.locator('#observation').fill('The allergy records conflict.');
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/observation') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Review my observation', exact: true }).click();
    const r = await response;
    assert.equal(r.status(), 503);
    assert.equal((await r.json()).error, 'AI_NOT_CONFIGURED');
    await page.locator('.error-banner').waitFor();
    await page.reload();
    await page.locator('#observation').waitFor();
    assert.equal(await page.locator('#observation').inputValue(), 'The allergy records conflict.');
    const state = await (await context.request.get(base + '/api/session')).json();
    assert.equal(state.aiConfigured, false);
    assert.equal(state.progress.completed, false);
    assert.equal(state.progress.observationOriginal, 'The allergy records conflict.');
    assert.equal(state.progress.reviews.length, 0);
    const guide = await (await context.request.post(base + '/api/agent', { data: {} })).json();
    assert.equal(guide.mode, 'demo');
    assert.equal(
      (await context.request.post(base + '/api/verification', { data: {} })).status(),
      422,
    );
    for (const route of ['/complete', '/shift-wall', '/wall'])
      assert.equal((await context.request.get(base + route)).status(), 200);
    await page.goto(base + '/wall');
    await page.getByRole('button', { name: 'Toggle fullscreen' }).click();
    assert.ok(
      await page
        .locator('.team-wall')
        .evaluate(
          (el) => el.classList.contains('is-fullscreen') || document.fullscreenElement === el,
        ),
    );
    await page.getByRole('button', { name: 'Toggle fullscreen' }).click();
    assert.deepEqual(errors, []);
    console.log(
      'PASS: production UI, missing OpenAI fails closed, original text survives reload, demo guidance honestly labeled, routes and fullscreen work.',
    );
  } finally {
    await browser.close();
  }
});
await server(false, async () => {
  const r = await fetch(base + '/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ type: 'start', name: 'Nora', lang: 'en' }),
  });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'DATABASE_NOT_CONFIGURED');
  assert.equal((await fetch(base + '/api/wall')).status, 503);
  console.log('PASS: production refuses persistence when Supabase is missing.');
});
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await inspect(p);
    else if (p.endsWith('.nft.json')) {
      const trace = JSON.parse(await readFile(p, 'utf8'));
      assert.ok(
        trace.files.every(
          (f) =>
            !/[\\/]\.local-data[\\/]|[\\/]\.env(?:\.|$)|[\\/]tests[\\/]|[\\/]artifacts[\\/]/.test(
              f,
            ),
        ),
        'Private runtime data/test fixtures must not enter production traces',
      );
    }
  }
}
await inspect('.next-production-test/server');
console.log(
  'PASS: no private local data, env files, test fixtures or artifacts in server deployment traces.',
);
