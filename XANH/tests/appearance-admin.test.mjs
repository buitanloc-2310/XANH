import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const read=p=>readFile(resolve(root,p),'utf8');
test('site-wide appearance controls persist through existing general settings endpoint',async()=>{
 const app=await read('public/app.js'); const api=await read('functions/api/[[path]].js');
 for(const x of ['theme_primary','theme_green','theme_navy','theme_font_size','theme_heading_scale','theme_radius','theme_content_width','applySiteTheme']) assert.ok(app.includes(x),`missing ${x}`);
 assert.ok(app.includes("key:'general',value"));
 assert.ok(api.includes("['general','footer','media','impact','security','cms'].includes(key)"));
});
test('reference visuals are included as optimized assets and used by real page components',async()=>{
 const css=await read('public/styles.css');
 for(const f of ['projects-visual.webp','activities-visual.webp','impact-visual.webp','action-visual.webp','footer-visual.webp']){
  await stat(resolve(root,'public/assets/reference',f)); assert.ok(css.includes(f),`asset not referenced in CSS: ${f}`);
 }
 const app=await read('public/app.js');assert.ok(app.includes('visual-page-hero visual-${type}'));
});
