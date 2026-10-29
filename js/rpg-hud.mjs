import { availableSkillClips, resolveSlots, statText } from './rpg-state.mjs';

export function initRpgHud({onPlayClip,onOpen,onClose,onMessage}={}){
  const $=id=>document.getElementById(id);
  const overlay=$('rpg-overlay'),trigger=$('rpg-open'),close=$('rpg-close'),content=$('rpg-skill-list');
  if(!overlay||!trigger||!close||!content)return {
    isOpen:()=>false,setClips:()=>{},setStats:()=>{},setItems:()=>{},triggerSkill:()=>false
  };
  let available=[],slots=[null,null,null,null],isOpen=false,lastFocused=null;
  const KEY='topweb_rpg_skill_slots_v1';
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  const hotbar=[...document.querySelectorAll('[data-hotbar-slot]')];
  const panels=[...overlay.querySelectorAll('[data-rpg-panel]')];
  const tabs=[...overlay.querySelectorAll('[data-rpg-tab]')];
  const nameOf=name=>(name||'').split('·').pop().trim();
  const iconFor=name=>/ataque/i.test(name)?'⚔':/magia|skill/i.test(name)?'✦':'✧';
  const hotbarIcons=['#ui-blade','#ui-flame','#ui-ice','#ui-vortex'];
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(slots))}catch{}};
  function setTab(tab){
    for(const b of tabs){
      const active=b.dataset.rpgTab===tab;
      b.classList.toggle('active',active);
      b.setAttribute('aria-selected',String(active));
      b.tabIndex=active?0:-1;
    }
    for(const panel of panels)panel.hidden=panel.dataset.rpgPanel!==tab;
  }
  function open(tab='stats'){
    if(isOpen){setTab(tab);return;}
    isOpen=true;lastFocused=document.activeElement;
    document.body.classList.remove('mobile-settings-open');
    document.body.classList.add('rpg-open');
    overlay.hidden=false;
    trigger.setAttribute('aria-expanded','true');
    setTab(tab);
    onOpen?.();
    close.focus({preventScroll:true});
  }
  function dismiss(){
    if(!isOpen)return;
    isOpen=false;overlay.hidden=true;
    document.body.classList.remove('rpg-open');
    trigger.setAttribute('aria-expanded','false');
    onClose?.();
    if(lastFocused&&lastFocused.isConnected)lastFocused.focus({preventScroll:true});
    else trigger.focus({preventScroll:true});
  }
  function drawHotbar(){
    for(const button of hotbar){
      const i=Number(button.dataset.hotbarSlot)-1,name=slots[i];
      button.disabled=!name;
      button.classList.toggle('is-empty',!name);
      button.setAttribute('aria-label',name?`Atalho ${i+1}: ${nameOf(name)}`:`Atalho ${i+1} vazio`);
      const ic=button.querySelector('.rpg-hotbar-symbol');
      const label=button.querySelector('.rpg-hotbar-number');
      const iconUse=ic?.querySelector('use');
      if(iconUse)iconUse.setAttribute('href',hotbarIcons[i]||hotbarIcons[0]);
      else if(ic)ic.textContent=name?iconFor(name):'+';
      if(label)label.textContent=String(i+1);
      button.title=name?nameOf(name):'Selecione uma animação no menu Skills';
    }
  }
  function drawSkills(){
    content.replaceChildren();
    if(!available.length){
      const p=document.createElement('p');p.className='rpg-empty';
      p.textContent='Nenhuma animação de skill disponível neste personagem.';
      content.append(p);return;
    }
    for(const clip of available){
      const row=document.createElement('div');row.className='rpg-skill-entry';
      const icon=document.createElement('div');icon.className='rpg-skill-entry-icon';icon.textContent=iconFor(clip);
      const text=document.createElement('div');text.className='rpg-skill-entry-label';
      const title=document.createElement('strong');title.textContent=nameOf(clip);
      const desc=document.createElement('small');desc.textContent='Animação do modelo · sem dano/efeito ainda';
      text.append(title,desc);
      const actions=document.createElement('div');actions.className='rpg-assign-actions';
      for(let i=0;i<4;i++){
        const b=document.createElement('button');b.type='button';b.textContent=String(i+1);
        b.title=`Usar ${nameOf(clip)} no atalho ${i+1}`;
        b.setAttribute('aria-label',b.title);
        b.classList.toggle('selected',slots[i]===clip);
        b.addEventListener('click',()=>{
          const other=slots.indexOf(clip);if(other>=0&&other!==i)slots[other]=null;
          slots[i]=clip;slots=resolveSlots(slots,available,4);persist();drawSkills();drawHotbar();
          onMessage?.(`Atalho ${i+1}: ${nameOf(clip)}`);
        });
        actions.append(b);
      }
      row.append(icon,text,actions);content.append(row);
    }
  }
  function setClips(clips){
    available=availableSkillClips(clips);
    slots=resolveSlots(saved,available,4);
    saved=slots.slice();persist();drawHotbar();drawSkills();
  }
  function triggerSkill(n){
    const clip=slots[n-1];
    if(!clip)return false;
    if(typeof onPlayClip!=='function')return false;
    return !!onPlayClip(clip);
  }
  function setStats(stats={}){
    for(const el of overlay.querySelectorAll('[data-rpg-stat]')){
      el.textContent=statText(stats[el.dataset.rpgStat]);
    }
    const desktopName=$('desktop-character-name');if(desktopName)desktopName.textContent=String(stats.name||'Lance');
    const mobileName=$('mobile-character-name');if(mobileName)mobileName.textContent=String(stats.name||'Lance');
    const display=$('rpg-character-name');
    if(display)display.textContent=String(stats.name||'Lance');
    const hp=$('mobile-hp'),mp=$('mobile-mp');
    const hpFill=$('mobile-hp-fill'),mpFill=$('mobile-mp-fill');
    const applyBar=(label,fill,current,max)=>{
      const valid=typeof current==='number'&&Number.isFinite(current) &&
        typeof max==='number'&&Number.isFinite(max)&&max>0;
      if(label)label.textContent=valid?`${statText(current)} / ${statText(max)}`:'—';
      if(fill)fill.style.width=valid?`${Math.round(Math.max(0,Math.min(1,current/max))*100)}%`:'0%';
    };
    applyBar(hp,hpFill,stats.hp,stats.maxHp);
    applyBar(mp,mpFill,stats.mp,stats.maxMp);
    const info=$('rpg-stats-pending');
    if(info)info.hidden=Object.keys(stats).some(k=>k!=='name'&&stats[k]!=null);
  }
  function setItems(items=[]){
    const grid=$('rpg-inventory-grid');if(!grid)return;
    grid.replaceChildren();
    const valid=Array.isArray(items)?items.slice(0,24):[];
    for(let i=0;i<24;i++){
      const item=valid[i],button=document.createElement('button');button.type='button';
      button.className='rpg-item-slot';button.disabled=!item;
      const n=document.createElement('span');n.className='rpg-item-icon';
      n.textContent=item?(item.symbol||'◇'):'';
      button.append(n);
      const label=item?.name||`Espaço vazio ${i+1}`;
      button.setAttribute('aria-label',label);button.title=label;
      if(item?.quantity>1){
        const count=document.createElement('small');count.textContent=String(item.quantity);button.append(count);
      }
      if(item)button.addEventListener('click',()=>onMessage?.(label));
      grid.append(button);
    }
    const empty=$('rpg-inventory-empty');if(empty)empty.hidden=valid.some(Boolean);
  }
  trigger.addEventListener('click',()=>isOpen?dismiss():open());
  for(const nav of document.querySelectorAll('[data-open-rpg]')){
    nav.addEventListener('click',()=>open(nav.dataset.openRpg));
  }
  close.addEventListener('click',dismiss);
  overlay.querySelector('.rpg-backdrop')?.addEventListener('click',dismiss);
  for(const tab of tabs)tab.addEventListener('click',()=>setTab(tab.dataset.rpgTab));
  hotbar.forEach(btn=>btn.addEventListener('click',()=>triggerSkill(Number(btn.dataset.hotbarSlot))));
  document.addEventListener('keydown',e=>{
    if(!isOpen)return;
    if(e.key==='Escape'){e.preventDefault();dismiss();}
    if(e.key==='Tab'){
      const focusables=[...overlay.querySelectorAll('button:not([disabled]):not([hidden])')]
        .filter(el=>el.offsetParent!==null);
      if(!focusables.length)return;
      const first=focusables[0],last=focusables.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  setItems([]);setStats({name:'Lance'});drawHotbar();setTab('stats');
  return {isOpen:()=>isOpen,open,dismiss,setClips,setStats,setItems,triggerSkill};
}
