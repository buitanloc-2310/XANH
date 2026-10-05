import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const root = resolve(new URL('..', import.meta.url).pathname);
const mustExist = [
  'functions/api/[[path]].js','functions/sitemap.xml.js','functions/_lib/crypto.js','functions/_lib/auth.js','functions/_lib/media.js',
  'migrations/0001_initial.sql','migrations/0002_people_forms.sql','migrations/0003_production_hardening.sql',
  'public/index.html','public/app.js','public/styles.css','public/sw.js','public/assets/xanh-sky-first-logo.png',
  'package.json','wrangler.jsonc','README.md','SECURITY.md','FINAL_ACCEPTANCE.md'
];
let failed = false;
for (const rel of mustExist) {
  try { const s = await stat(resolve(root, rel)); if (!s.isFile()) throw new Error('not file'); }
  catch { console.error(`MISSING: ${rel}`); failed = true; }
}
const all = [];
async function walk(dir){for(const name of await readdir(dir)){const p=resolve(dir,name);const s=await stat(p);if(s.isDirectory()){if(!['node_modules','.git'].includes(name))await walk(p)}else all.push(p)}}
await walk(root);
const forbiddenIterations=String(100000*2+10000);
for (const p of all) {
  if (/\.(js|mjs|jsonc|json|md|sql|html|css|txt)$/.test(p)) {
    const t = await readFile(p,'utf8');
    if (t.includes(forbiddenIterations)) { console.error(`Forbidden PBKDF2 iteration literal found: ${relative(root,p)}`); failed = true; }
  }
}
const cryptoText = await readFile(resolve(root,'functions/_lib/crypto.js'),'utf8');
if (!/PBKDF2_ITERATIONS\s*=\s*100000/.test(cryptoText)) { console.error('PBKDF2 is not hard-pinned to 100000'); failed = true; }
const wrangler = await readFile(resolve(root,'wrangler.jsonc'),'utf8');
for (const expected of ['"binding": "DB"','"database_name": "xanh"','6445b394-1588-4ef0-b22d-d2e312cfa596','"binding": "STORAGE"','"bucket_name": "xanh"']) {
  if (!wrangler.includes(expected)) { console.error(`Missing Wrangler setting: ${expected}`); failed = true; }
}
const app = await readFile(resolve(root,'public/app.js'),'utf8');
for(const bad of ['href="#gioi-thieu"','href="#tham-gia"','Coming soon']){
  if(app.includes(bad)){console.error(`Forbidden production placeholder found: ${bad}`);failed=true;}
}
const api = await readFile(resolve(root,'functions/api/[[path]].js'),'utf8');
if(api.includes('env.MAIL_FROM')){console.error('Legacy MAIL_FROM fallback still present');failed=true;}
if(!api.includes('photo_media_id')||!app.includes('Chọn từ Media Library')||!app.includes('Tải ảnh từ máy')){console.error('People upload-first flow missing');failed=true;}
if (failed) process.exit(1);
console.log(`Production verification passed (${all.length} files scanned).`);
