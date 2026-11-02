import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRefinementHeadgear} from '../js/refinement-headgear.mjs';
test('cancelar um chapéu em download não equipa o resultado atrasado',async()=>{
 let resolve,disposed=false;const errors=[];
 const head=createRefinementHeadgear({THREE:{},loader:{loadAsync:()=>new Promise(r=>{resolve=r;})},onError:e=>errors.push(e)});
 head.bind({},'lance');const pending=head.setStyle({hatModel:'royal-major'});
 await head.setStyle({hatModel:'none'});
 resolve({scene:{traverse(fn){fn({geometry:{dispose(){disposed=true;}}});}}});
 await pending;assert.equal(disposed,true);assert.equal(errors.length,0);head.clear();
});
test('trocar personagem durante download descarta o chapéu sem alterar o novo avatar',async()=>{
 let resolve,disposed=false;const head=createRefinementHeadgear({THREE:{},loader:{loadAsync:()=>new Promise(r=>{resolve=r;})}});
 head.bind({},'ami');const pending=head.setStyle({hatModel:'royal-major'});head.bind({},'phyllis');
 resolve({scene:{traverse(fn){fn({material:{dispose(){disposed=true;}}});}}});
 await pending;assert.equal(disposed,true);head.clear();
});
test('os quatro chapéus publicados têm metadados de peça real e tamanho limitado',()=>{
 const equipment=JSON.parse(readFileSync(new URL('../assets/equipment/manifest.json',import.meta.url)));
 const manifest=JSON.parse(readFileSync(new URL('../assets/equipment/headgear/manifest.json',import.meta.url)));
 assert.equal(manifest.itemId,5488);assert.equal(manifest.models.length,4);
 for(const entry of manifest.models){
   const data=readFileSync(new URL('../assets/equipment/headgear/'+entry.model,import.meta.url));
   assert.ok(data.length<512*1024);assert.equal(data.length,data.readUInt32LE(8));
   const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
   const meshes=json.nodes.filter(n=>'mesh'in n);assert.ok(meshes.length>0);
   assert.ok(meshes.every(n=>n.extras?.topRole==='hat'&&n.extras.equipmentSlot===1&&n.extras.sourceItemId===5488));
   assert.ok(json.skins[0].joints.length>0);assert.ok(!json.animations);
   const model=Object.values(equipment.sets).find(set=>set.models[entry.actor]).models[entry.actor];
   const body=readFileSync(new URL('../assets/equipment/'+model,import.meta.url));
   const bodyJson=JSON.parse(body.subarray(20,20+body.readUInt32LE(12)));
   const names=new Set(bodyJson.skins[0].joints.map(joint=>bodyJson.nodes[joint].name));
   assert.ok(json.skins[0].joints.every(joint=>names.has(json.nodes[joint].name)),'ossos do chapéu devem existir no personagem');
 }
});
