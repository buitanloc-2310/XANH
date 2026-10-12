# Xanh Sky First — Recovery package for `/admin/settings` and `/admin/ctt`

Date: 12 October 2026

## Fixes included

1. **`/admin/settings` loaded the public-site error shell instead of the admin module:** bumped the JavaScript/CSS asset versions, changed the service-worker cache name from `xanh-shell-v14` to `xanh-shell-v15`, and set no-cache headers for the HTML entry point, app bundle, and service worker. This forces clients to request the current route-handling code on deployment.
2. **`/admin/ctt` returned HTTP 500 when the CTT outbox schema was missing or incompatible:** the read endpoint now falls back to the previously used `ctt_sync_queue`. If neither known table is available, it returns an explicit setup warning and an empty list rather than throwing an HTTP 500. Retry actions are disabled in compatibility mode to avoid writing to an old schema.
3. Added `migrations/0011_admin_500_recovery.sql`, an additive/idempotent recovery migration that creates the current `ctt_integration_outbox` table and its index with `IF NOT EXISTS`. It does not delete or rewrite submissions.

## Verification completed locally

- `node --test tests/*.test.mjs`: **81 passed, 0 failed**.
- `node --check`: all JavaScript/MJS files in `functions`, `public`, `scripts`, `src`, and `tests` passed.
- `node scripts/verify-production.mjs`: static integrity passed (82 files scanned).
- All 12 migration files, including `0011_admin_500_recovery.sql`, executed successfully in filename order on a clean in-memory SQLite database; the final schema contains `site_settings` and `ctt_integration_outbox`.
- These are source/local tests only. Production was not deployed or queried from this environment, so live success is **not yet verified**.

## Deployment steps

1. Deploy this source package to the existing Cloudflare Pages project so that `public/index.html`, `public/sw.js`, `public/_headers`, `functions/api/[[path]].js`, and the new migration reach production.
2. To ensure the current CTT outbox table exists in production D1, run this once from the project folder:

   ```bash
   npx wrangler d1 execute xanh --remote --file=migrations/0011_admin_500_recovery.sql
   ```

   This SQL is additive and safe to re-run. It does not perform a full migration replay.
3. In a browser, hard-reload the website (Ctrl+Shift+R), then open `/admin/settings` and `/admin/ctt`. Confirm that the settings editor renders, and that CTT shows its table or a clear schema warning rather than HTTP 500.
4. If either endpoint still returns 500, inspect the Cloudflare Pages Function logs for `/api/admin/settings` or `/api/admin/ctt-integration`; the production logs are required to identify any remaining D1/runtime-specific error.

## Important limitation

This package has not been deployed by this tool. No production D1/R2 data was accessed or modified, and the ZIP is not a claim that live production already works.
