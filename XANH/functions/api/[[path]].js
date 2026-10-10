import { json, readJson, HttpError, assert, errorResponse, safeSlug, cleanText, requireSameOrigin } from '../_lib/http.js';
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS, randomToken, sha256Hex } from '../_lib/crypto.js';
import { currentUser, requireUser, createSession, sessionCookie, clearSessionCookie, destroySession, audit } from '../_lib/auth.js';
import { validateUpload, mediaKey } from '../_lib/media.js';

const CONTENT_TYPES = new Set(['article','project','activity','opportunity','resource','initiative']);
const PUBLIC_STATUSES = new Set(['published','open','completed']);
const FORM_STATUSES = new Set(['draft','open','closed','archived']);
const SUBMISSION_STATUSES = new Set(['new','reviewing','needs_info','approved','rejected','completed']);
const USER_ROLES = new Set(['root_admin','administrator','content_editor','project_manager','volunteer_coordinator','viewer']);
const ADMIN_ROLES = new Set(['root_admin','administrator']);

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
function mediaOut(row) { return row ? { ...row, url: `/api/media/${row.id}` } : null; }

async function rateLimit(env, request, bucket, limit, seconds) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const keyHash = await sha256Hex(`${bucket}:${ip}`);
  const ts = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(ts / seconds) * seconds;
  await env.DB.prepare(`INSERT INTO rate_limits(bucket,key_hash,window_start,hits) VALUES(?,?,?,1)
    ON CONFLICT(bucket,key_hash,window_start) DO UPDATE SET hits=hits+1`).bind(bucket,keyHash,windowStart).run();
  const row = await env.DB.prepare(`SELECT hits FROM rate_limits WHERE bucket=? AND key_hash=? AND window_start=?`).bind(bucket,keyHash,windowStart).first();
  if ((row?.hits || 0) > limit) throw new HttpError(429, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
}

async function settingsGet(env, key='general') {
  const row = await env.DB.prepare(`SELECT value_json FROM site_settings WHERE key=?`).bind(key).first();
  return asJson(row?.value_json, {});
}
async function settingsSet(env, key, value) {
  await env.DB.prepare(`INSERT INTO site_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).bind(key, JSON.stringify(value || {}), now()).run();
}

const CTT_FORM_ID = 'xanh-sky-first-integration';
const CTT_CASE_BASE = 'https://ctt.skyfirst.io.vn/ho-so';
const CTT_STATUS_MAP = {
  new: { status:'Đã tiếp nhận', label:'TIẾP NHẬN', note:'Hồ sơ đã được hệ thống ghi nhận.', next:'Theo dõi trạng thái hồ sơ và email đã đăng ký.', result:'' },
  reviewing: { status:'Đang xem xét', label:'KIỂM TRA', note:'Hồ sơ đang được xem xét theo quy trình.', next:'Vui lòng theo dõi cập nhật trạng thái.', result:'' },
  needs_info: { status:'Cần bổ sung thông tin', label:'CẦN BỔ SUNG', note:'Hồ sơ cần được bổ sung thông tin theo hướng dẫn của đơn vị tiếp nhận.', next:'Theo dõi email hoặc liên hệ kênh hỗ trợ chính thức để biết nội dung cần bổ sung.', result:'' },
  approved: { status:'Đã duyệt', label:'XỬ LÝ', note:'Hồ sơ đã được duyệt.', next:'Theo dõi hướng dẫn tiếp theo của chương trình nếu có.', result:'Hồ sơ đã được duyệt.' },
  rejected: { status:'Không phù hợp', label:'XỬ LÝ', note:'Kết quả xử lý hồ sơ đã được cập nhật.', next:'Liên hệ đơn vị tiếp nhận nếu cần làm rõ kết quả.', result:'Hồ sơ chưa được chấp thuận.' },
  completed: { status:'Đã hoàn tất', label:'HOÀN TẤT', note:'Quy trình xử lý hồ sơ đã hoàn tất.', next:'Bạn có thể lưu lại thông tin tra cứu để đối chiếu khi cần.', result:'Quy trình xử lý đã hoàn tất.' },
};
const APPEARANCE_DEFAULTS = { primary:'#0878E8', navy:'#123F70', green:'#099B77', background:'#F4F9FC', body_font:'Be Vietnam Pro', heading_font:'Georgia' };
const ALLOWED_BODY_FONTS = new Set(['Be Vietnam Pro','Times New Roman','System']);
const ALLOWED_HEADING_FONTS = new Set(['Georgia','Times New Roman','Be Vietnam Pro']);
function sanitizeAppearance(input) {
  const x=input&&typeof input==='object'?input:{};
  const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toUpperCase():fallback;
  const body=String(x.body_font||APPEARANCE_DEFAULTS.body_font),heading=String(x.heading_font||APPEARANCE_DEFAULTS.heading_font);
  return { primary:color(x.primary,APPEARANCE_DEFAULTS.primary),navy:color(x.navy,APPEARANCE_DEFAULTS.navy),green:color(x.green,APPEARANCE_DEFAULTS.green),background:color(x.background,APPEARANCE_DEFAULTS.background),body_font:ALLOWED_BODY_FONTS.has(body)?body:APPEARANCE_DEFAULTS.body_font,heading_font:ALLOWED_HEADING_FONTS.has(heading)?heading:APPEARANCE_DEFAULTS.heading_font };
}
function sanitizeProgramCode(value) {
  const code=cleanText(value||'XSK',24).toUpperCase();
  return /^[A-Z0-9-]{2,12}$/.test(code)?code:'XSK';
}
function publicCTTStatus(status) { return CTT_STATUS_MAP[SUBMISSION_STATUSES.has(status)?status:'new']||CTT_STATUS_MAP.new; }
function publicSyncError(error) {
  const m=String(error?.message||'').toLowerCase();
  if(!error) return '';
  if(m.includes('ctt_db')||m.includes('not configured')||m.includes('undefined')) return 'Chưa sẵn sàng kết nối cơ sở dữ liệu CTT.';
  if(m.includes('unique constraint')||m.includes('already exists')) return 'Mã hồ sơ đang trùng với một bản ghi khác tại CTT; hệ thống không ghi đè dữ liệu đó.';
  return 'Đồng bộ chưa hoàn tất. Kiểm tra kết nối CTT và cấu trúc dữ liệu; có thể thử đồng bộ lại trong trang quản trị.';
}
async function reserveCaseCode(env, programCode) {
  const safeProgram=sanitizeProgramCode(programCode);
  for(let attempt=0;attempt<10000;attempt++) {
    const buf=new Uint32Array(1);crypto.getRandomValues(buf);
    const number=buf[0]%10000, code=`${String(number).padStart(4,'0')}/MSH-XSK-${safeProgram}`;
    try {
      const r=await env.DB.prepare(`INSERT INTO case_code_registry(number,code,program_code,created_at) VALUES(?,?,?,?)`).bind(number,code,safeProgram,now()).run();
      if(Number(r.meta?.changes||0)===1) return code;
    } catch(e) {
      const m=String(e?.message||e).toLowerCase();
      if(m.includes('unique constraint')||m.includes('sqlite_constraint')||m.includes('constraint failed')) continue;
      throw e;
    }
  }
  throw new HttpError(503,'Hiện không còn mã số khả dụng trong dải bốn chữ số. Vui lòng liên hệ quản trị viên.');
}
async function inspectCTTSchema(db) {
  try {
    assert(db,503,'CTT_DB chưa được cấu hình.');
    const [forms,submissions,events]=await Promise.all([
      db.prepare(`PRAGMA table_info(forms)`).all(),
      db.prepare(`PRAGMA table_info(submissions)`).all(),
      db.prepare(`PRAGMA table_info(case_events)`).all(),
    ]);
    const cols={forms:new Set((forms.results||[]).map(x=>x.name)),submissions:new Set((submissions.results||[]).map(x=>x.name)),case_events:new Set((events.results||[]).map(x=>x.name))};
    const required={
      forms:['id','name','prefix','description','audience','min_age','enabled','recipient_email','version','config_json','created_at','updated_at'],
      submissions:['code','form_id','form_version','form_snapshot_json','user_id','full_name','email','answers_json','terms_snapshot_json','status','created_at','updated_at'],
      case_events:['id','submission_code','event_type','public_label','public_note','status','created_at'],
    };
    const missing=[];
    for(const [table,names] of Object.entries(required)) for(const name of names) if(!cols[table].has(name)) missing.push(`${table}.${name}`);
    if(missing.length) return {ok:false,error:`Cơ sở dữ liệu CTT đang thiếu cấu trúc cần thiết: ${missing.slice(0,8).join(', ')}${missing.length>8?'…':''}. Kiểm tra cấu trúc CTT hiện tại; không chạy migration Xanh lên CTT.`};
    return {ok:true,error:''};
  } catch(e) { return {ok:false,error:publicSyncError(e)}; }
}
async function ensureCTTIntegrationForm(db) {
  assert(db,503,'Kết nối tra cứu CTT chưa được cấu hình.');
  const t=now(), config={source:'xanh-sky-first',internal_integration:true,public_submission_form:false};
  await db.prepare(`INSERT OR IGNORE INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(CTT_FORM_ID,'Hồ sơ Xanh Sky First','XSK','Bản ghi tích hợp nội bộ để CTT tra cứu hồ sơ được tiếp nhận tại website Xanh Sky First.','private',null,0,'xanh@skyfirst.io.vn',1,JSON.stringify(config),t,t).run();
  const existing=await db.prepare(`SELECT id,config_json FROM forms WHERE id=?`).bind(CTT_FORM_ID).first();
  assert(existing&&asJson(existing.config_json,{}).source==='xanh-sky-first',409,'Không thể tạo vùng tích hợp Xanh trong CTT vì mã biểu mẫu nội bộ đã được sử dụng.');
}
async function syncCaseSubmissionToCTT(env, payload) {
  const db=env.CTT_DB;
  assert(db,503,'CTT_DB chưa được cấu hình trên môi trường chạy Xanh.');
  assert(payload&&String(payload.code||'').trim().length>=4,400,'Mã hồ sơ không hợp lệ để đồng bộ.');
  assert(validEmail(payload.email),400,'Hồ sơ thiếu email hợp lệ nên CTT không thể xác minh bằng mã và email.');
  const schema=await inspectCTTSchema(db); assert(schema.ok,503,schema.error||'Cấu trúc dữ liệu CTT chưa sẵn sàng.');
  await ensureCTTIntegrationForm(db);
  const status=publicCTTStatus(payload.status), timestamp=payload.updated_at||now();
  const colsResult=await db.prepare(`PRAGMA table_info(submissions)`).all();
  const cols=new Set((colsResult.results||[]).map(c=>c.name));
  for(const col of ['code','form_id','full_name','email','answers_json','status','created_at','updated_at']) assert(cols.has(col),503,`CTT thiếu trường dữ liệu cần thiết: ${col}.`);
  const existing=await db.prepare(`SELECT code,form_id,full_name,email,answers_json,status,created_at,updated_at FROM submissions WHERE code=? LIMIT 1`).bind(payload.code).first();
  const marker=existing?asJson(existing.answers_json,{}):{};
  if(existing) assert(existing.form_id===CTT_FORM_ID&&marker.source==='xanh-sky-first'&&Number(marker.xanh_submission_id)===Number(payload.id),409,'Mã hồ sơ đã tồn tại tại CTT nhưng không thuộc bản ghi Xanh này; hệ thống không ghi đè dữ liệu.');
  const snapshot=JSON.stringify({name:'Hồ sơ Xanh Sky First',description:'Hồ sơ này được tiếp nhận và quản lý trên website Xanh Sky First. CTT chỉ cung cấp chức năng tra cứu trạng thái đã đồng bộ.',source:'xanh-sky-first'});
  const answers=JSON.stringify({source:'xanh-sky-first',xanh_submission_id:Number(payload.id),program_code:sanitizeProgramCode(payload.program_code||'XSK')});
  if(!existing) {
    const insertCols=['code','form_id','form_version','form_snapshot_json','user_id','full_name','email','answers_json','terms_snapshot_json','status','created_at','updated_at'];
    const values=[payload.code,CTT_FORM_ID,1,snapshot,null,cleanText(payload.full_name||'Người đăng ký',120),String(payload.email).trim().toLowerCase(),answers,'[]',status.status,payload.created_at||timestamp,timestamp];
    await db.prepare(`INSERT INTO submissions(${insertCols.join(',')}) VALUES(${insertCols.map(()=>'?').join(',')})`).bind(...values).run();
  } else {
    await db.prepare(`UPDATE submissions SET full_name=?,email=?,answers_json=?,status=?,updated_at=? WHERE code=? AND form_id=?`)
      .bind(cleanText(payload.full_name||'Người đăng ký',120),String(payload.email).trim().toLowerCase(),answers,status.status,timestamp,payload.code,CTT_FORM_ID).run();
  }
  const updates=[],args=[];
  if(cols.has('next_action')) { updates.push('next_action=?'); args.push(status.next); }
  if(cols.has('result_summary')) { updates.push('result_summary=?'); args.push(status.result); }
  if(updates.length) { args.push(timestamp,payload.code,CTT_FORM_ID); await db.prepare(`UPDATE submissions SET ${updates.join(',')},updated_at=? WHERE code=? AND form_id=?`).bind(...args).run(); }
  // Keep public timeline entries safe: never copy Xanh's internal notes or raw form answers to CTT.
  const lastEvent=await db.prepare(`SELECT status FROM case_events WHERE submission_code=? ORDER BY created_at DESC,id DESC LIMIT 1`).bind(payload.code).first().catch(()=>null);
  if(!lastEvent || String(lastEvent.status||'')!==String(status.status)) {
    await db.prepare(`INSERT INTO case_events(submission_code,event_type,public_label,public_note,status,created_at) VALUES(?,?,?,?,?,?)`)
      .bind(payload.code,lastEvent?'xanh_status_update':'xanh_received',status.label,status.note,status.status,timestamp).run();
  }
  return {synced:true,status:status.status};
}
async function cttPayloadForSubmission(env, id) {
  const row=await env.DB.prepare(`SELECT s.id,s.code,s.full_name,s.email,s.status,s.created_at,s.updated_at,f.name AS form_name,f.settings_json FROM form_submissions s JOIN forms f ON f.id=s.form_id WHERE s.id=?`).bind(Number(id)).first();
  if(!row) return null;
  const settings=sanitizeFormSettings(asJson(row.settings_json,{}));
  return {...row,program_code:settings.program_code||'XSK'};
}
async function markCTTSyncFailure(env,payload,error) {
  const message=publicSyncError(error),t=now();
  try { await env.DB.prepare(`UPDATE form_submissions SET ctt_sync_status='pending',ctt_sync_error=? WHERE id=?`).bind(message,Number(payload.id)).run(); } catch {}
  try { await env.DB.prepare(`INSERT INTO ctt_sync_queue(submission_id,case_code,payload_json,state,attempts,last_error,updated_at) VALUES(?,?,?,'pending',1,?,?) ON CONFLICT(submission_id) DO UPDATE SET case_code=excluded.case_code,payload_json=excluded.payload_json,state='pending',attempts=ctt_sync_queue.attempts+1,last_error=excluded.last_error,ctt_synced_at=NULL,updated_at=excluded.updated_at`)
    .bind(Number(payload.id),String(payload.code||''),JSON.stringify(payload),message,t).run(); } catch(e) { console.error('CTT retry queue unavailable',e); }
  return {synced:false,error:message};
}
async function markCTTSyncSuccess(env,payload) {
  const t=now();
  await env.DB.prepare(`UPDATE form_submissions SET ctt_sync_status='synced',ctt_sync_error='',ctt_synced_at=? WHERE id=?`).bind(t,Number(payload.id)).run();
  await env.DB.prepare(`DELETE FROM ctt_sync_queue WHERE submission_id=?`).bind(Number(payload.id)).run().catch(()=>{});
  return {synced:true};
}
async function synchronizeOne(env,payload) {
  try { await syncCaseSubmissionToCTT(env,payload); await markCTTSyncSuccess(env,payload); return {synced:true}; }
  catch(e) { const r=await markCTTSyncFailure(env,payload,e); console.error('CTT sync pending for code',payload.code,publicSyncError(e)); return r; }
}
async function retryPendingCTTSync(env, limit=50) {
  const capped=Math.max(1,Math.min(200,Number(limit)||50));
  const rows=await env.DB.prepare(`SELECT s.id,s.code,s.full_name,s.email,s.status,s.created_at,s.updated_at,f.name AS form_name,f.settings_json FROM form_submissions s JOIN forms f ON f.id=s.form_id WHERE COALESCE(s.ctt_sync_status,'pending') IN ('pending','failed') ORDER BY s.created_at ASC LIMIT ?`).bind(capped).all();
  let synced=0,failed=0;
  for(const row of rows.results||[]) {
    const payload={...row,program_code:sanitizeFormSettings(asJson(row.settings_json,{})).program_code||'XSK'};
    const result=await synchronizeOne(env,payload); if(result.synced) synced++; else failed++;
  }
  return {checked:(rows.results||[]).length,synced,failed};
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
    await env.DB.prepare(`UPDATE users SET password_hash=?,updated_at=? WHERE id=?`).bind(nh,now(),u.id).run();
    await env.DB.prepare(`DELETE FROM sessions WHERE user_id=? AND id<>?`).bind(u.id,u.session_id).run();
    await audit(env,u.id,'auth.change_password','user',u.id,{pbkdf2_iterations:PBKDF2_ITERATIONS},request);
    return json({ok:true,pbkdf2_iterations:PBKDF2_ITERATIONS});
  }
  if (action === 'request-reset' && request.method === 'POST') {
    await rateLimit(env,request,'reset',5,3600); const b=await readJson(request); const email=cleanText(b.email,200).toLowerCase();
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
    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET password_hash=?,updated_at=? WHERE id=?`).bind(ph,t,row.user_id),
      env.DB.prepare(`UPDATE password_reset_tokens SET used_at=? WHERE id=?`).bind(t,row.id),
      env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(row.user_id),
    ]);
    await audit(env,row.user_id,'auth.reset_password','user',row.user_id,{pbkdf2_iterations:PBKDF2_ITERATIONS},request);
    return json({ok:true});
  }
  throw new HttpError(404,'Không tìm thấy API xác thực.');
}

function sanitizeFields(input) {
  const allowed = new Set(['text','email','phone','url','textarea','select','radio','checkbox','date','time','datetime','number','rating','file','signature','consent','section']);
  const fields = Array.isArray(input) ? input.slice(0,80) : [];
  return fields.map((f, i) => {
    const type = allowed.has(String(f?.type||'')) ? String(f.type) : 'text';
    const id = safeSlug(f?.id || f?.label || `field-${i+1}`) || `field-${i+1}`;
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
function sanitizeFormSettings(input) {
  const x = input && typeof input==='object' ? input : {};
  return {
    confirmation_title: cleanText(x.confirmation_title || 'Đã nhận hồ sơ', 160),
    confirmation_message: cleanText(x.confirmation_message || 'Xanh Sky First đã ghi nhận thông tin của bạn.', 2000),
    confirmation_email: x.confirmation_email !== false,
    closed_message: cleanText(x.closed_message || 'Biểu mẫu hiện không nhận thêm hồ sơ.', 1000),
    require_guardian_consent: bool(x.require_guardian_consent),
    guardian_note: cleanText(x.guardian_note, 1200),
    program_code: sanitizeProgramCode(x.program_code),
  };
}
async function publishDueContent(env) {
  try {
    await env.DB.prepare(`UPDATE content_items SET status='published',published_at=COALESCE(published_at,?),updated_at=? WHERE status='draft' AND json_extract(metadata_json,'$.scheduled_at') IS NOT NULL AND json_extract(metadata_json,'$.scheduled_at')<=?`).bind(now(),now(),now()).run();
  } catch {}
}
async function assertMediaImage(env, id) {
  if (!id) return null;
  const row = await env.DB.prepare(`SELECT id,mime_type FROM media WHERE id=?`).bind(Number(id)).first();
  assert(row && String(row.mime_type).startsWith('image/'),400,'Ảnh đã chọn không hợp lệ.');
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

async function handlePublic(env, request, action) {
  const u=new URL(request.url);
  await publishDueContent(env);
  if (action === 'site' && request.method==='GET') {
    const [settings,navigation,appearance]=await Promise.all([settingsGet(env),settingsGet(env,'navigation'),settingsGet(env,'appearance')]);
    const page=await env.DB.prepare(`SELECT * FROM pages WHERE slug='home' AND status='published'`).first();
    return json({ok:true,settings:{...settings,appearance:sanitizeAppearance(appearance)},navigation,page:pageOut(page)});
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
    const [r,cfgRows]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(DISTINCT CASE WHEN verified=1 AND completed=1 AND locality<>'' THEN locality END) AS localities,
        COALESCE(SUM(CASE WHEN verified=1 THEN confirmed_participants ELSE 0 END),0) AS participants,
        COALESCE(SUM(CASE WHEN verified=1 AND completed=1 THEN 1 ELSE 0 END),0) AS completed_activities,
        COALESCE(SUM(CASE WHEN verified=1 THEN volunteer_hours ELSE 0 END),0) AS volunteer_hours,
        COALESCE(SUM(CASE WHEN verified=1 THEN waste_tons ELSE 0 END),0) AS waste_tons,
        COALESCE(SUM(CASE WHEN verified=1 THEN community_reached ELSE 0 END),0) AS community_reached,
        SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END) AS verified_records FROM impact_records`).first(),
      env.DB.prepare(`SELECT * FROM impact_counter_config ORDER BY sort_order,metric_key`).all(),
    ]);
    const impact={localities:Number(r.localities||0),participants:Number(r.participants||0),completed_activities:Number(r.completed_activities||0),volunteer_hours:Number(r.volunteer_hours||0),waste_tons:Number(r.waste_tons||0),community_reached:Number(r.community_reached||0)};
    const verifiedCount=Number(r.verified_records||0);
    const sourceValues={participants:impact.participants,completed_activities:impact.completed_activities,waste_tons:impact.waste_tons,community_reached:impact.community_reached};
    const counters=(cfgRows.results||[]).map(c=>{
      const mode=c.value_mode==='manual'?'manual':'verified';
      const hasManual=c.manual_value!==null&&c.manual_value!==undefined&&Number.isFinite(Number(c.manual_value));
      const value=mode==='manual'?(hasManual?Math.max(0,Number(c.manual_value)):null):(verifiedCount>0?Number(sourceValues[c.metric_key]||0):null);
      const source_label=mode==='manual'?(hasManual?'Số liệu do quản trị viên nhập':'Chưa nhập số liệu thủ công'):(verifiedCount>0?'Dữ liệu Impact đã xác minh':'Chưa có dữ liệu xác minh');
      return {...c,value,value_mode:mode,unit_suffix:cleanText(c.unit_suffix||'',20),source_label,duration_ms:Math.min(12000,Math.max(300,Number(c.duration_ms||1800))),delay_ms:Math.min(5000,Math.max(0,Number(c.delay_ms||0))),hold_ms:Math.min(60000,Math.max(0,Number(c.hold_ms||0))),enabled:Number(c.enabled)===1};
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
    await sendMail(env,{to:email,subject:'Xác nhận nhận newsletter Xanh Sky First',html:`<p>Vui lòng xác nhận đăng ký newsletter:</p><p><a href="${link}">Xác nhận email</a></p><p>Nếu bạn không muốn nhận nội dung này, có thể <a href="${unsubscribeLink}">hủy đăng ký</a>.</p>`});
    return json({ok:true,message:'Vui lòng kiểm tra email để xác nhận đăng ký.'},201);
  }
  if (action === 'newsletter-verify' && request.method==='GET') {
    const email=cleanText(u.searchParams.get('email'),200).toLowerCase(), token=String(u.searchParams.get('token')||''), th=await sha256Hex(token);
    const r=await env.DB.prepare(`UPDATE newsletter_subscribers SET status='active',verify_token_hash=NULL,updated_at=? WHERE email=? AND verify_token_hash=?`).bind(now(),email,th).run();
    return new Response((r.meta.changes||0)>0?'Đã xác nhận newsletter Xanh Sky First.':'Liên kết xác nhận không hợp lệ.',{status:(r.meta.changes||0)>0?200:400,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
  if (action === 'newsletter-unsubscribe' && request.method==='GET') {
    const email=cleanText(u.searchParams.get('email'),200).toLowerCase(), token=String(u.searchParams.get('token')||'');
    assert(validEmail(email)&&token.length>=20,400,'Liên kết hủy đăng ký không hợp lệ.');
    const th=await sha256Hex(token);
    const r=await env.DB.prepare(`UPDATE newsletter_subscribers SET status='unsubscribed',verify_token_hash=NULL,updated_at=? WHERE email=? AND unsubscribe_token_hash=?`).bind(now(),email,th).run();
    const ok=Number(r.meta?.changes||0)>0;
    return new Response(ok?'Bạn đã hủy đăng ký newsletter Xanh Sky First. Email này sẽ không còn nhận nội dung newsletter.':'Liên kết hủy đăng ký không hợp lệ hoặc đã được sử dụng.',{status:ok?200:400,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
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
    if(row.opens_at) assert(new Date(row.opens_at)<=new Date(),409,'Biểu mẫu chưa đến thời gian mở.');
    if(row.closes_at) assert(new Date(row.closes_at)>new Date(),409,asJson(row.settings_json,{}).closed_message || 'Biểu mẫu đã hết hạn.');
    return json({ok:true,item:{...row,fields:asJson(row.fields_json,[]),settings:asJson(row.settings_json,{}),cover_url:row.cover_media_id?`/api/media/${row.cover_media_id}`:null}});
  }
  if (action === 'submission-lookup' && request.method==='GET') {
    return json({ok:false,error:'LOOKUP_MOVED_TO_CTT',message:'Tra cứu hồ sơ Xanh được thực hiện duy nhất tại Cổng Thông Tin Số Sky First (CTT).',lookup_url:CTT_CASE_BASE},410,{'Cache-Control':'no-store'});
  }
  if (action === 'form-upload' && request.method==='POST') {
    await rateLimit(env,request,'form-upload',12,3600);
    const ct=request.headers.get('content-type')||''; assert(ct.includes('multipart/form-data'),415,'Upload phải dùng multipart/form-data.');
    const fd=await request.formData(), formId=Number(fd.get('form_id')), fieldId=cleanText(fd.get('field_id'),120), file=fd.get('file');
    const form=await env.DB.prepare(`SELECT id,status,opens_at,closes_at,fields_json FROM forms WHERE id=?`).bind(formId).first(); assert(form&&form.status==='open',404,'Biểu mẫu chưa mở hoặc không tồn tại.');
    const uploadField=sanitizeFields(asJson(form.fields_json,[])).find(x=>x.id===fieldId&&['file','signature'].includes(x.type)); assert(uploadField,400,'Trường upload không hợp lệ.');
    if(form.opens_at) assert(new Date(form.opens_at)<=new Date(),409,'Biểu mẫu chưa đến thời gian mở.');
    if(form.closes_at) assert(new Date(form.closes_at)>new Date(),409,'Biểu mẫu đã hết hạn.');
    const v=await validateUpload(file), token=randomToken(24), tokenHash=await sha256Hex(token), key=`form-uploads/${formId}/${crypto.randomUUID()}.${v.ext}`;
    await env.STORAGE.put(key,v.body,{httpMetadata:{contentType:v.mime},customMetadata:{originalName:file.name,purpose:'form-upload'}});
    const r=await env.DB.prepare(`INSERT INTO form_uploads(form_id,upload_token_hash,r2_key,filename,mime_type,size_bytes,created_at) VALUES(?,?,?,?,?,?,?)`).bind(formId,tokenHash,key,cleanText(file.name,240),v.mime,v.size,now()).run();
    return json({ok:true,upload:{id:r.meta.last_row_id,upload_token:token,filename:cleanText(file.name,240),mime_type:v.mime,size_bytes:v.size}},201);
  }
  if (action === 'form-submit' && request.method==='POST') {
    await rateLimit(env,request,'form-submit',10,3600); const b=await readJson(request); const form=await env.DB.prepare(`SELECT * FROM forms WHERE id=? AND status='open'`).bind(Number(b.form_id)).first(); assert(form,404,'Biểu mẫu chưa mở hoặc không tồn tại.');
    const settings=sanitizeFormSettings(asJson(form.settings_json,{}));
    const fields=sanitizeFields(asJson(form.fields_json,[]));

    if(form.opens_at) assert(new Date(form.opens_at)<=new Date(),409,'Biểu mẫu chưa đến thời gian mở.');
    if(form.closes_at) assert(new Date(form.closes_at)>new Date(),409,settings.closed_message);
    if(form.capacity){const c=await env.DB.prepare(`SELECT COUNT(*) c FROM form_submissions WHERE form_id=?`).bind(form.id).first();assert(Number(c.c)<Number(form.capacity),409,'Biểu mẫu đã đủ số lượng.');}
    // Form Builder is the single source of truth for public form fields and server-side validation.
    const answers=validateSubmissionAnswers(fields,b.answers||{});
    // CTT verifies a case with both the case code and the registration email.
    // Refuse to issue a code if the form has not collected a valid email.
    assert(env.CTT_DB,503,'Hệ thống tiếp nhận đang hoàn thiện kết nối tra cứu CTT. Vui lòng thử lại sau.');
    const findAnswer=(preferredIds,type)=>{
      for(const id of preferredIds){const v=answers[id];if(typeof v==='string'&&v.trim())return v;}
      const f=fields.find(x=>x.type===type&&typeof answers[x.id]==='string'&&answers[x.id].trim());
      return f?answers[f.id]:'';
    };
    const name=cleanText(findAnswer(['full_name','name','ho_ten'],'text'),120);
    const email=cleanText(findAnswer(['email'],'email'),200).toLowerCase();
    const phone=cleanText(findAnswer(['phone','phone_zalo','sdt'],'phone'),40);
    assert(validEmail(email),400,'Để tra cứu tại CTT, biểu mẫu cần có email hợp lệ. Vui lòng nhập email đã đăng ký.');
    if(settings.require_guardian_consent) assert(bool(b.guardian_consent),400,'Biểu mẫu này yêu cầu xác nhận đồng ý phù hợp đối với người chưa thành niên.');
    const claimedUploads=[];
    for(const f of fields.filter(x=>['file','signature'].includes(x.type))){
      const a=answers[f.id]; if(!a?.upload_token) continue;
      const th=await sha256Hex(a.upload_token);
      const up=await env.DB.prepare(`SELECT id FROM form_uploads WHERE form_id=? AND upload_token_hash=? AND claimed_submission_id IS NULL`).bind(form.id,th).first();
      assert(up,400,`Tệp tại “${f.label}” không hợp lệ hoặc đã được sử dụng.`);
      claimedUploads.push(up.id); answers[f.id].upload_id=up.id; delete answers[f.id].upload_token;
    }
    const t=now(), programCode=settings.program_code||'XSK', code=await reserveCaseCode(env,programCode);
    let r;
    try {
      r=await env.DB.prepare(`INSERT INTO form_submissions(form_id,code,full_name,email,phone,answers_json,status,created_at,updated_at,ctt_sync_status) VALUES(?,?,?,?,?,?,'new',?,?,'pending')`).bind(form.id,code,name,email,phone,JSON.stringify(answers),t,t).run();
    } catch(e) {
      // The registry also prevents reuse; do not try to recycle a code after a failed insert.
      throw e;
    }
    const sid=r.meta.last_row_id;
    await env.DB.prepare(`UPDATE case_code_registry SET submission_id=? WHERE code=?`).bind(sid,code).run();
    for(const uploadId of claimedUploads) await env.DB.prepare(`UPDATE form_uploads SET claimed_submission_id=? WHERE id=? AND claimed_submission_id IS NULL`).bind(sid,uploadId).run();
    await env.DB.prepare(`INSERT INTO submission_events(submission_id,event_type,new_status,note,created_at) VALUES(?,'created','new','Hồ sơ được gửi từ website',?)`).bind(sid,t).run();
    const payload={id:sid,code,program_code:programCode,form_name:form.name,full_name:name,email,status:'new',created_at:t,updated_at:t};
    const synced=await synchronizeOne(env,payload);
    const trackingUrl=`${CTT_CASE_BASE}?code=${encodeURIComponent(code)}`;
    const lookupMessage=synced.synced
      ? `${settings.confirmation_message} Bạn có thể tra cứu tại CTT bằng mã hồ sơ và email đã đăng ký.`
      : `${settings.confirmation_message} Hệ thống đã lưu hồ sơ nhưng chưa xác nhận đồng bộ tại CTT; mã chỉ tra cứu được sau khi đồng bộ hoàn tất. Vui lòng thử lại sau.`;
    let emailSent=false;
    if(settings.confirmation_email&&validEmail(email)){const m=await sendMail(env,{to:email,subject:`Xác nhận hồ sơ ${code} · Xanh Sky First`,html:`<p>Xin chào ${escapeHtml(name)},</p><p>Xanh Sky First đã nhận hồ sơ của bạn cho <b>${escapeHtml(form.name)}</b>.</p><p>Mã hồ sơ: <b>${escapeHtml(code)}</b></p><p>${escapeHtml(lookupMessage)}</p>${synced.synced?`<p><a href="${trackingUrl}">Tra cứu hồ sơ tại CTT</a></p>`:`<p>Đường dẫn tra cứu: <a href="${trackingUrl}">CTT — Cổng Thông Tin Số Sky First</a>. Mã sẽ khả dụng sau khi quá trình đồng bộ hoàn tất.</p>`}`}); emailSent=!!m.sent;}
    if(emailSent) await env.DB.prepare(`UPDATE submission_events SET email_sent=1 WHERE submission_id=? AND event_type='created'`).bind(sid).run();
    return json({ok:true,code,message:lookupMessage,title:settings.confirmation_title,tracking_url:trackingUrl,ctt_synced:synced.synced,ctt_sync_message:synced.synced?'Đã đồng bộ với CTT.':'Đang chờ đồng bộ với CTT; mã chưa thể tra cứu cho đến khi hoàn tất.',email_sent:emailSent},201);
  }
  throw new HttpError(404,'Không tìm thấy API công khai.');
}

async function handleMedia(env, request, idPart) {
  if (request.method!=='GET' && request.method!=='HEAD') throw new HttpError(405,'Method not allowed');
  const id=Number(idPart); assert(Number.isInteger(id)&&id>0,400,'Media ID không hợp lệ.');
  const row=await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(id).first(); assert(row,404,'Không tìm thấy media.');
  const obj=await env.STORAGE.get(row.r2_key); assert(obj,404,'File media không còn tồn tại trong storage.');
  const headers=new Headers(); headers.set('Content-Type',row.mime_type); headers.set('Cache-Control','public, max-age=31536000, immutable'); if(obj.httpEtag) headers.set('ETag',obj.httpEtag); headers.set('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`); headers.set('X-Content-Type-Options','nosniff');
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
    assert(ADMIN_ROLES.has(user.role)||user.role==='project_manager',403,'Bạn không có quyền cấu hình bộ đếm Impact.');
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT * FROM impact_counter_config ORDER BY sort_order,metric_key`).all();return json({ok:true,items:rows.results});}
    if(request.method==='PUT'){
      const b=await readJson(request),items=Array.isArray(b.items)?b.items:[];
      const allowed=new Set(['participants','completed_activities','waste_tons','community_reached']);
      assert(items.length===4&&items.every(x=>allowed.has(String(x.metric_key))),400,'Cấu hình phải bao gồm đúng bốn chỉ số Impact được hỗ trợ.');
      const saved=[];for(const x of items){const key=String(x.metric_key),label=cleanText(x.label,100),description=cleanText(x.description,300),start=Math.max(0,Math.min(1000000000,Number(x.start_value||0))),duration=Math.max(300,Math.min(12000,Number(x.duration_ms||1800))),delay=Math.max(0,Math.min(5000,Number(x.delay_ms||0))),hold=Math.max(0,Math.min(60000,Number(x.hold_ms||0))),enabled=bool(x.enabled)?1:0,order=Math.max(0,Math.min(20,Number(x.sort_order||0))),mode=x.value_mode==='manual'?'manual':'verified',rawManual=x.manual_value,manualValue=(rawManual===null||rawManual===undefined||String(rawManual).trim()==='')?null:Number(rawManual),unit=cleanText(x.unit_suffix||'',20);
        assert(label.length>=2,400,'Nhãn số liệu cần ít nhất 2 ký tự.');
        assert(mode!=='manual'||(manualValue!==null&&Number.isFinite(manualValue)&&manualValue>=0&&manualValue<=1000000000000),400,'Chế độ nhập thủ công cần một giá trị số từ 0 đến 1.000.000.000.000.');
        assert(manualValue===null||(Number.isFinite(manualValue)&&manualValue>=0&&manualValue<=1000000000000),400,'Giá trị bộ đếm không hợp lệ.');
        await env.DB.prepare(`UPDATE impact_counter_config SET label=?,description=?,start_value=?,duration_ms=?,delay_ms=?,hold_ms=?,enabled=?,sort_order=?,value_mode=?,manual_value=?,unit_suffix=?,updated_at=? WHERE metric_key=?`).bind(label,description,start,duration,delay,hold,enabled,order,mode,manualValue,unit,now(),key).run();
        saved.push(key);
      }
      await audit(env,user.id,'impact.counters.update','impact','counter-config',{metrics:saved},request);
      const rows=await env.DB.prepare(`SELECT * FROM impact_counter_config ORDER BY sort_order,metric_key`).all();return json({ok:true,items:rows.results});
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
      env.DB.prepare(`SELECT a.*,u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 12`).all(),
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
    if(request.method==='GET'){const q=cleanText(u.searchParams.get('q'),120);let st=`SELECT * FROM media`,binds=[];if(q){st+=` WHERE filename LIKE ? OR alt_text LIKE ? OR caption LIKE ?`;binds=[`%${q}%`,`%${q}%`,`%${q}%`];}st+=` ORDER BY created_at DESC LIMIT 500`;const rows=await env.DB.prepare(st).bind(...binds).all();return json({ok:true,items:rows.results.map(mediaOut)});}
    if(request.method==='POST'){
      const ct=request.headers.get('content-type')||'';assert(ct.includes('multipart/form-data'),415,'Upload phải dùng multipart/form-data.');const fd=await request.formData(),file=fd.get('file');const v=await validateUpload(file);const id=crypto.randomUUID(),key=mediaKey(id,v.ext);await env.STORAGE.put(key,v.body,{httpMetadata:{contentType:v.mime},customMetadata:{originalName:file.name}});
      const width=Math.max(0,Math.min(30000,Number(fd.get('width')||0)))||null,height=Math.max(0,Math.min(30000,Number(fd.get('height')||0)))||null,t=now();
      const r=await env.DB.prepare(`INSERT INTO media(r2_key,filename,mime_type,size_bytes,width,height,alt_text,caption,credit,focus_x,focus_y,uploaded_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(key,cleanText(file.name,240),v.mime,v.size,width,height,cleanText(fd.get('alt_text'),500),cleanText(fd.get('caption'),1000),cleanText(fd.get('credit'),500),0.5,0.5,user.id,t,t).run();
      await audit(env,user.id,'media.upload','media',r.meta.last_row_id,{mime:v.mime,size:v.size},request);return json({ok:true,item:mediaOut(await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(r.meta.last_row_id).first())},201);
    }
  }
  if(action==='media-item' && p[2]){
    requireFeature(user,'media',write); const id=Number(p[2]);const m=await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(id).first();assert(m,404,'Không tìm thấy media.');
    if(request.method==='GET')return json({ok:true,item:mediaOut(m)});
    if(request.method==='PUT'){const b=await readJson(request);await env.DB.prepare(`UPDATE media SET alt_text=?,caption=?,credit=?,focus_x=?,focus_y=?,updated_at=? WHERE id=?`).bind(cleanText(b.alt_text??m.alt_text,500),cleanText(b.caption??m.caption,1000),cleanText(b.credit??m.credit,500),Math.min(1,Math.max(0,Number(b.focus_x??m.focus_x))),Math.min(1,Math.max(0,Number(b.focus_y??m.focus_y))),now(),id).run();await audit(env,user.id,'media.update','media',id,{},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xóa file media.');const refs=await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM people WHERE photo_media_id=?) + (SELECT COUNT(*) FROM content_items WHERE cover_media_id=?) + (SELECT COUNT(*) FROM forms WHERE cover_media_id=?) AS c`).bind(id,id,id).first();assert(Number(refs.c||0)===0,409,'File đang được nội dung khác sử dụng. Hãy gỡ liên kết trước khi xóa.');await env.STORAGE.delete(m.r2_key);await env.DB.prepare(`DELETE FROM media WHERE id=?`).bind(id).run();await audit(env,user.id,'media.delete','media',id,{filename:m.filename},request);return json({ok:true});}
  }

  if(action==='settings'){
    requireFeature(user,'pages',write);
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT key,value_json,updated_at FROM site_settings ORDER BY key`).all();const groups=Object.fromEntries(rows.results.map(x=>[x.key,asJson(x.value_json,{})]));groups.appearance=sanitizeAppearance(groups.appearance||{});return json({ok:true,groups});}
    if(request.method==='PUT'){
      assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được thay đổi cài đặt.');
      const b=await readJson(request),key=cleanText(b.key||'general',50);
      assert(['general','footer','media','impact','security','cms','appearance'].includes(key),400,'Nhóm cài đặt không hợp lệ.');
      const current=await settingsGet(env,key);let next={...current,...(b.value||{})};
      if(key==='security') next.pbkdf2_iterations=PBKDF2_ITERATIONS;
      if(key==='appearance') next=sanitizeAppearance(next);
      await settingsSet(env,key,next);await audit(env,user.id,'settings.update','system',key,{keys:Object.keys(b.value||{})},request);return json({ok:true,key,value:next});
    }
  }

  if(action==='ctt-sync'){
    assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên mới được quản lý kết nối tra cứu CTT.');
    if(request.method==='GET'){
      const rows=await env.DB.prepare(`SELECT s.id,s.code,s.ctt_sync_status,s.ctt_sync_error,s.ctt_synced_at,q.attempts,q.last_error,q.updated_at AS queue_updated_at FROM form_submissions s LEFT JOIN ctt_sync_queue q ON q.submission_id=s.id WHERE COALESCE(s.ctt_sync_status,'pending') IN ('pending','failed') OR q.submission_id IS NOT NULL ORDER BY s.created_at DESC LIMIT 100`).all();
      const count=await env.DB.prepare(`SELECT COUNT(*) AS count FROM form_submissions WHERE COALESCE(ctt_sync_status,'pending') IN ('pending','failed')`).first();
      let connection_ok=false,connection_error='';
      if(env.CTT_DB){const probe=await inspectCTTSchema(env.CTT_DB);connection_ok=probe.ok;connection_error=probe.error}
      return json({ok:true,binding_available:!!env.CTT_DB,connection_ok,connection_error,pending_count:Number(count?.count||0),items:(rows.results||[]).map(x=>({id:x.id,code:x.code,state:x.ctt_sync_status||'pending',message:x.ctt_sync_error||x.last_error||'',attempts:Number(x.attempts||0),updated_at:x.queue_updated_at||x.ctt_synced_at||null}))});
    }
    if(request.method==='POST'){
      const result=await retryPendingCTTSync(env,100);
      await audit(env,user.id,'ctt.sync.retry','integration','ctt-sync',result,request);
      return json({ok:true,...result,binding_available:!!env.CTT_DB});
    }
    throw new HttpError(405,'Method not allowed');
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
    if(request.method==='POST'){const b=await readJson(request),activityId=Number(b.activity_id);assert(activityId>0,400,'Activity ID không hợp lệ.');const participants=Number(b.confirmed_participants||0),hours=Number(b.volunteer_hours||0),waste=Number(b.waste_tons||0),community=Number(b.community_reached||0),verified=bool(b.verified),notes=cleanText(b.notes,3000);assert([participants,hours,waste,community].every(Number.isFinite),400,'Các chỉ số Impact phải là số hợp lệ.');assert(participants>=0&&participants<=100000000&&hours>=0&&hours<=100000000&&waste>=0&&waste<=1000000&&community>=0&&community<=100000000,400,'Một hoặc nhiều chỉ số Impact nằm ngoài giới hạn cho phép.');assert(!verified||notes.length>=10,400,'Muốn xác minh Impact, hãy ghi ít nhất 10 ký tự về căn cứ xác minh.');const t=now();await env.DB.prepare(`INSERT INTO impact_records(activity_id,locality,confirmed_participants,volunteer_hours,waste_tons,community_reached,completed,verified,notes,verified_by,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(activity_id) DO UPDATE SET locality=excluded.locality,confirmed_participants=excluded.confirmed_participants,volunteer_hours=excluded.volunteer_hours,waste_tons=excluded.waste_tons,community_reached=excluded.community_reached,completed=excluded.completed,verified=excluded.verified,notes=excluded.notes,verified_by=excluded.verified_by,verified_at=excluded.verified_at,updated_at=excluded.updated_at`).bind(activityId,cleanText(b.locality,160),participants,hours,waste,community,bool(b.completed)?1:0,verified?1:0,notes,user.id,verified?t:null,t,t).run();await audit(env,user.id,'impact.upsert','activity',activityId,{verified,waste_tons:waste,community_reached:community},request);return json({ok:true});}
  }

  if(action==='audit' && request.method==='GET'){
    requireFeature(user,'audit');const rows=await env.DB.prepare(`SELECT a.*,u.name AS user_name,u.email AS user_email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 500`).all();return json({ok:true,items:rows.results.map(x=>({...x,metadata:asJson(x.metadata_json,{})}))});
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
    if(request.method==='POST'){const b=await readJson(request),name=cleanText(b.name,200),slug=safeSlug(b.slug||name),t=now();assert(name&&slug,400,'Tên/slug không hợp lệ.');const cover=await assertMediaImage(env,b.cover_media_id),fields=sanitizeFields(b.fields),settings=sanitizeFormSettings(b.settings);assert(fields.some(f=>f.type==='email'&&f.required),400,'Mỗi biểu mẫu cần có trường Email bắt buộc để người đăng ký có thể tra cứu hồ sơ tại CTT.');const r=await env.DB.prepare(`INSERT INTO forms(slug,name,description,kind,status,fields_json,settings_json,cover_media_id,opens_at,closes_at,capacity,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(slug,name,cleanText(b.description,5000),cleanText(b.kind||'general',80),FORM_STATUSES.has(b.status)?b.status:'draft',JSON.stringify(fields),JSON.stringify(settings),cover,b.opens_at||null,b.closes_at||null,b.capacity?Number(b.capacity):null,user.id,user.id,t,t).run();await audit(env,user.id,'form.create','form',r.meta.last_row_id,{slug,field_count:fields.length},request);return json({ok:true,id:r.meta.last_row_id},201);}
  }
  if(action==='form'&&p[2]){
    requireFeature(user,'forms',write);const id=Number(p[2]),old=await env.DB.prepare(`SELECT * FROM forms WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy biểu mẫu.');
    if(request.method==='GET')return json({ok:true,item:{...old,fields:sanitizeFields(asJson(old.fields_json,[])),settings:sanitizeFormSettings(asJson(old.settings_json,{})),cover_url:old.cover_media_id?`/api/media/${old.cover_media_id}`:null}});
    if(request.method==='PUT'){const b=await readJson(request);let cover=old.cover_media_id;if(Object.prototype.hasOwnProperty.call(b,'cover_media_id'))cover=await assertMediaImage(env,b.cover_media_id);const fields=sanitizeFields(b.fields??asJson(old.fields_json,[])),settings=sanitizeFormSettings(b.settings??asJson(old.settings_json,{}));assert(fields.some(f=>f.type==='email'&&f.required),400,'Mỗi biểu mẫu cần có trường Email bắt buộc để người đăng ký có thể tra cứu hồ sơ tại CTT.');await env.DB.prepare(`UPDATE forms SET slug=?,name=?,description=?,kind=?,status=?,fields_json=?,settings_json=?,cover_media_id=?,opens_at=?,closes_at=?,capacity=?,updated_by=?,updated_at=? WHERE id=?`).bind(safeSlug(b.slug||old.slug),cleanText(b.name??old.name,200),cleanText(b.description??old.description,5000),cleanText(b.kind??old.kind,80),FORM_STATUSES.has(b.status)?b.status:old.status,JSON.stringify(fields),JSON.stringify(settings),cover,b.opens_at??old.opens_at,b.closes_at??old.closes_at,b.capacity===null?null:(b.capacity??old.capacity),user.id,now(),id).run();await audit(env,user.id,'form.update','form',id,{field_count:fields.length},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xóa biểu mẫu.');const uploads=await env.DB.prepare(`SELECT r2_key FROM form_uploads WHERE form_id=?`).bind(id).all();for(const x of uploads.results||[]){try{await env.STORAGE.delete(x.r2_key)}catch{}}const c=await env.DB.prepare(`SELECT COUNT(*) c FROM form_submissions WHERE form_id=?`).bind(id).first();await env.DB.prepare(`DELETE FROM forms WHERE id=?`).bind(id).run();await audit(env,user.id,'form.delete','form',id,{deleted_submissions:Number(c.c||0),deleted_uploads:(uploads.results||[]).length},request);return json({ok:true,deleted_submissions:Number(c.c||0)});}
  }

  if(action==='submissions'&&request.method==='GET'){
    requireFeature(user,'submissions');const status=cleanText(u.searchParams.get('status'),30),q=cleanText(u.searchParams.get('q'),120);let sql=`SELECT s.*,f.name AS form_name FROM form_submissions s JOIN forms f ON f.id=s.form_id WHERE 1=1`,binds=[];if(status&&SUBMISSION_STATUSES.has(status)){sql+=` AND s.status=?`;binds.push(status);}if(q){sql+=` AND (s.code LIKE ? OR s.full_name LIKE ? OR s.email LIKE ?)`;binds.push(`%${q}%`,`%${q}%`,`%${q}%`);}sql+=` ORDER BY s.created_at DESC LIMIT 800`;const rows=await env.DB.prepare(sql).bind(...binds).all();return json({ok:true,items:rows.results.map(x=>({...x,answers:asJson(x.answers_json,{})}))});
  }
  if(action==='submission'&&p[2]){
    requireFeature(user,'submissions',write);const id=Number(p[2]),row=await env.DB.prepare(`SELECT s.*,f.name AS form_name,f.fields_json FROM form_submissions s JOIN forms f ON f.id=s.form_id WHERE s.id=?`).bind(id).first();assert(row,404,'Không tìm thấy hồ sơ.');
    if(request.method==='GET'){const ev=await env.DB.prepare(`SELECT e.*,u.name AS actor_name FROM submission_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.submission_id=? ORDER BY e.created_at DESC`).bind(id).all();return json({ok:true,item:{...row,answers:asJson(row.answers_json,{}),fields:sanitizeFields(asJson(row.fields_json,[]))},timeline:ev.results});}
    if(request.method==='PUT'){
      const b=await readJson(request),status=SUBMISSION_STATUSES.has(b.status)?b.status:row.status,note=cleanText(b.internal_notes??row.internal_notes,5000),assignee=b.assignee_id?Number(b.assignee_id):user.id,t=now();
      await env.DB.prepare(`UPDATE form_submissions SET status=?,internal_notes=?,assignee_id=?,updated_at=? WHERE id=?`).bind(status,note,assignee,t,id).run();
      let emailSent=0;if(bool(b.send_email)&&validEmail(row.email)){const msg=cleanText(b.email_message||`Trạng thái hồ sơ ${row.code} đã được cập nhật.`,3000),m=await sendMail(env,{to:row.email,subject:`Cập nhật hồ sơ ${row.code} · Xanh Sky First`,html:`<p>Xin chào ${escapeHtml(row.full_name)},</p><p>${escapeHtml(msg).replace(/\n/g,'<br>')}</p>`});emailSent=m.sent?1:0;}
      await env.DB.prepare(`INSERT INTO submission_events(submission_id,event_type,old_status,new_status,note,actor_user_id,email_sent,created_at) VALUES(?,'status_update',?,?,?,?,?,?)`).bind(id,row.status,status,cleanText(b.event_note||'',2000),user.id,emailSent,t).run();
      const payload=await cttPayloadForSubmission(env,id);let sync={synced:false,error:'Không thể tạo dữ liệu đồng bộ.'};if(payload)sync=await synchronizeOne(env,payload);
      await audit(env,user.id,'submission.update','submission',id,{status,email_sent:!!emailSent,ctt_synced:sync.synced},request);
      return json({ok:true,ctt_synced:sync.synced,ctt_sync_message:sync.synced?'Đã cập nhật trạng thái tại CTT.':sync.error||'Đang chờ đồng bộ trạng thái với CTT.'});
    }
    if(request.method==='DELETE'){
      assert(ADMIN_ROLES.has(user.role),403,'Chỉ quản trị viên được xóa hồ sơ.');
      // Delete the mirrored public record first, so CTT never keeps a stale searchable case.
      assert(env.CTT_DB,503,'Chưa có kết nối CTT. Không thể xóa đồng bộ hồ sơ này.');
      await env.CTT_DB.prepare(`DELETE FROM submissions WHERE code=? AND form_id=? AND json_extract(answers_json,'$.source')='xanh-sky-first' AND CAST(json_extract(answers_json,'$.xanh_submission_id') AS INTEGER)=?`).bind(row.code,CTT_FORM_ID,id).run();
      const uploads=await env.DB.prepare(`SELECT r2_key FROM form_uploads WHERE claimed_submission_id=?`).bind(id).all();for(const x of uploads.results||[]){try{await env.STORAGE.delete(x.r2_key)}catch{}}
      await env.DB.prepare(`DELETE FROM form_submissions WHERE id=?`).bind(id).run();await audit(env,user.id,'submission.delete','submission',id,{code:row.code,deleted_uploads:(uploads.results||[]).length,ctt_record_removed:true},request);return json({ok:true,deleted_uploads:(uploads.results||[]).length});
    }
  }
  if(action==='submission-file'&&p[2]&&request.method==='GET'){
    requireFeature(user,'submissions');const id=Number(p[2]),row=await env.DB.prepare(`SELECT * FROM form_uploads WHERE id=? AND claimed_submission_id IS NOT NULL`).bind(id).first();assert(row,404,'Không tìm thấy tệp hồ sơ.');const obj=await env.STORAGE.get(row.r2_key);assert(obj,404,'Tệp không còn trong storage.');const h=new Headers({'Content-Type':row.mime_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return new Response(obj.body,{headers:h});
  }

  if(action==='contacts'&&request.method==='GET'){
    assert(user.role==='root_admin'||user.role==='administrator',403,'Bạn không có quyền xem liên hệ.');const rows=await env.DB.prepare(`SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 500`).all();return json({ok:true,items:rows.results});
  }
  if(action==='newsletter'&&request.method==='GET'){
    assert(user.role==='root_admin'||user.role==='administrator'||user.role==='content_editor',403,'Bạn không có quyền xem newsletter.');const rows=await env.DB.prepare(`SELECT id,email,preferences_json,status,created_at,updated_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 1000`).all();return json({ok:true,items:rows.results.map(x=>({...x,preferences:asJson(x.preferences_json,[])}))});
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
    return json({ok:false,error:'API route not found'},404);
  } catch (e) { return errorResponse(e); }
}
