function escXml(value='') {
  return String(value).replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}
export async function onRequestGet({ env }) {
  const base=(env.APP_URL||'https://xanh.skyfirst.io.vn').replace(/\/$/,'');
  const fixed=['/','/gioi-thieu','/con-nguoi','/du-an','/hoat-dong','/co-hoi','/tai-nguyen','/tin-tuc','/tham-gia','/lien-he','/quyen-rieng-tu','/dieu-khoan','/chinh-sach-du-lieu','/accessibility','/sitemap'];
  const urls=new Set(fixed.map(x=>base+x));
  try {
    const [content,people,pages,forms]=await Promise.all([
      env.DB.prepare(`SELECT type,slug,updated_at FROM content_items WHERE status IN ('published','open','completed')`).all(),
      env.DB.prepare(`SELECT slug,updated_at FROM people WHERE is_public=1 AND allow_index=1`).all(),
      env.DB.prepare(`SELECT slug,updated_at FROM pages WHERE status='published'`).all(),
      env.DB.prepare(`SELECT slug,updated_at FROM forms WHERE status='open'`).all(),
    ]);
    const prefix={article:'/tin-tuc/',project:'/du-an/',activity:'/hoat-dong/',opportunity:'/co-hoi/',resource:'/tai-nguyen/',initiative:'/sang-kien/'};
    for(const x of content.results||[]) if(prefix[x.type]) urls.add(base+prefix[x.type]+encodeURIComponent(x.slug));
    for(const x of people.results||[]) urls.add(base+'/con-nguoi/'+encodeURIComponent(x.slug));
    for(const x of pages.results||[]) if(x.slug!=='home') urls.add(base+'/'+encodeURIComponent(x.slug));
    for(const x of forms.results||[]) urls.add(base+'/tham-gia/'+encodeURIComponent(x.slug));
  } catch {}
  const body=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].map(loc=>`  <url><loc>${escXml(loc)}</loc></url>`).join('\n')}\n</urlset>`;
  return new Response(body,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=600','X-Content-Type-Options':'nosniff'}});
}
