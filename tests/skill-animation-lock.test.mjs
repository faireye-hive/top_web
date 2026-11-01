import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHero,selectClass} from '../js/hero-state.mjs';
import {createCombat} from '../js/combat-state.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

// Isola apenas a função de sequência e o callback de finished. Não é necessário
// simular WebGL/GLTFLoader para validar o contrato das ações do mixer.
function bodyBetween(source,from,to){
  const start=source.indexOf(from);
  assert.ok(start>=0,'não encontrou '+from);
  const end=source.indexOf(to,start+from.length);
  assert.ok(end>start,'não encontrou fim de '+from);
  return source.slice(start+from.length,end);
}
test('skill só desbloqueia depois da ÚLTIMA animação da cadeia GLB',()=>{
  const code=read('js/main.js');
  const play=bodyBetween(code,'function playSkillAnimation(skill){','\n}');
  const finish=bodyBetween(code,"mixer.addEventListener('finished',event=>{",'\n    });');
  const ctx={
    hero:{character:'lance'},animations:[{name:'081 · Ação 1',id:81},{name:'082 · Ação 2',id:82}],
    skillActionQueue:[],skillAnimationLocked:false,attackPlaying:false,seated:null,
    currentClip:'Parado',runningAction:null,extendCityCombatPose(){},
    getActionId:clip=>clip.id,
    resolveSkillClip:()=>({name:'081 · Ação 1'}),
    playClip(name){this.currentClip=name;this.runningAction={name};return true;}
  };
  // playClip é usado diretamente no main.js (não como método); vincular this.
  ctx.playClip=ctx.playClip.bind(ctx);
  const skill={actions:{lance:[{id:81},{id:82}]}};
  const playSkill=new Function('skill','ctx','with(ctx){'+play+'}');
  const finishClip=new Function('event','ctx','with(ctx){'+finish+'}');
  assert.equal(playSkill(skill,ctx),true);
  assert.equal(ctx.skillAnimationLocked,true);
  assert.deepEqual(ctx.skillActionQueue,['082 · Ação 2']);
  const first=ctx.runningAction;
  finishClip({action:first},ctx);
  assert.equal(ctx.currentClip,'082 · Ação 2');
  assert.equal(ctx.skillAnimationLocked,true,'primeiro finished não pode liberar');
  const second=ctx.runningAction;
  finishClip({action:first},ctx);
  assert.equal(ctx.skillAnimationLocked,true,'evento antigo não pode interromper o segundo clipe');
  finishClip({action:second},ctx);
  assert.equal(ctx.skillAnimationLocked,false,'deve liberar no segundo finished');
  assert.equal(ctx.attackPlaying,false);
  assert.equal(ctx.currentClip,'Parado');
});
test('mover durante skill não cancela cast nem inicia animação de corrida',()=>{
  const code=read('js/main.js');
  const start=code.indexOf('function update(dt){');
  const end=code.indexOf('let qualitySampleTime=0',start);
  const loop=code.slice(start,end);
  assert.match(loop,/const manualMove=!skillAnimationLocked&&!!\(dx\|\|dz\|\|moverTarget\)/);
  assert.match(loop,/if\(skillAnimationLocked\)\{dx=0;dz=0;\}/);
  assert.match(loop,/if\(!sailing&&approach&&!skillAnimationLocked&&!attackPlaying/);
  assert.match(loop,/if\(!sailing&&!attackPlaying\)\{/);
  assert.match(code,/if\(skillAnimationLocked&&!force\)return/);
  assert.match(code,/if\(skillAnimationLocked\)\{toast\('Aguarde a animação da skill terminar.'\);return false;\}/);
});
test('botões de outras poses e menus não interrompem animação de skill',()=>{
  const code=read('js/main.js');
  for(const name of ['idle','run','dance']){
    assert.ok(code.includes("$('"+name+"').addEventListener('click',()=>{if(skillAnimationLocked)return;"),
      'botão '+name+' deve preservar skill');
  }
  assert.match(code,/if\(\$\('sit'\)\)\$\('sit'\)\.addEventListener\('click',\(\)=>\{if\(skillAnimationLocked\)return/);
  assert.match(code,/onOpen:\(\)=>\{\s*if\(skillAnimationLocked\)/);
  assert.match(code,/function orderMove\(x,z,pose\)\{\s*if\(skillAnimationLocked\)/);
  assert.match(code,/async function changeLoadout\(change\)\{\s*if\(skillAnimationLocked\)/);
  assert.match(code,/function tryPose\(\)\{\s*if\(skillAnimationLocked\)/);
  assert.match(code,/function teleport\(x,z\)\{\s*stopCombat\(true\)/);
  assert.match(code,/if\(event\.type==='defeat'\)\{\s*skillAnimationLocked=false/);
});
test('combate conclui o efeito da skill mesmo com avatar bloqueado em animação',()=>{
  const hero=createHero('lance');
  selectClass(hero,'crusader');
  const monster={id:1,x:1,z:0,ready:true,hp:60,maxHp:60,attack:1,defense:0,
    accuracy:60,evasion:5,attackSpeed:1,xp:2,engaged:false};
  const events=[];
  const combat=createCombat({hero,monsters:[monster],random:()=>0,onEvent:event=>events.push(event)});
  const pos={x:0,z:0};
  assert.equal(combat.selectTarget(monster,pos),true);
  assert.equal(combat.queueSkill({id:81,name:'Illusion Slash'},pos),true);
  combat.update(.01,pos,{moving:false,busy:false});
  assert.ok(events.some(e=>e.type==='cast'),'deve começar o cast');
  combat.update(.6,pos,{moving:false,busy:true});
  assert.ok(events.some(e=>e.type==='skillhit'),'skill deve acertar enquanto clipe GLB está tocando');
  assert.ok(monster.hp<60);
});
