import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {WeaponHolster,readPoseProfiles,poseProfile,selectPoseName} from '../js/pose-studio-runtime.mjs?v=7';
import {readWeaponMaterialProfiles,applyWeaponAppearance,updateWeaponMaterialGlow} from '../js/weapon-materials.mjs?v=3';
import {createRefinementHeadgear} from '../js/refinement-headgear.mjs?v=2';
import {createRefinementSurfaces} from '../js/refinement-surfaces.mjs?v=4';
import {createRefinementEffects} from '../js/refinement-effects.mjs?v=9';
import {refinementFollowsSurface} from '../js/refinement-geometry.mjs?v=4';
import {DEFAULT_REFINEMENT_STYLE,normalizeRefinementStyle,readRefinementProfiles,refinementStyle,parseRefinementProfiles,saveRefinementProfiles,styledRefinementVisual} from '../js/refinement-profiles.mjs?v=3';

const $=id=>document.getElementById(id),actor=$('actor'),job=$('job'),canvas=$('view');
const sliderFields=[
 ['width','Largura da lâmina',.25,3,.05],['length','Comprimento na lâmina',.35,2,.05],
 ['tipWidth','Espessura da ponta',0,2,.05],['tipLength','Trecho de afunilamento',.1,.6,.05],
 ['intensity','Intensidade do brilho',.1,3,.05],
 ['aura','Aura ao redor',0,3,.05],['pulse','Pulsação',0,1,.05],['speed','Velocidade do efeito',.1,3,.05],
 ['particles','Quantidade de faíscas',0,2,.05],['particleSize','Tamanho das faíscas',.25,2,.05],
 ['strands','Quantidade de filamentos',0,1.4,.1],['radius','Raio de órbita',.2,3,.05],
 ['strandWidth','Largura dos filamentos',.25,5,.05],['strandGlow','Força da aura do filamento',0,3,.05],
 ['surfaceTint','Cor na superfície da arma',0,1,.05],['surfaceGlow','Brilho na superfície da arma',0,3,.05],
 ['armorGlow','Brilho da armadura',0,3,.05],['glovesGlow','Brilho das luvas',0,3,.05],
 ['bootsGlow','Brilho das botas',0,3,.05],['hatGlow','Brilho do chapéu',0,3,.05],
 ['armorAura','Aura externa da armadura',0,3,.05],['glovesAura','Aura externa das luvas',0,3,.05],
 ['bootsAura','Aura externa das botas',0,3,.05],['hatAura','Aura externa do chapéu',0,3,.05],
 ['equipmentAuraWidth','Largura da aura dos equipamentos',.25,3,.05],['armorTint','Cor na superfície dos equipamentos',0,1,.05]
];
for(const [key,label,min,max,step] of sliderFields){
 const wrapper=document.createElement('label');wrapper.htmlFor=key;wrapper.textContent=label+' ';
 const output=document.createElement('output');output.id=key+'-value';output.htmlFor=key;
 const input=document.createElement('input');Object.assign(input,{id:key,type:'range',min,max,step});input.setAttribute('aria-label',label);
 wrapper.append(output,input);
 const host=['surfaceTint','surfaceGlow'].includes(key)?'weapon-surface-sliders':
 ['armorGlow','glovesGlow','bootsGlow','hatGlow','armorTint','armorAura','glovesAura','bootsAura','hatAura','equipmentAuraWidth'].includes(key)?'armor-surface-sliders':
 ['strands','radius','strandWidth','strandGlow'].includes(key)?'strand-sliders':'sliders';
 $(host).append(wrapper);
 if(key==='tipWidth'){
   const hint=document.createElement('small');hint.className='control-hint';hint.textContent='0%: ponta fina · 100%: reta · 200%: ponta grossa';wrapper.append(hint);
 }
 if(key==='length'){
   const hint=document.createElement('small');hint.className='control-hint';hint.textContent='Altura do efeito ao longo da lâmina. 1× mantém o comprimento original.';wrapper.append(hint);
 }
}
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
const scene=new THREE.Scene();scene.background=new THREE.Color('#110f1b');
scene.add(new THREE.HemisphereLight(0xd6e6ff,0x65505f,2));
const sun=new THREE.DirectionalLight(0xffdec3,2.4);sun.position.set(6,12,8);scene.add(sun);
const camera=new THREE.PerspectiveCamera(45,1,.05,100);
const orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.minDistance=.8;orbit.maxDistance=25;
const grid=new THREE.GridHelper(20,20,0x76524b,0x322633);grid.position.y=-.04;scene.add(grid);
const surfaces=createRefinementSurfaces({THREE});
const effects=createRefinementEffects({THREE,scene,viewportHeight:()=>canvas.height}),loader=new GLTFLoader(),clock=new THREE.Clock();
let manifest=null,model=null,mixer=null,holster=null,animations=[],playing=true,time=0,loading=0,ready=false;
const headgear=createRefinementHeadgear({THREE,loader,onBeforeChange:()=>surfaces.clear(),
 onChange:()=>{if(!model)return;surfaces.bind(model,holster,actor.value);surfaces.setStyle(currentStyle());syncStrandControls();},
 onError:error=>status('Não foi possível abrir o chapéu: '+error.message)});
let store={version:1,profiles:{}},poses={version:1,profiles:{}},materials={version:1,profiles:{}};
const key=()=>`${actor.value}:${job.value}`;
const currentStyle=()=>refinementStyle(store,actor.value,job.value);
function status(text){$('status').textContent=text;}
function updateBudget(){
 const level=Number($('level').value),config=styledRefinementVisual(level,$('mobile').checked,currentStyle());
 $('level-value').textContent='+'+level;$('preview-badge').textContent='Refino +'+level;
 const count=config.particles;
 $('budget').textContent=`${count} faíscas / arma · ${$('mobile').checked?'Mobile':'Desktop'}`;
}
function controlOutput(id,value){
 return ['tipWidth','tipLength'].includes(id)?Math.round(Number(value)*100)+'%':Number(value).toFixed(2)+(['width','length','strandWidth'].includes(id)?'×':'');
}
function syncStrandControls(){
 const mode=$('strandColorMode').value;
 $('strandColor').disabled=mode==='rainbow';
 $('strandColor2').disabled=mode==='solid'||mode==='rainbow';
 $('strandGlow').disabled=$('strandAura').value==='none';
 $('surfaceTint').disabled=$('surfaceGlow').disabled=!$('weaponSurface').checked;
 $('armorColor').disabled=$('armorFollow').checked;
 const available=surfaces.available();
 for(const part of ['armor','gloves','boots','hat'])for(const key of ['Glow','Aura'])$(part+key).disabled=!available[part];
 for(const key of ['length','tipWidth','tipLength'])$(key).disabled=refinementFollowsSurface(job.value);
 $('alignment-note').textContent=refinementFollowsSurface(job.value)?'A aura acompanha o formato real desta arma. Comprimento e ponta são ajustes de espadas.':'';
 $('hat-availability').textContent=available.hat?'Chapéu presente neste visual.':
   'Selecione um chapéu original para ativar o brilho dessa peça.';
}
function fields(){
 const style=currentStyle();
 for(const key of Object.keys(DEFAULT_REFINEMENT_STYLE)){
   if(typeof style[key]==='boolean')$(key).checked=style[key];else $(key).value=style[key];
   if($(key+'-value'))$(key+'-value').textContent=controlOutput(key,style[key]);
 }
 effects.setStyle(style);surfaces.setStyle(style);void headgear.setStyle(style);updateBudget();syncStrandControls();if(ready)fitCamera();
 $('preset').value=Object.keys(presets).find(name=>JSON.stringify(normalizeRefinementStyle(presets[name]))===JSON.stringify(style))||'custom';
 $('profile-label').textContent=`Perfil ${actor.selectedOptions[0].text} / ${job.selectedOptions[0]?.text||job.value}`;
}
function applyFields(event){
 const style={};
 for(const key of Object.keys(DEFAULT_REFINEMENT_STYLE))style[key]=typeof DEFAULT_REFINEMENT_STYLE[key]==='boolean'?$(key).checked:typeof DEFAULT_REFINEMENT_STYLE[key]==='number'?Number($(key).value):$(key).value;
 store.profiles[key()]=normalizeRefinementStyle(style);effects.setStyle(store.profiles[key()]);surfaces.setStyle(store.profiles[key()]);void headgear.setStyle(store.profiles[key()]);$('preset').value='custom';
 for(const [id] of sliderFields)$(id+'-value').textContent=controlOutput(id,$(id).value);
 syncStrandControls();
 if(event?.target?.id==='length')fitCamera();
 updateBudget();status('Prévia atualizada · salve para aplicar no jogo.');
}
function fitCamera(){
 if(!model)return;
 model.updateMatrixWorld(true);
 model.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});
 const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 const halfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const distance=Math.max(size.y/(2*halfFov),Math.hypot(size.x,size.z)/(2*halfFov*Math.max(.4,camera.aspect)))*1.25+size.z*.5;
 orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(-.38,.13,-1).normalize().multiplyScalar(Math.max(3,distance)*Math.max(1,currentStyle().length)));orbit.update();
}
function changeAnimation(){
 if(!mixer)return;
 mixer.stopAllAction();
 const name=selectPoseName($('animation').value,null,animations,manifest.sets[job.value].pose||0);
 const clip=animations.find(c=>c.name===name);
 if(clip)mixer.clipAction(clip).setLoop(THREE.LoopRepeat).play();
 mixer.update(0);fitCamera();
}
function placement(){
 if(!holster)return;
 holster.setStowed($('placement').value==='back');
 if($('placement').value==='hidden')for(const part of holster.parts){part.source.visible=false;if(part.holder)part.holder.visible=false;}
}
function disposeModel(value){
 if(!value)return;
 scene.remove(value);
 const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
 value.traverse(o=>{
   if(o.geometry)geometries.add(o.geometry);
   if(o.skeleton)skeletons.add(o.skeleton);
   for(const m of [o.userData?.topWeaponBaseMaterial,...(Array.isArray(o.material)?o.material:[o.material])])if(m){
     materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
   }
 });
 for(const item of [...geometries,...materials,...textures,...skeletons])item.dispose();
}
async function loadCharacter(){
 const nonce=++loading;ready=false;effects.setAvatar(null,null);surfaces.clear();headgear.clear();$('style-controls').disabled=true;
 for(const id of ['save','export','import','actor','job'])$(id).disabled=true;
 status('Carregando personagem e armas…');
 try{
   const path=manifest?.sets?.[job.value]?.models?.[actor.value];
   if(!path)throw Error('Equipamento indisponível para este personagem');
   const gltf=await loader.loadAsync('assets/equipment/'+path+'?v=6');
   if(nonce!==loading){disposeModel(gltf.scene);return;}
   mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);holster?.dispose();disposeModel(model);
   model=gltf.scene;scene.add(model);model.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
   mixer=new THREE.AnimationMixer(model);animations=gltf.animations;
   applyWeaponAppearance(THREE,model,actor.value,job.value,materials);
   holster=new WeaponHolster(THREE,model,job.value,poseProfile(poses,actor.value,job.value),actor.value);
   for(const part of holster.parts)part.views?.forEach((view,i)=>{
     view.material=part.meshes[i].material;view.visible=part.meshes[i].visible;
   });
   effects.setAvatar(model,holster);surfaces.bind(model,holster,actor.value);headgear.bind(model,actor.value);fields();changeAnimation();placement();fitCamera();
   const names=manifest.sets[job.value].items.filter(item=>[6,9].includes(item.slot)).map(item=>item.name);
   $('weapon-name').textContent=names.join(' · ');
   ready=true;status('Pronto · ajuste o efeito e salve quando gostar.');
 }catch(error){status('Não foi possível abrir o modelo: '+error.message);}
 finally{if(nonce===loading){for(const id of ['import','actor','job'])$(id).disabled=false;for(const id of ['save','export'])$(id).disabled=!ready;$('style-controls').disabled=!ready;}}
}
function updateJobs(){
 const previous=job.value;job.replaceChildren();
 for(const [name,entry] of Object.entries(manifest?.sets||{}))if(entry.models?.[actor.value]){
   const option=document.createElement('option');option.value=name;option.textContent=name.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());job.append(option);
 }
 if([...job.options].some(o=>o.value===previous))job.value=previous;
}
const presets={
 original:DEFAULT_REFINEMENT_STYLE,
 flame:{color:'#ff0d03',coreColor:'#ffe0a1',strandColor:'#ff9a2e',strandColor2:'#fff1bf',strandColorMode:'gradient',strandAura:'flame',strandWidth:1.5,strandGlow:1.4,tipWidth:.15,tipLength:.35,width:1.25,intensity:1.3,aura:1.6,pulse:.35,speed:1.25,particles:1.2,particleSize:1.2,strands:1.3,radius:1.3},
 ice:{color:'#227dff',coreColor:'#d0ffff',strandColor:'#8cefff',strandColor2:'#e9ffff',strandColorMode:'gradient',strandAura:'soft',strandWidth:1.3,tipWidth:.1,width:1,intensity:1.2,aura:1.5,pulse:.15,speed:.75,particles:.8,particleSize:.8,strands:1,radius:1.3},
 violet:{color:'#a122ff',coreColor:'#ffd1ff',strandColor:'#ff87ed',strandColor2:'#98b8ff',strandColorMode:'alternate',strandAura:'electric',strandWidth:1.5,strandGlow:1.5,tipWidth:.25,width:1.1,intensity:1.2,aura:1.8,pulse:.4,speed:.9,particles:1,particleSize:1.1,strands:1.3,radius:1.5}
};
actor.addEventListener('change',()=>{updateJobs();void loadCharacter();});
job.addEventListener('change',()=>void loadCharacter());
$('animation').addEventListener('change',changeAnimation);$('placement').addEventListener('change',placement);
$('level').addEventListener('input',updateBudget);$('mobile').addEventListener('change',updateBudget);
$('grid').addEventListener('change',()=>{grid.visible=$('grid').checked;});
$('pause').addEventListener('click',()=>{playing=!playing;$('pause').textContent=playing?'Pausar':'Reproduzir';});
$('reset-camera').addEventListener('click',fitCamera);
for(const key of Object.keys(DEFAULT_REFINEMENT_STYLE))$(key).addEventListener('input',applyFields);
$('preset').addEventListener('change',()=>{store.profiles[key()]=normalizeRefinementStyle(presets[$('preset').value]);fields();status('Estilo aplicado à prévia · salve para usar no jogo.');});
$('reset-style').addEventListener('click',()=>{store.profiles[key()]={...DEFAULT_REFINEMENT_STYLE};$('preset').value='original';fields();status('Padrão restaurado na prévia · salve para aplicar.');});
$('save').addEventListener('click',()=>{
 try{saveRefinementProfiles(store);status('Salvo! O jogo aplica o estilo neste navegador. Use o mesmo endereço do jogo.');}
 catch{status('Não foi possível salvar neste navegador. Exporte o JSON para guardar seus ajustes.');}
});
$('export').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify(parseRefinementProfiles(store),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='refinement-effects.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
 status('JSON exportado. Para publicar: assets/weapons/refinement-effects.json.');
});
$('import').addEventListener('click',()=>$('json-file').click());
$('json-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
   if(file.size>100000)throw Error('Arquivo muito grande');
   const imported=parseRefinementProfiles(await file.text());store=imported;fields();
   status('Importado na prévia. Salve para aplicar no jogo.');
 }catch(error){status('JSON inválido: '+error.message);}
 e.target.value='';
});
async function init(){
 try{
   const get=async url=>{const response=await fetch(url);if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();};
   const [equipment,shipped,poseData,materialData]=await Promise.all([
     get('assets/equipment/manifest.json?v=1'),get('assets/weapons/refinement-effects.json?v=1'),
     get('assets/poses/overrides.json?v=1'),get('assets/weapons/overrides.json?v=1')
   ]);
   manifest=equipment;store=readRefinementProfiles(globalThis.localStorage,shipped);
   poses=readPoseProfiles(globalThis.localStorage,poseData);materials=readWeaponMaterialProfiles(globalThis.localStorage,materialData);
   $('mobile').checked=matchMedia('(pointer:coarse)').matches||innerWidth<951;
   updateJobs();await loadCharacter();
 }catch(error){status('Falha ao iniciar: '+error.message);}
}
function render(){
 requestAnimationFrame(render);const dt=Math.min(.05,clock.getDelta());
 if(playing){time+=dt;mixer?.update(dt);}
 if(model)updateWeaponMaterialGlow(model,time*1000);
 surfaces.update(time,Number($('level').value),{hidden:!ready});
 effects.update(time,camera,Number($('level').value),{mobile:$('mobile').checked,hidden:!ready||$('placement').value==='hidden'});
 orbit.update();
 const width=canvas.clientWidth,height=canvas.clientHeight,ratio=renderer.getPixelRatio();
 if(width>0&&height>0&&(canvas.width!==Math.floor(width*ratio)||canvas.height!==Math.floor(height*ratio))){
   renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(ready)fitCamera();
 }
 renderer.render(scene,camera);
}
render();void init();
