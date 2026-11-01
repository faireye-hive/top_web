import test from 'node:test';
import assert from 'node:assert/strict';
import {gmRaiseHero,gmRaiseWeapon,initGmControls} from '../js/gm-controls.mjs';
import {createHero,refreshHero,selectClass,serializeHero,restoreHero} from '../js/hero-state.mjs';

test('GM aumenta atributos reais, recupera recursos e preserva XP e save',()=>{
  const hero=createHero();hero.xp=17;hero.hp=1;hero.mp=2;
  assert.equal(gmRaiseHero(hero,10),10);assert.equal(hero.level,11);assert.equal(hero.xp,17);
  assert.equal(hero.hp,hero.stats.maxHp);assert.equal(hero.mp,hero.stats.maxMp);
  assert.ok(hero.stats.attack>16);assert.ok(hero.stats.defense>5);
  const saved=restoreHero(serializeHero(hero));
  assert.equal(saved.level,11);assert.equal(saved.xp,17);assert.deepEqual(saved.stats,hero.stats);
});
test('GM melhora somente a arma ativa e mantém práticas ao trocar classe e equipamento',()=>{
  const hero=createHero();hero.equipped=true;refreshHero(hero);const attack=hero.stats.attack;
  assert.equal(gmRaiseWeapon(hero,10),10);assert.equal(hero.stats.attack,attack+10);
  assert.equal(hero.practice.sword.level,20);assert.equal(hero.practice.unarmed.level,10);
  selectClass(hero,'hunter');assert.equal(gmRaiseWeapon(hero,1),1);
  assert.equal(hero.practice.bow.level,11);assert.equal(hero.practice.sword.level,20);
  hero.equipped=false;refreshHero(hero);gmRaiseWeapon(hero,1);
  assert.equal(hero.practice.unarmed.level,11);
  assert.deepEqual(restoreHero(serializeHero(hero)).practice,hero.practice);
});
test('limites e entradas inválidas não corrompem o progresso',()=>{
  const hero=createHero();
  for(const amount of [0,-1,1.5,NaN,Infinity,'10']){
    assert.equal(gmRaiseHero(hero,amount),0);assert.equal(gmRaiseWeapon(hero,amount),0);
  }
  assert.equal(gmRaiseHero(hero,999),999);assert.equal(gmRaiseHero(hero,10),0);
  assert.equal(gmRaiseWeapon(hero,199),190);assert.equal(gmRaiseWeapon(hero,1),0);
  assert.equal(restoreHero(serializeHero(hero)).level,1000);
  assert.equal(restoreHero(serializeHero(hero)).practice.unarmed.level,200);
});
test('botões respeitam bloqueio no clique, atualizam arma e limites no menu',()=>{
  const hero=createHero(),els=new Map(),buttons=[];let allowed=false,changes=0;
  for(const type of ['hero','weapon'])for(const amount of ['1','10'])buttons.push({
    dataset:{gmBoost:type,gmAmount:amount},addEventListener(_,click){this.click=click;}
  });
  const root={querySelector(selector){if(!els.has(selector))els.set(selector,{});return els.get(selector);},querySelectorAll(){return buttons;}};
  const ui=initGmControls({hero,root,canUse:()=>allowed,onChange:()=>changes++});
  buttons[0].click();assert.equal(hero.level,1);assert.equal(changes,0);
  allowed=true;buttons[1].click();assert.equal(hero.level,11);assert.equal(changes,1);
  ui.update({arena:true});assert.ok(buttons.every(b=>b.disabled));
  assert.match(els.get('#gm-test-note').textContent,/Argent/);
  ui.update();assert.ok(buttons.every(b=>!b.disabled));
  assert.match(els.get('#gm-weapon-level').textContent,/Punhos/);
});
