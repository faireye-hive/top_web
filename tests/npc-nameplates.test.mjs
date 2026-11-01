import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 NPC_NAMEPLATE_LIMITS,visibleNpcNameCandidates,
 npcLabelScreenPosition,overlapsNpcLabel
} from '../js/npc-nameplates.mjs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const npc=(name,x,z,{visible=true,hasLabel=true}={})=>({
  name,x,z,object:{visible},label:hasLabel?{textContent:name}:null,
  anchor:{x,y:2.7,z}
});
test('usa nomes reais e ignora NPC não carregado, distante, invisível ou inválido',()=>{
 const close=npc('Newbie Guide - Senna',4,1);
 const invisible=npc('Invisible',1,0,{visible:false});
 const unloaded=npc('Pending GLB',2,0,{hasLabel:false});
 const far=npc('Blacksmith - Goldie',45,0);
 const unnamed=npc('',1,1);
 const mobile=visibleNpcNameCandidates([far,unloaded,close,invisible,unnamed],0,0,true);
 assert.deepEqual(mobile.map(x=>x.npc.name),['Newbie Guide - Senna']);
 assert.equal(visibleNpcNameCandidates([close],NaN,0,false).length,0);
 assert.ok(NPC_NAMEPLATE_LIMITS.mobile.distance<NPC_NAMEPLATE_LIMITS.desktop.distance);
});
test('mobile limita seis nomes e prioriza os mais próximos',()=>{
 const all=Array.from({length:18},(_,i)=>npc('NPC '+i,i+1,0));
 const mobile=visibleNpcNameCandidates(all,0,0,true);
 assert.equal(mobile.length,6);
 assert.deepEqual(mobile.map(x=>x.npc.name),['NPC 0','NPC 1','NPC 2','NPC 3','NPC 4','NPC 5']);
 const desktop=visibleNpcNameCandidates(all,0,0,false);
 assert.equal(desktop.length,14);
 assert.equal(desktop.at(-1).npc.name,'NPC 13');
});
test('projeta sobre a cabeça e oculta objetos fora do campo visual',()=>{
 const rect={left:20,top:30,width:780,height:350,right:800,bottom:380};
 const pos=npcLabelScreenPosition({x:0,y:0,z:0},rect);
 assert.deepEqual(pos,{x:410,y:205});
 assert.equal(npcLabelScreenPosition({x:1.1,y:0,z:0},rect),null);
 assert.equal(npcLabelScreenPosition({x:0,y:0,z:1.5},rect),null);
 assert.equal(npcLabelScreenPosition({x:0,y:0,z:-1.5},rect),null);
 assert.equal(npcLabelScreenPosition({x:0,y:0,z:NaN},rect),null);
 assert.equal(npcLabelScreenPosition({x:0,y:.9,z:0},rect,{mobile:true}),null);
 assert.ok(npcLabelScreenPosition({x:0,y:0,z:0},rect,{mobile:true}));
});
test('não desenha nomes sobrepostos na mesma região',()=>{
 assert.equal(overlapsNpcLabel({x:400,y:200},{x:420,y:208},true),true);
 assert.equal(overlapsNpcLabel({x:400,y:200},{x:590,y:208},true),false);
 assert.equal(overlapsNpcLabel({x:400,y:200},{x:400,y:236},false),false);
});
test('NPC manager integra rótulos sem duplicar meshes e limpa DOM',()=>{
 const manager=file('js/npc-manager.mjs');
 const game=file('js/main.js');
 const css=file('npc-nameplates.css');
 const html=file('index.html');
 const data=JSON.parse(file('assets/npcs/manifest.json'));
 assert.ok(data.npcs.some(n=>n.name==='Arena Administrator'));
 assert.ok(data.npcs.some(n=>n.name==='Newbie Guide - Senna'));
 assert.ok(manager.includes("label.textContent=npc.name;"));
 assert.ok(manager.includes("nameLayer.setAttribute('aria-hidden','true')"));
 assert.ok(manager.includes('nameLayer?.remove()'));
 assert.ok(manager.includes('bbox.setFromObject(object)'));
 assert.ok(manager.includes('visibleNpcNameCandidates(records,px,pz,mobile)'));
 assert.ok(manager.includes('npcLabelScreenPosition(projected,rect,{mobile})'));
 assert.ok(manager.includes('overlapsNpcLabel(point,screen,mobile)'));
 assert.ok(manager.includes("lastLabelUpdate<limits.intervalMs"));
 assert.ok(game.includes('npcManager.updateLabels(camera,renderer.domElement,playerPos.x,playerPos.z,MOBILE_UI)'));
 assert.ok(css.includes('pointer-events:none'));
 assert.ok(css.includes('.npc-nameplate[hidden]{display:none!important}'));
 assert.ok(css.includes('body.mobile-ui .npc-nameplate'));
 assert.ok(html.includes('npc-nameplates.css?v=1'));
});
