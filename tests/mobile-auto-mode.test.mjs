import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../mobile-landscape.css',import.meta.url),'utf8');

// Executa as funções reais do main.js com dependências controladas, sem WebGL.
// Testar as funções em vez de replicar sua lógica previne falso positivo.
function sourceBetween(name,next){
  const begin='function '+name+'(){';
  const start=main.indexOf(begin),end=main.indexOf('\nfunction '+next+'(){',start+begin.length);
  assert.ok(start>=0&&end>start, 'função '+name+' não localizada');
  return main.slice(start,end).trim();
}
function invoke(source,name,context){
  return new Function('ctx','with(ctx){'+source+';return '+name+'();}')(context);
}
function fixture(){
  const notifications=[],prefs=[];
  const state={
    MOBILE_UI:true,sailing:false,boardingBoat:false,mobileAutoModeEnabled:false,attackPlaying:false,playClip(){return true},
    changingCharacter:false,changingLoadout:false,skillAnimationLocked:false,
    arenaUi:null,arenaTransition:false,
    hero:{hp:100},rpgHud:{isOpen:()=>false},seated:null,
    keys:new Set(['KeyW']),touchMove:{forward:1,sideways:0},
    moverTarget:{},pendingPose:{},waypoint:{hide(){}},
    combat:{auto:false,toggles:0,toggle(){this.auto=!this.auto;this.toggles++;return this.auto}},
    toast:m=>notifications.push(m),
    setPref:(key,value)=>prefs.push([key,value]),
    updateCombatHud(){this.hudCalls=(this.hudCalls||0)+1}
  };
  return {state,notifications,prefs};
}
const change=sourceBetween('selectMobileAutoMode','toggleAutoAttack');
const auto=sourceBetween('toggleAutoAttack','manualAttack');
const primary=sourceBetween('primaryAction','tryPose');
test('selecionar Auto no botão pequeno NÃO inicia o ataque automático',()=>{
  const {state,prefs}=fixture();
  assert.equal(invoke(change,'selectMobileAutoMode',state),true);
  assert.equal(state.mobileAutoModeEnabled,true);
  assert.equal(state.combat.auto,false);
  assert.equal(state.combat.toggles,0,'seleção não chama combat.toggle');
  assert.deepEqual(prefs.at(-1),['topweb_mobile_attack_mode','auto']);
});
test('botão principal inicia e para o auto apenas quando modo Auto está selecionado',()=>{
  const {state}=fixture();
  let manualCalls=0;
  state.manualAttack=()=>{manualCalls++;return 'manual'};
  state.toggleAutoAttack=()=>invoke(auto,'toggleAutoAttack',state);
  state.primaryContext=()=>({type:'attack'});
  state.tryPose=()=>{throw Error('Não deve executar pose em contexto de ataque')};
  assert.equal(invoke(primary,'primaryAction',state),'manual');
  assert.equal(manualCalls,1);
  assert.equal(state.combat.toggles,0);
  invoke(change,'selectMobileAutoMode',state);
  assert.equal(state.combat.toggles,0,'ativar modo não inicia combate');
  assert.equal(invoke(primary,'primaryAction',state),true);
  assert.equal(state.combat.auto,true);
  assert.equal(invoke(primary,'primaryAction',state),false);
  assert.equal(state.combat.auto,false);
  assert.equal(state.combat.toggles,2);
  assert.equal(manualCalls,1,'modo Auto não executa ataque manual');
});
test('desmarcar Auto interrompe ataque em andamento e retorna ao manual',()=>{
  const {state,prefs}=fixture();
  invoke(change,'selectMobileAutoMode',state);
  state.combat.auto=true;
  assert.equal(invoke(change,'selectMobileAutoMode',state),false);
  assert.equal(state.mobileAutoModeEnabled,false);
  assert.equal(state.combat.auto,false);
  assert.equal(state.combat.toggles,1,'a única chamada desliga um auto que já estava rodando');
  assert.deepEqual(prefs.at(-1),['topweb_mobile_attack_mode','manual']);
});
test('NPCs e poses continuam usando interação contextual em ambos os modos',()=>{
  const {state}=fixture();
  let interactions=0;
  state.primaryContext=()=>({type:'npc',label:'Conversar'});
  state.manualAttack=()=>{throw Error('Não deve atacar perto do NPC')};
  state.toggleAutoAttack=()=>{throw Error('Não deve começar automático perto do NPC')};
  state.tryPose=()=>{interactions++;return true};
  assert.equal(invoke(primary,'primaryAction',state),true);
  state.mobileAutoModeEnabled=true;
  assert.equal(invoke(primary,'primaryAction',state),true);
  assert.equal(interactions,2);
});
test('skill ativa impede trocar modo ou iniciar auto',()=>{
  const {state}=fixture();
  state.skillAnimationLocked=true;
  assert.equal(invoke(change,'selectMobileAutoMode',state),false);
  assert.equal(invoke(auto,'toggleAutoAttack',state),false);
  assert.equal(state.combat.toggles,0);
});
test('HUD reflete modo pequeno e execução apenas no botão principal',()=>{
  assert.match(main,/getPref\('topweb_mobile_attack_mode','manual'\)/);
  assert.match(main,/\$\('mobile-auto'\)\.addEventListener\('click',selectMobileAutoMode\)/);
  assert.match(main,/mobileAutoModeEnabled\?toggleAutoAttack\(\):manualAttack\(\)/);
  assert.match(main,/autoModeButton\.setAttribute\('aria-pressed',String\(mobileAutoModeEnabled\)\)/);
  assert.match(main,/button\?\.classList\.toggle\('auto-active',autoAction&&!!combat\?\.auto\)/);
  assert.ok(main.includes("mobileAutoModeEnabled?'Auto':combat?.manualActive?'Atacando':'Atacar'"));
  assert.match(main,/const wasActive=!!combat\?\.auto\|\|!!combat\?\.manualActive\|\|attackPlaying/);
  assert.ok(main.includes('combat?.manualActive||attackPlaying'));
  assert.match(main,/Um toque ataca o monstro até derrotá-lo/);
  assert.match(html,/id="mobile-auto"/);
  assert.match(html,/main\.js\?v=\d+/);
  assert.match(html,/mobile-landscape\.css\?v=5/);
  assert.match(css,/#mobile-attack\.auto-mode-selected/);
});
