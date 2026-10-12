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
