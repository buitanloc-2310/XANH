import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root=new URL('..',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');

test('action page has its own route and useful pathway rather than reusing the about page', async()=>{
  const app=await read('public/app.js');
  assert.match(app,/async function actionPage\(/);
  assert.match(app,/else if\(path==='\/gioi-thieu'\)app\.innerHTML=await about\(\);else if\(path==='\/hanh-dong'\)app\.innerHTML=await actionPage\(\)/);
  assert.match(app,/LỘ TRÌNH THAM GIA/);
});

test('public API failures are not silently presented as empty lists and impact errors are labeled',async()=>{
  const app=await read('public/app.js');
  assert.match(app,/Chưa thể tải số liệu lúc này/);
  assert.match(app,/Chưa thể tải danh sách lúc này/);
  assert.match(app,/async function listPage\(type\)\{\s*const cfg=publicType\[type\];const items=\(await api/);
});

test('CTT integration has a visible, role-limited Admin panel using existing API',async()=>{
  const [app,api]=await Promise.all([read('public/app.js'),read('functions/api/[[path]].js')]);
  assert.match(app,/ctt:'Đồng bộ CTT'/);
  assert.match(app,/api\/admin\/ctt-integration/);
  assert.match(app,/retry-ctt/);
  assert.match(api,/action==='ctt-integration'&&request\.method==='GET'/);
  assert.match(api,/action==='ctt-integration'&&p\[2\]==='retry'&&request\.method==='POST'/);
});

test('Admin fetch errors do not reflect raw backend errors and offer retry',async()=>{
  const app=await read('public/app.js');
  assert.match(app,/Thông tin lỗi kỹ thuật chi tiết không được hiển thị tại đây/);
  assert.match(app,/retry-admin-module/);
});

test('final UI includes responsive action cards, keyboard focus and reduced-motion support',async()=>{
  const css=await read('public/styles.css');
  assert.match(css,/\.action-path-grid/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});


test('HTML sitemap is derived from actual navigation rather than an undefined variable',async()=>{
  const app=await read('public/app.js');
  assert.match(app,/async function sitemapPage\(\)[\s\S]*?const roots=state\.site\?\.navigation\?\.items\?\.length\?state\.site\.navigation\.items:defaultNav/);
  assert.doesNotMatch(app,/const fixed=\[\.\.\.nav/);
});

test('default CMS submenu URLs match page slugs seeded by project migrations',async()=>{
  const [app,...migrations]=await Promise.all([read('public/app.js'),...Array.from({length:7},(_,i)=>read(`migrations/${String(i+1).padStart(4,'0')}_${['initial','people_forms','production_hardening','seed_hanoi_volunteer_form','form_builder_single_source','navigation_impact_content','ctt_integration_outbox'][i]}.sql`))]);
  const seeded=new Set(migrations.join('\n').match(/VALUES\s*\('([^']+)'\s*,\s*'[^']+'\s*,\s*'published'/gi)?.map(x=>x.match(/VALUES\s*\('([^']+)'/i)?.[1]).filter(Boolean)||[]);
  const navBlock=app.match(/const defaultNav=\[([\s\S]*?)\n\];/);assert.ok(navBlock,'Default navigation definition must be available');
  for(const match of navBlock[1].matchAll(/href:'\/noi-dung\/([a-z0-9-]+)'/g)) assert.ok(seeded.has(match[1]),`Default menu target /noi-dung/${match[1]} must exist in a seed migration`);
});

test('editorial refresh migration is non-destructive and guarded against overwriting CMS edits',async()=>{
  const sql=await read('migrations/0008_content_editorial_refresh.sql');
  const statements=sql.match(/UPDATE pages SET blocks_json=/g)||[];
  assert.equal(statements.length,26,'Expected the homepage and 25 seeded editorial pages to be refreshed');
  assert.match(sql,/WHERE slug='home' AND title=/);
  assert.equal((sql.match(/INSERT INTO page_revisions\(page_id,title,blocks_json,seo_json,created_by,created_at\)/g)||[]).length,26,'Existing revisions must be preserved before updating default copy');
  assert.equal((sql.match(/AND status='published' AND blocks_json=/g)||[]).length,52);
  assert.equal((sql.match(/AND seo_json=/g)||[]).length,52);
  assert.doesNotMatch(sql,/\b(?:CREATE|ALTER|DROP|DELETE)\s+(?:TABLE|INDEX|FROM)\b/i);
  assert.match(sql,/Thông tin về dự án, hoạt động, sáng kiến và tài nguyên môi trường, cộng đồng/);
});

test('public metadata describes the actual site purpose rather than a slogan-only description',async()=>{
  const html=await read('public/index.html');
  assert.match(html,/<title>Xanh Sky First \| Môi trường, cộng đồng và hành động thực tế<\/title>/);
  assert.match(html,/name="description" content="Thông tin về dự án, hoạt động, sáng kiến và tài nguyên môi trường, cộng đồng/);
});

test('Admin image block editor validates CMS media IDs before building preview URLs',async()=>{
  const app=await read('public/app.js');
  assert.ok(app.includes('Number.isInteger(Number(b.media_id))&&Number(b.media_id)>0?`<img class="block-image-preview"'));
  assert.ok(app.includes('Array.isArray(b.media_ids)?b.media_ids:[]'));
  assert.ok(app.includes('safeImageSrc(`/api/media/${Number(id)}`)'));
});
