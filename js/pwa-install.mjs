// Optional install action for mobile browsers. No intrusive modal.
const banner=document.getElementById('pwa-install-banner');
const button=document.getElementById('pwa-install-button');
const close=document.getElementById('pwa-install-close');
const message=document.getElementById('pwa-install-tip');
let pendingPrompt=null;
const mobile=matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ios=/iPad|iPhone|iPod/i.test(navigator.userAgent);
const dismissed=()=>{try{return sessionStorage.getItem('top-pwa-dismissed')==='1'}catch{return false}};
const show=()=>{
  if(!banner||!mobile||standalone()||dismissed())return;
  banner.hidden=false;
};
const hide=()=>{if(banner)banner.hidden=true};
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js')
    .catch(err=>console.warn('TOP Web: PWA não registrado',err)));
}
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();pendingPrompt=event;show();
});
window.addEventListener('appinstalled',()=>{pendingPrompt=null;hide()});
if(mobile&&!standalone()){
  // iOS Safari does not fire beforeinstallprompt.
  if(ios)setTimeout(show,2500);
}
close?.addEventListener('click',()=>{
  hide();try{sessionStorage.setItem('top-pwa-dismissed','1')}catch{}
});
button?.addEventListener('click',async()=>{
  if(pendingPrompt){
    const prompt=pendingPrompt;pendingPrompt=null;
    try{await prompt.prompt();const selected=await prompt.userChoice;
      if(selected?.outcome==='accepted')hide();
      else if(message)message.textContent='Use o menu do navegador para instalar mais tarde.';
    }catch(err){console.warn('TOP Web: instalação indisponível',err)}
    return;
  }
  if(message)message.textContent=ios
    ?'No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.'
    :'Abra o menu ⋮ do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.';
});
