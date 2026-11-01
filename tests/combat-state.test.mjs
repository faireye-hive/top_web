import test from 'node:test';
import assert from 'node:assert/strict';
import {createHero,selectClass,trainAttack,gainExperience,heroSnapshot,serializeHero,restoreHero,refreshHero} from '../js/hero-state.mjs';
import {createCombat,nearestMonster,COMBAT} from '../js/combat-state.mjs';

const monster=(extra={})=>({x:1,z:0,ready:true,hp:60,maxHp:60,attack:9,defense:2,
  accuracy:65,evasion:4,attackSpeed:.65,xp:10,...extra});
function setup(enemies=[monster()]) {
  const hero=createHero(),events=[];
  const combat=createCombat({hero,monsters:enemies,random:()=>0,onEvent:e=>events.push(e)});
  return {hero,events,combat,enemies};
}
function advance(combat,seconds,position={x:0,z:0},options) {
  for(let time=0;time<seconds;time+=.05)combat.update(.05,position,options);
}
test('seleção ignora mortos, modelos não carregados, distantes e caminhos bloqueados',()=>{
  const good=monster({x:4});
  assert.equal(nearestMonster([monster({hp:0}),monster({ready:false}),monster({x:30}),good],{x:0,z:0}),good);
  assert.equal(nearestMonster([monster(),good],{x:0,z:0},12,(p,m)=>m.x>2),good);
  assert.equal(nearestMonster([],{x:0,z:0}),null);
});
test('ataque aplica impacto após preparação, respeita cadência e alcance',()=>{
  const {combat,enemies,events}=setup();combat.toggle();
  combat.update(.01,{x:0,z:0});assert.equal(enemies[0].hp,60);
  advance(combat,.5);assert.ok(enemies[0].hp<60);
  assert.equal(events.filter(e=>e.type==='swing').length,1);
  advance(combat,.4);assert.equal(events.filter(e=>e.type==='swing').length,1);
  const hp=enemies[0].hp;advance(combat,2,{x:10,z:0});assert.equal(enemies[0].hp,hp);
});
test('mover ou abrir menu cancela o golpe pendente e o modo auto',()=>{
  for(const options of [{moving:true},{paused:true}]) {
    const {combat,enemies}=setup();combat.toggle();combat.update(.01,{x:0,z:0});
    advance(combat,1,{x:0,z:0},options);
    assert.equal(enemies[0].hp,60);assert.equal(combat.auto,false);assert.equal(combat.target,null);
  }
});
test('alvo que morre concede XP uma vez, permite outro alvo e reaparece',()=>{
  const {combat,hero,enemies,events}=setup([monster({hp:1}),monster({x:3})]);
  combat.toggle();advance(combat,.6);
  assert.equal(enemies[0].hp,0);assert.equal(hero.xp,10);
  advance(combat,.3);assert.equal(combat.target,enemies[1]);
  combat.stop();advance(combat,COMBAT.respawn+1);
  assert.equal(enemies[0].hp,60);assert.equal(hero.xp,10);
  assert.equal(events.filter(e=>e.type==='kill').length,1);
});
test('derrota suspende ataque e recupera o herói sem ataques acumulados',()=>{
  const {combat,hero,enemies,events}=setup([monster({engaged:true,attack:1000})]);
  advance(combat,.65);assert.equal(hero.hp,0);assert.equal(combat.auto,false);
  advance(combat,COMBAT.recovery+.1);
  assert.equal(hero.hp,hero.stats.maxHp);assert.equal(enemies[0].engaged,false);
  assert.ok(events.some(e=>e.type==='revive'));
});
test('atributos crescem automaticamente conforme a classe, sem pontos manuais',()=>{
  const hero=createHero('ami');selectClass(hero,'cleric');
  assert.equal(gainExperience(hero,120),2);assert.equal(hero.level,3);
  assert.equal(hero.attributes.intelligence,11);assert.equal(hero.attributes.constitution,9);
  assert.equal(hero.attributes.strength,5);assert.equal(heroSnapshot(hero).name,'Ami');
  assert.equal(hero.stats.attack,28); // Cleric usa Inteligência no ataque básico.
  assert.equal(hero.hp,hero.stats.maxHp);
});
test('prática vem de golpes válidos e mantém proficiência separada por arma',()=>{
  const hero=createHero();const attack=hero.stats.attack;
  for(let i=0;i<19;i++)assert.equal(trainAttack(hero),false);
  assert.equal(trainAttack(hero),true);assert.equal(hero.stats.attack,attack+1);
  assert.equal(hero.practice.unarmed.level,11);
  hero.equipped=true;refreshHero(hero);assert.equal(heroSnapshot(hero).practiceLevel,10);
  for(let i=0;i<20;i++)trainAttack(hero);
  assert.equal(hero.practice.sword.level,11);assert.equal(hero.practice.unarmed.level,11);
});
test('cancelamento, distância e reprodução de animações não treinam ataque',()=>{
  const {hero,combat}=setup();combat.toggle();
  combat.update(.01,{x:0,z:0});combat.stop();advance(combat,2);
  assert.equal(hero.practice.unarmed.uses,0);
  combat.toggle();advance(combat,2,{x:9,z:0});assert.equal(hero.practice.unarmed.uses,0);
  advance(combat,.6);assert.equal(hero.practice.unarmed.uses,1);
});
test('save validado conserva classe, equipamento e prática; números inválidos são descartados',()=>{
  const hero=createHero('phyllis');selectClass(hero,'seal-master');hero.equipped=true;refreshHero(hero);
  gainExperience(hero,40);for(let i=0;i<24;i++)trainAttack(hero);
  const saved=serializeHero(hero),restored=restoreHero(saved);
  assert.equal(restored.job,'seal-master');assert.equal(restored.level,2);
  assert.equal(restored.equipped,true);assert.deepEqual(restored.practice,hero.practice);
  assert.equal(restoreHero(saved.replace('"level":2','"level":-2')).level,1);
  assert.equal(restoreHero('not json').level,1);
});

test('selecionar monstro não liga auto e botão manual executa um golpe por toque',()=>{
  const {combat,enemies,events}=setup();
  const pos={x:0,z:0};
  assert.equal(combat.selectTarget(enemies[0],pos),true);
  assert.equal(combat.auto,false,'alvo selecionado não deve começar auto ataque');
  advance(combat,.5,pos);
  assert.equal(enemies[0].hp,60,'só selecionar não causa dano');
  assert.equal(combat.manualAttack(pos),true);
  assert.equal(combat.auto,false);
  assert.equal(combat.manualAttack(pos),false,'não repetir antes do cooldown');
  advance(combat,.6,pos);
  assert.ok(enemies[0].hp<60,'o toque deve causar apenas um golpe');
  const swings=events.filter(e=>e.type==='swing').length;
  advance(combat,2,pos);
  assert.equal(events.filter(e=>e.type==='swing').length,swings,'sem repetição automática');
  assert.equal(combat.manualAttack(pos),true,'segundo toque pode atacar após o cooldown');
});
test('botão Auto separado preserva o alvo ao desligar e desativa ataque manual enquanto ligado',()=>{
  const {combat,enemies}=setup();const pos={x:0,z:0};
  combat.selectTarget(enemies[0],pos);
  assert.equal(combat.toggle(),true);
  assert.equal(combat.manualAttack(pos),false,'modo auto impede golpe manual independente');
  assert.equal(combat.toggle(),false);
  assert.equal(combat.auto,false);
  assert.equal(combat.target,enemies[0],'ao desligar, alvo deve permanecer para ataque manual');
  assert.equal(combat.manualAttack(pos),true);
});
test('andar mantém alvo manual, mas cancela automático e golpes pendentes',()=>{
  const {combat,enemies,events}=setup();const pos={x:0,z:0};
  combat.selectTarget(enemies[0],pos);
  combat.update(.05,pos,{moving:true});
  assert.equal(combat.target,enemies[0]);
  assert.equal(combat.auto,false);
  assert.equal(combat.manualAttack(pos),true);
  combat.update(.05,pos,{moving:true});
  advance(combat,.6,pos);
  assert.equal(enemies[0].hp,60,'movimentar cancela golpe pendente');
  assert.equal(combat.target,enemies[0],'movimentar não apaga o alvo manual');
  combat.toggle();combat.update(.05,pos,{moving:true});
  assert.equal(combat.auto,false,'movimentar continua cancelando auto');
});
test('manual precisa de alcance e escolhe alvo próximo sem ligar auto',()=>{
  const enemy=monster({x:8});
  const {combat,events}=setup([enemy]);const pos={x:0,z:0};
  assert.equal(combat.manualAttack(pos),false);
  assert.equal(combat.auto,false);
  assert.equal(combat.target,enemy,'identifica o alvo, mas não ataca de longe');
  assert.ok(events.some(e=>e.type==='notice'&&/Aproxime-se/.test(e.message)));
  enemy.x=1;
  assert.equal(combat.manualAttack(pos),true);
});

test('monstro pacífico só persegue e revida após receber ataque, com preparação antes do dano',()=>{
  const {combat,hero,enemies,events}=setup();const pos={x:0,z:0},m=enemies[0];
  advance(combat,1,pos);assert.equal(m.engaged,undefined);assert.equal(hero.hp,hero.stats.maxHp);
  combat.manualAttack(pos);advance(combat,.5,pos);
  assert.equal(m.engaged,true);assert.ok(events.some(e=>e.type==='monster-swing'));
  assert.equal(hero.hp,hero.stats.maxHp,'dano espera a preparação do contra-ataque');
  advance(combat,.6,pos);assert.ok(hero.hp<hero.stats.maxHp);
  const before=m.x;advance(combat,.5,{x:9,z:0});assert.ok(m.x>before,'monstro persegue quem se afasta');
});
test('horda agressiva inicia perseguição e ataque sem golpe do jogador; visão, alcance e menus são respeitados',()=>{
  const enemy=monster({x:6,aggressive:true,aggroRange:10}),{combat,hero,events}=setup([enemy]);
  combat.update(.05,{x:0,z:0},{paused:true});assert.equal(enemy.engaged,undefined);
  advance(combat,3);assert.equal(enemy.engaged,true);assert.ok(enemy.x<6);assert.ok(hero.hp<hero.stats.maxHp);
  assert.equal(combat.auto,false);assert.equal(enemy.hp,enemy.maxHp);
  assert.ok(events.some(e=>e.type==='monster-swing'));
  for(const extra of [{x:20},{ready:false}]){
    const m=monster({aggressive:true,aggroRange:10,...extra}),state=setup([m]);
    advance(state.combat,.5);assert.notEqual(m.engaged,true);
  }
  const m=monster({aggressive:true});
  createCombat({hero:createHero(),monsters:[m],canSee:()=>false}).update(.1,{x:0,z:0});
  assert.notEqual(m.engaged,true);
});
test('mortos da Torre não reaparecem e leash próprio permite perseguir além do limite de Garner',()=>{
  const dead=monster({hp:1,respawn:false}),state=setup([dead]);
  state.combat.toggle();advance(state.combat,COMBAT.respawn+2);
  assert.equal(dead.hp,0);assert.equal(state.events.filter(e=>e.type==='kill').length,1);
  assert.equal(state.events.some(e=>e.type==='respawn'),false);
  const m=monster({x:40,home:{x:1,z:0},aggressive:true,engaged:true,leash:200});
  const {combat}=setup([m]);combat.update(.05,{x:45,z:0});
  assert.equal(m.engaged,true);assert.equal(m.motion,'chase');
});
test('sair do alcance, bloquear visão ou atordoar cancela impacto inimigo pendente',()=>{
  for(const mode of ['range','wall','stun']){
    const hero=createHero(),m=monster({engaged:true});let visible=true;
    const combat=createCombat({hero,monsters:[m],random:()=>0,canSee:()=>visible});
    combat.update(.05,{x:0,z:0});assert.ok(m.attackPending);
    if(mode==='wall')visible=false;if(mode==='stun')m.status.stun=2;
    advance(combat,.6,mode==='range'?{x:10,z:0}:{x:0,z:0});
    assert.equal(hero.hp,hero.stats.maxHp);
  }
});
test('leash inicia retorno sem atravessar mapa; respawn volta ao ponto original sem veneno ou ataque acumulado',()=>{
  const m=monster({x:8,home:{x:1,z:0},engaged:true,hp:20}),{combat,events}=setup([m]);
  combat.update(.05,{x:40,z:0});assert.equal(m.engaged,false);assert.equal(m.motion,'return');
  assert.equal(m.hp,m.maxHp);assert.ok(events.some(e=>e.type==='reset'));
  assert.equal(nearestMonster([m],{x:1,z:0}),null,'retorno não pode virar alvo novamente');
  assert.ok(m.x>1&&m.x<8,'retorno caminha, sem teleporte');
  advance(combat,3,{x:40,z:0});assert.equal(m.motion,'patrol');
  m.x=8;m.hp=0;m.respawnIn=.1;m.poisonTick=.8;m.status={poison:2};m.attackPending={time:.1};
  advance(combat,.15,{x:0,z:0});assert.equal(m.x,1);assert.equal(m.hp,m.maxHp);
  assert.equal(m.poisonTick,0);assert.deepEqual(m.status,{});assert.equal(m.attackPending,null);
});
test('menus congelam patrulha, perseguição, impacto inimigo e reaparecimento',()=>{
  const m=monster({engaged:true}),{combat,hero}=setup([m]);
  combat.update(.05,{x:0,z:0});const pending=m.attackPending.time;
  advance(combat,2,{x:10,z:0},{paused:true});assert.equal(m.x,1);assert.equal(m.attackPending.time,pending);assert.equal(hero.hp,hero.stats.maxHp);
  m.hp=0;m.respawnIn=5;advance(combat,2,{x:0,z:0},{paused:true});assert.equal(m.respawnIn,5);
});
test('monstro procura passagem mesmo se parede estiver dentro do alcance de ataque',()=>{
  const hero=createHero(),m=monster({x:0,engaged:true}),position={x:2,z:0};
  const canReach=(a,b)=>{
    for(let i=0;i<=30;i++){
      const x=a.x+(b.x-a.x)*i/30,z=a.z+(b.z-a.z)*i/30;
      if(x>.7&&x<1.3&&Math.abs(z)<.8)return false;
    }
    return true;
  };
  const combat=createCombat({hero,monsters:[m],canReach,canSee:canReach,random:()=>0});
  advance(combat,4,position);
  assert.ok(canReach(m,position),'encontra lado visível da parede');assert.ok(hero.hp<hero.stats.maxHp,'consegue revidar sem atacar através da parede');
});
