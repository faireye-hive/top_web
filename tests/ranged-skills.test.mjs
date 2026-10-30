import test from 'node:test';
import assert from 'node:assert/strict';
import {createHero,selectClass,refreshHero} from '../js/hero-state.mjs';
import {createCombat} from '../js/combat-state.mjs';
import {basicAttackRange,skillWithRules} from '../js/skill-rules.mjs';
const position={x:0,z:0};
const enemy=(x=12)=>({x,z:0,ready:true,hp:10000,maxHp:10000,attack:1,defense:0,accuracy:1,evasion:0,attackSpeed:1,xp:10});
function setup(job='hunter',enemies=[enemy()],canSee=()=>true){
  const hero=createHero(job==='cleric'?'ami':'lance');
  selectClass(hero,job);hero.equipped=true;refreshHero(hero);
  const events=[];
  const combat=createCombat({hero,monsters:enemies,canSee,random:()=>0,onEvent:e=>events.push(e)});
  return {hero,events,combat,enemies};
}
function advance(c,t,p=position,options){for(let a=0;a<t;a+=.025)c.update(.025,p,options);}
test('tiros e magia básicos acertam à distância sem atravessar paredes',()=>{
  for(const job of ['hunter','sharpshooter','cleric','seal-master']){
    const {combat,enemies,hero,events}=setup(job);
    assert.ok(basicAttackRange(hero)>=14);
    combat.toggle();combat.update(.01,position);
    assert.equal(enemies[0].hp,10000);
    advance(combat,2);
    assert.ok(enemies[0].hp<10000,job);
    assert.ok(events.some(e=>e.type==='swing'&&e.flight>0));
  }
  const {combat,enemies}=setup('hunter',[enemy()],()=>false);
  assert.equal(combat.selectTarget(enemies[0],position),false);
  combat.toggle();advance(combat,2);assert.equal(enemies[0].hp,10000);
});
test('projétil a longa distância não é substituído por ataque mais rápido',()=>{
  const {combat,hero,enemies}=setup('hunter',[enemy(19)]);
  hero.stats.attackSpeed=5;
  combat.toggle();advance(combat,1.2);assert.ok(enemies[0].hp<10000);
});
test('trocar alvo percorre visíveis por distância e mantém seleção explícita',()=>{
  const a=enemy(12),b=enemy(8),wall=enemy(6),far=enemy(31);
  const {combat}=setup('hunter',[a,b,wall,far],(p,m)=>m!==wall);
  combat.cycleTarget(position);assert.equal(combat.target,b);
  combat.cycleTarget(position);assert.equal(combat.target,a);
  advance(combat,.3);assert.equal(combat.target,a);
  combat.cycleTarget(position);assert.equal(combat.target,b);
});
test('skill distante espera alcance, cobra mana uma vez e respeita recarga',()=>{
  const {combat,hero,enemies,events}=setup('hunter',[enemy(24)]);
  const mp=hero.mp,skill={id:90,name:'Dual Shot'};
  assert.equal(combat.queueSkill(skill,position),true);
  advance(combat,.2);assert.equal(hero.mp,mp);assert.equal(combat.approach.range,20);
  advance(combat,.1,{x:5,z:0});assert.equal(hero.mp,mp-10);
  assert.equal(combat.approach,null);
  advance(combat,1.3,{x:5,z:0});assert.ok(enemies[0].hp<10000);
  assert.equal(combat.queueSkill(skill,{x:5,z:0}),false);
  assert.equal(events.filter(e=>e.type==='cast').length,1);
  assert.equal(hero.practice.bow.uses,0);
});
test('mover cancela skill antes de impacto; mana e recarga já gastos permanecem',()=>{
  const {combat,hero,enemies}=setup();const mp=hero.mp;
  combat.queueSkill({id:90,name:'Dual Shot'},position);combat.update(.01,position);
  advance(combat,1,position,{moving:true});
  assert.equal(enemies[0].hp,10000);assert.ok(hero.mp<mp);assert.ok(combat.cooldowns[90]>0);
});
test('cura funciona sem alvo, buffs expiram e habilidades de outra classe são rejeitadas',()=>{
  const {combat,hero}=setup('cleric',[]);hero.hp=20;const mp=hero.mp;
  assert.equal(combat.queueSkill({id:90},position),false);
  assert.equal(combat.queueSkill({id:97,name:'Heal'},position),true);
  advance(combat,.6);assert.ok(hero.hp>20);assert.equal(hero.mp,mp-14);
  assert.equal(combat.queueSkill({id:106,name:'Energy'},position),true);
  advance(combat,.5);assert.ok(combat.buffs.shield>0);
  advance(combat,9);assert.equal(combat.buffs.shield,0);
});
test('linha e área atingem apenas monstros no espaço correto e com visão livre',()=>{
  const a=enemy(8),b={...enemy(9),z:1},c={...enemy(8),z:5},wall={...enemy(7),z:.5};
  const {combat}=setup('crusader',[a,b,c,wall],(p,m)=>m!==wall);
  combat.selectTarget(a,position);combat.queueSkill({id:81,name:'Illusion Slash'},position);
  advance(combat,1);
  assert.ok(a.hp<10000&&b.hp<10000);assert.equal(c.hp,10000);assert.equal(wall.hp,10000);
});
test('todas as 28 skills do catálogo possuem regras novas e ações reais',async()=>{
  const {readFile}=await import('node:fs/promises');
  const catalog=JSON.parse(await readFile(new URL('../assets/skills/catalog.json',import.meta.url)));
  for(const preset of Object.values(catalog.classes))for(const skill of preset.skills){
    assert.ok(skillWithRules(skill),skill.name);
    assert.ok(Object.values(skill.actions).some(x=>x.length),skill.name);
  }
});
