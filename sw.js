/* TOP Web PWA: installable shell, without caching heavy GLBs or game data. */
const CACHE_NAME='top-web-shell-20261101-12';
const SHELL=['./','./index.html','./manifest.webmanifest','./pwa/top-icon.svg'];
const allowShell=url=>url.origin===self.location.origin&&
  (url.pathname.endsWith('/index.html')||
   url.pathname.endsWith('/manifest.webmanifest')||
   url.pathname.endsWith('/pwa/top-icon.svg')||
   url.pathname.endsWith('/'));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('top-web-shell-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  const url=new URL(req.url);
  // Never cache character models, large maps, player data, or skill JSON.
  if(req.mode!=='navigate'&&!allowShell(url))return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok&&response.type==='basic'&&allowShell(url)){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)));
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(req);
    return cached||(req.mode==='navigate'?await caches.match('./index.html'):
      Response.error());
  }));
});
