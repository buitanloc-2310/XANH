import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root=new URL('..',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');

test('Xanh mirrors real case data for the unchanged CTT code-and-email lookup',async()=>{
  const [api,wrangler]=await Promise.all([read('functions/api/[[path]].js'),read('wrangler.jsonc')]);
  assert.ok(api.includes("const CTT_CASE_BASE = 'https://ctt.skyfirst.io.vn/ho-so'"));
  assert.ok(api.includes("const CTT_FORM_ID = 'xanh-sky-first-integration'"));
  assert.ok(api.includes('env.CTT_DB'));
  assert.ok(api.includes('async function inspectCTTSchema(db)'));
  assert.ok(api.includes('Mỗi biểu mẫu cần có trường Email bắt buộc'));
  assert.ok(api.includes("WHERE code=? LIMIT 1"));
  assert.ok(api.includes("json_extract(answers_json,'$.source')='xanh-sky-first'"));
  assert.ok(api.includes('case_events'));
  assert.ok(api.includes("assert(validEmail(payload.email)"));
  assert.ok(wrangler.includes('"binding": "CTT_DB"'));
  assert.ok(wrangler.includes('a59afb69-f8fd-4c29-8afa-601d2cdfd1ed'));
});

test('CTT sync queue and code registry are durable and four-digit numbers cannot be reused',async()=>{
  const [mig,api]=await Promise.all([read('migrations/0007_appearance_ctt_case_sync.sql'),read('functions/api/[[path]].js')]);
  assert.ok(mig.includes('CREATE TABLE IF NOT EXISTS case_code_registry'));
  assert.ok(mig.includes('number INTEGER PRIMARY KEY CHECK(number BETWEEN 0 AND 9999)'));
  assert.ok(mig.includes('CREATE TABLE IF NOT EXISTS ctt_sync_queue'));
  assert.ok(mig.includes("ALTER TABLE form_submissions ADD COLUMN ctt_sync_status TEXT NOT NULL DEFAULT 'pending'"));
  assert.ok(mig.includes("ctt_sync_status='legacy'"));
  assert.ok(api.includes('async function retryPendingCTTSync'));
  assert.ok(api.includes("action==='ctt-sync'"));
  assert.ok(api.includes("ctt_sync_status='synced'"));
});

test('Xanh public lookup is a CTT handoff, not a second local lookup',async()=>{
  const [app,api]=await Promise.all([read('public/app.js'),read('functions/api/[[path]].js')]);
  assert.ok(app.includes('lookup-handoff'));
  assert.ok(app.includes('https://ctt.skyfirst.io.vn/ho-so'));
  assert.ok(api.includes('LOOKUP_MOVED_TO_CTT'));
  assert.ok(api.includes("},410,{'Cache-Control':'no-store'}"));
});

test('global appearance settings are sanitized on the backend and editable in CMS',async()=>{
  const [app,api,mig,css]=await Promise.all([read('public/app.js'),read('functions/api/[[path]].js'),read('migrations/0007_appearance_ctt_case_sync.sql'),read('public/styles.css')]);
  assert.ok(app.includes('id="appearance-form"'));
  assert.ok(app.includes('id="ctt-retry"'));
  assert.ok(api.includes('function sanitizeAppearance(input)'));
  assert.ok(api.includes("if(key==='appearance') next=sanitizeAppearance(next)"));
  assert.ok(mig.includes("'appearance'"));
  assert.ok(css.includes('Approved Xanh Sky First visual direction'));
});

test('Impact counters support both verified and explicitly labeled manual values',async()=>{
  const [mig,api,app]=await Promise.all([read('migrations/0007_appearance_ctt_case_sync.sql'),read('functions/api/[[path]].js'),read('public/app.js')]);
  assert.ok(mig.includes("ADD COLUMN value_mode TEXT NOT NULL DEFAULT 'verified'"));
  assert.ok(mig.includes('ADD COLUMN manual_value REAL'));
  assert.ok(mig.includes('ADD COLUMN unit_suffix TEXT NOT NULL DEFAULT'));
  assert.ok(api.includes("mode=x.value_mode==='manual'?'manual':'verified'"));
  assert.ok(api.includes('manualValue!==null&&Number.isFinite(manualValue)'));
  assert.ok(app.includes('Số liệu do quản trị viên nhập') || app.includes('source_label'));
  assert.ok(app.includes('name=\"manual_value\"'));
});

test('admin submission list distinguishes CTT sync status and status updates report sync result',async()=>{
  const app=await read('public/app.js');
  assert.ok(app.includes('Tra cứu CTT'));
  assert.ok(app.includes('syncLabel'));
  assert.ok(app.includes('r.ctt_synced'));
});
