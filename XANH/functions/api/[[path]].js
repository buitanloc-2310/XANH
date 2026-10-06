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
  const r = await env.DB.prepare(`INSERT INTO users(name,email,password_hash,role,status,created_at,updated_at) VALUES(?,?,?,'root_admin','active',?,?)`).bind(name,email,hash,t,t).run();
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
    const settings=await settingsGet(env);
    const page=await env.DB.prepare(`SELECT * FROM pages WHERE slug='home' AND status='published'`).first();
    return json({ok:true,settings,page:pageOut(page)});
  }
  if (action === 'page' && request.method==='GET') {
    const slug=safeSlug(u.searchParams.get('slug'));
    const row=await env.DB.prepare(`SELECT * FROM pages WHERE slug=? AND status='published' LIMIT 1`).bind(slug).first();
    assert(row,404,'Không tìm thấy trang.');
    return json({ok:true,item:pageOut(row)});
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
    const r=await env.DB.prepare(`SELECT COUNT(DISTINCT CASE WHEN verified=1 AND completed=1 AND locality<>'' THEN locality END) AS localities, COALESCE(SUM(CASE WHEN verified=1 THEN confirmed_participants ELSE 0 END),0) AS participants, COALESCE(SUM(CASE WHEN verified=1 AND completed=1 THEN 1 ELSE 0 END),0) AS completed_activities, COALESCE(SUM(CASE WHEN verified=1 THEN volunteer_hours ELSE 0 END),0) AS volunteer_hours FROM impact_records`).first();
    return json({ok:true,impact:{localities:Number(r.localities||0),participants:Number(r.participants||0),completed_activities:Number(r.completed_activities||0),volunteer_hours:Number(r.volunteer_hours||0)}},200,{'Cache-Control':'public, max-age=300'});
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
    await sendMail(env,{to:email,subject:'Xác nhận nhận newsletter Xanh Sky First',html:`<p>Vui lòng xác nhận đăng ký newsletter:</p><p><a href="${link}">Xác nhận email</a></p>`});
    return json({ok:true,message:'Vui lòng kiểm tra email để xác nhận đăng ký.'},201);
  }
  if (action === 'newsletter-verify' && request.method==='GET') {
    const email=cleanText(u.searchParams.get('email'),200).toLowerCase(), token=String(u.searchParams.get('token')||''), th=await sha256Hex(token);
    const r=await env.DB.prepare(`UPDATE newsletter_subscribers SET status='active',verify_token_hash=NULL,updated_at=? WHERE email=? AND verify_token_hash=?`).bind(now(),email,th).run();
    return new Response((r.meta.changes||0)>0?'Đã xác nhận newsletter Xanh Sky First.':'Liên kết xác nhận không hợp lệ.',{status:(r.meta.changes||0)>0?200:400,headers:{'Content-Type':'text/plain; charset=utf-8'}});
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
    await rateLimit(env,request,'submission-lookup',30,3600);
    const code=cleanText(u.searchParams.get('code'),80).toUpperCase();
    assert(code.length>=8,400,'Vui lòng nhập mã hồ sơ hợp lệ.');
    const row=await env.DB.prepare(`SELECT s.code,s.status,s.created_at,s.updated_at,f.name AS form_name FROM form_submissions s JOIN forms f ON f.id=s.form_id WHERE UPPER(s.code)=? LIMIT 1`).bind(code).first();
    assert(row,404,'Không tìm thấy hồ sơ với mã này.');
    return json({ok:true,item:row});
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
      const up=await env.DB.prepare(`SELECT id FROM form_uploads WHERE form_id=? AND upload_token_hash=? AND claimed_submission_id IS NULL`).bind(form.id,th).first();
      assert(up,400,`Tệp tại “${f.label}” không hợp lệ hoặc đã được sử dụng.`);
      claimedUploads.push(up.id); answers[f.id].upload_id=up.id; delete answers[f.id].upload_token;
    }
    const code=`XSF-${Date.now().toString(36).toUpperCase()}-${randomToken(3).slice(0,4).toUpperCase()}`,t=now();
    const r=await env.DB.prepare(`INSERT INTO form_submissions(form_id,code,full_name,email,phone,answers_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'new',?,?)`).bind(form.id,code,name,email,phone,JSON.stringify(answers),t,t).run();
    const sid=r.meta.last_row_id;
    for(const uploadId of claimedUploads) await env.DB.prepare(`UPDATE form_uploads SET claimed_submission_id=? WHERE id=? AND claimed_submission_id IS NULL`).bind(sid,uploadId).run();
    await env.DB.prepare(`INSERT INTO submission_events(submission_id,event_type,new_status,note,created_at) VALUES(?,'created','new','Hồ sơ được gửi từ website',?)`).bind(sid,t).run();
    let emailSent=false;
    if(settings.confirmation_email&&validEmail(email)){const m=await sendMail(env,{to:email,subject:`Xác nhận hồ sơ ${code} · Xanh Sky First`,html:`<p>Xin chào ${escapeHtml(name)},</p><p>Xanh Sky First đã nhận hồ sơ của bạn cho <b>${escapeHtml(form.name)}</b>.</p><p>Mã hồ sơ: <b>${code}</b></p><p>${escapeHtml(settings.confirmation_message)}</p>`}); emailSent=!!m.sent;}
    if(emailSent) await env.DB.prepare(`UPDATE submission_events SET email_sent=1 WHERE submission_id=? AND event_type='created'`).bind(sid).run();
    return json({ok:true,code,message:settings.confirmation_message,title:settings.confirmation_title},201);
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

async function handleAdmin(env, request, action, p) {
  requireSameOrigin(request);
  const user=await requireUser(env,request); const u=new URL(request.url), write=request.method!=='GET';
  assert(USER_ROLES.has(user.role),403,'Vai trò tài khoản không hợp lệ.');

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
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT key,value_json,updated_at FROM site_settings ORDER BY key`).all();return json({ok:true,groups:Object.fromEntries(rows.results.map(x=>[x.key,asJson(x.value_json,{})]))});}
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
    if(request.method==='POST'){const b=await readJson(request),activityId=Number(b.activity_id);assert(activityId>0,400,'Activity ID không hợp lệ.');const t=now();await env.DB.prepare(`INSERT INTO impact_records(activity_id,locality,confirmed_participants,volunteer_hours,completed,verified,notes,verified_by,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(activity_id) DO UPDATE SET locality=excluded.locality,confirmed_participants=excluded.confirmed_participants,volunteer_hours=excluded.volunteer_hours,completed=excluded.completed,verified=excluded.verified,notes=excluded.notes,verified_by=excluded.verified_by,verified_at=excluded.verified_at,updated_at=excluded.updated_at`).bind(activityId,cleanText(b.locality,160),Math.max(0,Number(b.confirmed_participants||0)),Math.max(0,Number(b.volunteer_hours||0)),bool(b.completed)?1:0,bool(b.verified)?1:0,cleanText(b.notes,3000),user.id,bool(b.verified)?t:null,t,t).run();await audit(env,user.id,'impact.upsert','activity',activityId,{verified:bool(b.verified)},request);return json({ok:true});}
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
    if(request.method==='POST'){const b=await readJson(request),name=cleanText(b.name,200),slug=safeSlug(b.slug||name),t=now();assert(name&&slug,400,'Tên/slug không hợp lệ.');const cover=await assertMediaImage(env,b.cover_media_id),fields=sanitizeFields(b.fields),settings=sanitizeFormSettings(b.settings);const r=await env.DB.prepare(`INSERT INTO forms(slug,name,description,kind,status,fields_json,settings_json,cover_media_id,opens_at,closes_at,capacity,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(slug,name,cleanText(b.description,5000),cleanText(b.kind||'general',80),FORM_STATUSES.has(b.status)?b.status:'draft',JSON.stringify(fields),JSON.stringify(settings),cover,b.opens_at||null,b.closes_at||null,b.capacity?Number(b.capacity):null,user.id,user.id,t,t).run();await audit(env,user.id,'form.create','form',r.meta.last_row_id,{slug,field_count:fields.length},request);return json({ok:true,id:r.meta.last_row_id},201);}
  }
  if(action==='form'&&p[2]){
    requireFeature(user,'forms',write);const id=Number(p[2]),old=await env.DB.prepare(`SELECT * FROM forms WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy biểu mẫu.');
    if(request.method==='GET')return json({ok:true,item:{...old,fields:sanitizeFields(asJson(old.fields_json,[])),settings:sanitizeFormSettings(asJson(old.settings_json,{})),cover_url:old.cover_media_id?`/api/media/${old.cover_media_id}`:null}});
    if(request.method==='PUT'){const b=await readJson(request);let cover=old.cover_media_id;if(Object.prototype.hasOwnProperty.call(b,'cover_media_id'))cover=await assertMediaImage(env,b.cover_media_id);const fields=sanitizeFields(b.fields??asJson(old.fields_json,[])),settings=sanitizeFormSettings(b.settings??asJson(old.settings_json,{}));await env.DB.prepare(`UPDATE forms SET slug=?,name=?,description=?,kind=?,status=?,fields_json=?,settings_json=?,cover_media_id=?,opens_at=?,closes_at=?,capacity=?,updated_by=?,updated_at=? WHERE id=?`).bind(safeSlug(b.slug||old.slug),cleanText(b.name??old.name,200),cleanText(b.description??old.description,5000),cleanText(b.kind??old.kind,80),FORM_STATUSES.has(b.status)?b.status:old.status,JSON.stringify(fields),JSON.stringify(settings),cover,b.opens_at??old.opens_at,b.closes_at??old.closes_at,b.capacity===null?null:(b.capacity??old.capacity),user.id,now(),id).run();await audit(env,user.id,'form.update','form',id,{field_count:fields.length},request);return json({ok:true});}
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
