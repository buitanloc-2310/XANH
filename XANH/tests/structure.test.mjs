import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(new URL('..', import.meta.url).pathname);

test('Cloudflare bindings are production values', async () => {
  const w = await readFile(resolve(root,'wrangler.jsonc'),'utf8');
  assert.ok(w.includes('"binding": "DB"'));
  assert.ok(w.includes('"database_name": "xanh"'));
  assert.ok(w.includes('6445b394-1588-4ef0-b22d-d2e312cfa596'));
  assert.ok(w.includes('"binding": "STORAGE"'));
  assert.ok(w.includes('"bucket_name": "xanh"'));
});

test('official supplied logo is bundled in production assets', async () => {
  const s = await stat(resolve(root,'public/assets/xanh-sky-first-logo.png'));
  assert.ok(s.size > 10000);
});
