// PWA leve: habilita instalação sem baixar dezenas de MB em segundo plano.
// O jogo requer internet para Three.js/CDN e recursos grandes; não prometer
// funcionamento offline total. Não interceptar áudio, texturas, GLB nem APIs.
const VERSION='topweb-pwa-shell-v1';
const SHELL=['./index.html','./manifest.webmanifest','./pwa/icon-192.png','./pwa/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(VERSION);
    await Promise.allSettled(SHELL.map(url=>cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('topweb-pwa-shell-')&&k!==VERSION)
      .map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
// Navegação: buscar versão atual primeiro; só exibir shell salvo sem rede.
// Os assets do jogo não são precacheados para evitar consumo de espaço mobile.
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.mode!=='navigate')return;
  event.respondWith((async()=>{
    try{return await fetch(request);}
    catch {
      return (await caches.match('./index.html')) ||
        new Response('Conecte-se à internet para abrir TOP Web.',{
          status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
