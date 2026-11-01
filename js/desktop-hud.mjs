// Desktop presentation only. Gameplay and the mobile controls keep their owners.
const icons={
  hero:'<circle cx="16" cy="10" r="5"/><path d="M6 28v-5c0-8 20-8 20 0v5M11 19l5 5 5-5"/>',
  target:'<circle cx="16" cy="16" r="9"/><path d="M16 2v8m0 12v8M2 16h8m12 0h8"/>',
  auto:'<path d="M25 10A11 11 0 0 0 5 16m2 6a11 11 0 0 0 20-6M25 4v7h-7M7 28v-7h7"/><path d="m12 20 8-9m-4 1 4-1-1 4"/>',
  rest:'<path d="M6 25h20M10 24v-9m12 9v-9M8 15h16M11 7h10v8M12 11h8"/>',
  map:'<path d="m3 7 8-3 10 4 8-3v21l-8 3-10-4-8 3Zm8-3v21M21 8v21"/>',
  help:'<circle cx="16" cy="16" r="12"/><path d="M12 12a4 4 0 1 1 6 3c-2 1-2 2-2 4m0 4h.01"/>',
};
const svg=name=>icons[name]?`<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`:
  `<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#ui-${name}"></use></svg>`;
const ratio=(value,max)=>Number.isFinite(value)&&max>0?Math.max(0,Math.min(1,value/max))*100:0;

export function initDesktopHud({onPrimary,onAuto,onTarget,onRest,onOpen,onMap,onPause,canOpen=()=>true}={}){
  const $=id=>document.getElementById(id),body=document.body;
  const root=document.createElement('div');root.id='desktop-hud';
  root.innerHTML=`
    <button type="button" class="desktop-player desktop-frame" id="desktop-player" aria-label="Abrir atributos do personagem" aria-describedby="desktop-hp desktop-mp" title="Personagem (C)">
      <span class="desktop-portrait"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M4 64c2-23 12-25 28-25s26 2 28 25Z" fill="#457f91"/><ellipse cx="32" cy="29" rx="17" ry="20" fill="var(--portrait-skin,#efc18b)"/><path d="M13 29C4 13 14 4 26 7c15-11 33 3 28 19L48 17 40 9l-8 14-8-7-11 13Z" fill="var(--portrait-hair,#9f5428)" stroke="#513f37" stroke-width="1.5"/><path d="M18 26h9m9 0h9" stroke="#654638" stroke-width="2"/><circle cx="25" cy="30" r="2" fill="#17434a"/><circle cx="40" cy="30" r="2" fill="#17434a"/><path d="M28 41q5 4 10 0" stroke="#8f4f3c" stroke-width="2" fill="none"/></svg><b id="desktop-level">1</b></span>
      <span class="desktop-vitals"><span class="desktop-player-name"><strong id="desktop-name">Lance</strong><small id="desktop-class">Crusader</small></span>
        <span class="desktop-meter hp" id="desktop-hp-meter" role="meter" aria-label="Vida"><i id="desktop-hp-fill"></i><span>HP</span><b id="desktop-hp">—</b></span>
        <span class="desktop-meter mp" id="desktop-mp-meter" role="meter" aria-label="Mana"><i id="desktop-mp-fill"></i><span>MP</span><b id="desktop-mp">—</b></span>
      </span>
    </button>
    <details class="desktop-journal desktop-frame" id="desktop-journal" open>
      <summary>Registro de viagem <small>LOCAL</small><span aria-hidden="true">⌃</span></summary>
      <ol id="desktop-events" aria-label="Eventos recentes"></ol>
      <p>WASD mover <span>·</span> Shift correr <span>·</span> Q/E câmera</p>
    </details>
    <section class="desktop-quickbar desktop-frame" aria-label="Barra de ações e experiência">
      <div class="desktop-action-slots">
        <button type="button" id="desktop-primary" title="Atacar ou interagir (Espaço)" aria-label="Atacar ou interagir"><span id="desktop-primary-icon">${svg('swords')}</span><kbd>␣</kbd></button>
        <button type="button" id="desktop-auto" title="Alternar ataque automático (F)" aria-label="Ataque automático" aria-pressed="false">${svg('auto')}<kbd>F</kbd></button>
        <button type="button" id="desktop-target" title="Alternar alvo (T)" aria-label="Alternar alvo">${svg('target')}<kbd>T</kbd></button>
        <button type="button" id="desktop-rest" title="Parar e descansar (X)" aria-label="Parar e descansar">${svg('rest')}<kbd>X</kbd></button>
      </div>
      <div class="desktop-xp-caption"><span id="desktop-xp-class">Crusader · Nv. 1</span><span id="desktop-xp-label">XP 0 / 40</span></div>
      <div class="desktop-xp" id="desktop-xp-meter" role="meter" aria-label="Experiência"><i id="desktop-xp-fill"></i></div>
    </section>
    <nav class="desktop-menu desktop-frame" aria-label="Menus do jogo">
      <button type="button" data-desktop-tab="stats" title="Personagem (C)">${svg('hero')}<span>Herói</span></button>
      <button type="button" data-desktop-tab="inventory" title="Bolsa (B)">${svg('bag')}<span>Bolsa</span></button>
      <button type="button" data-desktop-tab="skills" title="Habilidades (K)">${svg('book')}<span>Skills</span></button>
      <button type="button" id="desktop-map" title="Mapa (M)">${svg('map')}<span>Mapa</span></button>
      <button type="button" id="desktop-settings" title="Configurações (Esc)" aria-controls="settings" aria-expanded="false">${svg('menu')}<span>Menu</span></button>
    </nav>`;
  body.append(root);
  const header=document.createElement('div');header.className='desktop-only desktop-settings-header';
  header.innerHTML='<strong>Configurações</strong><button type="button" id="desktop-settings-close" aria-label="Fechar configurações">×</button>';
  $('settings').prepend(header);
  const caption=document.createElement('div');caption.className='desktop-only desktop-map-caption';
  caption.innerHTML='<strong id="desktop-location">Argent City</strong><span id="desktop-coordinates">—</span>';
  document.querySelector('.minimapbox').append(caption);
  const mobile=()=>body.classList.contains('mobile-ui');
  const settingsOpen=()=>body.classList.contains('desktop-settings-open');
  function closeSettings(focus=false){
    if(!settingsOpen())return;
    body.classList.remove('desktop-settings-open');$('desktop-settings').setAttribute('aria-expanded','false');
    $('rpg-hotbar').inert=false;
    if(focus&&!mobile())$('desktop-settings').focus({preventScroll:true});
  }
  function toggleSettings(){
    if(settingsOpen()){closeSettings(true);return;}
    if(mobile()||!canOpen())return;
    onPause?.();body.classList.remove('compact');body.classList.add('desktop-settings-open');
    $('rpg-hotbar').inert=true;
    $('desktop-settings').setAttribute('aria-expanded','true');$('desktop-settings-close').focus({preventScroll:true});
  }
  const actions={primary:onPrimary,auto:onAuto,target:onTarget,rest:onRest};
  for(const [key,fn] of Object.entries(actions))$('desktop-'+key).addEventListener('click',()=>{if(!mobile()&&!settingsOpen()&&canOpen())fn?.();});
  function open(tab){if(!mobile()&&canOpen()){closeSettings();onOpen?.(tab);}}
  $('desktop-player').addEventListener('click',()=>open('stats'));
  for(const button of root.querySelectorAll('[data-desktop-tab]'))button.addEventListener('click',()=>open(button.dataset.desktopTab));
  $('desktop-map').addEventListener('click',()=>{if(!mobile())onMap?.();});
  $('desktop-settings').addEventListener('click',toggleSettings);
  $('desktop-settings-close').addEventListener('click',()=>closeSettings(true));
  $('toggle').addEventListener('click',()=>closeSettings());
  document.addEventListener('topweb:menu-open',()=>closeSettings());
  $('game').addEventListener('pointerdown',()=>closeSettings());
  new MutationObserver(()=>{if(mobile())closeSettings();}).observe(body,{attributes:true,attributeFilter:['class']});
  // Keep the original mobile artwork; desktop skill tiles use the vector set.
  function drawSkillVectors(){
    const rows=[...$('rpg-skill-list').children].filter(row=>row.classList.contains('rpg-skill-entry'));
    $('rpg-skill-list').dataset.desktopSkills=String(rows.length>0);
    rows.forEach((row,index)=>{
      if(row.querySelector('.desktop-skill-icon'))return;
      const icon=document.createElement('span');icon.className='desktop-only desktop-skill-icon';icon.setAttribute('aria-hidden','true');
      icon.innerHTML=svg(['blade','flame','ice','vortex'][index%4]);row.prepend(icon);
    });
  }
  new MutationObserver(drawSkillVectors).observe($('rpg-skill-list'),{childList:true});drawSkillVectors();
  document.addEventListener('keydown',event=>{
    if(mobile()||event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
    if(event.target?.closest('#desktop-hud button,#desktop-hud summary,#rpg-hotbar button')&&['Space','Enter'].includes(event.code)){event.stopPropagation();return;}
    if(event.target?.closest('input,select,textarea,[contenteditable="true"]')){
      if(event.key==='Escape'&&settingsOpen()){event.preventDefault();event.stopPropagation();closeSettings(true);}
      return;
    }
    if(document.querySelector('dialog[open]')||body.classList.contains('rpg-open'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!event.repeat)toggleSettings();return;}
    if(settingsOpen()){
      if(event.key==='Tab'){
        const items=[...$('settings').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
        if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}
        else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}
      }
      return;
    }
    const shortcuts={KeyC:()=>open('stats'),KeyB:()=>open('inventory'),KeyK:()=>open('skills'),KeyM:onMap,KeyF:onAuto,KeyT:onTarget,KeyX:onRest};
    const action=shortcuts[event.code];
    if(action&&!event.repeat){event.preventDefault();event.stopPropagation();if(canOpen())action?.();}
  });
  function text(id,value){const el=$(id),next=String(value??'—');if(el.textContent!==next)el.textContent=next;}
  function meter(id,current,max){
    $(id+'-fill').style.width=ratio(current,max)+'%';
    const el=$(id+'-meter');el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax',String(max));el.setAttribute('aria-valuenow',String(Math.max(0,current)));
  }
  let lastIcon=null;
  function update({stats,position,context,target,auto,sailing,blocked,character,map,primaryLabel}){
    if(mobile())return;
    text('desktop-name',stats.name);text('desktop-level',stats.level);text('desktop-class',stats.className);
    text('desktop-hp',`${stats.hp} / ${stats.maxHp}`);text('desktop-mp',`${stats.mp} / ${stats.maxMp}`);
    meter('desktop-hp',stats.hp,stats.maxHp);meter('desktop-mp',stats.mp,stats.maxMp);
    const [xp,maxXp]=String(stats.xp).split('/').map(Number);meter('desktop-xp',xp,maxXp);
    text('desktop-xp-label',`XP ${stats.xp}`);text('desktop-xp-class',`${stats.className} · Nv. ${stats.level}`);
    text('desktop-location',map==='teampk'?'Torre da Provação':sailing?'Mar de Garner':position.x>2180&&position.x<2260&&position.z>2700&&position.z<2920?'Argent City':'Garner');
    text('desktop-coordinates',`${position.x.toFixed(0)}, ${position.z.toFixed(0)}`);
    $('desktop-player').dataset.character=character;
    $('desktop-player').setAttribute('aria-label',`${stats.name}, nível ${stats.level}. Abrir atributos (C)`);
    $('desktop-auto').setAttribute('aria-pressed',String(!!auto));
    for(const id of ['desktop-primary','desktop-auto','desktop-target','desktop-rest'])$(id).disabled=!!blocked;
    $('desktop-primary').title=`${primaryLabel||context.label||'Atacar'} (Espaço)`;
    $('desktop-primary').setAttribute('aria-label',primaryLabel||context.label||'Atacar');
    const symbol=context.icon||'#ui-swords';
    if(symbol!==lastIcon){$('desktop-primary-icon').innerHTML=`<svg viewBox="0 0 32 32" aria-hidden="true"><use></use></svg>`;$('desktop-primary-icon').querySelector('use').setAttribute('href',symbol);lastIcon=symbol;}
    document.querySelector('.combat-panel').dataset.desktopActive=String(!!target||!!context.npc||!!auto||stats.hp<=0);
    document.querySelector('.combat-panel').dataset.desktopTarget=String(!!target);
  }
  function record(message,kind='system'){
    if(mobile()||!message)return;
    const list=$('desktop-events'),stick=list.scrollHeight-list.clientHeight-list.scrollTop<24;
    const row=document.createElement('li');row.dataset.kind=kind;
    const time=document.createElement('time');time.textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const label=document.createElement('span');label.textContent=message;row.append(time,label);list.append(row);
    while(list.children.length>50)list.firstElementChild.remove();
    if(stick)list.scrollTop=list.scrollHeight;
  }
  function recordCombat(event){
    if(mobile())return;
    if(event.type==='hit'||event.type==='skillhit')record(`${event.monster.name} · ${event.damage?'-'+event.damage+' HP':'esquivou'}`,'hit');
    if(event.type==='hurt')record(event.damage?`Você recebeu ${event.damage} de dano.`:'Você esquivou.','damage');
    if(event.type==='kill'&&!event.monster.xp)record(`${event.monster.name} derrotado.`,'victory');
    if(event.type==='healed')record(`Você recuperou ${event.amount} HP.`,'victory');
  }
  record('Bem-vindo. Sua aventura é salva neste navegador.');
  return {update,record,recordCombat,closeSettings};
}
