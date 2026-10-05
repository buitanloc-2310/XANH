const CACHE='xanh-shell-v3';
const CORE=['/','/index.html','/styles.css','/app.js','/assets/xanh-sky-first-logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);if(u.origin!==location.origin)return;
  if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/admin')||u.pathname==='/login'||u.pathname==='/setup')return;
  e.respondWith(fetch(r).then(res=>{const copy=res.clone();if(res.ok)caches.open(CACHE).then(c=>c.put(r,copy));return res}).catch(()=>caches.match(r).then(hit=>hit||caches.match('/index.html'))));
});
