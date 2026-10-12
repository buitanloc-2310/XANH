import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root), 'utf8');

test('Typography controls expose decrease, reset, increase and Be Vietnam Pro', async () => {
  const html = await read('public/index.html');
  const css = await read('public/styles.css');
  const scaler = await read('public/accessibility.js');
  assert.match(html, /data-font-step="-1"/);
  assert.match(html, /data-font-step="0"/);
  assert.match(html, /data-font-step="1"/);
  assert.match(html, /family=Be\+Vietnam\+Pro/);
  assert.match(css, /\.font-accessibility-tools\{/);
  assert.match(scaler, /restoreOriginalFontSizes/);
  assert.match(scaler, /measurements = elements\.map/);
  assert.match(scaler, /localStorage\.setItem/);
});

test('Legacy manual_value is not added twice', async () => {
  const migration = await read('migrations/0009_impact_display_full_control.sql');
  assert.equal((migration.match(/ADD COLUMN manual_value/gi) || []).length, 0);
});

test('SVG uploads are not accepted as active-content media', async () => {
  const media = await read('functions/_lib/media.js');
  assert.doesNotMatch(media, /\['image\/svg\+xml'/);
  assert.match(media, /const ALLOWED = new Map/);
});

test('Newsletter state changes are implemented on POST rather than on GET', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /newsletter-verify' && \['GET','POST'\]\.includes\(request\.method\)/);
  assert.match(api, /newsletter-unsubscribe' && \['GET','POST'\]\.includes\(request\.method\)/);
  assert.match(api, /return newsletterTokenConfirmationPage\(\{kind:'verify'/);
  assert.match(api, /return newsletterTokenConfirmationPage\(\{kind:'unsubscribe'/);
});

test('Uploaded form files have an expiry and independent cleanup routine', async () => {
  const api = await read('functions/api/[[path]].js');
  const migration = await read('migrations/0010_lifecycle_accessibility.sql');
  assert.match(migration, /ADD COLUMN expires_at TEXT/);
  assert.match(api, /async function cleanupExpiredFormUploads/);
  assert.match(api, /DELETE FROM form_uploads WHERE id=\? AND claimed_submission_id IS NULL AND expires_at<=\?/);
});
