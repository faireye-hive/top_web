import { availableSkillClips, resolveSlots, statText } from './rpg-state.mjs';
import { classSkillEntries } from './class-skills.mjs?v=3';
import {skillWithRules} from './skill-rules.mjs';
import {BAG_LAYOUT_KEY,bagLayout,filterInventory,inventorySelection} from './inventory-view.mjs';

export function initRpgHud({onPlayClip,onPlaySkill,onOpen,onClose,onMessage}={}){
  const $=id=>document.getElementById(id);
  const overlay=$('rpg-overlay'),trigger=$('rpg-open'),close=$('rpg-close'),content=$('rpg-skill-list');
  if(!overlay||!trigger||!close||!content)return {
    isOpen:()=>false,setClips:()=>{},setStats:()=>{},setItems:()=>{},setCombatState:()=>{},triggerSkill:()=>false
  };
  let available=[],slots=[null,null,null,null],classSkills=null,isOpen=false,lastFocused=null;
  const KEY='topweb_rpg_skill_slots_v1';
  let saved=null,combatState={cooldowns:{},mp:Infinity};
  let items=[],selectedItemKey=null;
  try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  const hotbar=[...document.querySelectorAll('[data-hotbar-slot]')];
  const panels=[...overlay.querySelectorAll('[data-rpg-panel]')];
  const tabs=[...overlay.querySelectorAll('[data-rpg-tab]')];
  const nameOf=name=>(name||'').split('·').pop().trim();
  const iconFor=name=>/ataque/i.test(name)?'⚔':/magia|skill/i.test(name)?'✦':'✧';
  const hotbarIcons=['#ui-blade','#ui-flame','#ui-ice','#ui-vortex'];
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(slots))}catch{}};
  function setTab(tab){
    $('rpg-panel').dataset.activeTab=tab;
    for(const b of tabs){
      const active=b.dataset.rpgTab===tab;
      b.classList.toggle('active',active);
      b.setAttribute('aria-selected',String(active));
      b.tabIndex=active?0:-1;
    }
    for(const panel of panels)panel.hidden=panel.dataset.rpgPanel!==tab;
  }
  function setBagLayout(value){
    const layout=bagLayout(value);$('rpg-panel').dataset.bagLayout=layout;
    for(const id of ['bag-layout','bag-layout-panel'])if($(id))$(id).value=layout;
    try{localStorage.setItem(BAG_LAYOUT_KEY,layout)}catch{}
    return layout;
  }
  let initialLayout='classic';try{initialLayout=localStorage.getItem(BAG_LAYOUT_KEY)}catch{}
  setBagLayout(initialLayout);
  for(const id of ['bag-layout','bag-layout-panel'])$(id)?.addEventListener('change',e=>setBagLayout(e.target.value));
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
  function setCombatState(state){
    combatState=state;
    for(const button of hotbar){
      const skill=skillWithRules(classSkills?.[Number(button.dataset.hotbarSlot)-1]);
      if(!skill)continue;
      const remaining=combatState.cooldowns[skill.id]||0;
      button.disabled=!skill.available||remaining>0||combatState.mp<skill.mana;
      button.classList.toggle('is-cooling',remaining>0);
      let timer=button.querySelector('.skill-cooldown');
      if(!timer){timer=document.createElement('span');timer.className='skill-cooldown';button.append(timer);}
      const value=remaining>0?String(Math.ceil(remaining)):'';
      if(timer.textContent!==value)timer.textContent=value;
      timer.hidden=!value;
      button.title=`${skill.name} · ${skill.mana} MP · ${skill.range?skill.range+' m':'em você'} · recarga ${skill.cooldown}s`;
    }
  }
  function drawHotbar(){
    for(const button of hotbar){
      const i=Number(button.dataset.hotbarSlot)-1;
      const skill=classSkills?.[i],name=skill?.name||slots[i];
      const ready=classSkills?!!skill?.available:!!name;
      button.disabled=!ready;
      button.classList.toggle('is-empty',!name);
      button.classList.toggle('skill-unavailable',!!skill&&!ready);
      const labelText=skill?skill.name:nameOf(name);
      button.setAttribute('aria-label',skill?
        `Atalho ${i+1}: ${labelText}${ready?'':' (animação ainda indisponível)'}`:
        (name?`Atalho ${i+1}: ${labelText}`:`Atalho ${i+1} vazio`));
      const icon=button.querySelector('.rpg-hotbar-symbol'),number=button.querySelector('.rpg-hotbar-number');
      if(icon){
        const previous=icon.querySelector('img');
        if(previous)previous.remove();
        const svg=icon.querySelector('svg');
        if(svg)svg.hidden=!!skill;
        if(skill?.icon){
          const img=document.createElement('img');
          img.className='skill-original-icon';img.alt='';
          img.loading='eager';img.decoding='async';
          img.src='assets/skills/'+skill.icon;
          img.addEventListener('error',()=>{img.hidden=true;if(svg)svg.hidden=false},{once:true});
          icon.append(img);
        }
      }
      if(number)number.textContent=String(i+1);
      button.title=skill?(labelText+(ready?'':' · ação de arma ausente neste GLB')):
        (name?nameOf(name):'Selecione uma animação no menu Skills');
    }
    setCombatState(combatState);
  }
  function drawSkills(){
    content.replaceChildren();
    if(classSkills){
      const title=document.createElement('p');title.className='rpg-empty';
      title.textContent='Toque em um monstro ou use Alvo. Aproxime-se automaticamente até o alcance da skill. Mover cancela a ação.';
      content.append(title);
      classSkills.forEach((skill,i)=>{
        const row=document.createElement('div');row.className='rpg-skill-entry';
        const image=document.createElement('img');
        image.src='assets/skills/'+skill.icon;image.alt='';image.loading='lazy';
        image.className='rpg-skill-original-icon';
        const label=document.createElement('div');label.className='rpg-skill-entry-label';
        const name=document.createElement('strong');name.textContent=(i+1)+'. '+skill.name;
        const detail=document.createElement('small');
        const rule=skillWithRules(skill);
        detail.textContent=skill.available?`${rule.mana} MP · ${rule.range?rule.range+' m':'em você'} · recarga ${rule.cooldown}s`:
          'Ação de arma ainda indisponível para este personagem';
        label.append(name,detail);
        const btn=document.createElement('button');btn.type='button';
        btn.textContent=skill.available?'▶':'—';btn.disabled=!skill.available;
        btn.title='Usar habilidade';btn.setAttribute('aria-label','Executar '+skill.name);
        btn.addEventListener('click',()=>triggerSkill(i+1));
        row.append(image,label,btn);content.append(row);
      });
      return;
    }
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
  function setClassSkills(catalog,job,character,clips){
    classSkills=classSkillEntries(catalog,job,character,clips);
    if(!catalog?.classes?.[job])classSkills=null;
    drawHotbar();drawSkills();
  }
  function setClips(clips){
    available=availableSkillClips(clips);
    slots=resolveSlots(saved,available,4);
    saved=slots.slice();persist();drawHotbar();drawSkills();
  }
  function triggerSkill(n){
    if(classSkills){
      const skill=classSkills[n-1];
      return !!(skill?.available&&onPlaySkill?.(skill));
    }
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
  function drawItemDetail(item){
    const detail=$('bag-item-detail');if(!detail)return;
    detail.hidden=!item;if(!item)return;
    $('bag-item-name').textContent=item.name;
    $('bag-item-description').textContent=item.description||item.slotName||'Equipamento';
    $('bag-item-status').textContent=item.equipped?'Equipado · parte do conjunto ativo':'Disponível · use Equipar conjunto para vestir';
  }
  function drawInventory(){
    const grid=$('rpg-inventory-grid');if(!grid)return;
    grid.replaceChildren();
    const valid=filterInventory(items,{query:$('bag-search')?.value||'',kind:$('bag-filter')?.value||'all'});
    const selected=inventorySelection(valid,selectedItemKey);selectedItemKey=selected?.key||null;
    const filtered=!!$('bag-search')?.value||$('bag-filter')?.value!=='all';
    const count=filtered?valid.length:24;
    for(let i=0;i<count;i++){
      const item=valid[i],button=document.createElement('button');button.type='button';
      button.className='rpg-item-slot';button.disabled=!item;
      const n=document.createElement('span');n.className='rpg-item-icon';
      n.textContent=item?(item.symbol||'◇'):'';
      button.append(n);
      const label=item?.name||`Espaço vazio ${i+1}`;
      button.setAttribute('aria-label',label+(item?` · ${item.slotName||''} · ${item.equipped?'Equipado':'Disponível'}`:''));button.title=label;
      if(item){
        button.dataset.itemKey=item.key;button.setAttribute('aria-pressed',String(item.key===selectedItemKey));
        button.classList.toggle('is-equipped',!!item.equipped);
        const text=document.createElement('span');text.className='bag-item-label';text.textContent=item.name;
        const state=document.createElement('span');state.className='bag-item-state';state.textContent=`${item.slotName||'Item'} · ${item.equipped?'Equipado':'Disponível'}`;
        button.append(text,state);
        if(item.equipped){const marker=document.createElement('span');marker.className='bag-equipped-marker';marker.textContent='✓';marker.setAttribute('aria-hidden','true');button.append(marker);}
      }
      if(item?.quantity>1){
        const count=document.createElement('small');count.textContent=String(item.quantity);button.append(count);
      }
      if(item)button.addEventListener('click',()=>{
        selectedItemKey=item.key;
        for(const slot of grid.querySelectorAll('[data-item-key]'))slot.setAttribute('aria-pressed',String(slot.dataset.itemKey===selectedItemKey));
        drawItemDetail(item);
      });
      grid.append(button);
    }
    const empty=$('rpg-inventory-empty');if(empty)empty.hidden=valid.some(Boolean);
    const counter=$('bag-count');if(counter)counter.textContent=filtered?`${valid.length} de ${items.length} itens`:`${items.length} / 24 espaços · classe atual`;
    drawItemDetail(selected);
  }
  function setItems(value=[]){items=Array.isArray(value)?value.slice(0,24):[];drawInventory();}
  $('bag-search')?.addEventListener('input',drawInventory);
  $('bag-filter')?.addEventListener('change',drawInventory);
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
      const focusables=[...overlay.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),a[href],summary')]
        .filter(el=>el.offsetParent!==null&&el.tabIndex>=0);
      if(!focusables.length)return;
      const first=focusables[0],last=focusables.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  setItems([]);setStats({name:'Lance'});drawHotbar();setTab('stats');
  return {isOpen:()=>isOpen,open,dismiss,setClips,setClassSkills,setStats,setItems,setBagLayout,setCombatState,triggerSkill};
}
