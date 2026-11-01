import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {indexMonsterSpawns,createMonsterPopulation,monsterBudget} from '../js/monster-population.mjs';
import {arenaWave} from '../js/arena-state.mjs';
const type={name:'Forest Spirit',model:'models/forest-spirit.glb',maxHp:69};
const data=(spawns)=>({streaming:true,species:{forest:type},spawns:spawns.map(s=>({species:'forest',...s}))});
const free=(x,z)=>[x,z];

test('nascimentos publicados preservam 160 regiões e todas as espécies/quantidades originais',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/monsters/manifest.json',import.meta.url)));
  assert.equal(manifest.map,'garner');assert.equal(manifest.streaming,true);
  assert.equal(manifest.regions.length,160);assert.equal(Object.keys(manifest.species).length,129);
  assert.equal(manifest.spawns.length,10435);assert.match(manifest.source,/garnerChaSpn.txt/);
  const counts=new Map();
  for(const spawn of manifest.spawns){
    const species=manifest.species[spawn.species];assert.ok(species);
    const region=manifest.regions.find(r=>r.id===spawn.region);assert.ok(region);
    assert.ok(spawn.x>=Math.min(region.start[0],region.end[0])&&spawn.x<=Math.max(region.start[0],region.end[0]));
    assert.ok(spawn.z>=Math.min(region.start[1],region.end[1])&&spawn.z<=Math.max(region.start[1],region.end[1]));
    const key=`${spawn.region}:${species.sourceCharacterId}`;
    counts.set(key,(counts.get(key)||0)+1);
    assert.equal(spawn.respawnSeconds,region.respawnSeconds[region.characters.indexOf(species.sourceCharacterId)]);
  }
  for(const region of manifest.regions)region.characters.forEach((id,i)=>assert.equal(counts.get(`${region.id}:${id}`),region.counts[i]));
  for(const species of Object.values(manifest.species)){
    assert.ok(existsSync(new URL(`../assets/monsters/${species.model}`,import.meta.url)));
    assert.ok(species.level>0&&species.maxHp>0);assert.ok(['land','sea'].includes(species.habitat));
  }
  assert.equal(manifest.species['original-103'].name,'Forest Spirit');
  assert.equal(manifest.species['original-103'].level,3);
});
test('índice encontra nascimentos distantes e nas bordas de setores, ordenados por distância',()=>{
  const query=indexMonsterSpawns([{x:0,z:0},{x:64,z:64},{x:63,z:64},{x:3000,z:3000}]);
  assert.deepEqual(query({x:64,z:64},1).map(s=>s.id),[1,2]);
  assert.deepEqual(query({x:3000,z:3000},10).map(s=>s.id),[3]);
});
test('mobile e desktop ativam limites diferentes e liberam atores ao atravessar o mundo',()=>{
  const manifest=data(Array.from({length:100},(_,i)=>({x:2000+(i%10),z:2700+Math.floor(i/10)})));
  const mobile=monsterBudget(true),desktop=monsterBudget(false),released=[];
  assert.ok(mobile.radius<desktop.radius);assert.ok(mobile.loads<desktop.loads);
  const population=createMonsterPopulation({manifest,findSpawn:free,budget:mobile,release:m=>released.push(m.id)});
  const sharedArray=population.monsters;population.sync({x:2000,z:2700});
  assert.equal(sharedArray.length,mobile.limit);
  const larger=createMonsterPopulation({manifest,findSpawn:free,budget:desktop});larger.sync({x:2000,z:2700});
  assert.equal(larger.monsters.length,desktop.limit);
  population.sync({x:400,z:300});assert.equal(population.monsters,sharedArray);
  assert.equal(sharedArray.length,0);assert.equal(released.length,mobile.limit);
  for(const m of larger.monsters)m.engaged=true;
  const target=larger.monsters.at(-1);Object.assign(desktop,mobile);
  larger.sync({x:2000,z:2700},target);
  assert.equal(larger.monsters.length,mobile.limit);assert.ok(larger.monsters.includes(target));
});
test('pontos sem terreno são tentados novamente; alvo em combate mantém vaga',()=>{
  let available=false;
  const manifest=data([{x:1,z:0},{x:2,z:0}]);
  const p=createMonsterPopulation({manifest,findSpawn:(x,z)=>available?free(x,z):null,budget:{limit:1,radius:55}});
  p.sync({x:0,z:0});assert.equal(p.monsters.length,0);
  available=true;p.sync({x:0,z:0});const target=p.monsters[0];target.engaged=true;
  p.sync({x:2,z:0},target);assert.equal(p.monsters[0],target);
  p.sync({x:500,z:500},target);assert.equal(p.monsters.length,0);assert.equal(target.engaged,false);
});
test('ao embarcar, criaturas do mar têm prioridade sobre inimigos terrestres mais próximos',()=>{
  const manifest={streaming:true,species:{land:{...type,habitat:'land'},sea:{...type,habitat:'sea'}},
    spawns:[{species:'land',x:1,z:0},{species:'land',x:2,z:0},{species:'sea',x:12,z:0},{species:'sea',x:14,z:0}]};
  const p=createMonsterPopulation({manifest,findSpawn:free,budget:{limit:2,radius:55}});
  p.sync({x:0,z:0},null,0,{habitat:'land'});p.monsters.forEach(m=>m.engaged=true);
  p.sync({x:0,z:0},null,0,{habitat:'sea'});assert.equal(p.monsters.length,2);
  assert.ok(p.monsters.every(m=>m.habitat==='sea'));
});
test('sair e voltar não revive um monstro antes de seu respawn original',()=>{
  const p=createMonsterPopulation({manifest:data([{x:1,z:0,respawnSeconds:120}]),findSpawn:free});
  p.sync({x:0,z:0});const m=p.monsters[0];m.hp=0;m.respawnIn=120;m.pending=true;
  p.sync({x:500,z:500});assert.equal(m.ready,false);assert.equal(m.pending,false);assert.equal(m.loadVersion,1);
  p.sync({x:0,z:0},null,20);assert.equal(p.monsters[0],m);assert.equal(m.hp,0);assert.equal(m.respawnIn,100);
  p.sync({x:500,z:500});p.sync({x:0,z:0},null,101);assert.equal(m.hp,m.maxHp);
});
test('Torre conserva todas as instâncias e substitui hordas na mesma lista do combate',()=>{
  const p=createMonsterPopulation({manifest:arenaWave(1),findSpawn:free});
  const list=p.monsters;assert.equal(list.length,2);list[0].hp=0;
  p.sync({x:4000,z:4000});assert.equal(list.length,2);assert.equal(list[0].hp,0);
  const wave=arenaWave(20);p.reset(wave);assert.equal(p.monsters,list);assert.equal(list.length,wave.spawns.length);
  assert.ok(list.every(m=>m.hp===m.maxHp&&m.respawn===false));
});
