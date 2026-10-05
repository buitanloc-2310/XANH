import { json, text, readJson, HttpError, assert, errorResponse, safeSlug, cleanText, requireSameOrigin } from '../_lib/http.js';
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS, randomToken, sha256Hex } from '../_lib/crypto.js';
import { currentUser, requireUser, createSession, sessionCookie, clearSessionCookie, destroySession, audit } from '../_lib/auth.js';
import { validateUpload, mediaKey } from '../_lib/media.js';

const CONTENT_TYPES = new Set(['article','project','activity','opportunity','resource','initiative']);
const ADMIN_ROLES = ['root_admin','administrator'];
const EDIT_ROLES = ['root_admin','administrator','content_editor','project_manager','volunteer_coordinator'];

function routeParts(request) {
  const u = new URL(request.url);
  const p = u.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return { u, p };
}

function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
function now() { return new Date().toISOString(); }
function asJson(textValue, fallback) { try { return JSON.parse(textValue); } catch { return fallback; } }
function contentOut(row) {
  if (!row) return null;
  return { ...row, body: asJson(row.body_json, []), metadata: asJson(row.metadata_json, {}), cover_url: row.cover_media_id ? `/api/media/${row.cover_media_id}` : null };
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

async function settingsGet(env) {
  const row = await env.DB.prepare(`SELECT value_json FROM site_settings WHERE key='general'`).first();
  return asJson(row?.value_json, {});
}

async function sendMail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: 'RESEND_API_KEY chưa được cấu hình' };
  const from = env.MAIL_FROM || 'Xanh Sky First <xanh@skyfirst.io.vn>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html })
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
  const r = await env.DB.prepare(`INSERT INTO users(name,email,password_hash,role,status,created_at,updated_at) VALUES(?,?,?,'root_admin','active',?,?)`)
    .bind(name,email,hash,t,t).run();
  const id = r.meta.last_row_id;
  await audit(env,id,'setup.initialize','system','root_admin',{pbkdf2_iterations:PBKDF2_ITERATIONS},request);
  const user = { id, name, email, role:'root_admin', status:'active' };
  const s = await createSession(env,user,request);
  return json({ ok:true, user, pbkdf2_iterations:PBKDF2_ITERATIONS }, 201, { 'Set-Cookie': sessionCookie(s.token,s.expires) });
}

async function handleAuth(env, request, action) {
  requireSameOrigin(request);
  if (action === 'me' && request.method === 'GET') {
    const u = await currentUser(env,request); return json({ ok:true, user:u ? {id:u.id,name:u.name,email:u.email,role:u.role}:null });
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
    const u=await currentUser(env,request); await destroySession(env,request); if(u) await audit(env,u.id,'auth.logout','user',u.id,{},request);
    return json({ok:true},200,{'Set-Cookie':clearSessionCookie()});
  }
  if (action === 'change-password' && request.method === 'POST') {
    const u=await requireUser(env,request); const b=await readJson(request);
    const full=await env.DB.prepare(`SELECT password_hash FROM users WHERE id=?`).bind(u.id).first();
    assert(await verifyPassword(String(b.current_password||''),full.password_hash),400,'Mật khẩu hiện tại không đúng.');
    const nh=await hashPassword(String(b.new_password||''));
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
      const link=`${origin}/#reset-password?token=${encodeURIComponent(token)}`;
      await sendMail(env,{to:u.email,subject:'Đặt lại mật khẩu Xanh Sky First',html:`<p>Xin chào ${escapeHtml(u.name)},</p><p>Bạn vừa yêu cầu đặt lại mật khẩu. Liên kết này có hiệu lực trong 30 phút:</p><p><a href="${link}">${link}</a></p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`});
    }
    return json({ok:true,message:'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.'});
  }
  if (action === 'reset-password' && request.method === 'POST') {
    await rateLimit(env,request,'reset-confirm',10,3600); const b=await readJson(request); const token=String(b.token||'');
    const th=await sha256Hex(token); const row=await env.DB.prepare(`SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?`).bind(th,now()).first();
    assert(row,400,'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    const ph=await hashPassword(String(b.password||'')); const t=now();
    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET password_hash=?,updated_at=? WHERE id=?`).bind(ph,t,row.user_id),
      env.DB.prepare(`UPDATE password_reset_tokens SET used_at=? WHERE id=?`).bind(t,row.id),
      env.DB.prepare(`DELETE FROM sessions WHERE user_id=?`).bind(row.user_id)
    ]);
    await audit(env,row.user_id,'auth.reset_password','user',row.user_id,{pbkdf2_iterations:PBKDF2_ITERATIONS},request);
    return json({ok:true});
  }
  throw new HttpError(404,'Không tìm thấy API xác thực.');
}

function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function handlePublic(env, request, action, p) {
  const u=new URL(request.url);
  if (action === 'site' && request.method==='GET') {
    const settings=await settingsGet(env);
    const page=await env.DB.prepare(`SELECT * FROM pages WHERE slug='home' AND status='published'`).first();
    return json({ok:true,settings,page:pageOut(page)});
  }
  if (action === 'content' && request.method==='GET') {
    const type=cleanText(u.searchParams.get('type'),30); assert(CONTENT_TYPES.has(type),400,'Loại nội dung không hợp lệ.');
    const rows=await env.DB.prepare(`SELECT c.*,m.filename AS cover_filename FROM content_items c LEFT JOIN media m ON m.id=c.cover_media_id WHERE c.type=? AND c.status IN ('published','open','completed') ORDER BY COALESCE(c.published_at,c.created_at) DESC LIMIT 50`).bind(type).all();
    return json({ok:true,items:rows.results.map(contentOut)});
  }
  if (action === 'item' && request.method==='GET') {
    const type=cleanText(u.searchParams.get('type'),30), slug=cleanText(u.searchParams.get('slug'),140); assert(CONTENT_TYPES.has(type),400,'Loại nội dung không hợp lệ.');
    const row=await env.DB.prepare(`SELECT * FROM content_items WHERE type=? AND slug=? AND status IN ('published','open','completed') LIMIT 1`).bind(type,slug).first();
    assert(row,404,'Không tìm thấy nội dung.'); return json({ok:true,item:contentOut(row)});
  }
  if (action === 'impact' && request.method==='GET') {
    const r=await env.DB.prepare(`SELECT COUNT(DISTINCT CASE WHEN verified=1 AND completed=1 AND locality<>'' THEN locality END) AS localities, COALESCE(SUM(CASE WHEN verified=1 THEN confirmed_participants ELSE 0 END),0) AS participants, COALESCE(SUM(CASE WHEN verified=1 AND completed=1 THEN 1 ELSE 0 END),0) AS completed_activities, COALESCE(SUM(CASE WHEN verified=1 THEN volunteer_hours ELSE 0 END),0) AS volunteer_hours FROM impact_records`).first();
    return json({ok:true,impact:{localities:Number(r.localities||0),participants:Number(r.participants||0),completed_activities:Number(r.completed_activities||0),volunteer_hours:Number(r.volunteer_hours||0)}} ,200,{'Cache-Control':'public, max-age=300'});
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
    const origin=new URL(request.url).origin; const link=`${origin}/api/public/newsletter-verify?token=${encodeURIComponent(verify)}&email=${encodeURIComponent(email)}`;
    await sendMail(env,{to:email,subject:'Xác nhận nhận newsletter Xanh Sky First',html:`<p>Vui lòng xác nhận đăng ký newsletter:</p><p><a href="${link}">Xác nhận email</a></p>`});
    return json({ok:true,message:'Vui lòng kiểm tra email để xác nhận đăng ký.'},201);
  }
  if (action === 'newsletter-verify' && request.method==='GET') {
    const email=cleanText(u.searchParams.get('email'),200).toLowerCase(), token=String(u.searchParams.get('token')||''), th=await sha256Hex(token);
    const r=await env.DB.prepare(`UPDATE newsletter_subscribers SET status='active',verify_token_hash=NULL,updated_at=? WHERE email=? AND verify_token_hash=?`).bind(now(),email,th).run();
    return new Response((r.meta.changes||0)>0?'Đã xác nhận newsletter Xanh Sky First.':'Liên kết xác nhận không hợp lệ.',{status:(r.meta.changes||0)>0?200:400,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
  if (action === 'apply' && request.method==='POST') {
    await rateLimit(env,request,'apply',10,3600); const b=await readJson(request); const name=cleanText(b.full_name,120),email=cleanText(b.email,200).toLowerCase(),phone=cleanText(b.phone,40),kind=cleanText(b.kind,50);
    assert(name.length>=2 && validEmail(email) && kind,400,'Thông tin đăng ký chưa đầy đủ.'); const code=`XSF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`; const t=now();
    await env.DB.prepare(`INSERT INTO applications(kind,reference_id,code,full_name,email,phone,payload_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'new',?,?)`).bind(kind,b.reference_id||null,code,name,email,phone,JSON.stringify(b.payload||{}),t,t).run();
    return json({ok:true,code,message:'Đăng ký đã được ghi nhận.'},201);
  }
  throw new HttpError(404,'Không tìm thấy API công khai.');
}

async function handleMedia(env, request, idPart) {
  if (request.method!=='GET' && request.method!=='HEAD') throw new HttpError(405,'Method not allowed');
  const id=Number(idPart); assert(Number.isInteger(id)&&id>0,400,'Media ID không hợp lệ.');
  const row=await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(id).first(); assert(row,404,'Không tìm thấy media.');
  const obj=await env.STORAGE.get(row.r2_key); assert(obj,404,'File media không còn tồn tại trong storage.');
  const headers=new Headers(); headers.set('Content-Type',row.mime_type); headers.set('Cache-Control','public, max-age=31536000, immutable'); headers.set('ETag',obj.httpEtag || ''); headers.set('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`); headers.set('X-Content-Type-Options','nosniff');
  return new Response(request.method==='HEAD'?null:obj.body,{headers});
}

async function handleAdmin(env, request, action, p) {
  requireSameOrigin(request);
  const user=await requireUser(env,request,EDIT_ROLES); const u=new URL(request.url);
  if (action==='dashboard' && request.method==='GET') {
    const [apps,content,drafts,media,impact,auditRows]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS c FROM applications WHERE status IN ('new','reviewing','needs_info')`).first(),
      env.DB.prepare(`SELECT type,COUNT(*) AS c FROM content_items GROUP BY type`).all(),
      env.DB.prepare(`SELECT COUNT(*) AS c FROM content_items WHERE status='draft'`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS c FROM media`).first(),
      env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN verified=1 THEN confirmed_participants ELSE 0 END),0) AS participants, COALESCE(SUM(CASE WHEN verified=1 THEN volunteer_hours ELSE 0 END),0) AS hours FROM impact_records`).first(),
      env.DB.prepare(`SELECT a.*,u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 12`).all()
    ]);
    return json({ok:true,stats:{pending_applications:Number(apps.c||0),drafts:Number(drafts.c||0),media:Number(media.c||0),participants:Number(impact.participants||0),volunteer_hours:Number(impact.hours||0),content:Object.fromEntries(content.results.map(x=>[x.type,Number(x.c)]))},recent:auditRows.results});
  }
  if (action==='pages') {
    if(request.method==='GET') { const rows=await env.DB.prepare(`SELECT * FROM pages ORDER BY updated_at DESC`).all(); return json({ok:true,items:rows.results.map(pageOut)}); }
    if(request.method==='POST') { const b=await readJson(request), title=cleanText(b.title,200), slug=safeSlug(b.slug||title); assert(title&&slug,400,'Tiêu đề/slug không hợp lệ.'); const t=now(); const r=await env.DB.prepare(`INSERT INTO pages(slug,title,status,blocks_json,seo_json,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(slug,title,b.status==='published'?'published':'draft',JSON.stringify(b.blocks||[]),JSON.stringify(b.seo||{}),user.id,user.id,t,t).run(); await audit(env,user.id,'page.create','page',r.meta.last_row_id,{slug},request); return json({ok:true,id:r.meta.last_row_id},201); }
  }
  if (action==='page' && p[2]) {
    const id=Number(p[2]); assert(id>0,400,'Page ID không hợp lệ.');
    if(request.method==='GET'){const row=await env.DB.prepare(`SELECT * FROM pages WHERE id=?`).bind(id).first();assert(row,404,'Không tìm thấy trang.');return json({ok:true,item:pageOut(row)});}
    if(request.method==='PUT'){const b=await readJson(request); const old=await env.DB.prepare(`SELECT * FROM pages WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy trang.');
      await env.DB.prepare(`INSERT INTO page_revisions(page_id,title,blocks_json,seo_json,created_by,created_at) VALUES(?,?,?,?,?,?)`).bind(id,old.title,old.blocks_json,old.seo_json,user.id,now()).run();
      const title=cleanText(b.title||old.title,200), status=['draft','published','archived'].includes(b.status)?b.status:old.status, pub=status==='published'?(old.published_at||now()):old.published_at;
      await env.DB.prepare(`UPDATE pages SET title=?,status=?,blocks_json=?,seo_json=?,published_at=?,updated_by=?,updated_at=? WHERE id=?`).bind(title,status,JSON.stringify(b.blocks||[]),JSON.stringify(b.seo||{}),pub,user.id,now(),id).run();
      await audit(env,user.id,'page.update','page',id,{status},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.includes(user.role),403,'Chỉ quản trị viên được xóa trang.');await env.DB.prepare(`DELETE FROM pages WHERE id=? AND slug<>'home'`).bind(id).run();await audit(env,user.id,'page.delete','page',id,{},request);return json({ok:true});}
  }
  if (action==='content') {
    if(request.method==='GET'){const type=cleanText(u.searchParams.get('type'),30);let q=`SELECT * FROM content_items`;let b=[];if(type){assert(CONTENT_TYPES.has(type),400,'Loại nội dung không hợp lệ.');q+=` WHERE type=?`;b=[type];}q+=` ORDER BY updated_at DESC LIMIT 200`;const rows=await env.DB.prepare(q).bind(...b).all();return json({ok:true,items:rows.results.map(contentOut)});}
    if(request.method==='POST'){const b=await readJson(request),type=cleanText(b.type,30);assert(CONTENT_TYPES.has(type),400,'Loại nội dung không hợp lệ.');const title=cleanText(b.title,220),slug=safeSlug(b.slug||title);assert(title&&slug,400,'Tiêu đề/slug không hợp lệ.');const t=now(),status=['draft','published','open','closed','completed','reviewing'].includes(b.status)?b.status:'draft';
      const r=await env.DB.prepare(`INSERT INTO content_items(type,slug,title,excerpt,body_json,cover_media_id,status,category,location,starts_at,ends_at,capacity,metadata_json,published_at,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(type,slug,title,cleanText(b.excerpt,1000),JSON.stringify(b.body||[]),b.cover_media_id||null,status,cleanText(b.category,100),cleanText(b.location,160),b.starts_at||null,b.ends_at||null,b.capacity||null,JSON.stringify(b.metadata||{}),['published','open','completed'].includes(status)?t:null,user.id,user.id,t,t).run(); await audit(env,user.id,'content.create',type,r.meta.last_row_id,{slug,status},request);return json({ok:true,id:r.meta.last_row_id},201);}
  }
  if(action==='content-item' && p[2]){
    const id=Number(p[2]);assert(id>0,400,'ID không hợp lệ.'); const old=await env.DB.prepare(`SELECT * FROM content_items WHERE id=?`).bind(id).first();assert(old,404,'Không tìm thấy nội dung.');
    if(request.method==='GET')return json({ok:true,item:contentOut(old)});
    if(request.method==='PUT'){const b=await readJson(request),status=['draft','published','open','closed','completed','reviewing','archived'].includes(b.status)?b.status:old.status,title=cleanText(b.title||old.title,220),slug=safeSlug(b.slug||old.slug); const pub=['published','open','completed'].includes(status)?(old.published_at||now()):old.published_at;
      await env.DB.prepare(`UPDATE content_items SET slug=?,title=?,excerpt=?,body_json=?,cover_media_id=?,status=?,category=?,location=?,starts_at=?,ends_at=?,capacity=?,metadata_json=?,published_at=?,updated_by=?,updated_at=? WHERE id=?`).bind(slug,title,cleanText(b.excerpt??old.excerpt,1000),JSON.stringify(b.body??asJson(old.body_json,[])),b.cover_media_id??old.cover_media_id,status,cleanText(b.category??old.category,100),cleanText(b.location??old.location,160),b.starts_at??old.starts_at,b.ends_at??old.ends_at,b.capacity??old.capacity,JSON.stringify(b.metadata??asJson(old.metadata_json,{})),pub,user.id,now(),id).run();await audit(env,user.id,'content.update',old.type,id,{status},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.includes(user.role)||user.role==='content_editor',403,'Bạn không có quyền xóa nội dung.');await env.DB.prepare(`DELETE FROM content_items WHERE id=?`).bind(id).run();await audit(env,user.id,'content.delete',old.type,id,{},request);return json({ok:true});}
  }
  if(action==='media'){
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT * FROM media ORDER BY created_at DESC LIMIT 300`).all();return json({ok:true,items:rows.results.map(mediaOut)});}
    if(request.method==='POST'){const ct=request.headers.get('content-type')||'';assert(ct.includes('multipart/form-data'),415,'Upload phải dùng multipart/form-data.');const fd=await request.formData(),file=fd.get('file');const v=await validateUpload(file);const id=crypto.randomUUID(),key=mediaKey(id,v.ext);await env.STORAGE.put(key,v.body,{httpMetadata:{contentType:v.mime},customMetadata:{originalName:file.name}});const t=now();const r=await env.DB.prepare(`INSERT INTO media(r2_key,filename,mime_type,size_bytes,alt_text,caption,credit,focus_x,focus_y,uploaded_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(key,cleanText(file.name,240),v.mime,v.size,cleanText(fd.get('alt_text'),500),cleanText(fd.get('caption'),1000),cleanText(fd.get('credit'),500),0.5,0.5,user.id,t,t).run();await audit(env,user.id,'media.upload','media',r.meta.last_row_id,{mime:v.mime,size:v.size},request);return json({ok:true,item:mediaOut(await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(r.meta.last_row_id).first())},201);}
  }
  if(action==='media-item' && p[2]){
    const id=Number(p[2]);const m=await env.DB.prepare(`SELECT * FROM media WHERE id=?`).bind(id).first();assert(m,404,'Không tìm thấy media.');
    if(request.method==='PUT'){const b=await readJson(request);await env.DB.prepare(`UPDATE media SET alt_text=?,caption=?,credit=?,focus_x=?,focus_y=?,updated_at=? WHERE id=?`).bind(cleanText(b.alt_text??m.alt_text,500),cleanText(b.caption??m.caption,1000),cleanText(b.credit??m.credit,500),Math.min(1,Math.max(0,Number(b.focus_x??m.focus_x))),Math.min(1,Math.max(0,Number(b.focus_y??m.focus_y))),now(),id).run();await audit(env,user.id,'media.update','media',id,{},request);return json({ok:true});}
    if(request.method==='DELETE'){assert(ADMIN_ROLES.includes(user.role),403,'Chỉ quản trị viên được xóa file media.');await env.STORAGE.delete(m.r2_key);await env.DB.prepare(`DELETE FROM media WHERE id=?`).bind(id).run();await audit(env,user.id,'media.delete','media',id,{filename:m.filename},request);return json({ok:true});}
  }
  if(action==='settings'){
    if(request.method==='GET')return json({ok:true,settings:await settingsGet(env)});
    if(request.method==='PUT'){assert(ADMIN_ROLES.includes(user.role),403,'Chỉ quản trị viên được thay đổi cài đặt.');const b=await readJson(request);const current=await settingsGet(env);const next={...current,...b};await env.DB.prepare(`INSERT INTO site_settings(key,value_json,updated_at) VALUES('general',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).bind(JSON.stringify(next),now()).run();await audit(env,user.id,'settings.update','system','general',{keys:Object.keys(b)},request);return json({ok:true,settings:next});}
  }
  if(action==='applications'){
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT * FROM applications ORDER BY created_at DESC LIMIT 300`).all();return json({ok:true,items:rows.results.map(x=>({...x,payload:asJson(x.payload_json,{})}))});}
  }
  if(action==='application' && p[2] && request.method==='PUT'){const id=Number(p[2]),b=await readJson(request),status=['new','reviewing','needs_info','approved','rejected','completed'].includes(b.status)?b.status:null;assert(status,400,'Trạng thái không hợp lệ.');await env.DB.prepare(`UPDATE applications SET status=?,internal_notes=?,assignee_id=?,updated_at=? WHERE id=?`).bind(status,cleanText(b.internal_notes,5000),b.assignee_id||user.id,now(),id).run();await audit(env,user.id,'application.update','application',id,{status},request);return json({ok:true});}
  if(action==='impact'){
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT i.*,c.title AS activity_title FROM impact_records i LEFT JOIN content_items c ON c.id=i.activity_id ORDER BY i.updated_at DESC`).all();return json({ok:true,items:rows.results});}
    if(request.method==='POST'){assert(['root_admin','administrator','project_manager'].includes(user.role),403,'Bạn không có quyền xác nhận impact.');const b=await readJson(request),activityId=Number(b.activity_id);assert(activityId>0,400,'Activity ID không hợp lệ.');const t=now();await env.DB.prepare(`INSERT INTO impact_records(activity_id,locality,confirmed_participants,volunteer_hours,completed,verified,notes,verified_by,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(activity_id) DO UPDATE SET locality=excluded.locality,confirmed_participants=excluded.confirmed_participants,volunteer_hours=excluded.volunteer_hours,completed=excluded.completed,verified=excluded.verified,notes=excluded.notes,verified_by=excluded.verified_by,verified_at=excluded.verified_at,updated_at=excluded.updated_at`).bind(activityId,cleanText(b.locality,160),Math.max(0,Number(b.confirmed_participants||0)),Math.max(0,Number(b.volunteer_hours||0)),b.completed?1:0,b.verified?1:0,cleanText(b.notes,3000),user.id,b.verified?t:null,t,t).run();await audit(env,user.id,'impact.upsert','activity',activityId,{verified:!!b.verified},request);return json({ok:true});}
  }
  if(action==='audit' && request.method==='GET'){assert(ADMIN_ROLES.includes(user.role)||user.role==='viewer',403,'Bạn không có quyền xem audit.');const rows=await env.DB.prepare(`SELECT a.*,u.name AS user_name,u.email AS user_email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 300`).all();return json({ok:true,items:rows.results.map(x=>({...x,metadata:asJson(x.metadata_json,{})}))});}
  if(action==='users'){
    assert(ADMIN_ROLES.includes(user.role),403,'Chỉ quản trị viên được quản lý người dùng.');
    if(request.method==='GET'){const rows=await env.DB.prepare(`SELECT id,name,email,role,status,created_at,updated_at,last_login_at FROM users ORDER BY created_at DESC`).all();return json({ok:true,items:rows.results});}
    if(request.method==='POST'){const b=await readJson(request),name=cleanText(b.name,120),email=cleanText(b.email,200).toLowerCase(),role=['administrator','content_editor','project_manager','volunteer_coordinator','viewer'].includes(b.role)?b.role:'viewer';assert(name.length>=2&&validEmail(email),400,'Thông tin người dùng không hợp lệ.');const ph=await hashPassword(String(b.password||'')),t=now();const r=await env.DB.prepare(`INSERT INTO users(name,email,password_hash,role,status,created_at,updated_at) VALUES(?,?,?,?, 'active',?,?)`).bind(name,email,ph,role,t,t).run();await audit(env,user.id,'user.create','user',r.meta.last_row_id,{role,pbkdf2_iterations:PBKDF2_ITERATIONS},request);return json({ok:true,id:r.meta.last_row_id},201);}
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
    if (p[0] === 'public') return await handlePublic(env,request,p[1],p);
    if (p[0] === 'media') return await handleMedia(env,request,p[1]);
    if (p[0] === 'admin') return await handleAdmin(env,request,p[1],p);
    return json({ok:false,error:'API route not found'},404);
  } catch (e) { return errorResponse(e); }
}
