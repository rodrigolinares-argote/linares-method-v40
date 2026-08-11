const CACHE='lm-portal-url-v40-shell-1';
const SHELL=['/portal/index.html','/portal/icon-192.png','/portal/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('lm-portal-url-')).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.mode==='navigate' && u.pathname.startsWith('/p/')){
    e.respondWith(fetch(e.request).catch(()=>caches.match('/portal/index.html')));return;
  }
  if(u.origin===location.origin && (u.pathname.startsWith('/portal/')||u.pathname==='/portal-sw.js')){
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})));return;
  }
});