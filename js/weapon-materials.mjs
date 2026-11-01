// Shared weapon material overrides for TOP Web + Weapon Material Studio.
// Cosmetic only. Does not modify original GLB geometry or historical skills.
import {weaponMeshNodes} from './pose-studio-runtime.mjs';
export const WEAPON_MATERIAL_STORAGE='topweb_weapon_materials_v1';
export const MAX_TEXTURE_DATA_CHARS=1800000;
const finite=(v,def,min,max)=>{
 const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):def;
};
const color=(s,def='#ffffff')=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():def;
const safeTexture=s=>typeof s==='string'&&s.length<=MAX_TEXTURE_DATA_CHARS&&
 /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(s)?s:null;

export function normalizeWeaponMaterial(raw={}){
 const textureData=safeTexture(raw.textureData);
 return {
   color:color(raw.color),
   roughness:finite(raw.roughness,.85,0,1),
   metalness:finite(raw.metalness,0,0,1),
   emissive:color(raw.emissive,'#000000'),
   glow:finite(raw.glow,0,0,4),
   pulse:finite(raw.pulse,0,0,1),
   pulseSpeed:finite(raw.pulseSpeed,2,.2,10),
   flipV:raw.flipV===true,
   overlayVisible:raw.overlayVisible===true,
   overlayOpacity:finite(raw.overlayOpacity,.3,0,1),
   ...(textureData?{textureData}:{})
 };
}
export function parseWeaponMaterialProfiles(input){
 const obj=typeof input==='string'?JSON.parse(input):input;
 if(!obj||typeof obj!=='object'||Array.isArray(obj)||obj.version!==1)
   throw new Error('Formato inválido: esperado version 1');
 const profiles={};
 for(const [key,entry] of Object.entries(obj.profiles||{})){
   if(!/^[a-z-]{2,32}:[a-z-]{2,32}$/.test(key)||!entry||typeof entry!=='object')continue;
   const slots={};
   for(const [slot,data] of Object.entries(entry.slots||{})){
     if(!/^(6|9)$/.test(slot)||!data||typeof data!=='object')continue;
     const subsets={};
     for(const [index,settings] of Object.entries(data.subsets||{})){
       if(!/^\d{1,2}$/.test(index)||Number(index)>15||!settings||typeof settings!=='object')continue;
       subsets[index]=normalizeWeaponMaterial(settings);
     }
     slots[slot]={subsets};
   }
   profiles[key]={slots};
 }
 return {version:1,profiles};
}
export const weaponProfileKey=(actor,job)=>actor+':'+job;
export function readWeaponMaterialProfiles(storage=globalThis.localStorage,shipped={version:1,profiles:{}}){
 let base;try{base=parseWeaponMaterialProfiles(shipped)}catch{base={version:1,profiles:{}}}
 try{
   const data=storage?.getItem(WEAPON_MATERIAL_STORAGE);
   if(!data)return base;
   const local=parseWeaponMaterialProfiles(data);
   // Local profiles win, not the published defaults.
   return {version:1,profiles:{...base.profiles,...local.profiles}};
 }catch{return base}
}
export function saveWeaponMaterialProfiles(data,storage=globalThis.localStorage){
 const clean=parseWeaponMaterialProfiles(data);
 storage?.setItem(WEAPON_MATERIAL_STORAGE,JSON.stringify(clean));
 return clean;
}
export function weaponMaterialSettings(store,actor,job,slot,index){
 return store?.profiles?.[weaponProfileKey(actor,job)]?.slots?.[String(slot)]?.subsets?.[String(index)]||null;
}
export function writeWeaponMaterialSettings(store,actor,job,slot,index,value){
 const root=store.profiles??={};
 const entry=root[weaponProfileKey(actor,job)]??={slots:{}};
 const slotEntry=entry.slots[String(slot)]??={subsets:{}};
 slotEntry.subsets[String(index)]=normalizeWeaponMaterial(value);
 return slotEntry.subsets[String(index)];
}
export function weaponPrimitives(node){
 if(!node)return [];
 if(node.isMesh||node.isSkinnedMesh)return [node];
 const result=[];
 node.traverse?.(child=>{if(child!==node&&(child.isMesh||child.isSkinnedMesh))result.push(child)});
 return result;
}
// Prefer explicit blend metadata in future exports. The 14 old GLBs
// discarded original blend flags; their 16 equipped weapons all contain
// a separate material named "<LGO filename> · 1.BMP". The Dance of
// Evanescence was verified as additive. For the other classes, this is
// an additive *candidate*: hidden by default, user-selectable in Studio.
// Only weapon meshes are handled in applyWeaponAppearance(), not armor.
export function isWeaponAdditiveLayer(mesh){
 const material=mesh?.userData?.topWeaponBaseMaterial||mesh?.material;
 if(!material)return false;
 const extras=material.userData||{};
 if(extras.topOriginalBlend===1||extras.topBlend===1||extras.topLayer==='additive-overlay')
   return true;
 // Legacy compatibility: the shared 1.BMP effect name ONLY, not every
 // extra texture or the main weapon surface. Preserve all other passes.
 return /^.+\.lgo\s*·\s*1\.bmp$/i.test(String(material.name||''));
}

function ensureEditableMaterial(mesh){
 if(!mesh.userData.topWeaponBaseMaterial){
   mesh.userData.topWeaponBaseMaterial=mesh.material;
   mesh.material=mesh.material.clone();
   mesh.userData.topWeaponEditable=true;
 }
 return mesh.material;
}
export function applyWeaponMaterialSettings(THREE,mesh,settings,textureLoader=new THREE.TextureLoader()){
 if(!mesh?.material||!settings)return;
 const m=ensureEditableMaterial(mesh);
 const s=normalizeWeaponMaterial(settings);
 m.color?.set(s.color);
 if('roughness' in m)m.roughness=s.roughness;
 if('metalness' in m)m.metalness=s.metalness;
 if(m.emissive)m.emissive.set(s.emissive);
 if('emissiveIntensity' in m)m.emissiveIntensity=s.glow;
 m.userData.topGlow=s.glow;
 m.userData.topPulse=s.pulse;
 m.userData.topPulseSpeed=s.pulseSpeed;
 m.userData.topTextureStatus=s.textureData?'Carregando imagem':'Original';
 const original=mesh.userData.topWeaponBaseMaterial?.map||null;
 // Reuse source map by default. Custom data URL may take one frame to load.
 if(s.textureData){
   if(mesh.userData.topTextureSrc!==s.textureData){
     const token=(mesh.userData.topTextureToken||0)+1;
     mesh.userData.topTextureToken=token;
     mesh.userData.topTextureSrc=s.textureData;
     m.userData.topTextureStatus='Carregando imagem';
     textureLoader.load(s.textureData,tex=>{
       if(mesh.userData.topTextureToken!==token){tex.dispose();return}
       tex.colorSpace=THREE.SRGBColorSpace;
       tex.flipY=false;
       tex.needsUpdate=true;
       mesh.userData.topUploadedTexture?.dispose();
       mesh.userData.topUploadedTexture=tex;
       m.map=tex;m.needsUpdate=true;
       // A imagem pode terminar de carregar depois do clique "Inverter UV".
       // Reaplicar a configuração vigente sem refazer o download.
       applyWeaponMaterialSettings(THREE,mesh,s,textureLoader);
       m.userData.topTextureStatus='Imagem personalizada';
     },undefined,()=>{
       if(mesh.userData.topTextureToken===token){
         m.userData.topTextureStatus='Falha ao abrir imagem';
         m.map=original;m.needsUpdate=true;
       }
     });
   }
 }else{
   mesh.userData.topTextureToken=(mesh.userData.topTextureToken||0)+1;
   mesh.userData.topTextureSrc=null;
   mesh.userData.topUploadedTexture?.dispose();
   mesh.userData.topUploadedTexture=null;
   m.map=original;
   m.needsUpdate=true;
 }
 // Apply flip on a private texture clone; never touch shared GLB maps.
 if(!s.textureData && s.flipV && original){
   const copy=original.clone();
   copy.repeat.y=-1;copy.offset.y=1;copy.needsUpdate=true;
   mesh.userData.topUVTexture?.dispose();
   mesh.userData.topUVTexture=copy;
   m.map=copy;
 }else if(mesh.userData.topUVTexture){
   mesh.userData.topUVTexture.dispose();
   mesh.userData.topUVTexture=null;
 }
 if(s.textureData&&mesh.userData.topUploadedTexture){
   m.map=mesh.userData.topUploadedTexture;
   if(s.flipV){
     if(mesh.userData.topUVTexture)mesh.userData.topUVTexture.dispose();
     const flipped=m.map.clone();flipped.repeat.y=-1;flipped.offset.y=1;flipped.needsUpdate=true;
     mesh.userData.topUVTexture=flipped;m.map=flipped;
   }
 }
 m.needsUpdate=true;
}
export function applyWeaponAdditiveLayer(THREE,mesh,settings=null){
 if(!isWeaponAdditiveLayer(mesh))return false;
 const mat=ensureEditableMaterial(mesh);
 const state=normalizeWeaponMaterial(settings||{});
 // This is a separate additive overlay, NEVER the base sword texture.
 // Hidden until explicitly enabled; the historical refinement trigger
 // is not yet available and showing its opaque original obscures the blade.
 mat.transparent=true;
 mat.depthWrite=false;
 mat.blending=THREE.AdditiveBlending;
 mat.opacity=state.overlayOpacity;
 mat.needsUpdate=true;
 mesh.visible=state.overlayVisible;
 return true;
}
export function applyWeaponAppearance(THREE,avatar,actor,job,store,textureLoader){
 const groups=weaponMeshNodes(avatar);
 let count=0;
 for(const node of groups){
   const slot=Number(node.userData?.equipmentSlot)||(groups.indexOf(node)===0?6:9);
   for(const [index,mesh] of weaponPrimitives(node).entries()){
     const settings=weaponMaterialSettings(store,actor,job,slot,index);
     if(settings){applyWeaponMaterialSettings(THREE,mesh,settings,textureLoader);count++}
     applyWeaponAdditiveLayer(THREE,mesh,settings);
   }
 }
 return count;
}
export function updateWeaponMaterialGlow(avatar,timeMs=0){
 avatar?.traverse(node=>{
   if(!node.isMesh&&!node.isSkinnedMesh)return;
   const mat=node.material;
   if(!mat?.userData||!('topGlow' in mat.userData))return;
   const {topGlow:base,topPulse:pulse,topPulseSpeed:speed}=mat.userData;
   mat.emissiveIntensity=base*(1-pulse*.45+pulse*.45*(1+Math.sin(timeMs*.001*speed*2*Math.PI)));
 });
}
