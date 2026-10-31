// Instalação PWA: o menu do navegador continua disponível mesmo que
// beforeinstallprompt não seja oferecido (incluindo iOS e Firefox).
export function initPwaInstall({button,onMessage=()=>{}}={}){
  if(!button)return;
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone===true;
  let pending=null;
  const render=()=>{
    button.hidden=isStandalone();
    if(button.hidden)return;
    button.textContent=pending?'⬇ Instalar TOP Web':'⬇ Adicionar à tela inicial';
  };
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();pending=event;render();
  });
  window.addEventListener('appinstalled',()=>{
    pending=null;render();onMessage('TOP Web instalado!');
  });
  button.addEventListener('click',async()=>{
    if(isStandalone())return;
    if(pending){
      const prompt=pending;pending=null;render();
      try{await prompt.prompt();await prompt.userChoice;}
      catch(error){console.info('PWA: instalação via menu do navegador',error);}
      return;
    }
    onMessage('No navegador: abra o menu ⋮ (Android) ou Compartilhar (iPhone) e escolha “Adicionar à tela inicial” / “Instalar app”.');
  });
  render();
  if('serviceWorker' in navigator && window.isSecureContext){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js',{scope:'./'})
        .catch(error=>console.info('PWA: service worker indisponível',error));
    },{once:true});
  }
}
