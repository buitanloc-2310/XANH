import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=process.cwd();
const get=path=>readFile(resolve(root,path),'utf8');

test('Design System saves a scoped theme inside existing general settings and reads it back',async()=>{
 const app=await get('public/app.js');
 assert.match(app,/page_themes(?:\?\.)?\[page\]/);
 assert.match(app,/value:\{\.\.\.globalFields,page_themes\}/);
 assert.match(app,/const verify=\(await api\('\/api\/admin\/settings'\)\)\.groups\?\.general/);
 assert.match(app,/theme_header_bg/);assert.match(app,/theme_footer_bg/);assert.match(app,/theme_card_bg/);assert.match(app,/theme_section_space/);assert.match(app,/theme_button_radius/);assert.match(app,/theme_shadow_strength/);
 const css=await get('public/styles.css');
 for(const variable of ['--site-font-family','--site-font-size','--site-header-bg','--site-footer-bg','--site-card-bg','--site-section-space','--site-button-radius','--site-shadow-strength'])assert.ok(css.includes(variable),`missing consumed CSS variable ${variable}`);
});

test('Page Builder supports reusable countdown blocks and requires a valid deadline before publishing',async()=>{
 const app=await get('public/app.js');
 assert.match(app,/function countdownBlockMarkup\(b=\{\},formId=null,openFormOnZero=false\)/);
 assert.match(app,/initCountdowns\(root=document\)/);
 assert.match(app,/const choices=isHome\?\['hero','rich','cards','feature_grid','dynamic','impact','newsletter','cta','countdown'\]/);
 assert.match(app,/\['paragraph','heading','image','quote','callout','cta','countdown','table','spacer'\]/);
 assert.match(app,/f\.get\('status'\)==='published'&&blocks\.some\(b=>\{if\(b\.type!=='countdown'\)return false/);
 assert.match(app,/const tz=b\.timezone\|\|'Asia\/Ho_Chi_Minh',end=zonedLocalToISO\(b\.end_at,tz\),start=b\.start_at/);
 assert.match(app,/data-countdown-days/);assert.match(app,/data-countdown-close-form/);
});

test('Form deadline display is configurable and server endpoint keeps authoritative expiry guard',async()=>{
 const app=await get('public/app.js');
 const api=await get('functions/api/[[path]].js');
 for(const k of ['countdown_enabled','countdown_title','countdown_expired_title','countdown_expired_message','countdown_timezone'])assert.ok(app.includes(k)&&api.includes(k),`missing ${k}`);
 assert.match(api,/if\(form\.closes_at\) assert\(new Date\(form\.closes_at\)>new Date\(\),409,settings\.closed_message\)/);
 assert.match(api,/const isExpired=!!row\.closes_at && new Date\(row\.closes_at\)<=new Date\(\)/);
 assert.match(app,/closesAt=closesLocal\?zonedLocalToISO\(closesLocal,timezone\):null/);
});

test('Admin updates preserve workspace scroll container and route only scrolls on deliberate public navigation',async()=>{
 const app=await get('public/app.js');
 assert.match(app,/data-admin-user=/);
 assert.match(app,/if\(sameUser\)\{const area=\$\('\.admin-body',existing\);if\(area\)area\.innerHTML=body/);
 assert.match(app,/state\.scrollToTopOnRoute&&!path\.startsWith\('\/admin'\)/);
 assert.doesNotMatch(app,/finally\{app\.removeAttribute\('aria-busy'\);scrollTo\(0,0\)\}/);
 const css=await get('public/styles.css');assert.match(css,/\.admin-body\{flex:1;min-height:0;overflow:auto/);
});

test('datetime-local values are formatted in their configured time zone rather than sliced from UTC ISO strings',async()=>{
 const app=await get('public/app.js');
 assert.match(app,/function zonedLocalToISO\(value,tz='Asia\/Ho_Chi_Minh'\)/);
 assert.match(app,/new Intl\.DateTimeFormat\('en-CA',\{timeZone:safeTimeZone\(tz\)/);
 assert.doesNotMatch(app,/const localDateTime = s=>\{if\(!s\)return '';const d=new Date\(s\);return Number\.isNaN\(d\.getTime\(\)\)\?'':d\.toISOString\(\)\.slice\(0,16\)\}/);
});


test('Expired registration page initializes expiry state before rendering and does not show a live zero counter',async()=>{
 const app=await get('public/app.js');
 const section=app.slice(app.indexOf('async function formPage(slug)'),app.indexOf('function contactPage()'));
 assert.ok(section.indexOf('expired=!!f.is_expired')<section.indexOf('const countdown='),'expiry flag must exist before countdown rendering');
 assert.match(section,/deadline&&!expired&&settings\.countdown_enabled!==false/);
 assert.match(section,/const formMarkup=expired\?/);
});

test('Form Builder validates the open/close window on both client and server',async()=>{
 const app=await get('public/app.js'),api=await get('functions/api/[[path]].js');
 assert.match(app,/if\(opensAt&&closesAt&&Date\.parse\(closesAt\)<=Date\.parse\(opensAt\)\)/);
 assert.match(api,/function validateFormWindow\(opensAt, closesAt\)/);
 assert.match(api,/validateFormWindow\(b\.opens_at\|\|null,b\.closes_at\|\|null\)/);
 assert.match(api,/validateFormWindow\(opensAt\|\|null,closesAt\|\|null\)/);
 const fn=api.match(/function validateFormWindow\(opensAt, closesAt\) \{[\s\S]*?\n\}/)?.[0];assert.ok(fn);
 const guard=(ok,_status,msg)=>{if(!ok)throw new Error(msg)};
 const validate=new Function('assert',`${fn}; return validateFormWindow`)(guard);
 assert.doesNotThrow(()=>validate(null,null));assert.doesNotThrow(()=>validate('2026-10-10T00:00:00.000Z','2026-10-11T00:00:00.000Z'));
 assert.throws(()=>validate('not-a-date',null),/không hợp lệ/);
 assert.throws(()=>validate('2026-10-11T00:00:00.000Z','2026-10-10T00:00:00.000Z'),/phải sau/);
});

test('Configured local deadlines convert deterministically and reject impossible calendar dates',async()=>{
 const app=await get('public/app.js');
 const fn=app.match(/function zonedLocalToISO\(value,tz='Asia\/Ho_Chi_Minh'\)\{[^\n]+/)?.[0]?.trim();
 assert.ok(fn&&app.includes('const safeTimeZone='),'timezone converter and whitelist should be defined');
 const convert=new Function('safeTimeZone',`${fn}; return zonedLocalToISO`)(z=>['Asia/Ho_Chi_Minh','UTC','Asia/Bangkok','Asia/Singapore'].includes(String(z||''))?String(z):'Asia/Ho_Chi_Minh');
 assert.equal(convert('2026-10-12T15:30','Asia/Ho_Chi_Minh'),'2026-10-12T08:30:00.000Z');
 assert.equal(convert('2026-10-12T15:30','UTC'),'2026-10-12T15:30:00.000Z');
 assert.equal(convert('2026-02-31T09:00','Asia/Ho_Chi_Minh'),null);
});

test('Scoped Design System persists the selected page and does not bypass the existing settings merge',async()=>{
 const app=await get('public/app.js'),api=await get('functions/api/[[path]].js');
 assert.match(app,/const globalFields=Object\.fromEntries\(Object\.entries\(value\)\.filter\(\(\[k\]\)=>!themeVariables\.includes\(k\)\)\)/);
 assert.match(app,/value:\{\.\.\.globalFields,page_themes\}/);
 assert.match(api,/const current=await settingsGet\(env,key\),next=\{\.\.\.current,\.\.\.\(b\.value\|\|\{\}\)\}/);
 for(const key of ['theme_button_end','theme_button_secondary','theme_link','theme_link_hover','theme_border','theme_focus'])assert.ok(app.includes(key));
 const css=await get('public/styles.css');for(const token of ['--site-button-end','--site-button-secondary','--site-link','--site-link-hover','--site-border','--site-focus'])assert.ok(css.includes(token),`missing CSS token ${token}`);
});

test('Design System can independently choose heading typography and persist a Media-controlled favicon',async()=>{
 const app=await get('public/app.js'),css=await get('public/styles.css'),html=await get('public/index.html');
 assert.match(app,/name="theme_heading_font_family"/);
 assert.match(app,/--site-heading-font-family/);
 assert.match(css,/h1,h2,h3,h4,h5,h6\{font-family:var\(--site-heading-font-family/);
 assert.match(app,/name="site_favicon_url"/);
 assert.match(app,/data-theme-media="site_favicon_url"/);
 assert.match(app,/safeSettings\.site_favicon_url/);
 assert.match(app,/id="nav-logo-pick"/);
 assert.match(app,/onSelect:item=>\{navForm\.elements\.logo_url\.value=item\.url/);
 assert.match(html,/app\.js\?v=20261011-8/);
 const sw=await get('public/sw.js');assert.match(sw,/const CACHE='xanh-shell-v12'/);
});


test('A scheduled open form exposes its upcoming start without allowing server-side submissions early',async()=>{
 const app=await get('public/app.js'),api=await get('functions/api/[[path]].js');
 assert.match(api,/const isNotOpen=!!row\.opens_at && new Date\(row\.opens_at\)>new Date\(\)/);
 assert.match(api,/is_not_open:isNotOpen/);
 assert.doesNotMatch(api,/if\(row\.opens_at\) assert\(new Date\(row\.opens_at\)<=new Date\(\),409,'Biểu mẫu chưa đến thời gian mở\.'/);
 assert.match(app,/notOpen=!!f\.is_not_open/);
 assert.match(app,/data-countdown-open-form="1"/);
 assert.match(api,/if\(form\.opens_at\) assert\(new Date\(form\.opens_at\)<=new Date\(\),409,'Biểu mẫu chưa đến thời gian mở\.'/);
 assert.match(app,/countdown_warning_hours/);
});


test('Page Builder has real drag-and-drop ordering as well as keyboard-accessible up/down controls',async()=>{
 const app=await get('public/app.js'),css=await get('public/styles.css');
 assert.match(app,/class="block-drag-handle" draggable="true"/);
 assert.match(app,/class="home-drag-handle" draggable="true"/);
 assert.match(app,/dataTransfer\?\.setData\('text\/plain',String\(i\)\)/);
 assert.match(app,/body\.splice\(from,1\);body\.splice\(i,0,moved\)/);
 assert.match(app,/class="icon-btn block-up"/);assert.match(app,/class="icon-btn home-up"/);
 assert.match(css,/\.content-block\.drop-target,.home-block-editor\.drop-target/);
});
