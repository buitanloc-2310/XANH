import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root=new URL('..',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
test('public site uses real routes instead of hash sections',async()=>{const s=await read('public/app.js');assert.ok(s.includes("'/con-nguoi'"));assert.ok(s.includes("'/quyen-rieng-tu'"));assert.ok(!s.includes('href="#gioi-thieu"'));});
test('people and form builder migration exists',async()=>{const s=await read('migrations/0002_people_forms.sql');for(const t of ['people','forms','form_submissions'])assert.ok(s.includes(`CREATE TABLE IF NOT EXISTS ${t}`));});
test('Resend production variable names are supported',async()=>{const s=await read('functions/api/[[path]].js');assert.ok(s.includes('env.EMAIL_FROM'));assert.ok(s.includes('env.EMAIL_REPLY_TO'));});
