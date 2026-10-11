import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
test('WordPress Tổng is a unified CMS hub over existing modules, restricted to administrator roles',async()=>{
 const app=await readFile(resolve(root,'public/app.js'),'utf8');
 assert.match(app,/root_admin:\['dashboard','wordpress'/);
 assert.match(app,/administrator:\['dashboard','wordpress'/);
 assert.doesNotMatch(app,/content_editor:\['dashboard','wordpress'/);
 assert.match(app,/async function wordpressAdmin\(\)/);
 for(const key of ['pages','articles','navigation','media','settings','impact']) assert.ok(app.includes(`['${key}',`),`missing CMS tile: ${key}`);
 assert.match(app,/đây không phải một WordPress độc lập/);
 assert.match(await readFile(resolve(root,'public/styles.css'),'utf8'),/\.wp-hub-grid/);
});


test('WordPress Tổng reports API errors instead of disguising them as empty data and summarizes publish states',async()=>{
 const app=await readFile(resolve(root,'public/app.js'),'utf8');
 const hub=app.match(/async function wordpressAdmin\(\)[\s\S]*?\n\}\nasync function admin/)[0];
 assert.match(hub,/Promise\.allSettled/);
 assert.match(hub,/Không tải được/);
 assert.match(hub,/wp-hub-errors/);
 assert.match(hub,/statusPublished/);
 assert.match(hub,/statusDraft/);
 assert.match(hub,/\['forms','Biểu mẫu & tiếp nhận'/);
 assert.match(hub,/\['audit','Nhật ký & kiểm soát'/);
 assert.doesNotMatch(hub,/catch\{\}/);
 const css=await readFile(resolve(root,'public/styles.css'),'utf8');
 assert.match(css,/\.wp-hub-errors\{/);
});
