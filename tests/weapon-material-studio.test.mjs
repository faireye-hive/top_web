import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 WEAPON_MATERIAL_STORAGE,normalizeWeaponMaterial,parseWeaponMaterialProfiles,
 readWeaponMaterialProfiles,saveWeaponMaterialProfiles,weaponProfileKey,
 weaponPrimitives,weaponMaterialSettings,writeWeaponMaterialSettings,
 applyWeaponMaterialSettings,applyWeaponAppearance,updateWeaponMaterialGlow
} from '../js/weapon-materials.mjs';

test('configurações limitadas e import/export sem adulterar perfis de pose',()=>{
 const good={version:1,profiles:{'lance:crusader':{slots:{
   '6':{subsets:{'0':{color:'#12AABB',metalness:10,roughness:-3,glow:2,pulse:.5}}},
   '9':{subsets:{'1':{color:'javascript:bad',emissive:'#aa22cc',flipV:true}}}
 }}}};
 const p=parseWeaponMaterialProfiles(good);
 assert.equal(p.profiles['lance:crusader'].slots[6].subsets[0].color,'#12aabb');
 assert.equal(p.profiles['lance:crusader'].slots[6].subsets[0].metalness,1);
 assert.equal(p.profiles['lance:crusader'].slots[6].subsets[0].roughness,0);
 assert.equal(p.profiles['lance:crusader'].slots[9].subsets[1].color,'#ffffff');
 assert.equal(p.profiles['lance:crusader'].slots[9].subsets[1].flipV,true);
 assert.throws(()=>parseWeaponMaterialProfiles({version:2,profiles:{}}));
 assert.equal(normalizeWeaponMaterial({textureData:'data:text/html;base64,AAAA'}).textureData,undefined);
 assert.equal(weaponProfileKey('lance','crusader'),'lance:crusader');
});

test('perfis de materiais podem ser salvos e misturados com shipped',()=>{
 const map=new Map();
 const storage={getItem:key=>map.get(key)||null,setItem:(k,v)=>map.set(k,v)};
 const p={version:1,profiles:{}};
 writeWeaponMaterialSettings(p,'lance','crusader',6,1,{color:'#aabbcc',glow:2});
 saveWeaponMaterialProfiles(p,storage);
 assert.ok(map.get(WEAPON_MATERIAL_STORAGE));
 const merged=readWeaponMaterialProfiles(storage,{version:1,profiles:{
   'phyllis:cleric':{slots:{'9':{subsets:{'0':{metalness:.3}}}}}
 }});
 assert.equal(weaponMaterialSettings(merged,'lance','crusader',6,1).glow,2);
 assert.equal(weaponMaterialSettings(merged,'phyllis','cleric',9,0).metalness,.3);
 assert.equal(weaponMaterialSettings(merged,'lance','crusader',9,0),null);
});

test('material é clonado, original permanece intocado e malhas compartilham grupo',()=>{
 function mat(name){
   return {name,color:{value:null,set(v){this.value=v}},
     roughness:.9,metalness:0,
     emissive:{value:null,set(v){this.value=v}},
     emissiveIntensity:0,
     userData:{},map:{name:'GLB original'},
     clone(){return {...this,color:{...this.color},
       emissive:{...this.emissive},userData:{...this.userData}}}};
 }
 const meshes=Array.from({length:2},(_,i)=>({
   isMesh:true,geometry:{},material:mat('source '+i),userData:{}
 }));
 const orig=meshes.map(m=>m.material);
 const group={name:'Parte_5__01010021_lgo',
   userData:{topRole:'weapon',equipmentSlot:6},
   traverse(fn){fn(this);meshes.forEach(fn)}};
 const avatar={traverse(fn){group.traverse(fn)}};
 assert.deepEqual(weaponPrimitives(group),meshes);
 const p={version:1,profiles:{}};
 writeWeaponMaterialSettings(p,'lance','crusader',6,1,{color:'#4477cc',roughness:.15,glow:3,
   emissive:'#aaffaa',pulse:1,pulseSpeed:1});
 const count=applyWeaponAppearance({TextureLoader:class{}},avatar,'lance','crusader',p);
 assert.equal(count,1);
 assert.equal(meshes[0].material,orig[0]);
 assert.notEqual(meshes[1].material,orig[1]);
 assert.equal(meshes[1].material.map,orig[1].map);
 assert.equal(meshes[1].material.roughness,.15);
 assert.equal(meshes[1].material.color.value,'#4477cc');
 updateWeaponMaterialGlow(avatar,0);
 assert.ok(meshes[1].material.emissiveIntensity>0);
 assert.equal(orig[1].roughness,.9);
});

test('editor apresenta controles de texturas originais e refino separado do Pose Studio',()=>{
 const html=readFileSync(new URL('./weapon-editor.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('./weapon-editor.mjs',import.meta.url),'utf8');
 for(const id of ['slot','subset','texture-preview','upload','original','flipV','glow',
    'roughness','metalness','emissive','export','save','texture-file','placement']){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.ok(js.includes('writeWeaponMaterialSettings('));
 assert.ok(js.includes('applyWeaponMaterialSettings('));
 assert.ok(js.includes('new WeaponHolster('));
 assert.ok(js.includes("manifest.sets[job.value].models[actor.value]"));
 const main=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
 assert.ok(main.includes('applyWeaponAppearance('));
 assert.ok(main.includes('updateWeaponMaterialGlow('));
 const glb=readFileSync(new URL('../assets/equipment/models/lance-crusader.glb',import.meta.url));
 const len=glb.readUInt32LE(12);
 const g=JSON.parse(glb.subarray(20,20+len).toString());
 const weapons=g.nodes.filter(n=>n.extras?.topRole==='weapon');
 assert.equal(weapons.length,2);
 assert.deepEqual(weapons.map(n=>g.meshes[n.mesh].primitives.length),[2,2]);
 for(const node of weapons)for(const primitive of g.meshes[node.mesh].primitives){
   const material=g.materials[primitive.material];
   assert.ok(material.pbrMetallicRoughness.baseColorTexture,'weapon subset without embedded texture');
   assert.ok(primitive.attributes.TEXCOORD_0!==undefined);
 }
});
