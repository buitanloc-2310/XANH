import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
test('Xanh signs and sends minimal submission metadata to CTT with durable outbox',()=>{
  const src=fs.readFileSync(path.join(root,'functions/api/[[path]].js'),'utf8');
  assert.match(src,/signCttPayload/);
  assert.match(src,/X-SFN-Signature/);
  assert.match(src,/ctt_integration_outbox/);
  assert.match(src,/ctt_sync:/);
  assert.match(src,/ctt-integration.*retry/s);
  assert.doesNotMatch(src,/answers_json.*cttPayload/);
});
test('Xanh outbox migration is non-destructive and supports retry status',()=>{
  const sql=fs.readFileSync(path.join(root,'migrations/0007_ctt_integration_outbox.sql'),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS ctt_integration_outbox/);
  assert.match(sql,/UNIQUE/);
  assert.match(sql,/pending.*sent.*failed.*not_configured/s);
  assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM form_submissions|ALTER TABLE form_submissions/i);
});
