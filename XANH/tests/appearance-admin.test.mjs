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
test('reference designs are implemented as responsive HTML/CSS components, not screenshot backgrounds',async()=>{
 const css=await read('public/styles.css');
 for(const token of ['.dynamic-feature','.project-stack','.calendar-sheet','.visual-page-hero::after','.impact{background-image:var(--impact-visual,none)','.footer-cta']) assert.ok(css.includes(token),`missing CSS component: ${token}`);
 const app=await read('public/app.js');
 for(const token of ['project-visual','calendar-visual','dynamic-feature-list','visual-page-hero visual-${type}']) assert.ok(app.includes(token),`missing page markup: ${token}`);
 assert.ok(!css.includes('/assets/reference/'),'should not rely on reference screenshot assets');
});
