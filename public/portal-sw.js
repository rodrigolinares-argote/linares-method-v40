const CACHE='lm-portal-url-v40-shell-8';
const SHELL=['/portal/index.html','/portal/icon-192.png','/portal/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('lm-portal-url-')).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);

  // Navigations to /p/*: prefer the live shell after each deploy, fall back offline.
  if(e.request.mode==='navigate' && u.pathname.startsWith('/p/')){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          if(r.ok){
            const copy=r.clone();
            caches.open(CACHE).then(c=>c.put('/portal/index.html',copy)).catch(()=>{});
          }
          return r;
        })
        .catch(()=>caches.match('/portal/index.html'))
    );
    return;
  }

  // Portal shell/assets: network first, cache fallback. Avoid stale UI after deploys.
  if(u.origin===location.origin && (u.pathname.startsWith('/portal/')||u.pathname==='/portal-sw.js')){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          if(r.ok){
            const copy=r.clone();
            caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
          }
          return r;
        })
        .catch(()=>caches.match(e.request))
    );
  }
});