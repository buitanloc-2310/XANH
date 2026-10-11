import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);

test('WordPress Tổng is an in-place CMS workspace over the existing CMS APIs',async()=>{
 const app=await readFile(resolve(root,'public/app.js'),'utf8');
 assert.match(app,/root_admin:\['dashboard','wordpress'/);
 assert.match(app,/administrator:\['dashboard','wordpress'/);
 assert.match(app,/async function wordpressAdmin\(\)/);
 assert.match(app,/function wordpressFrame\(inner\)/);
 for(const section of ['overview','pages','content','navigation','media','appearance','impact','forms','seo']) assert.ok(app.includes(`${section}:{label:`),`missing in-place workspace section: ${section}`);
 assert.match(app,/data-wp-section/);
 assert.match(app,/data-wp-content-type/);
 assert.match(app,/Chỉnh sửa ngay trong khu vực này/);
 assert.match(app,/CMS và D1\/R2 hiện có/);
 assert.doesNotMatch(app,/async function wordpressAdmin\(\)[\s\S]*?<a class="wp-hub-card" data-nav href="\/admin\//);
 assert.match(app,/function returnAdmin\(fallback\)/);
 assert.match(app,/state\.wpContext\?'wordpress':fallback/);
});

test('WordPress workspace can edit pages, all content types, menus, media, appearance, impact and forms without losing its current section',async()=>{
 const app=await readFile(resolve(root,'public/app.js'),'utf8');
 assert.match(app,/else if\(state\.wpSection==='pages'\)inner=await pagesAdmin\(\)/);
 assert.match(app,/else if\(state\.wpSection==='content'\)inner=await wordpressContent\(\)/);
 assert.match(app,/else if\(state\.wpSection==='navigation'\)inner=await navigationAdmin\(\)/);
 assert.match(app,/else if\(state\.wpSection==='media'\)inner=await mediaAdmin\(\)/);
 assert.match(app,/else if\(state\.wpSection==='appearance'\)inner=await settingsAdmin\(\)/);
 assert.match(app,/else if\(state\.wpSection==='impact'\)inner=await impactAdmin\(\)/);
 assert.match(app,/else if\(state\.wpSection==='forms'\)inner=await formsAdmin\(\)/);
 assert.match(app,/else if\(state\.wpSection==='seo'\)inner=await wordpressSeo\(\)/);
 for(const pair of ["articles:'article'","projects:'project'","activities:'activity'","opportunities:'opportunity'","initiatives:'initiative'","resources:'resource'"]) assert.ok(app.includes(pair),`missing content type ${pair}`);
 assert.match(app,/\.edit-page'\)\.forEach/);
 assert.match(app,/\.edit-content'\)\.forEach/);
 assert.match(app,/toast\('Đã lưu trang'\);returnAdmin\('pages'\)/);
 assert.match(app,/toast\('Đã lưu nội dung'\);returnAdmin\(/);
 assert.match(app,/toast\('Đã cập nhật media'\);returnAdmin\('media'\)/);
 assert.match(app,/toast\('Đã lưu Form Builder'\);returnAdmin\('forms'\)/);
 assert.match(app,/toast\('Đã xuất bản menu đầu trang và chân trang'\);returnAdmin\('navigation'\)/);
});

test('WordPress sections are scoped to current roles and do not modify backend RBAC',async()=>{
 const app=await readFile(resolve(root,'public/app.js'),'utf8');
 assert.match(app,/function wordpressAllowedSections\(\)/);
 assert.match(app,/content_editor:\['dashboard','wordpress','pages','articles','resources','people','media'\]/);
 assert.match(app,/project_manager:\['dashboard','wordpress','projects','activities','opportunities','initiatives','impact','media'\]/);
 assert.match(app,/volunteer_coordinator:\['dashboard','wordpress','forms','submissions','applications','media'\]/);
 assert.match(app,/if\(\['root_admin','administrator'\]\.includes\(role\)\)return Object.keys\(wpSections\)/);
 assert.match(app,/if\(role==='content_editor'\)return \['overview','pages','content','media','seo'\]/);
 assert.match(app,/if\(role==='project_manager'\)return \['overview','content','media','impact'\]/);
 assert.match(app,/if\(role==='volunteer_coordinator'\)return \['overview','media','forms'\]/);
 assert.match(app,/function wordpressAllowedContentKeys\(\)/);
 assert.match(app,/const allowed=roleNav\[state\.user\.role\]/);
 const styles=await readFile(resolve(root,'public/styles.css'),'utf8');
 assert.match(styles,/\.wp-workspace-tabs/);
 assert.match(styles,/\.wp-workspace-tab\.active/);
 assert.match(styles,/@media\(max-width:700px\)\{\.wp-workspace-intro/);
});


test('content preview stays inside the current editor and does not replace the edit modal',async()=>{
 const app=await readFile(resolve(root,'public/app.js'),'utf8');
 assert.match(app,/id=\"content-preview-inline\" class=\"page-preview-inline\" hidden/);
 assert.match(app,/BẢN XEM TRƯỚC · CHƯA LƯU \/ CHƯA XUẤT BẢN/);
 const editor=app.match(/async function contentEditor\(type,item=null\)\{[\s\S]*?\n\}/)?.[0]||'';
 assert.ok(editor.includes("$('#content-preview-inline',m)"));
 assert.ok(!editor.includes("const p=makeModal"),'Preview must not close the current editor by opening a replacement modal');
});
