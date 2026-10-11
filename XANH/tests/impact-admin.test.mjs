import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const read=p=>readFile(resolve(root,p),'utf8');

test('Dấu ấn xanh has exactly the seven approved configurable metrics and keeps the rejected metric hidden',async()=>{
  const sql=await read('migrations/0009_impact_display_full_control.sql');
  for(const key of ['participants','completed_activities','waste_tons','completed_programs','education_sessions','green_points','partner_units']) assert.ok(sql.includes(`'${key}'`),`missing metric ${key}`);
  assert.match(sql,/unit TEXT NOT NULL DEFAULT/);
  assert.match(sql,/icon TEXT NOT NULL DEFAULT/);
  assert.match(sql,/data_source TEXT NOT NULL DEFAULT/);
  assert.match(sql,/manual_value REAL/);
  assert.match(sql,/decimal_places INTEGER/);
  assert.match(sql,/SET enabled=0, sort_order=99[\s\S]*?WHERE metric_key='community_reached'/);
  assert.match(sql,/Existing non-empty CMS copy is preserved/);
  assert.match(sql,/SET blocks_json=json_set[\s\S]*?'DẤU ẤN XANH'[\s\S]*?'Mỗi con số đại diện cho một hành động đã thực sự diễn ra\.'/);
  assert.match(sql,/AND \(SELECT json_extract\(j.value,'\$\.title'\)[\s\S]*?='Chỉ hiển thị số liệu có nguồn và trạng thái xác minh\.'/);
});

test('Admin Total can edit each card label, unit, icon, source, manual value, order and visibility',async()=>{
  const app=await read('public/app.js');
  for(const field of ['name="label"','name="unit"','name="icon"','name="data_source"','name="manual_value"','name="decimal_places"','name="sort_order"','name="enabled"']) assert.ok(app.includes(field),`missing admin field ${field}`);
  assert.match(app,/Cấu hình 7 thẻ Dấu ấn xanh/);
  assert.match(app,/Lưu và áp dụng 7 thẻ/);
  assert.doesNotMatch(app.match(/async function impactAdmin\(\)[\s\S]*?async function usersAdmin/)[0],/Cộng đồng hưởng lợi/);
  assert.match(app,/homeBlockRow\(b,i\)/);
  assert.match(app,/Những con số này được tổng hợp từ các hoạt động thực tế của Xanh Sky First/);
});

test('Admin impact API validates and persistently upserts seven cards in D1 with safe values',async()=>{
  const api=await read('functions/api/[[path]].js');
  assert.match(api,/const IMPACT_DISPLAY_KEYS = \['participants','completed_activities','waste_tons','completed_programs','education_sessions','green_points','partner_units'\]/);
  assert.match(api,/items.length===7&&new Set\(submitted\).size===7/);
  assert.match(api,/ON CONFLICT\(metric_key\) DO UPDATE SET/);
  assert.match(api,/IMPACT_ICON_KEYS.has\(icon\)/);
  assert.match(api,/\['d1','manual'\]\.includes\(source\)/);
  assert.match(api,/manualValue===null\|\|\(Number\.isFinite\(manualValue\)/);
  assert.match(api,/INSERT INTO impact_counter_config/);
  assert.match(api,/assert\(ADMIN_ROLES\.has\(user\.role\),403,'Chỉ Admin Tổng \/ Administrator được cấu hình các thẻ Dấu ấn xanh\.'/);
});

test('Public impact cards use configured API counters and keep units beside the animated value',async()=>{
  const app=await read('public/app.js');
  const api=await read('functions/api/[[path]].js');
  assert.match(app,/counters:Array\.isArray\(data\.counters\)\?data\.counters:\[\]/);
  assert.match(app,/data-decimals/);
  assert.match(app,/class="metric-value"[\s\S]*?class="metric-unit"/);
  assert.match(app,/function impactIconSvg\(key\)/);
  assert.match(app,/filter\(c=>c\.enabled===true\|\|Number\(c\.enabled\)===1\)/);
  assert.match(api,/const sourceValues=\{participants:impact\.participants/);
  assert.match(api,/data_source==='manual'/);
});


test('Public impact view fills missing config rows with the seven approved labels but never fake values',async()=>{
  const app=await read('public/app.js');
  for(const label of ['Tình nguyện viên tham gia','Hoạt động môi trường','Rác thải thu gom','Chương trình đã triển khai','Hoạt động giáo dục môi trường','Điểm xanh được kết nối','Đơn vị đồng hành']) assert.ok(app.includes(label),`missing fallback label ${label}`);
  assert.match(app,/enabled:true,value:null,description:'',decimal_places:0/);
  assert.match(app,/saved\.value===undefined\?null:saved\.value/);
});

test('Dấu ấn xanh matches the seven-column reference on wide screens and responds at 100% zoom',async()=>{
  const css=await read('public/styles.css');
  assert.match(css,/\.metrics\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/\.metric-value\{display:flex;flex-flow:row nowrap;align-items:baseline;justify-content:center/);
  assert.match(css,/\.metric-unit\{[^}]*white-space:nowrap[^}]*word-break:keep-all/);
  assert.match(css,/\.impact\{display:block!important/);
  assert.match(css,/\.top \.header-cta\{[^}]*white-space:nowrap/);
  assert.match(css,/\.hero-scenic h1\{font-size:clamp\(calc\(40px/);
  assert.match(css,/@media\(max-width:1499px\) and \(min-width:1100px\)\{\.metrics\{grid-template-columns:repeat\(4/);
  assert.match(css,/@media\(max-width:760px\)\{\.impact\{/);
  assert.ok((await stat(resolve(root,'public/assets/dau-an-xanh-landscape.webp'))).size>10000);
});


test('Incomplete D1 configuration is completed to seven cards without overwriting saved values',async()=>{
  const { completeImpactConfigRows } = await import('../functions/_lib/impact-config.js');
  const result=completeImpactConfigRows([
    {metric_key:'participants',label:'Tên đã được Admin đổi',unit:'người',icon:'users',data_source:'manual',manual_value:12,enabled:1,sort_order:1},
    {metric_key:'completed_activities',label:'Hoạt động môi trường',unit:'hoạt động',icon:'sprout',data_source:'d1',manual_value:null,enabled:1,sort_order:2},
    {metric_key:'waste_tons',label:'Rác thải thu gom',unit:'tấn',icon:'recycle',data_source:'d1',manual_value:null,enabled:1,sort_order:3},
  ]);
  assert.equal(result.length,7,'must never show only the rows that happen to exist in D1');
  assert.deepEqual(result.map(x=>x.metric_key),['participants','completed_activities','waste_tons','completed_programs','education_sessions','green_points','partner_units']);
  assert.equal(result[0].label,'Tên đã được Admin đổi','must preserve existing Admin edits');
  assert.equal(result[0].manual_value,12,'must preserve saved manual data');
  assert.equal(result[3].label,'Chương trình đã triển khai');
  assert.equal(result[3].manual_value,null,'must not invent statistics for missing metrics');
  assert.equal(new Set(result.map(x=>x.sort_order)).size,7,'defaults must have unique display order');
});

test('Admin impact editor fills missing API records locally and always builds seven editable cards',async()=>{
  const app=await read('public/app.js');
  const editor=app.match(/async function impactCounterEditor\(\)[\s\S]*?\n}\nasync function impactAdmin/);
  assert.ok(editor,'impact counter editor exists');
  assert.match(editor[0],/const metricDefaults=\[/);
  assert.match(editor[0],/storedByKey=new Map\(stored\.map\(c=>\[c\.metric_key,c\]\)\)/);
  assert.match(editor[0],/const rows=metricDefaults\.map\(base=>/);
  assert.match(editor[0],/if\(items\.length!==7\)/);
});
