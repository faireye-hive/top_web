import {refreshHero,practiceKey,PRACTICES} from './hero-state.mjs?v=5';

// Usa as mesmas faixas aceitas pelo save e pela progressão normal.
export function gmRaiseHero(hero,amount){
  if(!Number.isInteger(amount)||amount<=0)return 0;
  const before=hero.level;hero.level=Math.min(1000,hero.level+amount);
  if(hero.level!==before)refreshHero(hero,{heal:true});
  return hero.level-before;
}
export function gmRaiseWeapon(hero,amount){
  if(!Number.isInteger(amount)||amount<=0)return 0;
  const practice=hero.practice[practiceKey(hero)],before=practice.level;
  practice.level=Math.min(200,practice.level+amount);
  if(practice.level!==before)refreshHero(hero);
  return practice.level-before;
}
export function initGmControls({hero,canUse,onChange,root=document}){
  const level=root.querySelector('#gm-hero-level'),weapon=root.querySelector('#gm-weapon-level');
  const note=root.querySelector('#gm-test-note'),buttons=[...root.querySelectorAll('[data-gm-boost]')];
  const text=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
  function update({arena=false,blocked=false}={}){
    const key=practiceKey(hero),name=PRACTICES[key];
    text(level,`Herói · nível ${hero.level} / 1000`);
    text(weapon,`${name} · nível ${hero.practice[key].level} / 200`);
    text(note,arena?'Prepare os níveis em Argent antes de entrar na Torre.':
      'Teste local, salvo neste navegador. Arma = proficiência do ataque em uso (+1 ataque por nível). Sem equipamento, aumenta Punhos.');
    for(const button of buttons)button.disabled=arena||blocked||
      (button.dataset.gmBoost==='hero'?hero.level>=1000:hero.practice[key].level>=200);
  }
  for(const button of buttons)button.addEventListener('click',()=>{
    if(!canUse())return;
    const weapon=button.dataset.gmBoost==='weapon';
    const gained=(weapon?gmRaiseWeapon:gmRaiseHero)(hero,Number(button.dataset.gmAmount));
    if(gained)onChange(weapon?`${PRACTICES[practiceKey(hero)]}: nível ${hero.practice[practiceKey(hero)].level}`:`Herói: nível ${hero.level}`);
  });
  update();return {update};
}
