import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoatState,gainBoatExperience,boatExperienceRequired,boatStats,raiseBoatLevel,serializeBoat,restoreBoat} from '../js/boat-state.mjs';
import {createNavalCombat,NAVAL} from '../js/naval-combat.mjs';
import {createCombat} from '../js/combat-state.mjs';
import {createHero,serializeHero} from '../js/hero-state.mjs';
import {resolvePrimaryAction} from '../js/context-action.mjs';
const sea=(props={})=>({id:1,x:12,z:0,home:{x:12,z:0},habitat:'sea',ready:true,name:'Sea Jelly',hp:650,maxHp:650,attack:90,attackSpeed:.8,defense:20,accuracy:100,evasion:10,xp:85,moveSpeed:3.2,respawnSeconds:120,...props});
const advance=(combat,seconds,position={x:0,z:0},options)=>{for(let t=0;t<seconds;t+=.05)combat.update(.05,position,options);};
function setup(monsters=[sea()],extra={}){
  const ship=createBoatState(),events=[];
  const combat=createNavalCombat({ship,monsters,random:()=>0,onEvent:e=>events.push(e),...extra});
  return {ship,events,combat};
}
test('XP e nível do casco são independentes do herói e de outros barcos, persistindo HP',()=>{
  const hero=createHero(),before=serializeHero(hero),ship=createBoatState();ship.hp=300;
  assert.equal(gainBoatExperience(ship,300),1);assert.equal(ship.level,2);assert.equal(ship.xp,160);
  assert.equal(ship.hp,ship.stats.maxHp);ship.hp=321;
  const restored=restoreBoat(serializeBoat(ship));assert.equal(restored.hp,321);assert.equal(restored.level,2);
  assert.equal(restoreBoat(serializeBoat(ship),'phantom-galley').level,1);
  assert.equal(serializeHero(hero),before);assert.ok(ship.stats.attack>boatStats(1).attack);
  assert.equal(raiseBoatLevel(ship,1000),98);assert.equal(ship.level,100);
  gainBoatExperience(ship,1e9);assert.ok(ship.xp<boatExperienceRequired(100));assert.equal(restoreBoat(serializeBoat(ship)).level,100);
  for(const raw of ['{}','null','oops',JSON.stringify({version:1,hull:'guppy',level:2,xp:0,hp:1e9})])assert.equal(restoreBoat(raw).level,1);
});
test('canhão seleciona somente criaturas marinhas, exige alcance e aplica dano no impacto',()=>{
  const land=sea({id:2,habitat:'land',x:1}),enemy=sea(),{combat,events}=setup([land,enemy]);
  assert.equal(combat.selectTarget(land,{x:0,z:0}),false);
  assert.equal(combat.manualAttack({x:0,z:0}),true);assert.equal(enemy.hp,650);
  advance(combat,.3);assert.equal(enemy.hp,650);advance(combat,.5);assert.ok(enemy.hp<650);
  assert.equal(land.hp,650);assert.ok(events.some(e=>e.type==='swing'));assert.ok(events.some(e=>e.type==='hit'));
  const far=sea({x:40,home:{x:40,z:0}}),other=setup([far]);
  other.combat.manualAttack({x:0,z:0});assert.equal(other.combat.approach.range,NAVAL.range);
  advance(other.combat,3);assert.equal(far.hp,650);
});
test('manual para após um abate, Auto continua e a XP vai ao barco',()=>{
  for(const auto of [false,true]){
    const first=sea({hp:1,xp:160,attack:0}),second=sea({id:2,x:13,hp:1,attack:0}),state=setup([first,second]);
    if(auto)state.combat.toggle();else state.combat.manualAttack({x:0,z:0});
    advance(state.combat,5);assert.equal(first.hp,0);assert.equal(second.hp,auto?0:1);
    assert.equal(state.ship.level,2);assert.equal(state.combat.auto,auto);
    assert.ok(first.respawnIn>110);assert.equal(state.combat.manualActive,false);
  }
});
test('criaturas perseguem e atingem o casco sem afetar a vida do herói',()=>{
  const enemy=sea({aggressive:true}),hero=createHero(),before=hero.hp,state=setup([enemy]);
  advance(state.combat,5);assert.ok(enemy.x<12);assert.ok(state.ship.hp<state.ship.stats.maxHp);
  assert.equal(hero.hp,before);assert.ok(state.events.some(e=>e.type==='hurt'));
  const hp=state.ship.hp;advance(state.combat,5,{x:0,z:0},{paused:true});assert.equal(state.ship.hp,hp);
});
test('canhões e criaturas não atacam através de terra; mar não ataca herói em terra',()=>{
  const enemy=sea({x:1,engaged:true,aggressive:true});
  const hero=createHero(),land=createCombat({hero,monsters:[enemy],random:()=>0});
  advance(land,5);assert.equal(hero.hp,hero.stats.maxHp);assert.equal(land.selectTarget(enemy,{x:0,z:0}),false);
  const blocked=setup([enemy],{canReach:()=>false,canSee:()=>false});
  assert.equal(blocked.combat.manualAttack({x:0,z:0}),false);advance(blocked.combat,5);assert.equal(blocked.ship.hp,blocked.ship.stats.maxHp);
});
test('tiro cancelado por pausa, movimento ou obstrução durante o voo não aplica dano',()=>{
  for(const reason of ['pause','move','blocked']){
    let visible=true;const enemy=sea({attack:0}),state=setup([enemy],{canSee:()=>visible});
    state.combat.manualAttack({x:0,z:0});advance(state.combat,.1);
    if(reason==='blocked')visible=false;
    state.combat.update(.05,{x:0,z:0},{paused:reason==='pause',moving:reason==='move'});
    advance(state.combat,2);assert.equal(enemy.hp,650,reason);
  }
});
test('recuperação exige seis segundos sem tiros e nenhum inimigo engajado',()=>{
  const enemy=sea({x:1,hp:1,attack:0}),state=setup([enemy]);state.ship.hp=500;
  state.combat.manualAttack({x:0,z:0});advance(state.combat,1);assert.equal(enemy.hp,0);
  assert.equal(state.ship.hp,500);advance(state.combat,4);assert.equal(state.ship.hp,500);
  advance(state.combat,3);assert.ok(state.ship.hp>500);assert.ok(state.ship.hp<=state.ship.stats.maxHp);
  const engaged=sea({engaged:true,x:30,attack:0}),fighting=setup([engaged],{canReach:()=>false});fighting.ship.hp=500;
  advance(fighting.combat,20);assert.equal(fighting.ship.hp,500,'não regenera durante perseguição');
});
test('afundar interrompe ataques e resgata sem perder nível ou XP',()=>{
  const enemy=sea({x:1,engaged:true,attack:100000,accuracy:10000}),state=setup([enemy]);
  state.ship.xp=17;advance(state.combat,1);assert.equal(state.ship.hp,0);assert.equal(state.combat.auto,false);
  assert.ok(state.events.some(e=>e.type==='defeat'));enemy.attack=0;advance(state.combat,6);
  assert.equal(state.ship.hp,state.ship.stats.maxHp);assert.equal(state.ship.level,1);assert.equal(state.ship.xp,17);
  assert.equal(state.events.filter(e=>e.type==='revive').length,1);
});
test('alvo naval prioriza canhão na margem; desembarque continua separado',()=>{
  const landing={x:1,z:2};
  assert.equal(resolvePrimaryAction({sailing:true,naval:true}).type,'naval-attack');
  assert.equal(resolvePrimaryAction({sailing:true,naval:true,landing}).type,'disembark');
  assert.equal(resolvePrimaryAction({sailing:true,naval:true,landing,navalTarget:true}).type,'naval-attack');
  assert.equal(resolvePrimaryAction({sailing:true,naval:true,recovering:true}).type,'recovering');
});
test('cada nível do barco aumenta velocidade real, HP e ataque, preservando a base do casco',async()=>{
 const {boatMovementSpeed}=await import('../js/boat-state.mjs');
 const ship=createBoatState();assert.equal(boatMovementSpeed(ship,4.5),4.5);
 const hp=ship.stats.maxHp,attack=ship.stats.attack;
 raiseBoatLevel(ship,10);assert.equal(ship.stats.maxHp,hp+1400);assert.equal(ship.stats.attack,attack+140);
 assert.ok(Math.abs(boatMovementSpeed(ship,4.5)-4.95)<1e-9);
 assert.ok(Math.abs(boatMovementSpeed(ship,8)-8.8)<1e-9);
 const restored=restoreBoat(serializeBoat(ship));assert.equal(boatMovementSpeed(restored,4.5),boatMovementSpeed(ship,4.5));
 raiseBoatLevel(ship,1000);assert.ok(Math.abs(boatMovementSpeed(ship,4.5)-8.955)<1e-9);
});
