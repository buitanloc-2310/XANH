// Shared defaults for the seven approved Dấu ấn xanh cards.
// This fallback only completes API responses; it never writes to D1 or overwrites saved content.
const IMPACT_DISPLAY_KEYS = ['participants','completed_activities','waste_tons','completed_programs','education_sessions','green_points','partner_units'];

// Complete missing card configuration in the response without writing to D1.
// The Admin save endpoint persists all seven rows via its existing guarded UPSERT.
// Existing stored settings always win, so this fallback cannot overwrite Admin edits.
const IMPACT_DEFAULT_CONFIG = [
  {metric_key:'participants',label:'Tình nguyện viên tham gia',description:'',start_value:0,duration_ms:1800,delay_ms:0,hold_ms:0,enabled:1,sort_order:1,unit:'người',icon:'users',data_source:'manual',manual_value:null,decimal_places:0},
  {metric_key:'completed_activities',label:'Hoạt động môi trường',description:'',start_value:0,duration_ms:1900,delay_ms:0,hold_ms:0,enabled:1,sort_order:2,unit:'hoạt động',icon:'sprout',data_source:'d1',manual_value:null,decimal_places:0},
  {metric_key:'waste_tons',label:'Rác thải thu gom',description:'',start_value:0,duration_ms:1900,delay_ms:0,hold_ms:0,enabled:1,sort_order:3,unit:'tấn',icon:'recycle',data_source:'d1',manual_value:null,decimal_places:1},
  {metric_key:'completed_programs',label:'Chương trình đã triển khai',description:'',start_value:0,duration_ms:1900,delay_ms:180,hold_ms:0,enabled:1,sort_order:4,unit:'chương trình',icon:'clipboard-check',data_source:'manual',manual_value:null,decimal_places:0},
  {metric_key:'education_sessions',label:'Hoạt động giáo dục môi trường',description:'',start_value:0,duration_ms:2000,delay_ms:360,hold_ms:0,enabled:1,sort_order:5,unit:'buổi',icon:'book-open',data_source:'manual',manual_value:null,decimal_places:0},
  {metric_key:'green_points',label:'Điểm xanh được kết nối',description:'',start_value:0,duration_ms:2100,delay_ms:540,hold_ms:0,enabled:1,sort_order:6,unit:'điểm',icon:'map-pin',data_source:'manual',manual_value:null,decimal_places:0},
  {metric_key:'partner_units',label:'Đơn vị đồng hành',description:'',start_value:0,duration_ms:2200,delay_ms:720,hold_ms:0,enabled:1,sort_order:7,unit:'đơn vị',icon:'handshake',data_source:'manual',manual_value:null,decimal_places:0},
];
export function completeImpactConfigRows(rows=[]) {
  const stored = new Map((Array.isArray(rows)?rows:[]).filter(row=>row&&IMPACT_DISPLAY_KEYS.includes(row.metric_key)).map(row=>[row.metric_key,row]));
  // Reserve saved positions first; defaults for absent rows fill free slots without colliding.
  const occupied = new Set([...stored.values()].map(row=>Number(row.sort_order)).filter(n=>Number.isInteger(n)&&n>=1&&n<=7));
  const completed = IMPACT_DEFAULT_CONFIG.map(base=>{
    const saved=stored.get(base.metric_key);
    if(saved) return {...base,...saved};
    let order=base.sort_order;
    if(occupied.has(order)) order=[1,2,3,4,5,6,7].find(n=>!occupied.has(n))||base.sort_order;
    occupied.add(order);
    return {...base,sort_order:order};
  });
  return completed.sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)||IMPACT_DISPLAY_KEYS.indexOf(a.metric_key)-IMPACT_DISPLAY_KEYS.indexOf(b.metric_key));
}

