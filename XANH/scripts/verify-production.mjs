import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(new URL('..', import.meta.url).pathname);
const mustExist = [
  'functions/api/[[path]].js','functions/_lib/crypto.js','functions/_lib/auth.js','functions/_lib/media.js',
  'migrations/0001_initial.sql','public/index.html','public/app.js','public/styles.css','public/assets/xanh-sky-first-logo.png',
  'package.json','wrangler.jsonc','README.md','SECURITY.md','FINAL_ACCEPTANCE.md'
];
let failed = false;
for (const rel of mustExist) {
  try { const s = await stat(resolve(root, rel)); if (!s.isFile()) throw new Error('not file'); }
  catch { console.error(`MISSING: ${rel}`); failed = true; }
}
const all = [];
async function walk(dir){for(const name of await readdir(dir)){const p=resolve(dir,name);const s=await stat(p);if(s.isDirectory()){if(name!=='node_modules')await walk(p)}else all.push(p)}}
await walk(root);
for (const p of all) {
  if (/\.(js|mjs|jsonc|json|md|sql|html|css)$/.test(p)) {
    const t = await readFile(p,'utf8');
    if (t.includes(String(100000 * 2 + 10000))) { console.error(`Unsupported PBKDF2 iteration literal found: ${p}`); failed = true; }
  }
}
const cryptoText = await readFile(resolve(root,'functions/_lib/crypto.js'),'utf8');
if (!/PBKDF2_ITERATIONS\s*=\s*100000/.test(cryptoText)) { console.error('PBKDF2 is not hard-pinned to 100000'); failed = true; }
const wrangler = await readFile(resolve(root,'wrangler.jsonc'),'utf8');
for (const expected of ['"binding": "DB"','"database_name": "xanh"','6445b394-1588-4ef0-b22d-d2e312cfa596','"binding": "STORAGE"','"bucket_name": "xanh"']) {
  if (!wrangler.includes(expected)) { console.error(`Missing Wrangler setting: ${expected}`); failed = true; }
}
if (failed) process.exit(1);
console.log(`Production verification passed (${all.length} files scanned).`);
