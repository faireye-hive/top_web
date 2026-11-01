import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 WEAPON_MATERIAL_STORAGE,normalizeWeaponMaterial,parseWeaponMaterialProfiles,
 readWeaponMaterialProfiles,saveWeaponMaterialProfiles,weaponProfileKey,
 weaponPrimitives,weaponMaterialSettings,writeWeaponMaterialSettings,
 applyWeaponMaterialSettings,applyWeaponAppearance,updateWeaponMaterialGlow,
 isWeaponAdditiveLayer,applyWeaponAdditiveLayer
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


test('Dance of Evanescence: a textura vermelha é material principal; 1.BMP é overlay aditivo',()=>{
 const raw=readFileSync(new URL('../assets/equipment/models/lance-crusader.glb',import.meta.url));
 const len=raw.readUInt32LE(12);
 const gltf=JSON.parse(raw.subarray(20,20+len).toString('utf8'));
 const weapons=gltf.nodes.filter(x=>x.extras?.topRole==='weapon');
 assert.equal(weapons.length,2);
 for(const weapon of weapons){
   const materialNames=gltf.meshes[weapon.mesh].primitives.map(p=>gltf.materials[p.material].name);
   assert.match(materialNames[0],/01010021\.bmp$/i);
   assert.match(materialNames[1],/1\.BMP$/i);
 }
 const original={name:'01010021.lgo · 1.BMP',userData:{},
   transparent:false,depthWrite:true,opacity:1,
   clone(){return {...this,userData:{...this.userData}}}};
 const mesh={material:original,isMesh:true,userData:{},visible:true};
 assert.equal(isWeaponAdditiveLayer(mesh),true);
 const THREE={AdditiveBlending:'SRC_ALPHA_ONE',TextureLoader:class{}};
 applyWeaponAdditiveLayer(THREE,mesh);
 assert.equal(mesh.visible,false,'camada azul deve ficar oculta por padrão');
 assert.notEqual(mesh.material,original,'não alterar o GLB original');
 assert.equal(mesh.material.blending,'SRC_ALPHA_ONE');
 assert.equal(mesh.material.transparent,true);
 assert.equal(mesh.material.depthWrite,false);
 assert.equal(original.transparent,false);
 applyWeaponAdditiveLayer(THREE,mesh,{overlayVisible:true,overlayOpacity:.22});
 assert.equal(mesh.visible,true);
 assert.equal(mesh.material.opacity,.22);
 applyWeaponAdditiveLayer(THREE,mesh,{overlayVisible:false});
 assert.equal(mesh.visible,false);
 const real={material:{name:'01010021.lgo · 01010021.bmp',userData:{}},userData:{},visible:true};
 assert.equal(isWeaponAdditiveLayer(real),false);
 assert.equal(applyWeaponAdditiveLayer(THREE,real),false);
 assert.equal(real.visible,true);
});

test('material histórico com extras topOriginalBlend=1 também é reconhecido',()=>{
 assert.equal(isWeaponAdditiveLayer({material:{
   name:'Material 2',userData:{topOriginalBlend:1}}}),true);
 const s=normalizeWeaponMaterial({overlayVisible:true,overlayOpacity:9});
 assert.equal(s.overlayVisible,true);
 assert.equal(s.overlayOpacity,1);
 const p=parseWeaponMaterialProfiles({version:1,profiles:{
   'lance:crusader':{slots:{'6':{subsets:{'1':{overlayVisible:true,overlayOpacity:.4}}}}}
 }});
 assert.equal(p.profiles['lance:crusader'].slots[6].subsets[1].overlayOpacity,.4);
});


test('todos os 14 GLBs usam textura principal distinta de 1.BMP na arma',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../assets/equipment/manifest.json',import.meta.url)));
 let models=0,weapons=0,candidates=0;
 for(const [job,entry] of Object.entries(manifest.sets)){
   const expected=entry.items.filter(item=>item.slot===6||item.slot===9).length;
   for(const [actor,file] of Object.entries(entry.models)){
     const name=file.replace(/^models\//,'');
     const bytes=readFileSync(new URL('../assets/equipment/models/'+name,import.meta.url));
     assert.equal(bytes.subarray(0,4).toString(),'glTF');
     const len=bytes.readUInt32LE(12);
     const gltf=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
     const nodes=gltf.nodes.filter(node=>
       node.mesh!==undefined&&(
         node.extras?.topRole==='weapon'||
         /^Parte\s+[5-9]\s*·/.test(node.name||'')));
     assert.equal(nodes.length,expected,actor+'/'+job+' expected weapon count');
     for(const node of nodes){
       weapons++;
       const primitives=gltf.meshes[node.mesh].primitives;
       assert.equal(primitives.length,2,actor+'/'+job+' needs two subsets');
       for(let i=0;i<primitives.length;i++){
         const material=gltf.materials[primitives[i].material];
         const texture=material.pbrMetallicRoughness.baseColorTexture;
         assert.ok(texture,actor+'/'+job+' lacks texture '+i);
         assert.ok(primitives[i].attributes.TEXCOORD_0!==undefined);
         const filename=gltf.images[gltf.textures[texture.index].source].name;
         const old={material:{name:material.name,userData:{}},userData:{}};
         const isOverlay=isWeaponAdditiveLayer(old);
         if(i===0){
           assert.doesNotMatch(filename,/^1\.bmp$/i);
           assert.equal(isOverlay,false,actor+'/'+job+' main texture misclassified');
         }else{
           candidates++;
           assert.match(filename,/^1\.bmp$/i);
           assert.equal(isOverlay,true,actor+'/'+job+' candidate not recognized');
         }
       }
     }
     models++;
   }
 }
 assert.equal(models,14);
 assert.equal(weapons,16);
 assert.equal(candidates,16);
});

test('Champion and cleric: main weapon surface stays visible, secondary 1.BMP hides by default',()=>{
 const make=(name)=>({
   isMesh:true,material:{
     name,visible:true,transparent:false,userData:{},opacity:1,depthWrite:true,
     clone(){return {...this,userData:{...this.userData}}}
   },userData:{},visible:true
 });
 const main=make('02020029.lgo · 02020029.bmp');
 const overlay=make('02020029.lgo · 1.BMP');
 const sword={name:'Parte_5__02020029_lgo',
   userData:{topRole:'weapon',equipmentSlot:9},
   traverse(fn){fn(this);fn(main);fn(overlay)}};
 const avatar={traverse(fn){sword.traverse(fn)}};
 const THREE={AdditiveBlending:'additive',TextureLoader:class{}};
 const result=applyWeaponAppearance(THREE,avatar,'carsise','champion',{version:1,profiles:{}});
 assert.equal(result,0);
 assert.equal(main.visible,true);
 assert.equal(overlay.visible,false);
 assert.equal(overlay.material.blending,'additive');
 assert.equal(overlay.material.depthWrite,false);
 assert.equal(main.material.name,'02020029.lgo · 02020029.bmp');
 const explicit={version:1,profiles:{'carsise:champion':{slots:{'9':{subsets:{
   '1':{overlayVisible:true,overlayOpacity:.2}
 }}}}}};
 applyWeaponAppearance(THREE,avatar,'carsise','champion',explicit);
 assert.equal(overlay.visible,true);
 assert.equal(overlay.material.opacity,.2);
});

test('editor apresenta controles de texturas originais e refino separado do Pose Studio',()=>{
 const html=readFileSync(new URL('./weapon-editor.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('./weapon-editor.mjs',import.meta.url),'utf8');
 for(const id of ['slot','subset','texture-preview','upload','original','flipV','glow',
    'roughness','metalness','emissive','export','save','texture-file','placement']){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/id="overlay-visible"/);
 assert.match(html,/id="overlayOpacity"/);
 assert.ok(js.includes('applyWeaponAdditiveLayer('));
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
