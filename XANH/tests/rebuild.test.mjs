import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(new URL('..', import.meta.url).pathname);
const read = p => readFile(resolve(root,p),'utf8');

test('migration 0006 adds verified waste/beneficiary data and four counter settings', async () => {
  const sql = await read('migrations/0006_navigation_impact_content.sql');
  for (const fragment of [
    'ADD COLUMN waste_tons REAL', 'ADD COLUMN community_reached INTEGER',
    'CREATE TABLE IF NOT EXISTS impact_counter_config', "'participants'", "'completed_activities'", "'waste_tons'", "'community_reached'",
    "INSERT OR IGNORE INTO site_settings(key,value_json,updated_at) VALUES ('navigation'"
  ]) assert.ok(sql.includes(fragment), `missing migration fragment: ${fragment}`);
});

test('Navigation Manager and homepage preview are wired to admin endpoints', async () => {
  const app = await read('public/app.js');
  const api = await read('functions/api/[[path]].js');
  assert.ok(app.includes("api('/api/admin/navigation'"));
  assert.ok(app.includes("api('/api/admin/impact-display'"));
  assert.ok(app.includes('id="nav-preview"'));
  assert.ok(app.includes('id="page-preview"'));
  assert.ok(api.includes("action==='navigation'"));
  assert.ok(api.includes("action==='impact-display'"));
  assert.ok(api.includes("h.startsWith('/')&&!h.startsWith('//')"));
});

test('public counters show a placeholder without verified data and can be timed', async () => {
  const app = await read('public/app.js');
  const api = await read('functions/api/[[path]].js');
  assert.ok(app.includes("c.value===null||c.enabled===false?'—':'0'"));
  assert.ok(app.includes('data-duration'));
  assert.ok(app.includes('data-delay'));
  assert.ok(api.includes('verifiedCount>0?Number(sourceValues[c.metric_key]||0):null'));
});

test('newsletter has a backend unsubscribe route and email link', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.ok(api.includes('/api/public/newsletter-unsubscribe?token='));
  assert.ok(api.includes("action === 'newsletter-unsubscribe'"));
  assert.ok(api.includes("status='unsubscribed'"));
});
