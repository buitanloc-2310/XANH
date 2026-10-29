import { json, readJson, HttpError, assert, errorResponse, safeSlug, cleanText, requireSameOrigin } from '../_lib/http.js';
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS, randomToken, sha256Hex } from '../_lib/crypto.js';
import { currentUser, requireUser, createSession, sessionCookie, clearSessionCookie, destroySession, audit } from '../_lib/auth.js';
import { validateUpload, mediaKey } from '../_lib/media.js';
import { completeImpactConfigRows } from '../_lib/impact-config.js';
import { handleDiagnosticsAdmin, handleDiagnosticsCron } from '../_lib/diagnostics-api.js';

const CONTENT_TYPES = new Set(['article','project','activity','opportunity','resource','initiative']);
const PUBLIC_STATUSES = new Set(['published','open','completed']);
const FORM_STATUSES = new Set(['draft','open','closed','archived']);
const SUBMISSION_STATUSES = new Set(['new','reviewing','needs_info','approved','rejected','completed']);
const USER_ROLES = new Set(['root_admin','administrator','content_editor','project_manager','volunteer_coordinator','viewer']);
const ADMIN_ROLES = new Set(['root_admin','administrator']);
const IMPACT_DISPLAY_KEYS = ['participants','completed_activities','waste_tons','completed_programs','education_sessions','green_points','partner_units'];
const IMPACT_ICON_KEYS = new Set(['users','sprout','recycle','clipboard-check','book-open','map-pin','handshake']);
const IMPACT_D1_KEYS = new Set(['completed_activities','waste_tons','completed_programs','education_sessions']);


function routeParts(request) {
  const u = new URL(request.url);
  const p = u.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return { u, p };
}
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
function now() { return new Date().toISOString(); }
function asJson(textValue, fallback) { try { return JSON.parse(textValue); } catch { return fallback; } }
function bool(v) { return v === true || v === 1 || v === '1' || v === 'true' || v === 'on'; }
function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function contentOut(row) {
  if (!row) return null;
  return {
    ...row,
    body: asJson(row.body_json, []),
    metadata: asJson(row.metadata_json, {}),
    cover_url: row.cover_media_id ? `/api/media/${row.cover_media_id}` : null,
  };
}
function pageOut(row) {
  if (!row) return null;
  return { ...row, blocks: asJson(row.blocks_json, []), seo: asJson(row.seo_json, {}) };
}
function mediaOut(row) { return row ? { ...row, visibility: row.visibility==='private'?'private':'public', url: `/api/media/${row.id}` } : null; }

async function rateLimit(env, request, bucket, limit, seconds) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const keyHash = await sha256Hex(`${bucket}:${ip}`);
  const ts = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(ts / seconds) * seconds;
  // Bound historical rate-limit storage without a separately scheduled worker.
  await env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).bind(ts - 7 * 86400).run();
  await env.DB.prepare(`INSERT INTO rate_limits(bucket,key_hash,window_start,hits) VALUES(?,?,?,1)
    ON CONFLICT(bucket,key_hash,window_start) DO UPDATE SET hits=hits+1`).bind(bucket,keyHash,windowStart).run();
  const row = await env.DB.prepare(`SELECT hits FROM rate_limits WHERE bucket=? AND key_hash=? AND window_start=?`).bind(bucket,keyHash,windowStart).first();
  if ((row?.hits || 0) > limit) throw new HttpError(429, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
}

const DEFAULT_GENERAL_SETTINGS = {
  site_name: 'Xanh Sky First',
  site_url: 'https://xanh.skyfirst.io.vn',
  tagline: 'Hành động hôm nay. Xanh ngày mai.',
  email_main: 'xanh@skyfirst.io.vn',
  email_support: 'support@skyfirst.io.vn',
  email_partnership: 'hoptac@skyfirst.io.vn',
  email_media: 'truyenthong@skyfirst.io.vn',
  hotline: '0924 910 210',
  logo_url: '/assets/xanh-sky-first-logo.png',
  theme_primary: '#23794f',
  theme_green: '#329b65',
  theme_navy: '#173b2d',
};

async function recoverMissingSiteSettingsTable(env, error) {
  const message = String(error?.message || error);
  // Only repair the exact missing-table case. Do not conceal permission, binding,
  // malformed-schema, or general D1 failures as successful recovery.
  if (!/no such table:\s*site_settings/i.test(message)) throw error;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO site_settings(key,value_json,updated_at) VALUES(?,?,?)`)
    .bind('general', JSON.stringify(DEFAULT_GENERAL_SETTINGS), now()).run();
}

async function settingsRows(env) {
  try {
    return await env.DB.prepare(`SELECT key,value_json FROM site_settings ORDER BY key`).all();
  } catch (error) {
    await recoverMissingSiteSettingsTable(env, error);
    return await env.DB.prepare(`SELECT key,value_json FROM site_settings ORDER BY key`).all();
  }
}

async function settingsGet(env, key='general') {
  try {
    const row = await env.DB.prepare(`SELECT value_json FROM site_settings WHERE key=?`).bind(key).first();
    return asJson(row?.value_json, {});
  } catch (error) {
    await recoverMissingSiteSettingsTable(env, error);
    const row = await env.DB.prepare(`SELECT value_json FROM site_settings WHERE key=?`).bind(key).first();
    return asJson(row?.value_json, {});
  }
}
async function settingsSet(env, key, value) {
  const serialized = JSON.stringify(value || {});
  try {
    await env.DB.prepare(`INSERT INTO site_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).bind(key, serialized, now()).run();
  } catch (error) {
    // Some pre-existing D1 databases may have been created before updated_at
    // was added to site_settings. Support that legacy shape without swallowing
    // unrelated database errors or requiring a destructive rebuild.
    const message = String(error?.message || error);
    if (!/no such column: updated_at|has no column named updated_at/i.test(message)) throw error;
    await env.DB.prepare(`INSERT INTO site_settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`).bind(key, serialized).run();
  }
}

async function signCttPayload(secret, timestamp, nonce, raw) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${nonce}.${raw}`));
  return 'v1=' + Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function deliverCttSubmission(env, payload) {
  const secret = String(env.XANH_CTT_SHARED_SECRET || '');
  if (secret.length < 32) {
    await env.DB.prepare(`UPDATE ctt_integration_outbox SET state='not_configured',attempts=attempts+1,last_error=?,updated_at=? WHERE submission_code=?`).bind('Chưa cấu hình XANH_CTT_SHARED_SECRET', now(), payload.code).run();
    return { sent: false, reason: 'not_configured' };
  }
  const endpoint = String(env.XANH_CTT_ENDPOINT || 'https://ctt.skyfirst.io.vn/api/integrations/xanh/submissions');
  if (!endpoint.startsWith('https://')) {
    await env.DB.prepare(`UPDATE ctt_integration_outbox SET state='failed',attempts=attempts+1,last_error=?,updated_at=? WHERE submission_code=?`).bind('Endpoint CTT phải dùng HTTPS', now(), payload.code).run();
    return { sent: false, reason: 'invalid_endpoint' };
  }
  const raw = JSON.stringify(payload), timestamp = String(Math.floor(Date.now()/1000)), nonce = randomToken(24);
  try {
    const signature = await signCttPayload(secret, timestamp, nonce, raw);
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SFN-Timestamp': timestamp, 'X-SFN-Nonce': nonce, 'X-SFN-Signature': signature }, body: raw, signal: AbortSignal.timeout(8000) });
    const text = await response.text();
    if (response.ok) {
      await env.DB.prepare(`UPDATE ctt_integration_outbox SET state='sent',attempts=attempts+1,last_http_status=?,last_error='',updated_at=?,sent_at=? WHERE submission_code=?`).bind(response.status, now(), now(), payload.code).run();
      return { sent: true, status: response.status };
    }
    await env.DB.prepare(`UPDATE ctt_integration_outbox SET state='failed',attempts=attempts+1,last_http_status=?,last_error=?,updated_at=? WHERE submission_code=?`).bind(response.status, `CTT HTTP ${response.status}: ${text.slice(0,300)}`, now(), payload.code).run();
    return { sent: false, reason: 'http_error', status: response.status };
  } catch (e) {
    await env.DB.prepare(`UPDATE ctt_integration_outbox SET state='failed',attempts=attempts+1,last_error=?,updated_at=? WHERE submission_code=?`).bind(String(e?.message||e).slice(0,500), now(), payload.code).run();
    return { sent: false, reason: 'network_error' };
  }
}
async function queueCttSubmission(env, payload) {
  await env.DB.prepare(`INSERT INTO ctt_integration_outbox(submission_code,payload_json,state,created_at,updated_at) VALUES(?,?,'pending',?,?) ON CONFLICT(submission_code) DO NOTHING`).bind(payload.code, JSON.stringify(payload), now(), now()).run();
  return deliverCttSubmission(env, payload);
}

async function sendMail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: 'RESEND_API_KEY chưa được cấu hình' };
  const from = env.EMAIL_FROM || 'Xanh Sky First <xanh@skyfirst.io.vn>';
  const replyTo = env.EMAIL_REPLY_TO || 'xanh@skyfirst.io.vn';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html }),
  });
  if (!res.ok) return { sent: false, reason: `Resend HTTP ${res.status}` };
  return { sent: true };
}

async function setupStatus(env) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users WHERE role='root_admin'`).first();
  return Number(row?.c || 0) > 0;
}

async function handleSetup(env, request) {
  if (request.method === 'GET') return json({ ok: true, initialized: await setupStatus(env), pbkdf2_iterations: PBKDF2_ITERATIONS });
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  requireSameOrigin(request);
  await rateLimit(env, request, 'setup', 5, 900);
  assert(!(await setupStatus(env)), 409, 'Hệ thống đã được khởi tạo. Setup đã bị khóa.');
  const body = await readJson(request);
  assert(env.SETUP_SECRET, 503, 'SETUP_SECRET chưa được cấu hình trên Cloudflare.');
  assert(typeof body.setup_secret === 'string' && body.setup_secret === env.SETUP_SECRET, 403, 'SETUP_SECRET không hợp lệ.');
  const name = cleanText(body.name, 120), email = cleanText(body.email, 200).toLowerCase(), password = String(body.password || '');
  assert(name.length >= 2, 400, 'Họ tên chưa hợp lệ.');
  assert(validEmail(email), 400, 'Email chưa hợp lệ.');
  assert(password.length >= 10, 400, 'Mật khẩu phải có ít nhất 10 ký tự.');
  const hash = await hashPassword(password);
  const t = now();
  // Atomic first-admin claim: the predicate is checked inside the same INSERT statement,
  // so concurrent setup requests cannot both pass a preflight count.
  const r = await env.DB.prepare(`INSERT INTO users(name,email,password_hash,role,status,created_at,updated_at)
    SELECT ?,?,?,'root_admin','active',?,? WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='root_admin')`).bind(name,email,hash,t,t).run();
  assert(Number(r.meta?.changes||0)===1,409,'Hệ thống đã được khởi tạo. Setup đã bị khóa.');
  const id = r.meta.last_row_id;
  await audit(env,id,'setup.initialize','system','root_admin',{pbkdf2_iterations:PBKDF2_ITERATIONS},request);
  const user = { id, name, email, role:'root_admin', status:'active' };
  const s = await createSession(env,user,request);
  return json({ ok:true, user, pbkdf2_iterations:PBKDF2_ITERATIONS }, 201, { 'Set-Cookie': sessionCookie(s.token,s.expires) });
}

async function handleAuth(env, request, action) {
  requireSameOrigin(request);
  if (action === 'me' && request.method === 'GET') {
    const u = await currentUser(env,request);
    return json({ ok:true, user:u ? {id:u.id,name:u.name,email:u.email,role:u.role}:null });
  }
  if (action === 'login' && request.method === 'POST') {
    await rateLimit(env,request,'login',10,900);
    const b=await readJson(request), email=cleanText(b.email,200).toLowerCase(), password=String(b.password||'');
    const u=await env.DB.prepare(`SELECT * FROM users WHERE email=? AND status='active' LIMIT 1`).bind(email).first();
    if (!u || !(await verifyPassword(password,u.password_hash))) throw new HttpError(401,'Email hoặc mật khẩu không đúng.');
    await env.DB.prepare(`UPDATE users SET last_login_at=?,updated_at=? WHERE id=?`).bind(now(),now(),u.id).run();
    await audit(env,u.id,'auth.login','user',u.id,{},request);
    const s=await createSession(env,u,request);
    return json({ok:true,user:{id:u.id,name:u.name,email:u.email,role:u.role}},200,{'Set-Cookie':sessionCookie(s.token,s.expires)});
  }
  if (action === 'logout' && request.method === 'POST') {
    const u=await currentUser(env,request);
    await destroySession(env,request);
    if(u) await audit(env,u.id,'auth.logout','user',u.id,{},request);
    return json({ok:true},200,{'Set-Cookie':clearSessionCookie()});
  }
  if (action === 'change-password' && request.method === 'POST') {
    const u=await requireUser(env,request); const b=await readJson(request);
    const full=await env.DB.prepare(`SELECT password_hash FROM users WHERE id=?`).bind(u.id).first();
    assert(await verifyPassword(String(b.current_password||''),full.password_hash),400,'Mật khẩu hiện tại không đúng.');
    const next=String(b.new_password||''); assert(next.length>=10,400,'Mật khẩu mới phải có ít nhất 10 ký tự.');
    const nh=await hashPassword(next);
    const changedAt=now();
    const changed=await env.DB.batch([
      env.DB.prepare(`UPDATE users SET password_hash=?,updated_at=? WHERE id=? AND password_hash=?`).bind(nh,changedAt,u.id,full.password_hash),
      env.DB.prepare(`UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL AND EXISTS (SELECT 1 FROM users WHERE id=? AND password_hash=?)`).bind(changedAt,u.id,u.id,nh),
      env.DB.prepare(`DELETE FROM sessions WHERE user_id=? AND id<>? AND EXISTS (SELECT 1 FROM users WHERE id=? AND password_hash=?)`).bind(u.id,u.session_id,u.id,nh),
    ]);
    assert(Number(changed?.[0]?.meta?.changes||0)===1,409,'Mật khẩu đã được thay đổi trong một yêu cầu khác. Vui lòng đăng nhập lại.');
    await audit(env,u.id,'auth.change_password','user',u.id,{pbkdf2_iterations:PBKDF2_ITERATIONS},request);
    return json({ok:true,pbkdf2_iterations:PBKDF2_ITERATIONS});
  }
  if (action === 'request-reset' && request.method === 'POST') {
    await rateLimit(env,request,'reset',5,3600);
    await env.DB.prepare(`DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at<=?`).bind(now()).run();
    const b=await readJson(request); const email=cleanText(b.email,200).toLowerCase();
    const u=await env.DB.prepare(`SELECT id,name,email FROM users WHERE email=? AND status='active'`).bind(email).first();
    if (u) {
      const token=randomToken(32), tokenHash=await sha256Hex(token), expires=new Date(Date.now()+30*60000).toISOString();
      await env.DB.prepare(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?)`).bind(u.id,tokenHash,expires,now()).run();
      const origin=new URL(request.url).origin;
      const link=`${origin}/reset-password?token=${encodeURIComponent(token)}`;
      await sendMail(env,{to:u.email,subject:'Đặt lại mật khẩu Xanh Sky First',html:`<p>Xin chào ${escapeHtml(u.name)},</p><p>Bạn vừa yêu cầu đặt lại mật khẩu. Liên kết này có hiệu lực trong 30 phút:</p><p><a href="${link}">Đặt lại mật khẩu</a></p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`});
    }
    return json({ok:true,message:'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.'});
  }
  if (action === 'reset-password' && request.method === 'POST') {
    await rateLimit(env,request,'reset-confirm',10,3600); const b=await readJson(request); const token=String(b.token||''), password=String(b.password||'');
    assert(password.length>=10,400,'Mật khẩu mới phải có ít nhất 10 ký tự.');
    const th=await sha256Hex(token); const row=await env.DB.prepare(`SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?`).bind(th,now()).first();
    assert(row,400,'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    const ph=await hashPassword(password); const t=now();
    const resetResults=await env.DB.batch([
      env.DB.prepare(`UPDATE users SET password_hash=?,updated_at=? WHERE id=? AND status='active' AND EXISTS (SELECT 1 FROM password_reset_tokens WHERE id=? AND user_id=? AND used_at IS NULL AND expires_at>?)`).bind(ph,t,row.user_id,row.id,row.user_id,t),
      env.DB.prepare(`UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL AND EXISTS (SELECT 1 FROM password_reset_tokens WHERE id=? AND user_id=? AND used_at IS NULL AND expires_at>?)`).bind(t,row.user_id,row.id,row.user_id,t),
      env.DB.prepare(`DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM password_reset_tokens WHERE id=? AND user_id=? AND used_at=?)`).bind(row.user_id,row.id,row.user_id,t),
    ]);
    assert(Number(resetResults?.[0]?.meta?.changes||0)===1,409,'Liên kết đặt lại mật khẩu đã được sử dụng hoặc hết hạn.');
    await audit(env,row.user_id,'auth.reset_password','user',row.user_id,{pbkdf2_iterations:PBKDF2_ITERATIONS},request);
    return json({ok:true});
  }
  throw new HttpError(404,'Không tìm thấy API xác thực.');
}

function sanitizeFields(input) {
  const allowed = new Set(['text','email','phone','url','textarea','select','radio','checkbox','date','time','datetime','number','rating','file','signature','consent','section']);
  const fields = Array.isArray(input) ? input.slice(0,80) : [];
  const usedIds = new Set();
  return fields.map((f, i) => {
    const type = allowed.has(String(f?.type||'')) ? String(f.type) : 'text';
    const baseId = (safeSlug(f?.id || f?.label || `field-${i+1}`) || `field-${i+1}`).slice(0,110);
    let id = baseId, suffix = 2;
    while (usedIds.has(id)) { id = `${baseId.slice(0, 110 - String(suffix).length)}-${suffix}`; suffix += 1; }
    usedIds.add(id);
    const label = cleanText(f?.label || (type==='section' ? 'Phần mới' : `Trường ${i+1}`), 180);
    const options = ['select','radio','checkbox'].includes(type) && Array.isArray(f?.options)
      ? [...new Set(f.options.map(x=>cleanText(x,120)).filter(Boolean))].slice(0,50) : [];
    return {
      id, type, label,
      description: cleanText(f?.description, 500),
      required: type==='section' ? false : bool(f?.required),
      options,
      accept: type==='file' ? cleanText(f?.accept || 'image/*,.pdf,.docx,.xlsx,.pptx,.txt,.csv', 300) : (type==='signature' ? 'image/png' : undefined),
      placeholder: cleanText(f?.placeholder, 180),
      min: Number.isFinite(Number(f?.min)) ? Number(f.min) : undefined,
      max: Number.isFinite(Number(f?.max)) ? Number(f.max) : undefined,
      conditional: f?.conditional && typeof f.conditional==='object' ? f.conditional : undefined,
    };
  });
}
function formCapacity(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  assert(Number.isSafeInteger(n) && n >= 1 && n <= 1000000, 400, 'Sức chứa phải là số nguyên từ 1 đến 1.000.000; để trống nếu không giới hạn.');
  return n;
}
function validateFormWindow(opensAt, closesAt) {
  const start = opensAt ? new Date(opensAt).getTime() : null;
  const end = closesAt ? new Date(closesAt).getTime() : null;
  assert(!opensAt || Number.isFinite(start),400,'Thời điểm mở biểu mẫu không hợp lệ.');
  assert(!closesAt || Number.isFinite(end),400,'Thời điểm đóng biểu mẫu không hợp lệ.');
  assert(start===null || end===null || end>start,400,'Thời điểm đóng phải sau thời điểm mở.');
}
function sanitizeFormSettings(input) {
  const x = input && typeof input==='object' ? input : {};
  return {
    confirmation_title: cleanText(x.confirmation_title || 'Đã nhận hồ sơ', 160),
    confirmation_message: cleanText(x.confirmation_message || 'Xanh Sky First đã ghi nhận thông tin của bạn.', 2000),
    confirmation_email: x.confirmation_email !== false,
    closed_message: cleanText(x.closed_message || 'Biểu mẫu hiện không nhận thêm hồ sơ.', 1000),
    require_guardian_consent: bool(x.require_guardian_consent),
    guardian_note: cleanText(x.guardian_note, 1200),
    countdown_enabled: x.countdown_enabled === undefined ? true : bool(x.countdown_enabled),
    countdown_title: cleanText(x.countdown_title || 'Thời gian còn lại để đăng ký', 160),
    countdown_expired_title: cleanText(x.countdown_expired_title || 'Biểu mẫu đã đóng', 160),
    countdown_expired_message: cleanText(x.countdown_expired_message || x.closed_message || 'Biểu mẫu hiện không nhận thêm hồ sơ.', 1000),
    countdown_warning_hours: Math.max(0,Math.min(720,Number.isFinite(Number(x.countdown_warning_hours))?Number(x.countdown_warning_hours):24)),
    countdown_warning_message: cleanText(x.countdown_warning_message || 'Sắp hết hạn nhận hồ sơ.', 500),
    countdown_timezone: ['Asia/Ho_Chi_Minh','UTC','Asia/Bangkok','Asia/Singapore'].includes(x.countdown_timezone) ? x.countdown_timezone : 'Asia/Ho_Chi_Minh',
  };
}
async function publishDueContent(env) {
  try {
    await env.DB.prepare(`UPDATE content_items SET status='published',published_at=COALESCE(published_at,?),updated_at=? WHERE status='draft' AND json_extract(metadata_json,'$.scheduled_at') IS NOT NULL AND json_extract(metadata_json,'$.scheduled_at')<=?`).bind(now(),now(),now()).run();
  } catch {}
}
async function assertMediaImage(env, id) {
  if (!id) return null;
  const row = await env.DB.prepare(`SELECT id,mime_type,visibility FROM media WHERE id=?`).bind(Number(id)).first();
  assert(row && String(row.mime_type).startsWith('image/') && row.visibility!=='private',400,'Ảnh đã chọn không hợp lệ hoặc đang ở chế độ riêng tư.');
  return Number(row.id);
}
function validateSubmissionAnswers(fields, answers) {
  const a = answers && typeof answers==='object' ? answers : {};
  const clean = {};
  for (const f of fields) {
    if (f.type==='section') continue;
    const raw = a[f.id];
    if (f.type==='file' || f.type==='signature') {
      if (f.required) assert(raw && typeof raw==='object' && raw.upload_token,400,`Vui lòng tải tệp cho “${f.label}”.`);
      if (raw && typeof raw==='object') clean[f.id]={upload_token:cleanText(raw.upload_token,200),filename:cleanText(raw.filename,240)};
      continue;
    }
    if (f.type==='checkbox') {
      const vals = Array.isArray(raw) ? raw.map(x=>cleanText(x,200)) : raw ? [cleanText(raw,200)] : [];
      if (f.required) assert(vals.length>0,400,`Vui lòng chọn “${f.label}”.`);
      if (f.options?.length) assert(vals.every(x=>f.options.includes(x)),400,`Giá trị “${f.label}” không hợp lệ.`);
      clean[f.id]=vals;
      continue;
    }
    if (f.type==='consent') {
      const yes=bool(raw); if(f.required) assert(yes,400,`Bạn cần đồng ý “${f.label}”.`); clean[f.id]=yes; continue;
    }
    const v=cleanText(raw, f.type==='textarea'?8000:1000);
    if (f.required) assert(v.length>0,400,`Vui lòng điền “${f.label}”.`);
    if (f.type==='email' && v) assert(validEmail(v),400,`Email tại “${f.label}” chưa hợp lệ.`);
    if (f.type==='url' && v) { try { const uu=new URL(v); assert(['http:','https:'].includes(uu.protocol),400,`Liên kết tại “${f.label}” chưa hợp lệ.`); } catch { throw new HttpError(400,`Liên kết tại “${f.label}” chưa hợp lệ.`); } }
    if (['number','rating'].includes(f.type) && v) { const num=Number(v); assert(Number.isFinite(num),400,`Giá trị tại “${f.label}” chưa hợp lệ.`); if(f.min!==undefined) assert(num>=f.min,400,`Giá trị tại “${f.label}” nhỏ hơn mức cho phép.`); if(f.max!==undefined) assert(num<=f.max,400,`Giá trị tại “${f.label}” vượt mức cho phép.`); }
    if (['select','radio'].includes(f.type) && v && f.options?.length) assert(f.options.includes(v),400,`Giá trị “${f.label}” không hợp lệ.`);
    clean[f.id]=v;
  }
  return clean;
}

function newsletterPageShell(title,body){
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} | Xanh Sky First</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f5f8f4;color:#20332a;font:16px/1.65 system-ui,sans-serif}.panel{width:min(100%,560px);padding:32px;border:1px solid #dbe7dc;border-radius:24px;background:#fff;box-shadow:0 18px 56px #173b2d12}h1{margin:0 0 12px;font-size:clamp(25px,5vw,34px);line-height:1.2}p{color:#53675a}button{border:0;border-radius:999px;padding:13px 18px;background:#23794f;color:#fff;font:inherit;font-weight:750;cursor:pointer}a{color:#23794f}</style></head><body><main class="panel"><p><b>XANH SKY FIRST</b></p>${body}</main></body></html>`,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
function newsletterTokenConfirmationPage({kind,email,token}){
  const verify=kind==='verify',title=verify?'Xác nhận đăng ký nhận tin':'Xác nhận hủy nhận tin';
  const message=verify?'Nhấn xác nhận bên dưới để kích hoạt đăng ký newsletter. Việc mở liên kết này chưa thay đổi trạng thái đăng ký.':'Nhấn xác nhận bên dưới nếu bạn thực sự muốn ngừng nhận newsletter. Việc mở liên kết này chưa hủy đăng ký.';
  const endpoint=verify?'newsletter-verify':'newsletter-unsubscribe';
  return newsletterPageShell(title,`<h1>${title}</h1><p>${message}</p><form method="post" action="/api/public/${endpoint}"><input type="hidden" name="email" value="${escapeHtml(email)}"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">${verify?'Xác nhận đăng ký':'Xác nhận hủy đăng ký'}</button></form>`);
}
function newsletterResultPage(message,ok){
  return newsletterPageShell(ok?'Đã cập nhật lựa chọn':'Không thể xác nhận',`<h1>${ok?'Đã hoàn tất':'Không thể thực hiện'}</h1><p>${escapeHtml(message)}</p><p><a href="/">Quay lại Xanh Sky First</a></p>`);
}

async function cleanupExpiredFormUploads(env) {
  try {
    const expired = await env.DB.prepare(`SELECT id,r2_key FROM form_uploads WHERE claimed_submission_id IS NULL AND expires_at IS NOT NULL AND expires_at<=? ORDER BY expires_at LIMIT 100`).bind(now()).all();
    for (const item of expired.results || []) {
      try {
        await env.STORAGE.delete(item.r2_key);
        await env.DB.prepare(`DELETE FROM form_uploads WHERE id=? AND claimed_submission_id IS NULL AND expires_at<=?`).bind(item.id,now()).run();
      } catch (error) {
        // Keep the database row for a later retry if R2 is temporarily unavailable.
        console.warn('FORM_UPLOAD_CLEANUP_DEFERRED', String(error?.message || error).slice(0,160));
      }
    }
  } catch (error) {
    // During a staged migration the lifecycle column may not exist yet; normal requests remain available.
    console.warn('FORM_UPLOAD_CLEANUP_UNAVAILABLE', String(error?.message || error).slice(0,160));
  }
}

async function handlePublic(env, request, action) {
  const u=new URL(request.url);
  await publishDueContent(env);
  if (action === 'site' && request.method==='GET') {
    const [settings,navigation]=await Promise.all([settingsGet(env),settingsGet(env,'navigation')]);
    const page=await env.DB.prepare(`SELECT * FROM pages WHERE slug='home' AND status='published'`).first();
    return json({ok:true,settings,navigation,page:pageOut(page)});
  }
  if (action === 'page' && request.method==='GET') {
    const slug=safeSlug(u.searchParams.get('slug'));
    const row=await env.DB.prepare(`SELECT * FROM pages WHERE slug=? AND status='published' LIMIT 1`).bind(slug).first();
    assert(row,404,'Không tìm thấy trang.');
    return json({ok:true,item:pageOut(row)});
  }
  if (action === 'search' && request.method==='GET') {
    const q=cleanText(u.searchParams.get('q'),120); assert(q.length>=1,400,'Nhập từ khóa tìm kiếm.');
    const like=`%${q}%`;
    const [pages,items]=await Promise.all([
      env.DB.prepare(`SELECT slug,title,blocks_json,updated_at FROM pages WHERE status='published' AND slug<>'home' AND (title LIKE ? OR blocks_json LIKE ?) ORDER BY updated_at DESC LIMIT 30`).bind(like,like).all(),
      env.DB.prepare(`SELECT type,slug,title,excerpt,updated_at FROM content_items WHERE status IN ('published','open','completed') AND (title LIKE ? OR excerpt LIKE ? OR body_json LIKE ?) ORDER BY COALESCE(published_at,created_at) DESC LIMIT 50`).bind(like,like,like).all()
    ]);
    const pageResults=pages.results.map(x=>({title:x.title,excerpt:asJson(x.blocks_json,[]).filter(b=>b.type==='paragraph').map(b=>b.text).join(' ').slice(0,180),href:['gioi-thieu'].includes(x.slug)?'/gioi-thieu':`/noi-dung/${x.slug}`,type_label:'Trang'}));
    const bases={article:'tin-tuc',project:'du-an',activity:'hoat-dong',opportunity:'co-hoi',resource:'tai-nguyen',initiative:'sang-kien'};
    const contentResults=items.results.map(x=>({title:x.title,excerpt:x.excerpt,href:`/${bases[x.type]||x.type}/${x.slug}`,type_label:({article:'Tin tức',project:'Dự án',activity:'Hoạt động',opportunity:'Cơ hội',resource:'Tài nguyên',initiative:'Sáng kiến'})[x.type]||'Nội dung'}));
    const merged=[...pageResults,...contentResults].filter((x,i,a)=>a.findIndex(y=>y.href===x.href)===i).slice(0,60);
    return json({ok:true,items:merged});
  }
  if (action === 'content' && request.method==='GET') {
    const type=cleanText(u.searchParams.get('type'),30); assert(CONTENT_TYPES.has(type),400,'Loại nội dung không hợp lệ.');
    const rows=await env.DB.prepare(`SELECT c.* FROM content_items c WHERE c.type=? AND c.status IN ('published','open','completed') ORDER BY COALESCE(c.published_at,c.created_at) DESC LIMIT 100`).bind(type).all();
    return json({ok:true,items:rows.results.map(contentOut)});
  }
  if (action === 'item' && request.method==='GET') {
    const type=cleanText(u.searchParams.get('type'),30), slug=cleanText(u.searchParams.get('slug'),140); assert(CONTENT_TYPES.has(type),400,'Loại nội dung không hợp lệ.');
    const row=await env.DB.prepare(`SELECT * FROM content_items WHERE type=? AND slug=? AND status IN ('published','open','completed') LIMIT 1`).bind(type,slug).first();
    assert(row,404,'Không tìm thấy nội dung.'); return json({ok:true,item:contentOut(row)});
  }
  if (action === 'impact' && request.method==='GET') {
    const [r,cfgRows,programs,education]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(DISTINCT CASE WHEN verified=1 AND completed=1 AND locality<>'' THEN locality END) AS localities,
        COALESCE(SUM(CASE WHEN verified=1 THEN confirmed_participants ELSE 0 END),0) AS participants,
        COALESCE(SUM(CASE WHEN verified=1 AND completed=1 THEN 1 ELSE 0 END),0) AS completed_activities,
        COALESCE(SUM(CASE WHEN verified=1 THEN volunteer_hours ELSE 0 END),0) AS volunteer_hours,
        COALESCE(SUM(CASE WHEN verified=1 THEN waste_tons ELSE 0 END),0) AS waste_tons,
        COALESCE(SUM(CASE WHEN verified=1 THEN community_reached ELSE 0 END),0) AS community_reached,
        SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END) AS verified_records FROM impact_records`).first(),
      env.DB.prepare(`SELECT * FROM impact_counter_config WHERE metric_key IN (${IMPACT_DISPLAY_KEYS.map(()=>'?').join(',')}) ORDER BY sort_order,metric_key`).bind(...IMPACT_DISPLAY_KEYS).all(),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM content_items WHERE type IN ('project','initiative') AND status='completed'`).first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT c.id) AS total FROM content_items c JOIN impact_records i ON i.activity_id=c.id WHERE c.type='activity' AND c.status='completed' AND i.verified=1 AND i.completed=1 AND LOWER(TRIM(COALESCE(c.category,''))) IN ('giáo dục môi trường','hoạt động giáo dục môi trường')`).first(),
    ]);
    const impact={localities:Number(r.localities||0),participants:Number(r.participants||0),completed_activities:Number(r.completed_activities||0),volunteer_hours:Number(r.volunteer_hours||0),waste_tons:Number(r.waste_tons||0),community_reached:Number(r.community_reached||0)};
    const verifiedCount=Number(r.verified_records||0);
    // Each D1-backed metric has an explicit counting rule. Metrics without an
    // existing trustworthy source return null until Admin chooses manual input.
    const sourceValues={participants:impact.participants,completed_activities:impact.completed_activities,waste_tons:impact.waste_tons,completed_programs:Number(programs.total||0),education_sessions:Number(education.total||0)};
    const counters=completeImpactConfigRows(cfgRows.results).map(c=>{
      let value=null;
      if(c.data_source==='manual') value=c.manual_value===null||c.manual_value===undefined?null:Number(c.manual_value);
      else if(c.data_source==='d1'&&IMPACT_D1_KEYS.has(c.metric_key)&&Object.prototype.hasOwnProperty.call(sourceValues,c.metric_key)) {
        value=['completed_activities','waste_tons'].includes(c.metric_key)&&verifiedCount===0?null:Number(sourceValues[c.metric_key]||0);
      }
      return {...c,value,duration_ms:Math.min(12000,Math.max(300,Number(c.duration_ms||1800))),delay_ms:Math.min(5000,Math.max(0,Number(c.delay_ms||0))),hold_ms:Math.min(60000,Math.max(0,Number(c.hold_ms||0))),decimal_places:Math.min(3,Math.max(0,Number(c.decimal_places||0))),enabled:Number(c.enabled)===1};
    });
    return json({ok:true,impact,counters},200,{'Cache-Control':'no-store'});
  }
  if (action === 'contact' && request.method==='POST') {
    await rateLimit(env,request,'contact',8,3600); const b=await readJson(request);
    const route=['general','partnership','media','support'].includes(b.route)?b.route:'general'; const name=cleanText(b.full_name,120), email=cleanText(b.email,200).toLowerCase(), subject=cleanText(b.subject,200), message=cleanText(b.message,6000);
    assert(name.length>=2 && validEmail(email) && subject.length>=3 && message.length>=10,400,'Vui lòng điền đầy đủ thông tin liên hệ.');
    const t=now(); await env.DB.prepare(`INSERT INTO contact_messages(route,full_name,email,subject,message,status,created_at,updated_at) VALUES(?,?,?,?,?,'new',?,?)`).bind(route,name,email,subject,message,t,t).run();
    const st=await settingsGet(env), target=route==='partnership'?st.email_partnership:route==='media'?st.email_media:route==='support'?st.email_support:st.email_main;
    if(target) await sendMail(env,{to:target,subject:`[XANH] ${subject}`,html:`<p><b>${escapeHtml(name)}</b> (${escapeHtml(email)})</p><p>${escapeHtml(message).replace(/\n/g,'<br>')}</p>`});
    return json({ok:true,message:'Xanh đã ghi nhận liên hệ của bạn.'},201);
  }
  if (action === 'newsletter' && request.method==='POST') {
    await rateLimit(env,request,'newsletter',8,3600); const b=await readJson(request), email=cleanText(b.email,200).toLowerCase(); assert(validEmail(email),400,'Email chưa hợp lệ.');
    const prefs=Array.isArray(b.preferences)?b.preferences.map(x=>cleanText(x,50)).slice(0,10):[]; const verify=randomToken(24), unsubscribe=randomToken(24); const vh=await sha256Hex(verify), uh=await sha256Hex(unsubscribe), t=now();
    await env.DB.prepare(`INSERT INTO newsletter_subscribers(email,preferences_json,status,verify_token_hash,unsubscribe_token_hash,created_at,updated_at) VALUES(?,?,'pending',?,?,?,?) ON CONFLICT(email) DO UPDATE SET preferences_json=excluded.preferences_json,status='pending',verify_token_hash=excluded.verify_token_hash,unsubscribe_token_hash=excluded.unsubscribe_token_hash,updated_at=excluded.updated_at`).bind(email,JSON.stringify(prefs),vh,uh,t,t).run();
    const origin=env.APP_URL || new URL(request.url).origin; const link=`${origin}/api/public/newsletter-verify?token=${encodeURIComponent(verify)}&email=${encodeURIComponent(email)}`;
    const unsubscribeLink=`${origin}/api/public/newsletter-unsubscribe?token=${encodeURIComponent(unsubscribe)}&email=${encodeURIComponent(email)}`;
    let mailResult={sent:false,reason:'unknown'};
    try {
      mailResult=await sendMail(env,{to:email,subject:'Xác nhận nhận newsletter Xanh Sky First',html:`<p>Vui lòng xác nhận đăng ký newsletter:</p><p><a href="${link}">Xác nhận email</a></p><p>Nếu bạn không muốn nhận nội dung này, có thể <a href="${unsubscribeLink}">hủy đăng ký</a>.</p>`});
    } catch (error) {
      console.warn('NEWSLETTER_CONFIRMATION_EMAIL_FAILED',String(error?.message||error).slice(0,180));
    }
    if(!mailResult.sent) return json({ok:true,pending:true,confirmation_email_sent:false,message:'Yêu cầu đã được ghi nhận tạm thời, nhưng email xác nhận chưa gửi được. Vui lòng thử lại sau.'},202);
    return json({ok:true,pending:true,confirmation_email_sent:true,message:'Vui lòng kiểm tra email để xác nhận đăng ký.'},201);
  }
  if (action === 'newsletter-verify' && ['GET','POST'].includes(request.method)) {
    let email,token;
    if(request.method==='GET'){
      email=cleanText(u.searchParams.get('email'),200).toLowerCase();token=String(u.searchParams.get('token')||'');
      assert(validEmail(email)&&token.length>=20,400,'Liên kết xác nhận không hợp lệ.');
      return newsletterTokenConfirmationPage({kind:'verify',email,token});
    }
    requireSameOrigin(request);
    const fd=await request.formData();email=cleanText(fd.get('email'),200).toLowerCase();token=String(fd.get('token')||'');
    assert(validEmail(email)&&token.length>=20,400,'Liên kết xác nhận không hợp lệ.');
    const th=await sha256Hex(token);
    const r=await env.DB.prepare(`UPDATE newsletter_subscribers SET status='active',verify_token_hash=NULL,updated_at=? WHERE email=? AND verify_token_hash=? AND status='pending'`).bind(now(),email,th).run();
    const ok=Number(r.meta?.changes||0)>0;
    return newsletterResultPage(ok?'Đã xác nhận newsletter Xanh Sky First.':'Liên kết xác nhận không hợp lệ hoặc đã được sử dụng.',ok);
  }
  if (action === 'newsletter-unsubscribe' && ['GET','POST'].includes(request.method)) {
    let email,token;
    if(request.method==='GET'){
      email=cleanText(u.searchParams.get('email'),200).toLowerCase();token=String(u.searchParams.get('token')||'');
      assert(validEmail(email)&&token.length>=20,400,'Liên kết hủy đăng ký không hợp lệ.');
      return newsletterTokenConfirmationPage({kind:'unsubscribe',email,token});
    }
    requireSameOrigin(request);
    const fd=await request.formData();email=cleanText(fd.get('email'),200).toLowerCase();token=String(fd.get('token')||'');
    assert(validEmail(email)&&token.length>=20,400,'Liên kết hủy đăng ký không hợp lệ.');
    const th=await sha256Hex(token);
    const r=await env.DB.prepare(`UPDATE newsletter_subscribers SET status='unsubscribed',verify_token_hash=NULL,updated_at=? WHERE email=? AND unsubscribe_token_hash=? AND status<>'unsubscribed'`).bind(now(),email,th).run();
    const ok=Number(r.meta?.changes||0)>0;
    return newsletterResultPage(ok?'Bạn đã hủy đăng ký newsletter Xanh Sky First. Email này sẽ không còn nhận nội dung newsletter.':'Liên kết hủy đăng ký không hợp lệ hoặc đã được sử dụng.',ok);
  }
  if (action === 'people' && request.method==='GET') {
    const rows=await env.DB.prepare(`SELECT p.id,p.slug,p.name,p.title,p.role_group,p.bio,p.expertise,p.photo_media_id,p.links_json,p.seo_json,m.alt_text AS photo_alt,m.focus_x AS photo_focus_x,m.focus_y AS photo_focus_y FROM people p LEFT JOIN media m ON m.id=p.photo_media_id WHERE p.is_public=1 ORDER BY p.sort_order,p.name`).all();
    return json({ok:true,items:rows.results.map(x=>({...x,links:asJson(x.links_json,{}),seo:asJson(x.seo_json,{}),photo_url:x.photo_media_id?`/api/media/${x.photo_media_id}`:null}))});
  }
  if (action === 'person' && request.method==='GET') {
    const slug=cleanText(u.searchParams.get('slug'),140); const row=await env.DB.prepare(`SELECT p.*,m.alt_text AS photo_alt,m.focus_x AS photo_focus_x,m.focus_y AS photo_focus_y FROM people p LEFT JOIN media m ON m.id=p.photo_media_id WHERE p.slug=? AND p.is_public=1 LIMIT 1`).bind(slug).first(); assert(row,404,'Không tìm thấy hồ sơ.');
    return json({ok:true,item:{...row,links:asJson(row.links_json,{}),seo:asJson(row.seo_json,{}),photo_url:row.photo_media_id?`/api/media/${row.photo_media_id}`:null}});
  }
  if (action === 'forms' && request.method==='GET') {
    const rows=await env.DB.prepare(`SELECT id,slug,name,description,kind,status,fields_json,settings_json,cover_media_id,opens_at,closes_at,capacity FROM forms WHERE status='open' AND (opens_at IS NULL OR opens_at<=?) AND (closes_at IS NULL OR closes_at>?) ORDER BY updated_at DESC`).bind(now(),now()).all();
    return json({ok:true,items:rows.results.map(x=>({...x,fields:asJson(x.fields_json,[]),settings:asJson(x.settings_json,{}),cover_url:x.cover_media_id?`/api/media/${x.cover_media_id}`:null}))});
  }
  if (action === 'form' && request.method==='GET') {
    const slug=cleanText(u.searchParams.get('slug'),140); const row=await env.DB.prepare(`SELECT * FROM forms WHERE slug=? AND status='open' LIMIT 1`).bind(slug).first(); assert(row,404,'Biểu mẫu chưa mở hoặc không tồn tại.');
    const formSettings=sanitizeFormSettings(asJson(row.settings_json,{}));
    const isNotOpen=!!row.opens_at && new Date(row.opens_at)>new Date();
    const isExpired=!!row.closes_at && new Date(row.closes_at)<=new Date();
    return json({ok:true,item:{...row,is_not_open:isNotOpen,is_expired:isExpired,fields:asJson(row.fields_json,[]),settings:formSettings,cover_url:row.cover_media_id?`/api/media/${row.cover_media_id}`:null}});
  }
  if (action === 'submission-lookup' && request.method==='GET') {
    await rateLimit(env,request,'submission-lookup',30,3600);
    const code=cleanText(u.searchParams.get('code'),80).toUpperCase();
    assert(code.length>=8,400,'Vui lòng nhập mã hồ sơ hợp lệ.');
    const row=await env.DB.prepare(`SELECT s.code,s.status,s.created_at,s.updated_at,f.name AS form_name FROM form_submissions s JOIN forms f ON f.id=s.form_id WHERE UPPER(s.code)=? LIMIT 1`).bind(code).first();
    assert(row,404,'Không tìm thấy hồ sơ với mã này.');
    return json({ok:true,item:row});
  }
  if (action === 'form-upload' && request.method==='POST') {
    await cleanupExpiredFormUploads(env);
    await rateLimit(env,request,'form-upload',12,3600);
    const ct=request.headers.get('content-type')||''; assert(ct.includes('multipart/form-data'),415,'Upload phải dùng multipart/form-data.');
    const fd=await request.formData(), formId=Number(fd.get('form_id')), fieldId=cleanText(fd.get('field_id'),120), file=fd.get('file');
    const form=await env.DB.prepare(`SELECT id,status,opens_at,closes_at,fields_json FROM forms WHERE id=?`).bind(formId).first(); assert(form&&form.status==='open',404,'Biểu mẫu chưa mở hoặc không tồn tại.');
    const uploadField=sanitizeFields(asJson(form.fields_json,[])).find(x=>x.id===fieldId&&['file','signature'].includes(x.type)); assert(uploadField,400,'Trường upload không hợp lệ.');
    if(form.opens_at) assert(new Date(form.opens_at)<=new Date(),409,'Biểu mẫu chưa đến thời gian mở.');
    if(form.closes_at) assert(new Date(form.closes_at)>new Date(),409,'Biểu mẫu đã hết hạn.');
    const v=await validateUpload(file), token=randomToken(24), tokenHash=await sha256Hex(token), key=`form-uploads/${formId}/${crypto.randomUUID()}.${v.ext}`, createdAt=now(), expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
    await env.STORAGE.put(key,v.body,{httpMetadata:{contentType:v.mime},customMetadata:{originalName:file.name,purpose:'form-upload'}});
    let r;
    try {
      r=await env.DB.prepare(`INSERT INTO form_uploads(form_id,upload_token_hash,r2_key,filename,mime_type,size_bytes,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)`).bind(formId,tokenHash,key,cleanText(file.name,240),v.mime,v.size,createdAt,expiresAt).run();
    } catch (error) {
      try { await env.STORAGE.delete(key); } catch (cleanupError) { console.warn('FORM_UPLOAD_ORPHAN_CLEANUP_FAILED', String(cleanupError?.message||cleanupError).slice(0,160)); }
      throw error;
    }
    return json({ok:true,upload:{id:r.meta.last_row_id,upload_token:token,filename:cleanText(file.name,240),mime_type:v.mime,size_bytes:v.size,expires_at:expiresAt}},201);
  }
  if (action === 'form-submit' && request.method==='POST') {
    await cleanupExpiredFormUploads(env);
    await rateLimit(env,request,'form-submit',10,3600); const b=await readJson(request); const form=await env.DB.prepare(`SELECT * FROM forms WHERE id=? AND status='open'`).bind(Number(b.form_id)).first(); assert(form,404,'Biểu mẫu chưa mở hoặc không tồn tại.');
    const settings=sanitizeFormSettings(asJson(form.settings_json,{}));
    const fields=sanitizeFields(asJson(form.fields_json,[]));

    if(form.opens_at) assert(new Date(form.opens_at)<=new Date(),409,'Biểu mẫu chưa đến thời gian mở.');
    if(form.closes_at) assert(new Date(form.closes_at)>new Date(),409,settings.closed_message);
    const configuredCapacity = form.capacity===null||form.capacity===undefined||form.capacity===''?null:Number(form.capacity);
    assert(configuredCapacity===null||(Number.isSafeInteger(configuredCapacity)&&configuredCapacity>=0&&configuredCapacity<=1000000),500,'Cấu hình sức chứa của biểu mẫu không hợp lệ; vui lòng cập nhật trong Management Center.');
    const maxCapacity = configuredCapacity!==null&&configuredCapacity>0?configuredCapacity:null;
    if(maxCapacity!==null){const c=await env.DB.prepare(`SELECT COUNT(*) c FROM form_submissions WHERE form_id=?`).bind(form.id).first();assert(Number(c.c)<maxCapacity,409,'Biểu mẫu đã đủ số lượng.');}
    const answers=validateSubmissionAnswers(fields,b.answers||{});
    // Form Builder is the single source of truth: no hidden/hard-coded identity fields.
    // These three columns are only searchable metadata extracted from configured answers when present.
    const findAnswer=(preferredIds,type)=>{
      for(const id of preferredIds){const v=answers[id];if(typeof v==='string'&&v.trim())return v;}
      const f=fields.find(x=>x.type===type&&typeof answers[x.id]==='string'&&answers[x.id].trim());
      return f?answers[f.id]:'';
    };
    const name=cleanText(findAnswer(['full_name','name','ho_ten'],'text'),120);
    const email=cleanText(findAnswer(['email'],'email'),200).toLowerCase();
    const phone=cleanText(findAnswer(['phone','phone_zalo','sdt'],'phone'),40);
    if(settings.require_guardian_consent) assert(bool(b.guardian_consent),400,'Biểu mẫu này yêu cầu xác nhận đồng ý phù hợp đối với người chưa thành niên.');
    const claimedUploads=[];
    for(const f of fields.filter(x=>['file','signature'].includes(x.type))){
      const a=answers[f.id]; if(!a?.upload_token) continue;
      const th=await sha256Hex(a.upload_token);
      const up=await env.DB.prepare(`SELECT id FROM form_uploads WHERE form_id=? AND upload_token_hash=? AND claimed_submission_id IS NULL AND expires_at>?`).bind(form.id,th,now()).first();
      assert(up,400,`Tệp tại “${f.label}” không hợp lệ hoặc đã được sử dụng.`);
      claimedUploads.push(up.id); answers[f.id].upload_id=up.id; delete answers[f.id].upload_token;
    }
    const code=`XSF-${Date.now().toString(36).toUpperCase()}-${randomToken(3).slice(0,4).toUpperCase()}`,t=now();
    const capacityClause=maxCapacity===null?'1=1':'(SELECT COUNT(*) FROM form_submissions WHERE form_id=?) < ?';
    const uploadClause=claimedUploads.length?`(SELECT COUNT(*) FROM form_uploads WHERE id IN (${claimedUploads.map(()=>'?').join(',')}) AND form_id=? AND claimed_submission_id IS NULL AND expires_at>?)=?`:'1=1';
    const insertBindings=[form.id,code,name,email,phone,JSON.stringify(answers),t,t];
    if(maxCapacity!==null)insertBindings.push(form.id,maxCapacity);
    if(claimedUploads.length)insertBindings.push(...claimedUploads,form.id,t,claimedUploads.length);
    const statements=[env.DB.prepare(`INSERT INTO form_submissions(form_id,code,full_name,email,phone,answers_json,status,created_at,updated_at) SELECT ?,?,?,?,?,?,'new',?,? WHERE ${capacityClause} AND ${uploadClause}`).bind(...insertBindings)];
    for(const uploadId of claimedUploads)statements.push(env.DB.prepare(`UPDATE form_uploads SET claimed_submission_id=(SELECT id FROM form_submissions WHERE code=?),expires_at=NULL WHERE id=? AND form_id=? AND claimed_submission_id IS NULL AND EXISTS (SELECT 1 FROM form_submissions WHERE code=?)`).bind(code,uploadId,form.id,code));
    const results=await env.DB.batch(statements),r=results[0];
    assert(Number(r?.meta?.changes||0)===1,409,'Biểu mẫu vừa đủ số lượng hoặc một tệp đính kèm đã được sử dụng. Vui lòng tải lại và gửi lại hồ sơ.');
    const sid=r.meta.last_row_id;
    await env.DB.prepare(`INSERT INTO submission_events(submission_id,event_type,new_status,note,created_at) VALUES(?,'created','new','Hồ sơ được gửi từ website',?)`).bind(sid,t).run();
    let emailSent=false;
    if(settings.confirmation_email&&validEmail(email)){const m=await sendMail(env,{to:email,subject:`Xác nhận hồ sơ ${code} · Xanh Sky First`,html:`<p>Xin chào ${escapeHtml(name)},</p><p>Xanh Sky First đã nhận hồ sơ của bạn cho <b>${escapeHtml(form.name)}</b>.</p><p>Mã hồ sơ: <b>${code}</b></p><p>${escapeHtml(settings.confirmation_message)}</p>`}); emailSent=!!m.sent;}
    if(emailSent) await env.DB.prepare(`UPDATE submission_events SET email_sent=1 WHERE submission_id=? AND event_type='created'`).bind(sid).run();
    // Send only necessary metadata to CTT. The Xanh submission remains authoritative and is not rolled back if CTT is unavailable.
    const cttPayload={source:'xanh-sky-first',code,full_name:name,email,form_name:form.name,status:'Đã tiếp nhận',submitted_at:t,tracking_url:`${env.APP_URL||'https://xanh.skyfirst.io.vn'}/tra-cuu?code=${encodeURIComponent(code)}`};
    let cttSync={sent:false,reason:'not_attempted'};
    try{cttSync=await queueCttSubmission(env,cttPayload);}catch(err){console.error('CTT_OUTBOX_QUEUE_FAILED',String(err?.message||err));}
    return json({ok:true,code,message:settings.confirmation_message,title:settings.confirmation_title,ctt_sync:cttSync.sent?'sent':(cttSync.reason||'pending')},201);
  }
  throw new HttpError(404,'Không tìm thấy API công khai.');
}

async function handleMedia(env, request, idPart) {
  if (request.method!=='GET' && request.method!=='HEAD') throw new HttpError(405,'Method not allowed');
  const id=Number(idPart); assert(Number.isInteger(id)&&id>0,400,'Media ID không hợp lệ.');
  const row=await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(id).first(); assert(row,404,'Không tìm thấy media.');
  if(row.visibility==='private'){
    const viewer=await currentUser(env,request);
    assert(viewer,401,'Cần đăng nhập để truy cập tệp riêng tư.');
    assert(ADMIN_ROLES.has(viewer.role)||(canFeature(viewer,'media')&&Number(row.uploaded_by)===Number(viewer.id)),403,'Bạn không có quyền truy cập tệp riêng tư này.');
  }
  const obj=await env.STORAGE.get(row.r2_key); assert(obj,404,'File media không còn tồn tại trong storage.');
  const headers=new Headers();
  headers.set('Content-Type',row.mime_type);
  headers.set('Cache-Control',row.visibility==='private'?'private, no-store':'public, max-age=86400');
  if(obj.httpEtag) headers.set('ETag',obj.httpEtag);
  const inlineTypes=new Set(['image/jpeg','image/png','image/webp','image/avif','image/gif','image/svg+xml','video/mp4','video/webm']);
  headers.set('Content-Disposition',`${inlineTypes.has(row.mime_type)?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','no-referrer');
  if(row.mime_type==='image/svg+xml') headers.set('Content-Security-Policy',"default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; sandbox");
  return new Response(request.method==='HEAD'?null:obj.body,{headers});
}

function canFeature(user, feature, write=false) {
  if (user.role==='root_admin') return true;
  if (user.role==='administrator') return feature!=='users-root';
  if (user.role==='viewer') return !write && ['dashboard','audit'].includes(feature);
  if (user.role==='content_editor') return ['dashboard','pages','content-editor','people','media'].includes(feature);
  if (user.role==='project_manager') return ['dashboard','content-project','media','impact'].includes(feature);
  if (user.role==='volunteer_coordinator') return ['dashboard','forms','submissions','applications','media'].includes(feature);
  return false;
}
function contentFeatureFor(user,type){
  if(user.role==='root_admin'||user.role==='administrator') return true;
  if(user.role==='content_editor') return ['article','resource'].includes(type);
  if(user.role==='project_manager') return ['project','activity','opportunity','initiative'].includes(type);
  return false;
}
function requireFeature(user, feature, write=false){assert(canFeature(user,feature,write),403,'Bạn không có quyền thực hiện thao tác này.');}

async function saveContentRevision(env, old, userId) {
  const snapshot={...contentOut(old)};
  await env.DB.prepare(`INSERT INTO content_revisions(content_id,snapshot_json,created_by,created_at) VALUES(?,?,?,?)`).bind(old.id,JSON.stringify(snapshot),userId,now()).run();
}


function sanitizeNavigation(input) {
  const x=input&&typeof input==='object'?input:{};
  const href=(v)=>{const h=cleanText(v,500);if(!h)return '/';const internal=h.startsWith('/')&&!h.startsWith('//');assert(internal||/^https?:\/\//i.test(h)||/^mailto:/i.test(h),400,'Liên kết menu chỉ được dùng đường dẫn nội bộ, HTTP(S) hoặc mailto; không dùng URL bắt đầu bằng // .');return h;};
  const asset=(v)=>{const h=cleanText(v||'/assets/xanh-sky-first-logo.png',500);assert((h.startsWith('/')&&!h.startsWith('//'))||/^https?:\/\//i.test(h),400,'Logo phải là đường dẫn nội bộ hoặc URL HTTP(S) hợp lệ.');return h;};
  const cleanItem=(it,i)=>({
    id:safeSlug(it?.id||it?.label||`menu-${i+1}`)||`menu-${i+1}`,
    label:cleanText(it?.label||`Mục ${i+1}`,80),href:href(it?.href),visible:it?.visible!==false,
    open_new_tab:bool(it?.open_new_tab),icon:cleanText(it?.icon||'',24),
    children:(Array.isArray(it?.children)?it.children:[]).slice(0,20).map((ch,j)=>({id:safeSlug(ch?.id||ch?.label||`item-${j+1}`)||`item-${j+1}`,label:cleanText(ch?.label||`Mục con ${j+1}`,80),href:href(ch?.href),visible:ch?.visible!==false,open_new_tab:bool(ch?.open_new_tab),icon:cleanText(ch?.icon||'',24)}))
  });
  const items=(Array.isArray(x.items)?x.items:[]).slice(0,20).map(cleanItem).filter(it=>it.label);
  const top=x.topbar&&typeof x.topbar==='object'?x.topbar:{};
  const footerCols=(Array.isArray(x.footer_columns)?x.footer_columns:[]).slice(0,5).map((c,i)=>({title:cleanText(c?.title||`Cột ${i+1}`,100),items:(Array.isArray(c?.items)?c.items:[]).slice(0,15).map((it,j)=>({label:cleanText(it?.label||`Liên kết ${j+1}`,100),href:href(it?.href),open_new_tab:bool(it?.open_new_tab)}))}));
  assert(items.length>0,400,'Menu phải có ít nhất một mục.');
  return {version:1,topbar:{enabled:top.enabled!==false,tagline:cleanText(top.tagline,180),email:cleanText(top.email,200),hours:cleanText(top.hours,80),phone:cleanText(top.phone,80),address:cleanText(top.address,200)},brand_name:cleanText(x.brand_name||'XANH SKY FIRST',100),brand_description:cleanText(x.brand_description||'Môi trường · Cộng đồng · Công nghệ xanh',180),logo_url:asset(x.logo_url),cta_label:cleanText(x.cta_label||'Cùng hành động',80),cta_href:href(x.cta_href||'/tham-gia'),search_enabled:bool(x.search_enabled),items,footer_columns:footerCols};
}

async function handleAdmin(env, request, action, p) {
  requireSameOrigin(request);
  const user=await requireUser(env,request); const u=new URL(request.url), write=request.method!=='GET';
  assert(USER_ROLES.has(user.role),403,'Vai trò tài khoản không hợp lệ.');

  if(action==='navigation') {
    assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên mới được quản lý menu đầu trang và chân trang.');
    if(request.method==='GET') return json({ok:true,item:await settingsGet(env,'navigation')});
    if(request.method==='PUT') { const b=await readJson(request),clean=sanitizeNavigation(b.item||b.navigation||b); await settingsSet(env,'navigation',clean); await audit(env,user.id,'navigation.publish','navigation','header-footer',{roots:clean.items.length},request); return json({ok:true,item:clean}); }
  }
  if(action==='impact-display') {
    assert(ADMIN_ROLES.has(user.role),403,'Chỉ Admin Tổng / Administrator được cấu hình các thẻ Dấu ấn xanh.');
    if(request.method==='GET'){
      const rows=await env.DB.prepare(`SELECT * FROM impact_counter_config WHERE metric_key IN (${IMPACT_DISPLAY_KEYS.map(()=>'?').join(',')}) ORDER BY sort_order,metric_key`).bind(...IMPACT_DISPLAY_KEYS).all();
      return json({ok:true,items:completeImpactConfigRows(rows.results)});
    }
    if(request.method==='PUT'){
      const b=await readJson(request),items=Array.isArray(b.items)?b.items:[];
      const submitted=items.map(x=>String(x.metric_key));
      assert(items.length===7&&new Set(submitted).size===7&&IMPACT_DISPLAY_KEYS.every(k=>submitted.includes(k)),400,'Cấu hình phải bao gồm đủ 7 chỉ số đã chốt, không được trùng.');
      const orders=items.map(x=>Number(x.sort_order));
      assert(orders.every(n=>Number.isInteger(n)&&n>=1&&n<=7)&&new Set(orders).size===7,400,'Thứ tự hiển thị phải là các số từ 1 đến 7, không trùng nhau.');
      const saved=[];
      for(const x of items){
        const key=String(x.metric_key),label=cleanText(x.label,100),description=cleanText(x.description,300),unit=cleanText(x.unit,30),icon=String(x.icon||'sprout'),source=String(x.data_source||'d1'),rawManual=x.manual_value;
        const manualValue=rawManual===null||rawManual===undefined||rawManual===''?null:Number(rawManual);
        const decimalPlaces=Math.max(0,Math.min(3,Math.trunc(Number(x.decimal_places||0))));
        const duration=Math.max(300,Math.min(12000,Number(x.duration_ms||1800))),delay=Math.max(0,Math.min(5000,Number(x.delay_ms||0))),order=Number(x.sort_order),enabled=bool(x.enabled)?1:0;
        assert(label.length>=2,400,'Tên chỉ số cần ít nhất 2 ký tự.');
        assert(IMPACT_ICON_KEYS.has(icon),400,'Biểu tượng không được hỗ trợ.');
        assert(['d1','manual'].includes(source),400,'Nguồn dữ liệu không hợp lệ.');
        assert(manualValue===null||(Number.isFinite(manualValue)&&manualValue>=0&&manualValue<=1000000000000),400,'Giá trị thủ công phải là số không âm hợp lệ.');
        // The animation always begins at 0. Values and units are stored separately.
        await env.DB.prepare(`INSERT INTO impact_counter_config(metric_key,label,description,start_value,duration_ms,delay_ms,hold_ms,enabled,sort_order,updated_at,unit,icon,data_source,manual_value,decimal_places)
          VALUES(?,?,?,?,?,?,0,?,?,?,?,?,?,?,?)
          ON CONFLICT(metric_key) DO UPDATE SET label=excluded.label,description=excluded.description,start_value=0,duration_ms=excluded.duration_ms,delay_ms=excluded.delay_ms,hold_ms=0,enabled=excluded.enabled,sort_order=excluded.sort_order,updated_at=excluded.updated_at,unit=excluded.unit,icon=excluded.icon,data_source=excluded.data_source,manual_value=excluded.manual_value,decimal_places=excluded.decimal_places`)
          .bind(key,label,description,0,duration,delay,enabled,order,now(),unit,icon,source,manualValue,decimalPlaces).run();
        saved.push(key);
      }
      await audit(env,user.id,'impact.counters.update','impact','counter-config',{metrics:saved},request);
      const rows=await env.DB.prepare(`SELECT * FROM impact_counter_config WHERE metric_key IN (${IMPACT_DISPLAY_KEYS.map(()=>'?').join(',')}) ORDER BY sort_order,metric_key`).bind(...IMPACT_DISPLAY_KEYS).all();
      return json({ok:true,items:rows.results});
    }
  }

  if (action==='dashboard' && request.method==='GET') {
    requireFeature(user,'dashboard');
    const [apps,forms,drafts,media,impact,auditRows]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS c FROM applications WHERE status IN ('new','reviewing','needs_info')`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS c FROM form_submissions WHERE status IN ('new','reviewing','needs_info')`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS c FROM content_items WHERE status='draft'`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS c FROM media`).first(),
      env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN verified=1 THEN confirmed_participants ELSE 0 END),0) AS participants, COALESCE(SUM(CASE WHEN verified=1 THEN volunteer_hours ELSE 0 END),0) AS hours FROM impact_records`).first(),
      ADMIN_ROLES.has(user.role)
        ? env.DB.prepare(`SELECT a.id,a.action,a.object_type,a.object_id,a.created_at,u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 12`).all()
        : Promise.resolve({results:[]}),
    ]);
    return json({ok:true,stats:{pending_applications:Number(apps.c||0),pending_submissions:Number(forms.c||0),drafts:Number(drafts.c||0),media:Number(media.c||0),participants:Number(impact.participants||0),volunteer_hours:Number(impact.hours||0)},recent:auditRows.results});
  }

  if (action==='pages') {
    requireFeature(user,'pages',write);
    if(request.method==='GET') { const rows=await env.DB.prepare(`SELECT * FROM pages ORDER BY updated_at DESC`).all(); return json({ok:true,items:rows.results.map(pageOut)}); }
    if(request.method==='POST') { const b=await readJson(request), title=cleanText(b.title,200), slug=safeSlug(b.slug||title); assert(title&&slug,400,'Tiêu đề/slug không hợp lệ.'); const t=now(); const status=b.status==='published'?'published':'draft'; const r=await env.DB.prepare(`INSERT INTO pages(slug,title,status,blocks_json,seo_json,published_at,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(slug,title,status,JSON.stringify(Array.isArray(b.blocks)?b.blocks:[]),JSON.stringify(b.seo||{}),status==='published'?t:null,user.id,user.id,t,t).run(); await audit(env,user.id,'page.create','page',r.meta.last_row_id,{slug},request); return json({ok:true,id:r.meta.last_row_id},201); }
  }
  if (action==='page' && p[2]) {
    requireFeature(user,'pages',write); const id=Number(p[2]); assert(id>0,400,'Page ID không hợp lệ.');
    if(request.method==='GET'){const row=await env.DB.prepare(`SELECT * FROM pages WHERE id=?`).bind(id).first();assert(row,404,'Không tìm thấy trang.');const revs=await env.DB.prepare(`SELECT id,created_by,created_at FROM page_revisions WHERE page_id=? ORDER BY created_at DESC LIMIT 30`).bind(id).all();return json({ok:true,item:pageOut(row),revisions:revs.results});}
    if(request.method==='PUT'){const b=await readJson(request); const old=await env.DB.prepare(`SELECT * FROM pages WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy trang.');
      await env.DB.prepare(`INSERT INTO page_revisions(page_id,title,blocks_json,seo_json,created_by,created_at) VALUES(?,?,?,?,?,?)`).bind(id,old.title,old.blocks_json,old.seo_json,user.id,now()).run();
      const title=cleanText(b.title??old.title,200), status=['draft','published','archived'].includes(b.status)?b.status:old.status, pub=status==='published'?(old.published_at||now()):old.published_at;
      await env.DB.prepare(`UPDATE pages SET title=?,status=?,blocks_json=?,seo_json=?,published_at=?,updated_by=?,updated_at=? WHERE id=?`).bind(title,status,JSON.stringify(b.blocks??asJson(old.blocks_json,[])),JSON.stringify(b.seo??asJson(old.seo_json,{})),pub,user.id,now(),id).run();
      await audit(env,user.id,'page.update','page',id,{status},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xóa trang.');await env.DB.prepare(`DELETE FROM pages WHERE id=? AND slug<>'home'`).bind(id).run();await audit(env,user.id,'page.delete','page',id,{},request);return json({ok:true});}
  }
  if(action==='page-revision' && p[2] && p[3] && request.method==='POST'){
    requireFeature(user,'pages',true); const pageId=Number(p[2]),revId=Number(p[3]);
    const rev=await env.DB.prepare(`SELECT * FROM page_revisions WHERE id=? AND page_id=?`).bind(revId,pageId).first(); assert(rev,404,'Không tìm thấy revision.');
    const cur=await env.DB.prepare(`SELECT * FROM pages WHERE id=?`).bind(pageId).first(); assert(cur,404,'Không tìm thấy trang.');
    await env.DB.prepare(`INSERT INTO page_revisions(page_id,title,blocks_json,seo_json,created_by,created_at) VALUES(?,?,?,?,?,?)`).bind(pageId,cur.title,cur.blocks_json,cur.seo_json,user.id,now()).run();
    await env.DB.prepare(`UPDATE pages SET title=?,blocks_json=?,seo_json=?,updated_by=?,updated_at=? WHERE id=?`).bind(rev.title,rev.blocks_json,rev.seo_json,user.id,now(),pageId).run();
    await audit(env,user.id,'page.restore_revision','page',pageId,{revision_id:revId},request); return json({ok:true});
  }

  if (action==='content') {
    if(request.method==='GET'){
      const type=cleanText(u.searchParams.get('type'),30); if(type){assert(CONTENT_TYPES.has(type),400,'Loại nội dung không hợp lệ.');assert(contentFeatureFor(user,type),403,'Bạn không có quyền với loại nội dung này.');}
      else assert(user.role==='root_admin'||user.role==='administrator',403,'Bạn phải chọn loại nội dung được phân quyền.');
      let q=`SELECT * FROM content_items`, binds=[]; if(type){q+=` WHERE type=?`;binds=[type];} q+=` ORDER BY updated_at DESC LIMIT 300`;
      const rows=await env.DB.prepare(q).bind(...binds).all(); return json({ok:true,items:rows.results.map(contentOut)});
    }
    if(request.method==='POST'){
      const b=await readJson(request),type=cleanText(b.type,30);assert(CONTENT_TYPES.has(type),400,'Loại nội dung không hợp lệ.');assert(contentFeatureFor(user,type),403,'Bạn không có quyền với loại nội dung này.');
      const title=cleanText(b.title,220),slug=safeSlug(b.slug||title);assert(title&&slug,400,'Tiêu đề/slug không hợp lệ.');
      const t=now(),status=['draft','published','open','closed','completed','reviewing'].includes(b.status)?b.status:'draft', cover=await assertMediaImage(env,b.cover_media_id);
      const meta=b.metadata&&typeof b.metadata==='object'?b.metadata:{}; if(b.scheduled_at) meta.scheduled_at=String(b.scheduled_at);
      const r=await env.DB.prepare(`INSERT INTO content_items(type,slug,title,excerpt,body_json,cover_media_id,status,category,location,starts_at,ends_at,capacity,metadata_json,published_at,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(type,slug,title,cleanText(b.excerpt,1000),JSON.stringify(Array.isArray(b.body)?b.body:[]),cover,status,cleanText(b.category,100),cleanText(b.location,160),b.starts_at||null,b.ends_at||null,b.capacity?Number(b.capacity):null,JSON.stringify(meta),PUBLIC_STATUSES.has(status)?t:null,user.id,user.id,t,t).run();
      await audit(env,user.id,'content.create',type,r.meta.last_row_id,{slug,status},request);return json({ok:true,id:r.meta.last_row_id},201);
    }
  }
  if(action==='content-item' && p[2]){
    const id=Number(p[2]);assert(id>0,400,'ID không hợp lệ.'); const old=await env.DB.prepare(`SELECT * FROM content_items WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy nội dung.');assert(contentFeatureFor(user,old.type),403,'Bạn không có quyền với loại nội dung này.');
    if(request.method==='GET'){const revs=await env.DB.prepare(`SELECT id,created_by,created_at FROM content_revisions WHERE content_id=? ORDER BY created_at DESC LIMIT 30`).bind(id).all();return json({ok:true,item:contentOut(old),revisions:revs.results});}
    if(request.method==='PUT'){
      const b=await readJson(request),status=['draft','published','open','closed','completed','reviewing','archived'].includes(b.status)?b.status:old.status,title=cleanText(b.title??old.title,220),slug=safeSlug(b.slug||old.slug); const pub=PUBLIC_STATUSES.has(status)?(old.published_at||now()):old.published_at;
      await saveContentRevision(env,old,user.id); let cover=old.cover_media_id; if(Object.prototype.hasOwnProperty.call(b,'cover_media_id')) cover=await assertMediaImage(env,b.cover_media_id);
      const meta=b.metadata??asJson(old.metadata_json,{}); if(b.scheduled_at) meta.scheduled_at=String(b.scheduled_at); else if(b.scheduled_at===null && meta) delete meta.scheduled_at;
      await env.DB.prepare(`UPDATE content_items SET slug=?,title=?,excerpt=?,body_json=?,cover_media_id=?,status=?,category=?,location=?,starts_at=?,ends_at=?,capacity=?,metadata_json=?,published_at=?,updated_by=?,updated_at=? WHERE id=?`).bind(slug,title,cleanText(b.excerpt??old.excerpt,1000),JSON.stringify(b.body??asJson(old.body_json,[])),cover,status,cleanText(b.category??old.category,100),cleanText(b.location??old.location,160),b.starts_at??old.starts_at,b.ends_at??old.ends_at,b.capacity===null?null:(b.capacity??old.capacity),JSON.stringify(meta||{}),pub,user.id,now(),id).run();
      await audit(env,user.id,'content.update',old.type,id,{status},request);return json({ok:true});
    }
    if(request.method==='DELETE'){assert(user.role==='root_admin'||user.role==='administrator'||(user.role==='content_editor'&&['article','resource'].includes(old.type)),403,'Bạn không có quyền xóa nội dung.');await env.DB.prepare(`DELETE FROM content_items WHERE id=?`).bind(id).run();await audit(env,user.id,'content.delete',old.type,id,{},request);return json({ok:true});}
  }
  if(action==='content-revision'&&p[2]&&p[3]&&request.method==='POST'){
    const id=Number(p[2]),revId=Number(p[3]),old=await env.DB.prepare(`SELECT * FROM content_items WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy nội dung.');assert(contentFeatureFor(user,old.type),403,'Bạn không có quyền.');
    const rev=await env.DB.prepare(`SELECT * FROM content_revisions WHERE id=? AND content_id=?`).bind(revId,id).first();assert(rev,404,'Không tìm thấy revision.');await saveContentRevision(env,old,user.id);const s=asJson(rev.snapshot_json,null);assert(s,400,'Revision hỏng.');
    await env.DB.prepare(`UPDATE content_items SET slug=?,title=?,excerpt=?,body_json=?,cover_media_id=?,status=?,category=?,location=?,starts_at=?,ends_at=?,capacity=?,metadata_json=?,published_at=?,updated_by=?,updated_at=? WHERE id=?`).bind(s.slug,s.title,s.excerpt,JSON.stringify(s.body||[]),s.cover_media_id||null,s.status,s.category||'',s.location||'',s.starts_at||null,s.ends_at||null,s.capacity||null,JSON.stringify(s.metadata||{}),s.published_at||null,user.id,now(),id).run();
    await audit(env,user.id,'content.restore_revision',old.type,id,{revision_id:revId},request);return json({ok:true});
  }

  if(action==='media'){
    requireFeature(user,'media',write);
    if(request.method==='GET'){
      const q=cleanText(u.searchParams.get('q'),120),conditions=[],binds=[];
      if(!ADMIN_ROLES.has(user.role)){conditions.push(`(visibility='public' OR uploaded_by=?)`);binds.push(user.id);}
      if(q){conditions.push(`(filename LIKE ? OR alt_text LIKE ? OR caption LIKE ?)`);binds.push(`%${q}%`,`%${q}%`,`%${q}%`);}
      let st=`SELECT * FROM media`;if(conditions.length)st+=` WHERE ${conditions.join(' AND ')}`;st+=` ORDER BY created_at DESC LIMIT 500`;
      const rows=await env.DB.prepare(st).bind(...binds).all();return json({ok:true,items:rows.results.map(mediaOut)});
    }
    if(request.method==='POST'){
      const ct=request.headers.get('content-type')||'';assert(ct.includes('multipart/form-data'),415,'Upload phải dùng multipart/form-data.');const fd=await request.formData(),file=fd.get('file');const v=await validateUpload(file);const id=crypto.randomUUID(),key=mediaKey(id,v.ext);
      const requestedVisibility=String(fd.get('visibility')||'public');assert(['public','private'].includes(requestedVisibility),400,'Quyền truy cập tệp không hợp lệ.');assert(requestedVisibility!=='private'||ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên mới có thể tạo tệp riêng tư.');const visibility=requestedVisibility;
      await env.STORAGE.put(key,v.body,{httpMetadata:{contentType:v.mime},customMetadata:{originalName:file.name,purpose:'media-library'}});
      const width=Math.max(0,Math.min(30000,Number(fd.get('width')||0)))||null,height=Math.max(0,Math.min(30000,Number(fd.get('height')||0)))||null,t=now();
      let r;
      try {
        r=await env.DB.prepare(`INSERT INTO media(r2_key,filename,mime_type,size_bytes,width,height,alt_text,caption,credit,focus_x,focus_y,uploaded_by,visibility,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(key,cleanText(file.name,240),v.mime,v.size,width,height,cleanText(fd.get('alt_text'),500),cleanText(fd.get('caption'),1000),cleanText(fd.get('credit'),500),0.5,0.5,user.id,visibility,t,t).run();
      } catch (error) {
        try { await env.STORAGE.delete(key); } catch (cleanupError) { console.warn('MEDIA_ORPHAN_CLEANUP_FAILED', String(cleanupError?.message||cleanupError).slice(0,160)); }
        throw error;
      }
      await audit(env,user.id,'media.upload','media',r.meta.last_row_id,{mime:v.mime,size:v.size,visibility},request);return json({ok:true,item:mediaOut(await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(r.meta.last_row_id).first())},201);
    }
  }
  if(action==='media-item' && p[2]){
    requireFeature(user,'media',write); const id=Number(p[2]);const m=await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(id).first();assert(m,404,'Không tìm thấy media.');
    if(m.visibility==='private')assert(ADMIN_ROLES.has(user.role)||Number(m.uploaded_by)===Number(user.id),403,'Bạn không có quyền truy cập metadata của tệp riêng tư này.');
    if(request.method==='GET')return json({ok:true,item:mediaOut(m)});
    if(request.method==='PUT'){
      const b=await readJson(request);let visibility=m.visibility==='private'?'private':'public';
      if(Object.prototype.hasOwnProperty.call(b,'visibility')){
        assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được thay đổi quyền truy cập media.');
        assert(['public','private'].includes(b.visibility),400,'Quyền truy cập tệp không hợp lệ.');
        assert(!(visibility==='public'&&b.visibility==='private'),409,'Tệp đã công khai không thể chuyển ngược sang riêng tư vì URL có thể đã được lưu hoặc cache. Hãy tải lên bản mới ở chế độ riêng tư.');
        visibility=b.visibility;
      }
      await env.DB.prepare(`UPDATE media SET alt_text=?,caption=?,credit=?,focus_x=?,focus_y=?,visibility=?,updated_at=? WHERE id=?`).bind(cleanText(b.alt_text??m.alt_text,500),cleanText(b.caption??m.caption,1000),cleanText(b.credit??m.credit,500),Math.min(1,Math.max(0,Number(b.focus_x??m.focus_x))),Math.min(1,Math.max(0,Number(b.focus_y??m.focus_y))),visibility,now(),id).run();
      await audit(env,user.id,'media.update','media',id,{visibility},request);return json({ok:true,visibility});
    }
    if(request.method==='DELETE'){assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xóa file media.');const refs=await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM people WHERE photo_media_id=?) + (SELECT COUNT(*) FROM content_items WHERE cover_media_id=?) + (SELECT COUNT(*) FROM forms WHERE cover_media_id=?) AS c`).bind(id,id,id).first();assert(Number(refs.c||0)===0,409,'File đang được nội dung khác sử dụng. Hãy gỡ liên kết trước khi xóa.');await env.STORAGE.delete(m.r2_key);await env.DB.prepare(`DELETE FROM media WHERE id=?`).bind(id).run();await audit(env,user.id,'media.delete','media',id,{filename:m.filename},request);return json({ok:true});}
  }

  if(action==='settings'){
    requireFeature(user,'pages',write);
    if(request.method==='GET'){const rows=await settingsRows(env);return json({ok:true,groups:Object.fromEntries(rows.results.map(x=>[x.key,asJson(x.value_json,{})]))});}
    if(request.method==='PUT'){assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được thay đổi cài đặt.');const b=await readJson(request),key=cleanText(b.key||'general',50);assert(['general','footer','media','impact','security','cms'].includes(key),400,'Nhóm cài đặt không hợp lệ.');const current=await settingsGet(env,key),next={...current,...(b.value||{})};if(key==='security') next.pbkdf2_iterations=PBKDF2_ITERATIONS;await settingsSet(env,key,next);await audit(env,user.id,'settings.update','system',key,{keys:Object.keys(b.value||{})},request);return json({ok:true,key,value:next});}
  }

  if(action==='applications'){
    requireFeature(user,'applications',write);
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT * FROM applications ORDER BY created_at DESC LIMIT 500`).all();return json({ok:true,items:rows.results.map(x=>({...x,payload:asJson(x.payload_json,{})}))});}
  }
  if(action==='application' && p[2] && request.method==='PUT'){
    requireFeature(user,'applications',true);const id=Number(p[2]),b=await readJson(request),status=SUBMISSION_STATUSES.has(b.status)?b.status:null;assert(status,400,'Trạng thái không hợp lệ.');await env.DB.prepare(`UPDATE applications SET status=?,internal_notes=?,assignee_id=?,updated_at=? WHERE id=?`).bind(status,cleanText(b.internal_notes,5000),b.assignee_id||user.id,now(),id).run();await audit(env,user.id,'application.update','application',id,{status},request);return json({ok:true});
  }

  if(action==='impact'){
    requireFeature(user,'impact',write);
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT i.*,c.title AS activity_title FROM impact_records i LEFT JOIN content_items c ON c.id=i.activity_id ORDER BY i.updated_at DESC`).all();const acts=await env.DB.prepare(`SELECT id,title FROM content_items WHERE type='activity' ORDER BY updated_at DESC LIMIT 300`).all();return json({ok:true,items:rows.results,activities:acts.results});}
    if(request.method==='POST'){
      const b=await readJson(request),activityId=Number(b.activity_id);
      assert(Number.isSafeInteger(activityId)&&activityId>0,400,'Activity ID không hợp lệ.');
      const activity=await env.DB.prepare(`SELECT id FROM content_items WHERE id=? AND type='activity'`).bind(activityId).first();
      assert(activity,400,'Bản ghi Impact phải liên kết với một nội dung thuộc loại Hoạt động.');
      const participants=Number(b.confirmed_participants||0),hours=Number(b.volunteer_hours||0),waste=Number(b.waste_tons||0),community=Number(b.community_reached||0),verified=bool(b.verified),notes=cleanText(b.notes,3000);
      assert([participants,hours,waste,community].every(Number.isFinite),400,'Các chỉ số Impact phải là số hợp lệ.');
      assert(participants>=0&&participants<=100000000&&hours>=0&&hours<=100000000&&waste>=0&&waste<=1000000&&community>=0&&community<=100000000,400,'Một hoặc nhiều chỉ số Impact nằm ngoài giới hạn cho phép.');
      const locality=cleanText(b.locality,160),completed=bool(b.completed)?1:0;
      const existing=await env.DB.prepare(`SELECT * FROM impact_records WHERE activity_id=?`).bind(activityId).first();
      if(verified){
        assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên mới được xác minh số liệu tác động.');
        assert(existing && existing.recorded_by!==null && existing.recorded_by!==undefined && Number(existing.recorded_by)!==Number(user.id),409,'Cần lưu lại số liệu để ghi nhận người nhập, sau đó một tài khoản quản trị khác xác minh độc lập.');
        assert(Number(existing.confirmed_participants)===participants&&Number(existing.volunteer_hours)===hours&&Number(existing.waste_tons)===waste&&Number(existing.community_reached)===community&&Number(existing.completed)===completed&&String(existing.locality||'')===locality,409,'Không thể thay đổi số liệu trong cùng thao tác xác minh. Lưu thay đổi ở trạng thái chưa xác minh trước, sau đó yêu cầu một quản trị viên khác xác minh.');
        assert(notes.length>=10,400,'Muốn xác minh Impact, hãy ghi ít nhất 10 ký tự về căn cứ xác minh.');
      }
      const t=now();
      await env.DB.prepare(`INSERT INTO impact_records(activity_id,locality,confirmed_participants,volunteer_hours,waste_tons,community_reached,completed,verified,notes,verified_by,verified_at,recorded_by,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(activity_id) DO UPDATE SET locality=excluded.locality,confirmed_participants=excluded.confirmed_participants,volunteer_hours=excluded.volunteer_hours,waste_tons=excluded.waste_tons,community_reached=excluded.community_reached,completed=excluded.completed,verified=excluded.verified,notes=excluded.notes,verified_by=excluded.verified_by,verified_at=excluded.verified_at,recorded_by=CASE WHEN excluded.verified=0 THEN excluded.recorded_by ELSE impact_records.recorded_by END,updated_at=excluded.updated_at`)
        .bind(activityId,locality,participants,hours,waste,community,completed,verified?1:0,notes,verified?user.id:null,verified?t:null,user.id,t,t).run();
      await audit(env,user.id,'impact.upsert','activity',activityId,{verified,waste_tons:waste,community_reached:community},request);
      return json({ok:true});
    }
  }

  if(action==='audit' && request.method==='GET'){
    requireFeature(user,'audit');
    const rows = user.role==='viewer'
      ? await env.DB.prepare(`SELECT a.id,a.action,a.object_type,a.object_id,a.created_at,u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 500`).all()
      : await env.DB.prepare(`SELECT a.*,u.name AS user_name,u.email AS user_email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 500`).all();
    return json({ok:true,items:rows.results.map(x=>({...x,metadata:asJson(x.metadata_json,{}),...(user.role==='viewer'?{metadata_json:undefined,ip_address:undefined,user_email:undefined}: {})}))});
  }

  if(action==='users'){
    assert(user.role==='root_admin',403,'Chỉ Root Admin được quản lý tài khoản và phân quyền.');
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT id,name,email,role,status,created_at,updated_at,last_login_at FROM users ORDER BY created_at DESC`).all();return json({ok:true,items:rows.results});}
    if(request.method==='POST'){const b=await readJson(request),name=cleanText(b.name,120),email=cleanText(b.email,200).toLowerCase(),role=USER_ROLES.has(b.role)&&b.role!=='root_admin'?b.role:'viewer';assert(name.length>=2&&validEmail(email),400,'Thông tin người dùng không hợp lệ.');assert(String(b.password||'').length>=10,400,'Mật khẩu phải có ít nhất 10 ký tự.');const ph=await hashPassword(String(b.password||'')),t=now();const r=await env.DB.prepare(`INSERT INTO users(name,email,password_hash,role,status,created_at,updated_at) VALUES(?,?,?,?, 'active',?,?)`).bind(name,email,ph,role,t,t).run();await audit(env,user.id,'user.create','user',r.meta.last_row_id,{role,pbkdf2_iterations:PBKDF2_ITERATIONS},request);return json({ok:true,id:r.meta.last_row_id},201);}
  }
  if(action==='user'&&p[2]&&request.method==='PUT'){
    assert(user.role==='root_admin',403,'Chỉ Root Admin được quản lý tài khoản và phân quyền.');const id=Number(p[2]),old=await env.DB.prepare(`SELECT * FROM users WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy tài khoản.');assert(old.role!=='root_admin'||old.id===user.id,403,'Không thể thay đổi Root Admin khác qua API này.');const b=await readJson(request),role=old.role==='root_admin'?'root_admin':(USER_ROLES.has(b.role)&&b.role!=='root_admin'?b.role:old.role),status=['active','disabled'].includes(b.status)?b.status:old.status;await env.DB.prepare(`UPDATE users SET name=?,role=?,status=?,updated_at=? WHERE id=?`).bind(cleanText(b.name||old.name,120),role,status,now(),id).run();if(status==='disabled')await env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(id).run();await audit(env,user.id,'user.update','user',id,{role,status},request);return json({ok:true});
  }

  if(action==='people'){
    requireFeature(user,'people',write);
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT p.*,m.alt_text AS photo_alt,m.filename AS photo_filename,m.focus_x AS photo_focus_x,m.focus_y AS photo_focus_y FROM people p LEFT JOIN media m ON m.id=p.photo_media_id ORDER BY p.sort_order,p.name`).all();return json({ok:true,items:rows.results.map(x=>({...x,links:asJson(x.links_json,{}),seo:asJson(x.seo_json,{}),photo_url:x.photo_media_id?`/api/media/${x.photo_media_id}`:null}))});}
    if(request.method==='POST'){const b=await readJson(request),name=cleanText(b.name,160),slug=safeSlug(b.slug||name),t=now();assert(name&&slug,400,'Tên/slug không hợp lệ.');const photo=await assertMediaImage(env,b.photo_media_id);const r=await env.DB.prepare(`INSERT INTO people(slug,name,title,role_group,bio,expertise,photo_media_id,links_json,seo_json,sort_order,is_public,allow_index,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(slug,name,cleanText(b.title,200),cleanText(b.role_group||'coordination',80),cleanText(b.bio,12000),cleanText(b.expertise,1000),photo,JSON.stringify(b.links||{}),JSON.stringify(b.seo||{}),Number(b.sort_order||0),bool(b.is_public)?1:0,bool(b.allow_index)?1:0,user.id,user.id,t,t).run();await audit(env,user.id,'person.create','person',r.meta.last_row_id,{slug,photo_media_id:photo},request);return json({ok:true,id:r.meta.last_row_id},201);}
  }
  if(action==='person'&&p[2]){
    requireFeature(user,'people',write);const id=Number(p[2]),old=await env.DB.prepare(`SELECT * FROM people WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy hồ sơ.');
    if(request.method==='GET')return json({ok:true,item:{...old,links:asJson(old.links_json,{}),seo:asJson(old.seo_json,{}),photo_url:old.photo_media_id?`/api/media/${old.photo_media_id}`:null}});
    if(request.method==='PUT'){const b=await readJson(request);let photo=old.photo_media_id;if(Object.prototype.hasOwnProperty.call(b,'photo_media_id'))photo=await assertMediaImage(env,b.photo_media_id);const publicFlag=Object.prototype.hasOwnProperty.call(b,'is_public')?(bool(b.is_public)?1:0):Number(old.is_public||0);const indexFlag=Object.prototype.hasOwnProperty.call(b,'allow_index')?(bool(b.allow_index)?1:0):Number(old.allow_index||0);await env.DB.prepare(`UPDATE people SET slug=?,name=?,title=?,role_group=?,bio=?,expertise=?,photo_media_id=?,links_json=?,seo_json=?,sort_order=?,is_public=?,allow_index=?,updated_by=?,updated_at=? WHERE id=?`).bind(safeSlug(b.slug||old.slug),cleanText(b.name??old.name,160),cleanText(b.title??old.title,200),cleanText(b.role_group??old.role_group,80),cleanText(b.bio??old.bio,12000),cleanText(b.expertise??old.expertise,1000),photo,JSON.stringify(b.links??asJson(old.links_json,{})),JSON.stringify(b.seo??asJson(old.seo_json,{})),Number(b.sort_order??old.sort_order),publicFlag,indexFlag,user.id,now(),id).run();await audit(env,user.id,'person.update','person',id,{photo_media_id:photo,is_public:publicFlag,allow_index:indexFlag},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xóa hồ sơ.');await env.DB.prepare(`DELETE FROM people WHERE id=?`).bind(id).run();await audit(env,user.id,'person.delete','person',id,{},request);return json({ok:true});}
  }

  if(action==='forms'){
    requireFeature(user,'forms',write);
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT * FROM forms ORDER BY updated_at DESC`).all();return json({ok:true,items:rows.results.map(x=>({...x,fields:sanitizeFields(asJson(x.fields_json,[])),settings:sanitizeFormSettings(asJson(x.settings_json,{})),cover_url:x.cover_media_id?`/api/media/${x.cover_media_id}`:null}))});}
    if(request.method==='POST'){const b=await readJson(request),name=cleanText(b.name,200),slug=safeSlug(b.slug||name),t=now();assert(name&&slug,400,'Tên/slug không hợp lệ.');validateFormWindow(b.opens_at||null,b.closes_at||null);const cover=await assertMediaImage(env,b.cover_media_id),fields=sanitizeFields(b.fields),settings=sanitizeFormSettings(b.settings),capacity=formCapacity(b.capacity);const r=await env.DB.prepare(`INSERT INTO forms(slug,name,description,kind,status,fields_json,settings_json,cover_media_id,opens_at,closes_at,capacity,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(slug,name,cleanText(b.description,5000),cleanText(b.kind||'general',80),FORM_STATUSES.has(b.status)?b.status:'draft',JSON.stringify(fields),JSON.stringify(settings),cover,b.opens_at||null,b.closes_at||null,capacity,user.id,user.id,t,t).run();await audit(env,user.id,'form.create','form',r.meta.last_row_id,{slug,field_count:fields.length},request);return json({ok:true,id:r.meta.last_row_id},201);}
  }
  if(action==='form'&&p[2]){
    requireFeature(user,'forms',write);const id=Number(p[2]),old=await env.DB.prepare(`SELECT * FROM forms WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy biểu mẫu.');
    if(request.method==='GET')return json({ok:true,item:{...old,fields:sanitizeFields(asJson(old.fields_json,[])),settings:sanitizeFormSettings(asJson(old.settings_json,{})),cover_url:old.cover_media_id?`/api/media/${old.cover_media_id}`:null}});
    if(request.method==='PUT'){const b=await readJson(request);let cover=old.cover_media_id;if(Object.prototype.hasOwnProperty.call(b,'cover_media_id'))cover=await assertMediaImage(env,b.cover_media_id);const fields=sanitizeFields(b.fields??asJson(old.fields_json,[])),settings=sanitizeFormSettings(b.settings??asJson(old.settings_json,{})),opensAt=Object.prototype.hasOwnProperty.call(b,'opens_at')?b.opens_at:old.opens_at,closesAt=Object.prototype.hasOwnProperty.call(b,'closes_at')?b.closes_at:old.closes_at,capacity=Object.prototype.hasOwnProperty.call(b,'capacity')?formCapacity(b.capacity):old.capacity;validateFormWindow(opensAt||null,closesAt||null);await env.DB.prepare(`UPDATE forms SET slug=?,name=?,description=?,kind=?,status=?,fields_json=?,settings_json=?,cover_media_id=?,opens_at=?,closes_at=?,capacity=?,updated_by=?,updated_at=? WHERE id=?`).bind(safeSlug(b.slug||old.slug),cleanText(b.name??old.name,200),cleanText(b.description??old.description,5000),cleanText(b.kind??old.kind,80),FORM_STATUSES.has(b.status)?b.status:old.status,JSON.stringify(fields),JSON.stringify(settings),cover,opensAt||null,closesAt||null,capacity,user.id,now(),id).run();await audit(env,user.id,'form.update','form',id,{field_count:fields.length},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xóa biểu mẫu.');const uploads=await env.DB.prepare(`SELECT r2_key FROM form_uploads WHERE form_id=?`).bind(id).all();for(const x of uploads.results||[]){try{await env.STORAGE.delete(x.r2_key)}catch{}}const c=await env.DB.prepare(`SELECT COUNT(*) c FROM form_submissions WHERE form_id=?`).bind(id).first();await env.DB.prepare(`DELETE FROM forms WHERE id=?`).bind(id).run();await audit(env,user.id,'form.delete','form',id,{deleted_submissions:Number(c.c||0),deleted_uploads:(uploads.results||[]).length},request);return json({ok:true,deleted_submissions:Number(c.c||0)});}
  }

  if(action==='submissions'&&request.method==='GET'){
    requireFeature(user,'submissions');const status=cleanText(u.searchParams.get('status'),30),q=cleanText(u.searchParams.get('q'),120);let sql=`SELECT s.*,f.name AS form_name FROM form_submissions s JOIN forms f ON f.id=s.form_id WHERE 1=1`,binds=[];if(status&&SUBMISSION_STATUSES.has(status)){sql+=` AND s.status=?`;binds.push(status);}if(q){sql+=` AND (s.code LIKE ? OR s.full_name LIKE ? OR s.email LIKE ?)`;binds.push(`%${q}%`,`%${q}%`,`%${q}%`);}sql+=` ORDER BY s.created_at DESC LIMIT 800`;const rows=await env.DB.prepare(sql).bind(...binds).all();return json({ok:true,items:rows.results.map(x=>({...x,answers:asJson(x.answers_json,{})}))});
  }
  if(action==='submission'&&p[2]){
    requireFeature(user,'submissions',write);const id=Number(p[2]),row=await env.DB.prepare(`SELECT s.*,f.name AS form_name,f.fields_json FROM form_submissions s JOIN forms f ON f.id=s.form_id WHERE s.id=?`).bind(id).first();assert(row,404,'Không tìm thấy hồ sơ.');
    if(request.method==='GET'){const ev=await env.DB.prepare(`SELECT e.*,u.name AS actor_name FROM submission_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.submission_id=? ORDER BY e.created_at DESC`).bind(id).all();return json({ok:true,item:{...row,answers:asJson(row.answers_json,{}),fields:sanitizeFields(asJson(row.fields_json,[]))},timeline:ev.results});}
    if(request.method==='PUT'){const b=await readJson(request),status=SUBMISSION_STATUSES.has(b.status)?b.status:row.status,note=cleanText(b.internal_notes??row.internal_notes,5000),assignee=b.assignee_id?Number(b.assignee_id):user.id;await env.DB.prepare(`UPDATE form_submissions SET status=?,internal_notes=?,assignee_id=?,updated_at=? WHERE id=?`).bind(status,note,assignee,now(),id).run();let emailSent=0;if(bool(b.send_email)&&validEmail(row.email)){const msg=cleanText(b.email_message||`Trạng thái hồ sơ ${row.code} đã được cập nhật thành ${status}.`,3000),m=await sendMail(env,{to:row.email,subject:`Cập nhật hồ sơ ${row.code} · Xanh Sky First`,html:`<p>Xin chào ${escapeHtml(row.full_name)},</p><p>${escapeHtml(msg).replace(/\n/g,'<br>')}</p>`});emailSent=m.sent?1:0;}await env.DB.prepare(`INSERT INTO submission_events(submission_id,event_type,old_status,new_status,note,actor_user_id,email_sent,created_at) VALUES(?,'status_update',?,?,?,?,?,?)`).bind(id,row.status,status,cleanText(b.event_note||'',2000),user.id,emailSent,now()).run();await audit(env,user.id,'submission.update','submission',id,{status,email_sent:!!emailSent},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xóa hồ sơ.');const uploads=await env.DB.prepare(`SELECT r2_key FROM form_uploads WHERE claimed_submission_id=?`).bind(id).all();for(const x of uploads.results||[]){try{await env.STORAGE.delete(x.r2_key)}catch{}}await env.DB.prepare(`DELETE FROM form_submissions WHERE id=?`).bind(id).run();await audit(env,user.id,'submission.delete','submission',id,{code:row.code,deleted_uploads:(uploads.results||[]).length},request);return json({ok:true});}
  }
  if(action==='submission-file'&&p[2]&&request.method==='GET'){
    requireFeature(user,'submissions');const id=Number(p[2]),row=await env.DB.prepare(`SELECT * FROM form_uploads WHERE id=? AND claimed_submission_id IS NOT NULL`).bind(id).first();assert(row,404,'Không tìm thấy tệp hồ sơ.');const obj=await env.STORAGE.get(row.r2_key);assert(obj,404,'Tệp không còn trong storage.');const h=new Headers({'Content-Type':row.mime_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return new Response(obj.body,{headers:h});
  }

  if(action==='contacts'&&request.method==='GET'){
    assert(user.role==='root_admin'||user.role==='administrator',403,'Bạn không có quyền xem liên hệ.');const rows=await env.DB.prepare(`SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 500`).all();return json({ok:true,items:rows.results});
  }
  if(action==='contact'&&p[2]&&request.method==='PUT'){
    assert(user.role==='root_admin'||user.role==='administrator',403,'Bạn không có quyền cập nhật liên hệ.');
    const id=Number(p[2]),b=await readJson(request),status=String(b.status||'');
    assert(Number.isSafeInteger(id)&&id>0,400,'ID liên hệ không hợp lệ.');
    assert(['new','read','replied','closed'].includes(status),400,'Trạng thái liên hệ không hợp lệ.');
    const old=await env.DB.prepare(`SELECT id,status FROM contact_messages WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy liên hệ.');
    await env.DB.prepare(`UPDATE contact_messages SET status=?,updated_at=? WHERE id=?`).bind(status,now(),id).run();
    await audit(env,user.id,'contact.status.update','contact',id,{from:old.status,to:status},request);
    return json({ok:true,status});
  }
  if(action==='newsletter'&&request.method==='GET'){
    assert(user.role==='root_admin'||user.role==='administrator'||user.role==='content_editor',403,'Bạn không có quyền xem newsletter.');const rows=await env.DB.prepare(`SELECT id,email,preferences_json,status,created_at,updated_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 1000`).all();return json({ok:true,items:rows.results.map(x=>({...x,preferences:asJson(x.preferences_json,[])}))});
  }

  if(action==='ctt-integration'&&request.method==='GET'){
    assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xem trạng thái tích hợp CTT.');
    const readLegacyQueue=async()=>{
      const legacy=await env.DB.prepare(`SELECT q.case_code AS submission_code,
        CASE q.state WHEN 'synced' THEN 'sent' ELSE q.state END AS state,
        q.attempts,NULL AS last_http_status,q.last_error,
        COALESCE(s.created_at,q.updated_at) AS created_at,q.updated_at,q.ctt_synced_at AS sent_at
        FROM ctt_sync_queue q LEFT JOIN form_submissions s ON s.id=q.submission_id
        ORDER BY q.updated_at DESC LIMIT 300`).all();
      return (legacy.results||[]).map(x=>({...x,_source:'legacy_queue'}));
    };
    try {
      const rows=await env.DB.prepare(`SELECT submission_code,state,attempts,last_http_status,last_error,created_at,updated_at,sent_at FROM ctt_integration_outbox ORDER BY updated_at DESC LIMIT 300`).all();
      const current=(rows.results||[]).map(x=>({...x,_source:'outbox'}));
      let legacy=[];
      try { legacy=await readLegacyQueue(); }
      catch(legacyError) {
        const legacyMessage=String(legacyError?.message||legacyError);
        if(!/no such table:\s*ctt_sync_queue|no such column:/i.test(legacyMessage)) throw legacyError;
      }
      // Preserve old history even after the current outbox is created; never let the recovery SQL hide legacy rows.
      const codes=new Set(current.map(x=>String(x.submission_code)));
      const merged=[...current,...legacy.filter(x=>!codes.has(String(x.submission_code)))].sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,300);
      const hasLegacy=merged.some(x=>x._source==='legacy_queue');
      return json({ok:true,source:hasLegacy?(current.length?'combined':'legacy_queue'):'outbox',...(hasLegacy?{warning:'Lịch sử hàng đợi CTT cũ được giữ nguyên. Các dòng lịch sử cũ chỉ để tra cứu; thao tác gửi lại áp dụng cho bản ghi thuộc outbox hiện hành.'}:{}),items:merged});
    } catch (error) {
      const message=String(error?.message||error);
      // Older deployed D1s used ctt_sync_queue instead of ctt_integration_outbox.
      // Treat only missing-table/column errors as schema compatibility; preserve other failures.
      if(!/no such table:\s*ctt_integration_outbox|no such column:/i.test(message)) throw error;
      try {
        const legacy=await readLegacyQueue();
        return json({ok:true,source:'legacy_queue',warning:'Đang đọc hàng đợi đồng bộ cũ. Hãy áp dụng migrations/0011_admin_500_recovery.sql để khôi phục outbox hiện hành và chức năng gửi lại.',items:legacy});
      } catch (legacyError) {
        const legacyMessage=String(legacyError?.message||legacyError);
        if(!/no such table:\s*ctt_sync_queue|no such column:/i.test(legacyMessage)) throw legacyError;
        return json({ok:true,source:'uninitialized',warning:'Bảng đồng bộ CTT chưa được khởi tạo trên D1. Hãy áp dụng migrations/0011_admin_500_recovery.sql để khởi tạo bảng không phá hủy dữ liệu hiện có.',items:[]});
      }
    }
  }
  if(action==='ctt-integration'&&p[2]==='retry'&&request.method==='POST'){
    assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được gửi lại dữ liệu sang CTT.');
    const code=decodeURIComponent(p[3]||'');
    let row;
    try {
      row=await env.DB.prepare(`SELECT payload_json FROM ctt_integration_outbox WHERE submission_code=?`).bind(code).first();
    } catch(error) {
      if(/no such table:\s*ctt_integration_outbox|no such column:/i.test(String(error?.message||error))) throw new HttpError(503,'Bảng đồng bộ hiện hành chưa sẵn sàng. Hãy áp dụng migrations/0011_admin_500_recovery.sql rồi thử lại.');
      throw error;
    }
    assert(row,404,'Không tìm thấy bản ghi đồng bộ.');
    const payload=asJson(row.payload_json,null);assert(payload,500,'Dữ liệu đồng bộ không hợp lệ.');
    const result=await deliverCttSubmission(env,payload);await audit(env,user.id,'ctt.integration.retry','submission',code,{sent:!!result.sent,reason:result.reason||'',status:result.status||null},request);
    return json({ok:!!result.sent,state:result.sent?'sent':'failed',reason:result.reason||null,status:result.status||null});
  }

  if(action==='diagnostics'){
    return await handleDiagnosticsAdmin(env,request,user,p,{apiOnRequest:onRequest,sendMailFn:sendMail,rateLimitFn:rateLimit});
  }

  throw new HttpError(404,'Không tìm thấy API quản trị.');
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const { p } = routeParts(request);
    if (p[0] === 'health') return json({ok:true,service:'Xanh Sky First',time:now(),pbkdf2_iterations:PBKDF2_ITERATIONS});
    if (p[0] === 'setup') return await handleSetup(env,request);
    if (p[0] === 'auth') return await handleAuth(env,request,p[1]);
    if (p[0] === 'public') return await handlePublic(env,request,p[1]);
    if (p[0] === 'media') return await handleMedia(env,request,p[1]);
    if (p[0] === 'admin') return await handleAdmin(env,request,p[1],p);
    if (p[0] === 'cron' && p[1] === 'diagnostics') return await handleDiagnosticsCron(env,request,onRequest,sendMail);
    return json({ok:false,error:'API route not found'},404);
  } catch (e) { return errorResponse(e); }
}
