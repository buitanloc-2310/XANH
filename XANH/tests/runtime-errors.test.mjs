import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCookies } from '../functions/_lib/http.js';
import { onRequest } from '../functions/api/[[path]].js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Malformed percent escapes in unrelated cookies do not crash session parsing', () => {
  const request = new Request('https://www.xanh.skyfirst.io.vn/api/auth/me', {
    headers: { Cookie: 'xanh_session=valid-token; legacy_cookie=bad%value; locale=vi%2Dvn' },
  });
  const parsed = parseCookies(request);
  assert.equal(parsed.xanh_session, 'valid-token');
  assert.equal(parsed.legacy_cookie, 'bad%value');
  assert.equal(parsed.locale, 'vi-vn');
});

test('Site theme uses bracket access for the hyphenated Be Vietnam Pro key', async () => {
  const app = await read('public/app.js');
  assert.match(app, /fonts\[['"]be-vietnam-pro['"]\]/);
  assert.doesNotMatch(app, /fonts\.be-vietnam-pro/);
});

test('Admin settings read does not depend on the unused updated_at column', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /SELECT key,value_json FROM site_settings ORDER BY key/);
  assert.match(api, /no such column: updated_at\|has no column named updated_at/i);
  assert.match(api, /INSERT INTO site_settings\(key,value_json\) VALUES\(\?,\?\) ON CONFLICT\(key\) DO UPDATE SET value_json=excluded\.value_json/);
});


function mockD1({ legacySettingsSchema = false } = {}) {
  const values = { general: { site_name: 'Xanh Sky First' }, security: { pbkdf2_iterations: 100000 } };
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        async all() {
          if (/SELECT key,value_json FROM site_settings ORDER BY key/i.test(sql)) {
            return { results: Object.entries(values).map(([key, value]) => ({ key, value_json: JSON.stringify(value) })) };
          }
          return { results: [] };
        },
        bind(...args) {
          return {
            async first() {
              if (/FROM sessions s JOIN users u/i.test(sql)) {
                return { id: 1, name: 'Administrator', email: 'admin@example.invalid', role: 'root_admin', status: 'active', session_id: 7, expires_at: '2099-01-01T00:00:00.000Z' };
              }
              if (/SELECT value_json FROM site_settings WHERE key=\?/i.test(sql)) {
                const value = values[args[0]];
                return value === undefined ? null : { value_json: JSON.stringify(value) };
              }
              return null;
            },
            async all() {
              if (/SELECT key,value_json FROM site_settings ORDER BY key/i.test(sql)) {
                return { results: Object.entries(values).map(([key, value_json]) => ({ key, value_json: JSON.stringify(value_json) })) };
              }
              return { results: [] };
            },
            async run() {
              calls.push({ sql, args });
              if (legacySettingsSchema && /^INSERT INTO site_settings\(key,value_json,updated_at\)/i.test(sql)) {
                throw new Error('table site_settings has no column named updated_at');
              }
              if (/^INSERT INTO site_settings\(key,value_json(?:,updated_at)?\)/i.test(sql)) {
                values[args[0]] = JSON.parse(args[1]);
              }
              return { meta: { changes: 1, last_row_id: 1 } };
            },
          };
        },
      };
    },
  };
}

test('Admin settings GET succeeds when the table has no unused updated_at column', async () => {
  const DB = mockD1({ legacySettingsSchema: true });
  const request = new Request('https://www.xanh.skyfirst.io.vn/api/admin/settings', {
    headers: { Cookie: 'xanh_session=valid-token' },
  });
  const response = await onRequest({ request, env: { DB } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.groups.general.site_name, 'Xanh Sky First');
  assert.ok(!DB.calls.some(call => /SELECT key,value_json,updated_at FROM site_settings/i.test(call.sql)));
});

test('Admin settings PUT retries without updated_at only for the legacy missing-column error', async () => {
  const DB = mockD1({ legacySettingsSchema: true });
  const request = new Request('https://www.xanh.skyfirst.io.vn/api/admin/settings', {
    method: 'PUT',
    headers: { Cookie: 'xanh_session=valid-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'general', value: { site_name: 'Xanh — final fix' } }),
  });
  const response = await onRequest({ request, env: { DB } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.value.site_name, 'Xanh — final fix');
  assert.ok(DB.calls.some(call => /^INSERT INTO site_settings\(key,value_json,updated_at\)/i.test(call.sql)));
  assert.ok(DB.calls.some(call => /^INSERT INTO site_settings\(key,value_json\) VALUES\(\?,\?\)/i.test(call.sql)));
});

test('Management assets are cache-busted so /admin/settings does not load a stale public router', async () => {
  const html = await read('public/index.html');
  const sw = await read('public/sw.js');
  const headers = await read('public/_headers');
  assert.match(html, /app\.js\?v=20261012-3/);
  assert.match(sw, /xanh-shell-v15/);
  assert.match(sw, /app\.js\?v=20261012-3/);
  assert.match(headers, /\/app\.js\n\s+Cache-Control: no-store, no-cache, must-revalidate/);
  assert.match(headers, /\/sw\.js\n\s+Cache-Control: no-store, no-cache, must-revalidate/);
});

test('CTT Admin stays available when modern outbox is missing and falls back to legacy queue', async () => {
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM sessions s JOIN users u/i.test(sql)) return { id: 1, name: 'Root', email: 'root@example.invalid', role: 'root_admin', status: 'active', session_id: 1, expires_at: '2099-01-01T00:00:00.000Z' };
              return null;
            },
            async all() { return { results: [] }; },
            async run() { return { meta: { changes: 1 } }; },
          };
        },
        async all() {
          if (/FROM ctt_integration_outbox/i.test(sql)) throw new Error('no such table: ctt_integration_outbox');
          if (/FROM ctt_sync_queue q/i.test(sql)) return { results: [{ submission_code: 'XSF-LEGACY', state: 'failed', attempts: 1, last_http_status: null, last_error: 'timeout', created_at: '2026-01-01', updated_at: '2026-01-02', sent_at: null }] };
          return { results: [] };
        },
      };
    },
  };
  const request = new Request('https://www.xanh.skyfirst.io.vn/api/admin/ctt-integration', { headers: { Cookie: 'xanh_session=valid-token' } });
  const response = await onRequest({ request, env: { DB } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'legacy_queue');
  assert.equal(body.items[0].submission_code, 'XSF-LEGACY');
  assert.match(body.warning, /0011_admin_500_recovery\.sql/);
});

test('CTT Admin returns a visible setup warning instead of HTTP 500 when both known queues are absent', async () => {
  const DB = {
    prepare(sql) {
      return {
        bind(...args) { return { async first() { if (/FROM sessions s JOIN users u/i.test(sql)) return { id: 1, name: 'Root', email: 'root@example.invalid', role: 'root_admin', status: 'active', session_id: 1, expires_at: '2099-01-01T00:00:00.000Z' }; return null; } }; },
        async all() {
          if (/FROM ctt_integration_outbox/i.test(sql)) throw new Error('no such table: ctt_integration_outbox');
          if (/FROM ctt_sync_queue q/i.test(sql)) throw new Error('no such table: ctt_sync_queue');
          return { results: [] };
        },
      };
    },
  };
  const request = new Request('https://www.xanh.skyfirst.io.vn/api/admin/ctt-integration', { headers: { Cookie: 'xanh_session=valid-token' } });
  const response = await onRequest({ request, env: { DB } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'uninitialized');
  assert.deepEqual(body.items, []);
  assert.match(body.warning, /0011_admin_500_recovery\.sql/);
});

test('CTT Admin preserves legacy history alongside a newly initialized outbox', async () => {
  const DB = {
    prepare(sql) {
      return {
        bind(...args) { return { async first() { if (/FROM sessions s JOIN users u/i.test(sql)) return { id: 1, name: 'Root', email: 'root@example.invalid', role: 'root_admin', status: 'active', session_id: 1, expires_at: '2099-01-01T00:00:00.000Z' }; return null; } }; },
        async all() {
          if (/FROM ctt_integration_outbox/i.test(sql)) return { results: [{ submission_code: 'XSF-CURRENT', state: 'pending', attempts: 0, last_http_status: null, last_error: '', created_at: '2026-10-12', updated_at: '2026-10-12', sent_at: null }] };
          if (/FROM ctt_sync_queue q/i.test(sql)) return { results: [{ submission_code: 'XSF-OLD', state: 'failed', attempts: 2, last_http_status: null, last_error: 'legacy', created_at: '2026-10-10', updated_at: '2026-10-11', sent_at: null }] };
          return { results: [] };
        },
      };
    },
  };
  const request = new Request('https://www.xanh.skyfirst.io.vn/api/admin/ctt-integration', { headers: { Cookie: 'xanh_session=valid-token' } });
  const response = await onRequest({ request, env: { DB } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'combined');
  assert.deepEqual(body.items.map(x => x.submission_code).sort(), ['XSF-CURRENT', 'XSF-OLD']);
  assert.ok(body.items.find(x => x.submission_code === 'XSF-OLD')._source === 'legacy_queue');
});
