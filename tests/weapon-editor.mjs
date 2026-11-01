import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {weaponMeshNodes,WeaponHolster,selectPoseName,readPoseProfiles,poseProfile} from '../js/pose-studio-runtime.mjs';
import {MAX_TEXTURE_DATA_CHARS,readWeaponMaterialProfiles,saveWeaponMaterialProfiles,
  parseWeaponMaterialProfiles,weaponPrimitives,weaponMaterialSettings,
  writeWeaponMaterialSettings,applyWeaponMaterialSettings,
  updateWeaponMaterialGlow} from '../js/weapon-materials.mjs';

const $=id=>document.getElementById(id);
const actor=$('actor'),job=$('job'),slot=$('slot'),subset=$('subset');
const canvas=$('view'),message=$('status'),info=$('info');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
const scene=new THREE.Scene();
scene.background=new THREE.Color('#102b36');
scene.add(new THREE.HemisphereLight(0xd4eafe,0x474f5e,2.2));
const sun=new THREE.DirectionalLight(0xffdfbe,2.3);
sun.position.set(6,12,8);scene.add(sun);
const camera=new THREE.PerspectiveCamera(45,1,.05,400);
const orbit=new OrbitControls(camera,canvas);
orbit.enableDamping=true;
orbit.minDistance=1.1;orbit.maxDistance=35;
const grid=new THREE.GridHelper(30,30,0x497786,0x224451);grid.position.y=-.04;scene.add(grid);
const clock=new THREE.Clock(),loader=new GLTFLoader(),textureLoader=new THREE.TextureLoader();
let manifest=null,model=null,mixer=null,holster=null,groups=[],animations=[];
let currentAction=null,currentKey='',playing=true,loading=0;
let store={version:1,profiles:{}};
const currentSlot=()=>Number(slot.value);
const selectedPart=()=>groups.find((g,i)=>String(g.userData?.equipmentSlot||(i===0?6:9))===slot.value);
const selectedMesh=()=>weaponPrimitives(selectedPart())[Number(subset.value)]||null;
const selectedIndex=()=>Number(subset.value);
function status(text){message.textContent=text;}
function clampSettings(){
 const v={};
 for(const key of ['roughness','metalness','glow','pulse','pulseSpeed']){
   const n=Number($(key).value);
   v[key]=Number.isFinite(n)?n:0;
 }
 v.color=$('color').value;
 v.emissive=$('emissive').value;
 v.flipV=$('flipV').checked;
 const previous=weaponMaterialSettings(store,actor.value,job.value,currentSlot(),selectedIndex());
 if(previous?.textureData)v.textureData=previous.textureData;
 return v;
}
function setOutputs(){
 for(const id of ['roughness','metalness','glow','pulse','pulseSpeed'])
   $(id+'-value').textContent=Number($(id).value).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
}
function getEffective(){
 const mesh=selectedMesh();
 const settings=weaponMaterialSettings(store,actor.value,job.value,currentSlot(),selectedIndex());
 if(settings)return {...settings};
 const base=mesh?.userData?.topWeaponBaseMaterial||mesh?.material;
 return {
   color:base?.color?'#'+base.color.getHexString():'#ffffff',
   roughness:base?.roughness??.85,metalness:base?.metalness??0,
   emissive:base?.emissive?'#'+base.emissive.getHexString():'#000000',
   glow:base?.emissiveIntensity&&base.emissiveIntensity!==1?base.emissiveIntensity:0,
   pulse:0,pulseSpeed:2,flipV:false
 };
}
function fields(){
 const mesh=selectedMesh();
 const values=getEffective();
 for(const key of ['roughness','metalness','glow','pulse','pulseSpeed'])
   $(key).value=values[key];
 $('color').value=values.color;$('emissive').value=values.emissive;
 $('flipV').checked=values.flipV;setOutputs();
 for(const elt of document.querySelectorAll('.settings input:not([type="file"]),.settings button'))
   elt.disabled=!mesh;
 showSource();
}
function drawTexture(texture){
 const canvas=$('texture-preview'),ctx=canvas.getContext('2d');
 ctx.clearRect(0,0,canvas.width,canvas.height);
 const image=texture?.image?.data?null:texture?.image;
 if(!image){
   ctx.fillStyle='#d0e1e9';ctx.font='14px sans-serif';
   ctx.fillText('Sem imagem para pré-visualizar',15,65);return;
 }
 try{
   const scale=Math.min(canvas.width/image.width,canvas.height/image.height);
   const w=Math.max(1,image.width*scale),h=Math.max(1,image.height*scale);
   ctx.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
 }catch{
   ctx.fillStyle='#d0e1e9';ctx.font='14px sans-serif';
   ctx.fillText('Textura está no GLB',16,66);
 }
}
function showSource(){
 const mesh=selectedMesh();
 if(!mesh){$('source').textContent='Selecione uma espada e uma submalha.';drawTexture(null);return;}
 const base=mesh.userData?.topWeaponBaseMaterial||mesh.material;
 const tex=base.map;
 const upload=weaponMaterialSettings(store,actor.value,job.value,currentSlot(),selectedIndex())?.textureData;
 $('source').textContent=[
  'Malha: '+mesh.name,
  'Material: '+(base.name||'(sem nome)'),
  'Textura incorporada: '+(tex?'SIM':'NÃO'),
  'Imagem importada: '+(upload?'SIM':'NÃO'),
  'UV: '+(mesh.geometry.getAttribute('uv')?'SIM':'NÃO'),
  'Tamanho original: '+(tex?.image?.width||'?')+' × '+(tex?.image?.height||'?'),
  'Estado: '+(mesh.material.userData?.topTextureStatus||'original')
 ].join('\n');
 drawTexture(upload?mesh.material.map:tex);
}
function applyCurrent(){
 const mesh=selectedMesh();if(!mesh)return;
 const settings=writeWeaponMaterialSettings(
   store,actor.value,job.value,currentSlot(),selectedIndex(),clampSettings());
 applyWeaponMaterialSettings(THREE,mesh,settings,textureLoader);
 // The holstered copies share geometry, but must follow the edited material.
 const part=holster?.parts.find(p=>p.slot===currentSlot());
 const index=part?.meshes?.indexOf(mesh)??-1;
 if(index>=0&&part?.views?.[index])part.views[index].material=mesh.material;
 setOutputs();showSource();
}
function selectSubset(){
 const group=selectedPart();
 subset.replaceChildren();
 weaponPrimitives(group).forEach((mesh,i)=>{
   const option=document.createElement('option');
   option.value=String(i);
   option.textContent='Parte '+(i+1)+' · '+(mesh.material?.name||mesh.name||'Material');
   subset.append(option);
 });
 subset.disabled=!group;
 fields();
}
function selectSlot(){
 slot.replaceChildren();
 groups.forEach((g,i)=>{
   const slotId=Number(g.userData?.equipmentSlot)||(i===0?6:9);
   const match=manifest?.sets?.[job.value]?.items?.find(e=>e.slot===slotId);
   const op=document.createElement('option');op.value=String(slotId);
   op.textContent='Slot '+slotId+' · '+(match?.name||g.name);
   slot.append(op);
 });
 slot.disabled=!groups.length;
 selectSubset();
}
function changeAnimation(){
 if(!mixer)return;
 currentAction?.stop();currentAction=null;
 const state=$('animation').value;
 const chosen=selectPoseName(state,null,animations,manifest?.sets?.[job.value]?.pose||0);
 const clip=animations.find(x=>x.name===chosen);
 if(clip){
   currentAction=mixer.clipAction(clip);
   currentAction.reset().setLoop(state==='attack'?THREE.LoopRepeat:THREE.LoopRepeat).play();
   currentAction.paused=!playing;
 }
}
function applyPlacement(){
 if(!holster)return;
 const selected=$('placement').value;
 holster.setStowed(selected==='back');
 if(selected==='hidden')for(const p of holster.parts){
   p.source.visible=false;if(p.holder)p.holder.visible=false;
 }
}
function toggleBody(){
 const weapons=new Set(groups.flatMap(g=>weaponPrimitives(g)));
 model?.traverse(mesh=>{
   if(!mesh.isMesh&&!mesh.isSkinnedMesh)return;
   if(!weapons.has(mesh))mesh.visible=$('body').checked;
 });
}
function fitCamera(){
 if(!model)return;
 // Frame entire character so both hand and holstered position stay visible.
 const box=new THREE.Box3().setFromObject(model);
 const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 const height=Math.max(2,size.y);
 orbit.target.copy(c);camera.position.set(c.x+height*.78,c.y+height*.35,c.z+height*1.45);
 camera.near=.05;camera.far=400;camera.updateProjectionMatrix();
 orbit.update();
}
async function loadCharacter(){
 const nonce=++loading;
 if(!manifest?.sets?.[job.value]?.models?.[actor.value])return;
 status('Carregando personagem e equipamentos...');
 try{
   const path='assets/equipment/'+manifest.sets[job.value].models[actor.value]+'?v=6';
   const gltf=await loader.loadAsync(path);
   if(nonce!==loading)return;
   holster?.dispose();holster=null;
   if(model)scene.remove(model);
   model=gltf.scene;scene.add(model);
   model.traverse(x=>{if(x.isMesh)x.frustumCulled=false});
   animations=gltf.animations;mixer=new THREE.AnimationMixer(model);
   groups=weaponMeshNodes(model);
   for(const node of groups){
     const slotId=Number(node.userData?.equipmentSlot)||(groups.indexOf(node)===0?6:9);
     for(const [index,mesh] of weaponPrimitives(node).entries()){
       const s=weaponMaterialSettings(store,actor.value,job.value,slotId,index);
       if(s)applyWeaponMaterialSettings(THREE,mesh,s,textureLoader);
     }
   }
   const shippedPose=await fetch('assets/poses/overrides.json?v=1').then(r=>r.json()).catch(()=>({version:1,profiles:{}}));
   const poseProfileData=readPoseProfiles(globalThis.localStorage,shippedPose);
   holster=new WeaponHolster(THREE,model,job.value,
     poseProfile(poseProfileData,actor.value,job.value),actor.value);
   for(const part of holster.parts){
     part.views?.forEach((view,i)=>{if(part.meshes[i])view.material=part.meshes[i].material});
   }
   selectSlot();fitCamera();changeAnimation();applyPlacement();toggleBody();
   status('✓ '+actor.value+' / '+job.value+' · '+groups.length+
     ' arma(s) · '+groups.reduce((n,g)=>n+weaponPrimitives(g).length,0)+' materiais editáveis');
 }catch(err){
   console.error(err);status('Falha ao abrir modelo: '+err.message);
 }
}
function updateJobs(){
 const actorValue=actor.value,current=job.value;
 job.replaceChildren();
 Object.entries(manifest?.sets||{}).forEach(([name,entry])=>{
   if(!entry.models?.[actorValue])return;
   const option=document.createElement('option');option.value=name;option.textContent=name;
   job.append(option);
 });
 if([...job.options].some(op=>op.value===current))job.value=current;
}
function downloadJSON(){
 try{
   const clean=parseWeaponMaterialProfiles(store);
   const file=new Blob([JSON.stringify(clean,null,2)+'\n'],{type:'application/json'});
   const url=URL.createObjectURL(file),a=document.createElement('a');
   a.href=url;a.download='weapon-material-overrides.json';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1200);
   status('✓ JSON exportado: publique como assets/weapons/overrides.json');
 }catch(err){status('Não foi possível exportar: '+err.message)}
}
function save(){
 try{saveWeaponMaterialProfiles(store);status('✓ Aparência salva no navegador. Atualize o jogo para aplicá-la.')}
 catch(err){status('Não coube no armazenamento local; exporte JSON. '+err.message)}
}
async function init(){
 try{
   manifest=await fetch('assets/equipment/manifest.json?v=1').then(r=>r.json());
   const shipped=await fetch('assets/weapons/overrides.json?v=1')
     .then(r=>r.ok?r.json():{version:1,profiles:{}})
     .catch(()=>({version:1,profiles:{}}));
   store=readWeaponMaterialProfiles(globalThis.localStorage,shipped);
   updateJobs();
   await loadCharacter();
 }catch(err){status('Erro ao inicializar: '+err.message)}
}
actor.addEventListener('change',()=>{updateJobs();loadCharacter()});
job.addEventListener('change',loadCharacter);
slot.addEventListener('change',selectSubset);
subset.addEventListener('change',fields);
$('animation').addEventListener('change',changeAnimation);
$('placement').addEventListener('change',applyPlacement);
$('body').addEventListener('change',toggleBody);
$('grid').addEventListener('change',()=>{grid.visible=$('grid').checked});
$('pause').addEventListener('click',()=>{
 playing=!playing;$('pause').textContent=playing?'❚❚ Pausar':'▶ Reproduzir';
 if(currentAction)currentAction.paused=!playing;
});
$('reset-camera').addEventListener('click',fitCamera);
for(const id of ['color','emissive','roughness','metalness','glow','pulse','pulseSpeed','flipV']){
 $(id).addEventListener('input',()=>{
   if(id==='glow'&&Number($('glow').value)>0&&$('emissive').value==='#000000')
     $('emissive').value='#5ecbff';
   applyCurrent();
 });
}
$('original').addEventListener('click',()=>{
 const data=clampSettings();delete data.textureData;
 const settings=writeWeaponMaterialSettings(
   store,actor.value,job.value,currentSlot(),selectedIndex(),data);
 delete settings.textureData;
 const mesh=selectedMesh();
 if(mesh)applyWeaponMaterialSettings(THREE,mesh,settings,textureLoader);
 showSource();status('Textura original do GLB restaurada nesta submalha.');
});
$('upload').addEventListener('click',()=>$('texture-file').click());
$('texture-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1250000){
   status('Use PNG/JPG/WebP de até 1,25 MB para caber no JSON.');return;
 }
 const reader=new FileReader();
 reader.onload=()=>{
   if(typeof reader.result!=='string'||reader.result.length>MAX_TEXTURE_DATA_CHARS){
     status('Imagem grande demais para o perfil.');return;
   }
   const mesh=selectedMesh();if(!mesh)return;
   const settings={...clampSettings(),textureData:reader.result};
   writeWeaponMaterialSettings(store,actor.value,job.value,currentSlot(),selectedIndex(),settings);
   applyWeaponMaterialSettings(THREE,mesh,settings,textureLoader);
   const part=holster?.parts.find(p=>p.slot===currentSlot());
   const index=part?.meshes?.indexOf(mesh)??-1;
   if(index>=0&&part?.views?.[index])part.views[index].material=mesh.material;
   status('Imagem aplicada para prévia. Salve ou exporte para reutilizar.');
   setTimeout(showSource,350);
 };
 reader.readAsDataURL(file);
 e.target.value='';
});
$('reset-part').addEventListener('click',async()=>{
 const profile=store.profiles?.[actor.value+':'+job.value];
 const part=profile?.slots?.[String(currentSlot())];
 if(part)delete part.subsets[String(selectedIndex())];
 await loadCharacter();
 status('Material restaurado ao GLB original para este perfil.');
});
$('save').addEventListener('click',save);
$('export').addEventListener('click',downloadJSON);
$('import').addEventListener('click',()=>$('json-file').click());
$('json-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{store=parseWeaponMaterialProfiles(await file.text());await loadCharacter();
   status('✓ JSON importado em memória. Salve para aplicar no jogo.')}
 catch(err){status('JSON inválido: '+err.message)}
 e.target.value='';
});
function render(){
 requestAnimationFrame(render);
 const dt=Math.min(.05,clock.getDelta());
 if(playing)mixer?.update(dt);
 if(model)updateWeaponMaterialGlow(model,performance.now());
 orbit.update();
 const width=canvas.clientWidth||500,height=canvas.clientHeight||500;
 const w=Math.round(width*Math.min(devicePixelRatio||1,2));
 const h=Math.round(height*Math.min(devicePixelRatio||1,2));
 if(canvas.width!==w||canvas.height!==h){
   renderer.setSize(width,height,false);
   camera.aspect=width/height;camera.updateProjectionMatrix();
 }
 renderer.render(scene,camera);
}
render();void init();
