import test from 'node:test';
import assert from 'node:assert/strict';
import {refinementSurfaceNodes,createRefinementSurfaces} from '../js/refinement-surfaces.mjs';
import {normalizeRefinementStyle,parseRefinementProfiles} from '../js/refinement-profiles.mjs';
class Color{constructor(value){this.value=value;}set(value){this.value=value;return this;}copy(value){this.value=value.value;return this;}}
function material(name){return {name,map:{original:true},userData:{},disposed:false,
 onBeforeCompile(){},customProgramCacheKey(){return 'original';},dispose(){this.disposed=true;},
 clone(){return {...this,userData:{...this.userData}}}};}
function node(name,extras={},mat=material(name)){
 return {name,userData:extras,isMesh:true,material:mat,traverse(fn){fn(this);}};
}
function avatar(nodes){return {traverse(fn){nodes.forEach(n=>n.traverse(fn));}};}
function shader(mat){const value={uniforms:{},fragmentShader:'#include <map_fragment>\n#include <emissivemap_fragment>'};mat.onBeforeCompile(value);return value;}
test('brilho seleciona peças e armas, preservando rosto, cabelo e overlay 1.BMP',()=>{
 const hair=node('Parte_0__hair.lgo'),face=node('Parte_1__face.lgo'),body=node('Parte_2__body.lgo');
 const gloves=node('Parte_3__gloves.lgo'),boots=node('Parte_4__boots.lgo');
 const weapon=node('Parte_5__sword.lgo',{topRole:'weapon',equipmentSlot:6});
 const overlay=node('Parte_6__sword.lgo',{topRole:'weapon',equipmentSlot:9},material('weapon.lgo · 1.BMP'));
 const groups=refinementSurfaceNodes(avatar([hair,face,body,gloves,boots,weapon,overlay]),'lance');
 assert.deepEqual(groups,{weapon:[weapon],armor:[body],gloves:[gloves],boots:[boots],hat:[]});
 assert.deepEqual(refinementSurfaceNodes(avatar([hair,face]),'ami').hat,[]);
 const hat=node('Capacete',{topRole:'hat',equipmentSlot:1});
 assert.deepEqual(refinementSurfaceNodes(avatar([hat]),'lance').hat,[hat]);
});
test('arma e cópia nas costas compartilham brilho sem substituir textura e restauram o material',()=>{
 const original=material('sword'),weapon=node('Parte_5__sword.lgo',{equipmentSlot:6},original);
 const back=node('copy',{},original),surface=createRefinementSurfaces({THREE:{Color}});
 surface.bind(avatar([weapon]),{parts:[{meshes:[weapon],views:[back]}]},'lance');
 assert.notEqual(weapon.material,original);assert.equal(back.material,weapon.material);assert.equal(weapon.material.map,original.map);
 const compiled=shader(weapon.material);surface.setStyle({surfaceTint:.8,surfaceGlow:2,color:'#00ffff',coreColor:'#ffffff'});
 surface.update(2,13);assert.equal(compiled.uniforms.uRefTint.value,.8);assert.equal(compiled.uniforms.uRefGlow.value,2);
 assert.equal(compiled.uniforms.uRefColor.value.value,'#00ffff');assert.match(compiled.fragmentShader,/totalEmissiveRadiance\+=/);
 surface.update(3,0);assert.equal(compiled.uniforms.uRefTint.value,0);assert.equal(compiled.uniforms.uRefGlow.value,0);
 const clone=weapon.material;surface.clear();assert.equal(weapon.material,original);assert.equal(back.material,original);
 assert.equal(clone.disposed,true);assert.equal(original.disposed,false);surface.clear();
});
test('cada peça tem intensidade própria, cor opcional e pode brilhar com refino de arma zero',()=>{
 const meshes=[node('Parte_0__hat.lgo',{topRole:'hat',equipmentSlot:1}),node('Parte_2__body.lgo'),node('Parte_3__gloves.lgo'),node('Parte_4__boots.lgo')];
 const surface=createRefinementSurfaces({THREE:{Color}});surface.bind(avatar(meshes),null,'ami');
 const compiled=meshes.map(m=>shader(m.material));
 surface.setStyle({armorGlow:1,glovesGlow:2,bootsGlow:.5,hatGlow:1.5,armorFollow:false,armorColor:'#12abef'});
 surface.update(1,0);assert.deepEqual(compiled.map(s=>s.uniforms.uRefGlow.value),[1.5,1,2,.5]);
 assert.ok(compiled.every(s=>s.uniforms.uRefColor.value.value==='#12abef'));
 surface.update(2,13,{equipped:false});assert.ok(compiled.every(s=>s.uniforms.uRefGlow.value===0));
 surface.update(2,13,{hidden:true});assert.ok(compiled.every(s=>s.uniforms.uRefTint.value===0));
 surface.clear();
});
test('JSON valida brilho de superfície e mantém peças desligadas nos perfis antigos',()=>{
 const defaults=normalizeRefinementStyle({});assert.equal(defaults.weaponSurface,true);
 for(const key of ['armorGlow','glovesGlow','bootsGlow','hatGlow'])assert.equal(defaults[key],0);
 const edited=normalizeRefinementStyle({weaponSurface:false,armorFollow:false,armorColor:'#123456',surfacePattern:'pulse',hatGlow:9,surfaceTint:-4});
 const result=parseRefinementProfiles(JSON.stringify({version:1,profiles:{'ami:cleric':edited}})).profiles['ami:cleric'];
 assert.deepEqual(result,edited);assert.equal(result.hatGlow,3);assert.equal(result.surfaceTint,0);
 assert.equal(normalizeRefinementStyle({surfacePattern:'invalid',weaponSurface:'false'}).surfacePattern,'flow');
});

test('aura externa de cada peça independe do brilho da textura; aura de cajado respeita refino zero',async()=>{
 const {refinementAuraState}=await import('../js/refinement-surfaces.mjs');
 const style=normalizeRefinementStyle({armorGlow:0,armorAura:1.7,glovesAura:.8,bootsAura:.5,hatAura:1.2,equipmentAuraWidth:2});
 assert.equal(refinementAuraState(style,'armor',0).intensity,1.7);
 assert.equal(refinementAuraState(style,'gloves',0).intensity,.8);
 assert.equal(refinementAuraState(style,'boots',0).intensity,.5);
 assert.equal(refinementAuraState(style,'hat',0).intensity,1.2);
 assert.equal(refinementAuraState(style,'armor',0).width,.08);
 assert.equal(refinementAuraState(style,'weapon',0).intensity,0);
 assert.ok(refinementAuraState(style,'weapon',13).intensity>0);
 const saved=parseRefinementProfiles({version:1,profiles:{'ami:cleric':style}});
 assert.equal(saved.profiles['ami:cleric'].armorAura,1.7);
});
