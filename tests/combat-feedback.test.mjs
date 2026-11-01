import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMBAT_FEEDBACK_LIMITS,describeCombatFeedback,projectCombatFeedback,
  createCombatFeedback} from '../js/combat-feedback.mjs';

test('números refletem somente o dano real, miss/0, skill, veneno, cura e dano sofrido',()=>{
 const monster={x:0,z:0,name:'Forest Spirit'};
 assert.deepEqual(describeCombatFeedback({type:'hit',monster,damage:14}),
   {kind:'hit',label:'−14',target:'monster',impact:true});
 assert.deepEqual(describeCombatFeedback({type:'skillhit',monster,damage:23}),
   {kind:'skill',label:'−23',target:'monster',impact:true});
 assert.deepEqual(describeCombatFeedback({type:'dot',monster,damage:3}),
   {kind:'dot',label:'−3',target:'monster',impact:true});
 assert.deepEqual(describeCombatFeedback({type:'hit',monster,damage:0}),
   {kind:'miss',label:'ERROU',target:'monster',impact:false});
 assert.deepEqual(describeCombatFeedback({type:'hurt',monster,damage:7}),
   {kind:'hurt',label:'−7',target:'hero',impact:true});
 assert.deepEqual(describeCombatFeedback({type:'hurt',monster,damage:0}),
   {kind:'block',label:'0',target:'hero',impact:false});
 assert.deepEqual(describeCombatFeedback({type:'healed',amount:12}),
   {kind:'heal',label:'+12',target:'hero',impact:false});
 assert.equal(describeCombatFeedback({type:'healed',amount:0}),null);
 assert.equal(describeCombatFeedback({type:'practice'}),null);
 assert.equal(describeCombatFeedback({type:'kill',monster}),null,
   'abate não deve criar número de dano fictício');
 assert.deepEqual(describeCombatFeedback({type:'swing',monster}),
   {kind:'swing',label:'',target:'monster',impact:true});
});

test('projeção da câmera respeita borda, profundidade e localização do canvas',()=>{
 const rect={left:25,top:40,right:625,bottom:340,width:600,height:300};
 assert.deepEqual(projectCombatFeedback({x:0,y:0,z:0},rect),{x:325,y:190});
 for(const point of [
  {x:1.1,y:0,z:0},{x:0,y:-1.1,z:0},{x:0,y:0,z:1.2},
  {x:0,y:0,z:-1.2},{x:NaN,y:0,z:0}
 ])assert.equal(projectCombatFeedback(point,rect),null);
 assert.equal(projectCombatFeedback({x:.99,y:0,z:0},rect),null,
   'não deixar números cortados na borda do canvas');
});

function mockDom(){
 class ClassList{
   classes=new Set();
   add(s){this.classes.add(s)}
   remove(s){this.classes.delete(s)}
   contains(s){return this.classes.has(s)}
 }
 class El{
   constructor(tag='div'){
     this.tag=tag;this.children=[];this.classList=new ClassList();
     this.style={setProperty(k,v){this[k]=v}};
     this.hidden=false;this.dataset={};this.textContent='';
   }
   append(...els){for(const el of els){el.parent=this;this.children.push(el)}}
   remove(){
     if(!this.parent)return;
     const idx=this.parent.children.indexOf(this);
     if(idx!==-1)this.parent.children.splice(idx,1);
     this.parent=null;this.removed=true;
   }
   setAttribute(k,v){this[k]=v}
   get offsetWidth(){return 100}
 }
 const root=new El('body');
 return {root,document:{hidden:false,createElement:tag=>new El(tag)}};
}
test('runtime mantém rótulos sobre monstros/personagem, tem teto mobile e limpa DOM',()=>{
 const {root,document:fakeDocument}=mockDom();
 const original=globalThis.document;globalThis.document=fakeDocument;
 try{
   let time=0;
   const canvas={getBoundingClientRect:()=>({left:0,top:0,right:700,bottom:350,
     width:700,height:350})};
   const THREE={Vector3:class{
     set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
     project(){this.x/=10;this.y/=10;this.z/=10;return this}
   }};
   const instance=createCombatFeedback({THREE,camera:{},canvas,root,
     playerPosition:()=>({x:0,y:0,z:0}),mobile:()=>true,now:()=>time});
   assert.equal(root.children.length,2);
   const monster={x:2,z:1,object:{position:{y:0}}};
   instance.emit({type:'hit',monster,damage:19});
   instance.update();
   assert.equal(instance.count,1);
   const layer=root.children[0],display=layer.children[0];
   assert.equal(display.children[0].textContent,'−19');
   assert.equal(display.hidden,false);
   assert.equal(display.style.left,'420.0px');
   assert.equal(display.style.top,'149.6px');
   for(let i=0;i<15;i++)instance.emit({type:'hurt',damage:3,monster});
   assert.equal(instance.count,COMBAT_FEEDBACK_LIMITS.mobile.max);
   assert.equal(layer.children.length,COMBAT_FEEDBACK_LIMITS.mobile.max);
   assert.equal(root.children[1].classList.contains('active'),true);
   instance.update();
   const heroLabel=layer.children.at(-1);
   assert.equal(heroLabel.children[0].textContent,'−3');
   assert.equal(heroLabel.style.left,'350.0px');
   root.classList.add('rpg-open');
   instance.update();
   assert.equal(heroLabel.hidden,true);
   root.classList.remove('rpg-open');
   time+=COMBAT_FEEDBACK_LIMITS.mobile.lifetime+100;
   instance.update();
   assert.equal(instance.count,0);
   instance.dispose();
   assert.equal(root.children.length,0);
   instance.emit({type:'hit',monster,damage:5});
   assert.equal(instance.count,0);
 }finally{
   if(original===undefined)delete globalThis.document;
   else globalThis.document=original;
 }
});

test('jogo e CSS conectam números ao combate real sem mexer no damageMonster',()=>{
 const game=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
 const logic=readFileSync(new URL('../js/combat-state.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../combat-feedback.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(game.includes("from './combat-feedback.mjs?v=1'"));
 assert.ok(game.includes('combatFeedback.emit(event);'));
 assert.ok(game.includes('combatFeedback.update();'));
 assert.ok(game.includes('playerPosition:()=>playerPos,mobile:()=>MOBILE_UI'));
 assert.ok(html.includes('combat-feedback.css?v=1'));
 assert.ok(logic.includes("damageMonster(victim,damage,'hit')"));
 assert.ok(logic.includes("onEvent({type:'hurt',monster:m,damage})"));
 assert.ok(logic.includes("damageMonster(m,damage,'skillhit',skill)"));
 assert.ok(css.includes('pointer-events:none'));
 assert.ok(css.includes('.combat-float--hurt'));
 assert.ok(css.includes('.combat-float--skill'));
 assert.ok(css.includes('.combat-float--miss'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});
