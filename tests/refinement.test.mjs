import test from 'node:test';
import assert from 'node:assert/strict';
import {createHero,refreshHero,setRefinement,currentRefinement,selectClass,serializeHero,restoreHero} from '../js/hero-state.mjs';
import {refinementVisual} from '../js/refinement-rules.mjs';
test('refino é independente da proficiência e tem benefício real de ataque',()=>{
  const hero=createHero();assert.equal(setRefinement(hero,3),false);
  hero.equipped=true;refreshHero(hero);const base=hero.stats.attack;
  assert.equal(setRefinement(hero,13),true);assert.equal(hero.stats.attack,base+26);assert.equal(hero.practice.sword.level,10);
  assert.equal(currentRefinement(restoreHero(serializeHero(hero))),13);
  selectClass(hero,'hunter');assert.equal(currentRefinement(hero),0);setRefinement(hero,3);
  selectClass(hero,'crusader');assert.equal(currentRefinement(hero),13);
  hero.equipped=false;refreshHero(hero);assert.equal(currentRefinement(hero),0);
  hero.equipped=true;refreshHero(hero);setRefinement(hero,0);assert.equal(hero.stats.attack,base);
});
test('saves antigos mantêm nível/XP/classe/prática e recebem refino zero',()=>{
  const hero=createHero();hero.level=21;hero.xp=70;hero.practice.sword.level=40;
  const old=JSON.parse(serializeHero(hero));delete old.refinement;
  const restored=restoreHero(JSON.stringify(old));assert.equal(restored.level,21);assert.equal(restored.xp,70);assert.equal(restored.practice.sword.level,40);
  assert.equal(currentRefinement(restored),0);
  for(const value of [-1,14,1.5,NaN,'13']){restored.equipped=true;assert.equal(setRefinement(restored,value),false);}
});
test('mais refino aumenta aura, faíscas e filamentos com limites menores no mobile',()=>{
  assert.equal(refinementVisual(0).width,0);assert.equal(refinementVisual(0).particles,0);
  let previous=refinementVisual(0);
  for(let level=1;level<=13;level++){
    const next=refinementVisual(level);assert.ok(next.width>previous.width);assert.ok(next.intensity>previous.intensity);
    assert.ok(next.particles>=previous.particles);assert.ok(next.strands>=previous.strands);previous=next;
  }
  assert.ok(refinementVisual(13,true).particles<refinementVisual(13,false).particles);
  assert.equal(refinementVisual(13,true).particles,24);assert.equal(refinementVisual(13).strands,3);
});
