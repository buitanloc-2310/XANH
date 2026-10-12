# Xanh Sky First — Recovery package for `/admin/settings` and `/admin/ctt`

Date: 12 October 2026

## Fixes included

1. **`/admin/settings` loaded the public-site error shell instead of the admin module:** bumped the JavaScript/CSS asset versions, changed the service-worker cache name to `xanh-shell-v16` and app bundle to `app.js?v=20261012-4`, and set no-cache headers for the HTML entry point, app bundle, and service worker. This forces clients to request the current route-handling code on deployment.
2. **`/admin/ctt` returned HTTP 500 when the CTT outbox schema was missing or incompatible:** the read endpoint now falls back to the previously used `ctt_sync_queue`. If neither known table is available, it returns an explicit setup warning and an empty list rather than throwing an HTTP 500. Retry actions are disabled in compatibility mode to avoid writing to an old schema.
3. Added `migrations/0011_admin_500_recovery.sql`, an additive/idempotent recovery migration that creates the current `ctt_integration_outbox` table and its index with `IF NOT EXISTS`. It does not delete or rewrite submissions.
4. **Follow-up for `/admin/settings` still returning HTTP 500:** the settings API now catches only the exact missing `site_settings` table error, creates the table if absent, and seeds a minimal `general` default row with `INSERT OR IGNORE`. Existing settings are not overwritten; unrelated D1 errors still remain errors. A regression test covers this missing-table path.

## Verification completed locally

- `node --test tests/*.test.mjs`: **82 passed, 0 failed** after the settings-table recovery patch.
- `node --check`: all JavaScript/MJS files in `functions`, `public`, `scripts`, `src`, and `tests` passed (syntax-checked as a batch).
- `node scripts/verify-production.mjs`: static integrity passed (**83 files scanned**).
- The local recovery test simulates `site_settings` being absent and verifies the admin settings GET creates it and returns defaults. This does not prove the live D1 binding is correct; unrelated errors still need Cloudflare logs.
- These are source/local tests only. Production was not deployed or queried from this environment, so live success is **not yet verified**.

## Deployment steps

1. Deploy this source package to the existing Cloudflare Pages project so that `public/index.html`, `public/sw.js`, `public/_headers`, `functions/api/[[path]].js`, and the new migration reach production.
2. To ensure the current CTT outbox table exists in production D1, run this once from the project folder:

   ```bash
   npx wrangler d1 execute xanh --remote --file=migrations/0011_admin_500_recovery.sql
   ```

   This SQL is additive and safe to re-run. It does not perform a full migration replay.
3. In a browser, hard-reload the website (Ctrl+Shift+R), then open `/admin/settings` and `/admin/ctt`. Confirm that the settings editor renders, and that CTT shows its table or a clear schema warning rather than HTTP 500.
4. Settings storage now self-recovers only if `site_settings` is absent. No SQL is required specifically for this settings-table case. If `/api/admin/settings` still returns 500 after the new source is deployed, inspect Cloudflare Pages Function logs for the exact D1/runtime error; that would indicate an unrelated schema, binding, or deployment issue that cannot be inferred from local files. For CTT, apply the one-file recovery SQL above if needed.

## Important limitation

This package has not been deployed by this tool. No production D1/R2 data was accessed or modified, and the ZIP is not a claim that live production already works.
