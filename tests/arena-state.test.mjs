import test from 'node:test';
import assert from 'node:assert/strict';
import {createArenaRun,arenaChoices,arenaWave,arenaDestination,ARENA_RETURN,isArenaAdministrator} from '../js/arena-state.mjs';
import {createHero,refreshHero,serializeHero,restoreHero} from '../js/hero-state.mjs';
test('andares exigem eliminar toda a horda e escolher exatamente um de três atributos',()=>{
  const run=createArenaRun();assert.equal(run.floor,1);assert.equal(run.choose('strength','crusader'),false);
  assert.equal(run.complete([]),false);assert.equal(run.complete([{hp:0},{hp:1}]),false);
  assert.equal(run.complete([{hp:0},{hp:0}]),true);assert.equal(run.phase,'choice');
  assert.equal(run.complete([{hp:0}]),false);assert.equal(run.choose('bogus','crusader'),false);
  const choices=arenaChoices(run.floor,'crusader');assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.attribute)).size,3);
  assert.equal(run.choose('constitution','crusader'),true);assert.equal(run.floor,2);assert.equal(run.bonuses.constitution,3);
  assert.equal(run.choose('strength','crusader'),false);assert.equal(run.bonuses.strength,0);
  for(const job of ['cleric','sharpshooter','champion','voyager'])assert.equal(new Set(arenaChoices(2,job).map(c=>c.attribute)).size,3);
});
test('restauração conserva bônus e escolha pendente; saves incoerentes não concedem pontos',()=>{
  const run=createArenaRun();run.complete([{hp:0}]);run.choose('strength','crusader');run.complete([{hp:0}]);
  const restored=createArenaRun(run.serialize());assert.equal(restored.floor,2);assert.equal(restored.phase,'choice');assert.equal(restored.bonuses.strength,3);
  const invalid=JSON.parse(run.serialize());invalid.bonuses.strength=300;assert.equal(createArenaRun(invalid).floor,1);
  assert.equal(createArenaRun('bad json').floor,1);restored.finish();assert.equal(restored.choose('constitution','crusader'),false);
});
test('melhorias afetam stats na tentativa e nunca são gravadas no personagem permanente',()=>{
  const hero=createHero(),base=serializeHero(hero),max=hero.stats.maxHp;
  hero.arenaBonuses={constitution:3,strength:3};refreshHero(hero);
  assert.equal(hero.stats.maxHp,max+36);assert.equal(hero.stats.defense,8);assert.equal(hero.stats.attack,22);
  refreshHero(hero);assert.equal(hero.stats.maxHp,max+36,'não acumula novamente ao recalcular');
  assert.equal(serializeHero(hero),base);assert.equal(restoreHero(serializeHero(hero)).stats.maxHp,max);
});
test('hordas usam um único modelo agressivo, sem respawn, com escala crescente e limite de instâncias',()=>{
  const first=arenaWave(1),later=arenaWave(20),last=arenaWave(10000);
  assert.equal(first.spawns.length,2);assert.ok(later.spawns.length>first.spawns.length);assert.equal(last.spawns.length,8);
  const type=first.species['forest-spirit'];assert.equal(type.aggressive,true);assert.equal(type.respawn,false);assert.equal(type.xp,0);
  assert.equal(new Set(last.spawns.map(s=>s.species)).size,1);assert.ok(later.species['forest-spirit'].attack>type.attack);
  assert.ok(later.species['forest-spirit'].maxHp>type.maxHp);assert.ok(Number.isFinite(last.species['forest-spirit'].maxHp));
});
test('transporte usa teampk e retorna a 2207,2891 preservando parâmetros de câmera e depuração',()=>{
  const from='https://example.test/top_web/?debug=0&spawn=2207,2891&boat=1';
  const enter=new URL(arenaDestination(from,{enter:true}));assert.equal(enter.searchParams.get('map'),'teampk');assert.equal(enter.searchParams.has('spawn'),false);
  const back=new URL(arenaDestination(enter.href,{defeated:true,floor:7}));
  assert.equal(back.searchParams.get('spawn'),`${ARENA_RETURN.x},${ARENA_RETURN.z}`);assert.equal(back.searchParams.has('map'),false);
  assert.equal(back.searchParams.get('debug'),'0');assert.equal(back.searchParams.get('arenaResult'),'defeat');
  assert.equal(isArenaAdministrator({serial:52}),true);assert.equal(isArenaAdministrator({name:'Arena Administrator'}),true);assert.equal(isArenaAdministrator({serial:21}),false);
});
