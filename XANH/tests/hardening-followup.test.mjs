import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Password change only commits against the password hash that was verified', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /UPDATE users SET password_hash=\?,updated_at=\? WHERE id=\? AND password_hash=\?/);
  assert.match(api, /Mật khẩu đã được thay đổi trong một yêu cầu khác/);
});

test('Password reset consumes only tokens when the selected token is still valid and revokes sessions', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /UPDATE password_reset_tokens SET used_at=\? WHERE user_id=\? AND used_at IS NULL AND EXISTS \(SELECT 1 FROM password_reset_tokens WHERE id=\? AND user_id=\? AND used_at IS NULL AND expires_at>\?\)/);
  assert.match(api, /DELETE FROM sessions WHERE user_id=\? AND EXISTS \(SELECT 1 FROM password_reset_tokens WHERE id=\? AND user_id=\? AND used_at=\?\)/);
});

test('Old rate-limit rows, reset tokens and expired sessions have bounded cleanup paths', async () => {
  const api = await read('functions/api/[[path]].js');
  const auth = await read('functions/_lib/auth.js');
  assert.match(api, /DELETE FROM rate_limits WHERE window_start < \?/);
  assert.match(api, /DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at<=\?/);
  assert.match(auth, /DELETE FROM sessions WHERE expires_at<=\? OR user_id IN/);
});

test('Form file uploads are rejected after expiry even if cleanup has not run yet', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /upload_token_hash=\? AND claimed_submission_id IS NULL AND expires_at>\?/);
  assert.match(api, /claimed_submission_id IS NULL AND expires_at>\?\)=\?/);
});

test('A failed D1 media metadata insert attempts to remove the R2 object', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /MEDIA_ORPHAN_CLEANUP_FAILED/);
  assert.match(api, /FORM_UPLOAD_ORPHAN_CLEANUP_FAILED/);
});

test('Private media does not leak single-item metadata to other users', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /if\(m\.visibility==='private'\)assert\(ADMIN_ROLES\.has\(user\.role\)\|\|Number\(m\.uploaded_by\)===Number\(user\.id\)/);
  assert.match(api, /row\.visibility==='private'\?'private, no-store'/);
});

test('Newsletter signup reports email delivery failure honestly', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /NEWSLETTER_CONFIRMATION_EMAIL_FAILED/);
  assert.match(api, /confirmation_email_sent:false,message:'Yêu cầu đã được ghi nhận tạm thời/);
  assert.match(api, /confirmation_email_sent:true,message:'Vui lòng kiểm tra email/);
});

test('The runtime theme defaults to forest green while admin controls retain Be Vietnam Pro', async () => {
  const app = await read('public/app.js');
  assert.match(app, /setColor\('theme_primary','--blue','#23794f'\)/);
  assert.match(app, /--site-font-family',fonts\[['"]be-vietnam-pro['"]\]/);
  assert.doesNotMatch(app, /fonts\.be-vietnam-pro/);
  assert.match(app, /theme_font_family:'be-vietnam-pro'/);
});

test('Impact verification requires an independent verifier and does not change measurements inline', async () => {
  const api = await read('functions/api/[[path]].js');
  assert.match(api, /Number\(existing\.recorded_by\)!==Number\(user\.id\)/);
  assert.match(api, /Không thể thay đổi số liệu trong cùng thao tác xác minh/);
  assert.match(api, /recorded_by=CASE WHEN excluded\.verified=0 THEN excluded\.recorded_by ELSE impact_records\.recorded_by END/);
});

test('Service worker uses the current versioned typography and static assets', async () => {
  const worker = await read('public/sw.js');
  assert.match(worker, /xanh-shell-v14/);
  assert.match(worker, /accessibility\.js\?v=20261012-1/);
  assert.match(worker, /styles\.css\?v=20261012-1/);
});
