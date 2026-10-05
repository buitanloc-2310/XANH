import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root=new URL('..',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');

test('public site uses pathname routes instead of hash-only navigation',async()=>{
  const s=await read('public/app.js');
  for(const route of ["'/con-nguoi'","'/hoat-dong'","'/quyen-rieng-tu'","'/lien-he'"]) assert.ok(s.includes(route));
  assert.ok(!s.includes('href="#gioi-thieu"'));
  assert.ok(!s.includes('href="#tham-gia"'));
});

test('people editor is upload-first and stores photo_media_id',async()=>{
  const [app,api]=await Promise.all([read('public/app.js'),read('functions/api/[[path]].js')]);
  for(const marker of ['Chọn từ Media Library','Tải ảnh từ máy','photo_media_id','remove-photo']) assert.ok(app.includes(marker));
  assert.ok(api.includes('photo_media_id'));
  assert.ok(api.includes('assertMediaImage'));
});

test('form builder is real UI and private uploads exist',async()=>{
  const [app,mig,api]=await Promise.all([read('public/app.js'),read('migrations/0003_production_hardening.sql'),read('functions/api/[[path]].js')]);
  for(const marker of ['fields-builder','field-dup','field-del','require_guardian_consent','confirmation_email']) assert.ok(app.includes(marker));
  assert.ok(mig.includes('CREATE TABLE IF NOT EXISTS form_uploads'));
  assert.ok(api.includes("action === 'form-upload'"));
  assert.ok(api.includes("action==='submission-file'"));
});

test('Resend production variable names are used without MAIL_FROM fallback',async()=>{
  const s=await read('functions/api/[[path]].js');
  assert.ok(s.includes('env.EMAIL_FROM'));
  assert.ok(s.includes('env.EMAIL_REPLY_TO'));
  assert.ok(!s.includes('env.MAIL_FROM'));
});

test('dynamic sitemap function includes indexable people and public content',async()=>{
  const s=await read('functions/sitemap.xml.js');
  assert.ok(s.includes('allow_index=1'));
  assert.ok(s.includes("status IN ('published','open','completed')"));
});
