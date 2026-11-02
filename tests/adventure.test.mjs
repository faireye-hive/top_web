import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {validateContent} from '../js/content-data.mjs';
import {createAdventure} from '../js/adventure-state.mjs';
import {createHero,gainExperience,restoreHero,serializeHero} from '../js/hero-state.mjs';
import {createCombat} from '../js/combat-state.mjs';
import {createMonsterPopulation} from '../js/monster-population.mjs';
import {isArenaAdministrator} from '../js/arena-state.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const species=read('assets/monsters/manifest.json').species;
const published={version:1,npcs:read('assets/npcs/manifest.json').npcs};
for(const [key,name] of Object.entries({items:'items',quests:'quests',drops:'drops',services:'npc-services'}))published[key]=read(`assets/content/${name}.json`);
const start='garner-npc-21',end='garner-npc-10',shop='garner-npc-18',qid='test-supplies';
// Fixture independente: editar os JSONs não exige reescrever os testes das regras.
const fixture={version:1,npcs:[start,end,shop].map(id=>({id,name:id,model:'models/npc_0011.glb',x:10,z:10,yaw:0})),
  items:[['bee-honey',3],['forest-seed',2],['supply-token',10]].map(([id,sellPrice])=>({id,name:id,sellPrice,kind:'material',symbol:'◆',description:''})),
  quests:[{id:qid,name:'Teste',description:'Suprimentos',startNpcId:start,endNpcId:end,minimumLevel:1,requires:[],
    objectives:[{id:'defeat-spirits',type:'kill',speciesId:'original-103',quantity:3},{id:'collect-honey',type:'collect',itemId:'bee-honey',quantity:2}],
    rewards:{gold:40,xp:80,items:[{itemId:'supply-token',quantity:1}]}}],
  drops:[{speciesId:'original-103',items:[{itemId:'forest-seed',chance:1,min:1,max:2}]},{speciesId:'original-206',items:[{itemId:'bee-honey',chance:1,min:1,max:1}]}],
  services:[start,end,shop].map(npcId=>({npcId,dialogue:'Olá',buysItems:npcId===shop,shop:npcId===shop?[{itemId:'bee-honey',quantity:1,price:8}]:[],
    trades:npcId===shop?[{id:'seeds-for-honey',name:'Troca',goldCost:0,cost:[{itemId:'forest-seed',quantity:3}],reward:[{itemId:'bee-honey',quantity:1}]}]:[]}))};
const content=()=>validateContent(fixture,species);
const run=(data=content(),extra={})=>createAdventure({content:data,random:()=>0,...extra});
function fulfill(a){a.accept(qid,start,1);for(let i=0;i<3;i++)a.kill('original-103');for(let i=0;i<2;i++)a.kill('original-206');}

test('conteúdo publicado tem NPCs únicos permanentes, espécies originais e modelos disponíveis',()=>{
  const data=validateContent(published,species);
  assert.equal(new Set(data.npcs.map(n=>n.id)).size,data.npcs.length);
  for(const n of data.npcs)assert.ok(existsSync(new URL('../assets/npcs/'+n.model,import.meta.url)));
  assert.equal(isArenaAdministrator({id:'npc-copy',serial:52,name:'Arena Administrator'}),false);
  assert.equal(isArenaAdministrator({id:'garner-npc-52'}),true);
});
test('NPC, espécie, item, pré-requisito e ID incorretos são rejeitados antes de aplicar',()=>{
  const cases=[
    d=>d.npcs.push({...d.npcs[0]}),d=>d.items.push({...d.items[0]}),d=>d.npcs[0].x=NaN,
    d=>d.quests[0].startNpcId='missing',d=>d.quests[0].endNpcId='missing',
    d=>d.quests[0].objectives[0].speciesId='missing',d=>d.quests[0].objectives[1].itemId='missing',
    d=>d.drops[0].items[0].chance=1.1,d=>d.drops[0].items[0].min=0,
    d=>d.services[2].shop[0].price=-1,d=>d.services[2].trades[0].cost.push({...d.services[2].trades[0].cost[0]}),
    d=>d.quests[0].objectives.push({...d.quests[0].objectives[1],id:'other'}),
    d=>d.quests[0].requires=['missing'],d=>d.quests[0].requires=[qid]
  ];
  for(const mutate of cases){const d=content();mutate(d);assert.throws(()=>validateContent(d,species));}
  const d=content();d.quests.push({...structuredClone(d.quests[0]),id:'second',requires:[qid]});d.quests[0].requires=['second'];
  assert.throws(()=>validateContent(d,species),/ciclo/);
});
test('mesma espécie compartilha speciesId sem confundir com ID da instância',()=>{
  const p=createMonsterPopulation({manifest:{species,spawns:[{species:'original-103',x:1,z:2},{species:'original-103',x:2,z:2}]},findSpawn:(x,z)=>[x,z]});
  assert.notEqual(p.monsters[0].id,p.monsters[1].id);
  assert.equal(p.monsters[0].speciesId,'original-103');assert.equal(p.monsters[1].speciesId,'original-103');
});
test('missão conta apenas abates após aceitar, coleta outro monstro e entrega apenas no NPC correto',()=>{
  const a=run();a.kill('original-103');assert.throws(()=>a.accept(qid,end,1));a.accept(qid,start,1);
  assert.throws(()=>a.accept(qid,start,1));assert.throws(()=>a.complete(qid,end));
  a.kill('original-75');assert.equal(a.progress(fixture.quests[0])[0].current,0);
  for(let i=0;i<3;i++)a.kill('original-103');a.kill('original-206');assert.equal(a.ready(fixture.quests[0]),false);
  a.kill('original-206');assert.equal(a.ready(fixture.quests[0]),true);assert.throws(()=>a.complete(qid,start));
  const reward=a.complete(qid,end);assert.equal(reward.xp,80);assert.equal(a.state.gold,40);
  assert.equal(a.quantity('bee-honey'),0);assert.equal(a.quantity('supply-token'),1);assert.equal(a.status(qid),'completed');
  const snapshot=a.serialize();assert.throws(()=>a.complete(qid,end));assert.throws(()=>a.accept(qid,start,1));assert.equal(a.serialize(),snapshot);
});
test('compras, vendas e trocas são atômicas e materiais gastos deixam de contar para a missão',()=>{
  const a=run();fulfill(a);const before=a.serialize();assert.throws(()=>a.buy(shop,0));assert.equal(a.serialize(),before);
  a.sell(shop,'bee-honey');assert.equal(a.ready(fixture.quests[0]),false);assert.equal(a.state.gold,3);
  a.trade(shop,'seeds-for-honey');assert.equal(a.quantity('forest-seed'),0);assert.equal(a.ready(fixture.quests[0]),true);
  const beforeTrade=a.serialize();assert.throws(()=>a.trade(shop,'seeds-for-honey'));assert.equal(a.serialize(),beforeTrade);
  assert.throws(()=>a.sell(start,'bee-honey'));assert.throws(()=>a.buy(start,0));assert.throws(()=>a.buy(shop,-1));
  a.complete(qid,end);a.buy(shop,0);assert.equal(a.quantity('bee-honey'),1);assert.equal(a.state.gold,35);
});
test('progresso, ouro e inventário sobrevivem a recarga e recompensas não são repetidas',()=>{
  let a=run();fulfill(a);a=run(content(),{raw:a.serialize()});assert.equal(a.ready(fixture.quests[0]),true);
  const hero=createHero();gainExperience(hero,a.complete(qid,end).xp);
  assert.equal(restoreHero(serializeHero(hero)).level,2);
  a=run(content(),{raw:a.serialize()});assert.equal(a.status(qid),'completed');assert.equal(a.state.gold,40);
  assert.equal(a.bagItems().find(i=>i.id==='supply-token').quantity,1);assert.throws(()=>a.complete(qid,end));
});
test('pré-requisitos e nível bloqueiam aceitação até conclusão da missão anterior',()=>{
  const d=content();d.quests.push({...structuredClone(d.quests[0]),id:'second',minimumLevel:3,requires:[qid]});
  const a=run(validateContent(d,species));assert.throws(()=>a.accept('second',start,100));fulfill(a);a.complete(qid,end);
  assert.throws(()=>a.accept('second',start,2));a.accept('second',start,3);assert.equal(a.status('second'),'active');
});
test('recompensas grandes respeitam o nível máximo e continuam recuperáveis após recarregar',()=>{
  const hero=createHero();gainExperience(hero,1e9);assert.equal(hero.level,1000);
  const recovered=restoreHero(serializeHero(hero));assert.equal(recovered.level,1000);assert.equal(recovered.xp,39999);
});
test('probabilidade zero e um e intervalo de quantidade são aplicados por espécie',()=>{
  const d=content();d.drops[0].items=[{itemId:'forest-seed',chance:0,min:1,max:1},{itemId:'bee-honey',chance:1,min:2,max:4}];
  const a=run(d,{random:()=>.999});a.kill('original-103');assert.equal(a.quantity('forest-seed'),0);assert.equal(a.quantity('bee-honey'),4);
  a.kill('unknown');assert.equal(a.quantity('bee-honey'),4);
});
test('estado inválido não injeta ouro, quantidades ou contadores negativos',()=>{
  const a=run(content(),{raw:{version:1,gold:-1,inventory:{'bee-honey':-2},quests:{[qid]:{status:'active',kills:{'defeat-spirits':NaN}}}}});
  assert.equal(a.state.gold,0);assert.equal(a.quantity('bee-honey'),0);assert.equal(a.progress(fixture.quests[0])[0].current,0);
  assert.equal(run(content(),{raw:'bad JSON'}).state.gold,0);
});
test('evento real de morte concede drop e objetivo uma vez, inclusive após impacto adicional',()=>{
  const a=run(),hero=createHero();a.accept(qid,start,1);
  const monster={...species['original-103'],id:1,speciesId:'original-103',x:1,z:0,ready:true,hp:1,respawnSeconds:10};
  let deaths=0;
  const c=createCombat({hero,monsters:[monster],random:()=>0,onEvent:e=>{if(e.type==='kill'){deaths++;a.kill(e.monster.speciesId);}}});
  c.selectTarget(monster,{x:0,z:0});c.manualAttack({x:0,z:0});
  for(let i=0;i<10;i++)c.update(.2,{x:0,z:0});
  assert.equal(deaths,1);assert.equal(a.quantity('forest-seed'),1);assert.equal(a.progress(fixture.quests[0])[0].current,1);
});
