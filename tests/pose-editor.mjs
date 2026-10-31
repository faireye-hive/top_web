import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {WeaponHolster,POSE_STATES,POSE_DEFAULTS,profileKey,poseProfile,
  parsePoseProfiles,readPoseProfiles,savePoseProfiles,selectPoseName,weaponDefaults,
  availableBones} from '../js/pose-studio-runtime.mjs?v=1';

const $=id=>document.getElementById(id);
const stateLabels={idle:'Cidade',guard:'Guarda',run:'Corrida',armedRun:'Corrida armada',attack:'Ataque'};
const loader=new GLTFLoader(),actorEl=$('actor'),jobEl=$('job');
const panel=$('viewport'),renderer=new THREE.WebGLRenderer({canvas:panel,antialias:true,alpha:false});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
const scene=new THREE.Scene();scene.background=new THREE.Color('#12303d');
scene.add(new THREE.HemisphereLight(0xdcefff,0x314b59,2.4));
const light=new THREE.DirectionalLight(0xffe7ba,2.7);light.position.set(4,8,5);scene.add(light);
const ground=new THREE.GridHelper(12,24,0x4a8591,0x29515c);
ground.position.y=-.015;scene.add(ground);
const camera=new THREE.PerspectiveCamera(42,1,.03,150);camera.position.set(3,2.7,5.8);
const controls=new OrbitControls(camera,panel);controls.target.set(0,1,0);
controls.enableDamping=true;controls.enablePan=false;controls.minDistance=1;controls.maxDistance=20;controls.update();
let model=null,mixer=null,clips=[],action=null,holster=null,skeletonHelper=null;
let equipment=null,store={version:1,profiles:{}},profile=null,selectedState='idle';
let selectedPart='weapon-0',playing=true,loading=0,clock=new THREE.Clock();
function status(msg){$('status').textContent=msg;}
function note(msg){$('part-alert').textContent=msg;}
function ensureProfile(){
 const key=profileKey(actorEl.value,jobEl.value);
 profile=store.profiles[key]||{clips:{},stowOnIdle:true,weapons:{}};
 store.profiles[key]=profile;
 return profile;
}
function selectedWeapon(){return holster?.parts.find(part=>part.key===selectedPart)||null;}
function editableWeapon(){
 ensureProfile();
 const part=selectedWeapon();if(!part)return null;
 if(!profile.weapons[part.key])profile.weapons[part.key]=weaponDefaults(jobEl.value,part.index,holster.bones);
 return profile.weapons[part.key];
}
function redrawWeaponFields(){
 const part=selectedWeapon();
 $('weapon-controls').hidden=!part;
 $('part').disabled=!holster?.parts.length;
 if(!part){note('Nenhuma arma convertida encontrada no modelo. Os conjuntos básicos sem arma não têm encaixe.');return;}
 const w=editableWeapon();
 const bones=availableBones(model);
 $('bone').replaceChildren();
 for(const name of bones){const option=document.createElement('option');option.value=name;option.textContent=name;$('bone').append(option);}
 $('bone').value=w.bone;
 for(const [axis,i] of [['x',0],['y',1],['z',2]]){
  $('p'+axis).value=w.position[i];$('r'+axis).value=w.rotation[i];
 }
 $('scale').value=w.scale;
 note('Peça '+(part.index+1)+' · '+part.source.name+' · osso de origem '+
   (part.source.skeleton?.bones?.[part.source.geometry.getAttribute('skinIndex')?.getX(0)]?.name||'não identificado'));
}
function reloadHolster(){
 if(!holster)return;
 holster.setProfile(profile);
 const stowed=$('stow').checked&&(selectedState==='idle'||selectedState==='run');
 holster.setStowed(stowed);
}
function showClip(){
 if(!clips.length)return;
 ensureProfile();
 const chosen=selectPoseName(selectedState,profile,clips);
 $('clip').replaceChildren();
 const automatic=document.createElement('option');automatic.value='';
 automatic.textContent='Automático ('+(chosen||'não disponível')+')';$('clip').append(automatic);
 for(const clip of clips){const option=document.createElement('option');option.value=clip.name;option.textContent=clip.name;$('clip').append(option);}
 const override=profile.clips?.[selectedState]||'';
 $('clip').value=clips.some(c=>c.name===override)?override:'';
 const found=clips.find(c=>c.name===chosen);
 const desired=POSE_DEFAULTS[selectedState];
 const original=clips.some(c=>c.name.toLowerCase().split('·').pop().trim()===desired.toLowerCase());
 const warning=!(profile.clips?.[selectedState])&&!original;
 $('clip-info').textContent=(warning?'⚠ ':'✓ ')+stateLabels[selectedState]+' · '+(found?.name||'Sem clipe')+
   (found?' · '+found.duration.toFixed(2)+' s':'')+
   (warning?' · Ação histórica '+desired+' ainda não exportada neste GLB; prévia usa outra ação.':'');
 if(action){action.stop();action=null;}
 if(found&&mixer){
  action=mixer.clipAction(found);
  action.reset().setEffectiveWeight(1).play();
  action.setLoop(selectedState==='attack'?THREE.LoopOnce:THREE.LoopRepeat,
    selectedState==='attack'?1:Infinity);
  action.clampWhenFinished=selectedState==='attack';
  action.paused=!playing;
  $('timeline').value=0;
 }
 reloadHolster();
}
function changeState(next){
 if(!POSE_STATES.includes(next))return;
 selectedState=next;
 for(const button of document.querySelectorAll('[data-state]'))
   button.classList.toggle('active',button.dataset.state===next);
 showClip();
}
async function loadCharacter(){
 const request=++loading;
 const actor=actorEl.value,job=jobEl.value;
 const url=$('equipped').checked?equipment?.sets?.[job]?.models?.[actor]:null;
 if($('equipped').checked&&!url){status('Este conjunto não está disponível para '+actor);return;}
 status('Carregando modelo '+actor+' / '+job+'...');
 try{
  const asset=await loader.loadAsync(url?'assets/equipment/'+url+'?v=1':
    'assets/characters/'+actor+'.glb?v=3');
  let extra=null;
  try{extra=await loader.loadAsync('assets/skills/animations/'+actor+'.glb?v=3');}
  catch{ /* Animações opcionais não impedem edição básica */ }
  if(request!==loading)return;
  holster?.dispose();holster=null;
  if(model)scene.remove(model);
  if(skeletonHelper){scene.remove(skeletonHelper);skeletonHelper=null;}
  model=asset.scene;model.name='Prévia '+actor;scene.add(model);
  model.traverse(obj=>{if(obj.isMesh)obj.frustumCulled=false;});
  clips=[...(asset.animations||[]),...(extra?.animations||[])];
  mixer=new THREE.AnimationMixer(model);
  profile=poseProfile(store,actor,job);
  ensureProfile();
  holster=$('equipped').checked?new WeaponHolster(THREE,model,job,profile):null;
  skeletonHelper=new THREE.SkeletonHelper(model);skeletonHelper.visible=$('skeleton').checked;scene.add(skeletonHelper);
  $('stow').checked=profile.stowOnIdle!==false;
  $('part').replaceChildren();
  holster?.parts.forEach((part,i)=>{
    const option=document.createElement('option');option.value=part.key;
    const item=equipment?.sets?.[job]?.items?.filter(v=>v.slot===6||v.slot===9)[i];
    option.textContent='Arma '+(i+1)+(item?' · '+item.name:'');
    $('part').append(option);
  });
  if(!holster?.parts.some(part=>part.key===selectedPart))selectedPart=holster?.parts[0]?.key||'';
  $('part').value=selectedPart;
  redrawWeaponFields();showClip();
  status('✓ '+actor+' · '+job+' · '+clips.length+' clipes · '+(holster?.parts.length||0)+' armas ajustáveis');
 }catch(error){console.error(error);status('Falha ao carregar modelo: '+error.message);}
}
function updateJobs(){
 const actor=actorEl.value;
 const options=Object.entries(equipment?.sets||{}).filter(([,data])=>data.models?.[actor]);
 const previous=jobEl.value;
 jobEl.replaceChildren();
 for(const [key] of options){const option=document.createElement('option');option.value=key;option.textContent=key;jobEl.append(option);}
 if(options.some(([key])=>key===previous))jobEl.value=previous;
}
function editWeapon(fn){
 const w=editableWeapon();if(!w)return;
 fn(w);
 reloadHolster();redrawWeaponFields();
}
function preset(which){
 editWeapon(w=>{
  const bones=holster?.bones||[];
  const defaults=weaponDefaults(which==='hip'?'sharpshooter':'cleric',
    selectedWeapon().index,bones);
  if(which==='reset')Object.assign(w,weaponDefaults(jobEl.value,selectedWeapon().index,bones));
  else Object.assign(w,defaults);
 });
}
function persist(){
 savePoseProfiles(store);
 status('✓ Ajustes salvos neste navegador. Atualize o jogo para ver a nova pose.');
}
function download(){
 const data=JSON.stringify(parsePoseProfiles(store),null,2)+'\n';
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='overrides.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
 status('Arquivo overrides.json exportado. Publique em assets/poses/overrides.json.');
}
function updateTime(){
 if(!action)return;
 const duration=action.getClip().duration||1;
 $('timeline').value=Math.round(1000*Math.min(1,action.time/duration));
 $('clock').textContent=action.time.toFixed(2)+' / '+duration.toFixed(2)+' s';
}
function render(){
 requestAnimationFrame(render);
 const delta=Math.min(.05,clock.getDelta());
 if(mixer&&playing){mixer.update(delta*Number($('speed').value));updateTime();}
 const rect=panel.getBoundingClientRect();
 const width=Math.max(1,Math.round(rect.width)),height=Math.max(1,Math.round(rect.height));
 if(panel.width!==Math.round(width*renderer.getPixelRatio())||
   panel.height!==Math.round(height*renderer.getPixelRatio())){
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
 }
 controls.update();renderer.render(scene,camera);
}
$('actor').onchange=()=>{updateJobs();loadCharacter()};
$('job').onchange=loadCharacter;
$('equipped').onchange=loadCharacter;
for(const b of document.querySelectorAll('[data-state]'))
 b.onclick=()=>changeState(b.dataset.state);
$('clip').onchange=()=>{
 ensureProfile();
 if($('clip').value)profile.clips[selectedState]=$('clip').value;
 else delete profile.clips[selectedState];
 showClip();
};
$('part').onchange=()=>{selectedPart=$('part').value;redrawWeaponFields()};
$('bone').onchange=()=>editWeapon(w=>{w.bone=$('bone').value});
$('stow').onchange=()=>{ensureProfile();profile.stowOnIdle=$('stow').checked;reloadHolster()};
for(const [kind,key] of [['p','position'],['r','rotation']])
 for(const [axis,i]of [['x',0],['y',1],['z',2]])
  $(kind+axis).oninput=()=>editWeapon(w=>{const value=Number($(kind+axis).value);if(Number.isFinite(value))w[key][i]=value;});
$('scale').oninput=()=>editWeapon(w=>{const n=Number($('scale').value);if(Number.isFinite(n))w.scale=Math.max(.1,Math.min(5,n));});
for(const b of document.querySelectorAll('[data-preset]'))
 b.onclick=()=>preset(b.dataset.preset);
$('play').onclick=()=>{
 playing=!playing;$('play').textContent=playing?'❚❚ Pausar':'▶ Reproduzir';
 if(action)action.paused=!playing;
};
$('restart').onclick=()=>{if(action){action.reset().play();action.paused=!playing;updateTime()}};
$('timeline').oninput=()=>{
 if(!action||!mixer)return;
 const seconds=Number($('timeline').value)/1000*action.getClip().duration;
 action.paused=true;action.time=seconds;mixer.update(0);updateTime();
 if(playing){action.paused=false;}
};
$('skeleton').onchange=()=>{if(skeletonHelper)skeletonHelper.visible=$('skeleton').checked};
$('save').onclick=$('save-bottom').onclick=persist;
$('export').onclick=download;
$('reset-profile').onclick=()=>{
 if(!confirm('Limpar as edições deste personagem/classe?'))return;
 delete store.profiles[profileKey(actorEl.value,jobEl.value)];
 profile=null;ensureProfile();
 $('stow').checked=true;
 holster?.setProfile(profile);redrawWeaponFields();showClip();persist();
};
$('import').onclick=()=>$('file').click();
$('file').onchange=async()=>{
 const file=$('file').files?.[0];if(!file)return;
 try{
  const imported=parsePoseProfiles(await file.text());
  store=imported;savePoseProfiles(store);
  profile=poseProfile(store,actorEl.value,jobEl.value);ensureProfile();
  holster?.setProfile(profile);$('stow').checked=profile.stowOnIdle!==false;
  redrawWeaponFields();showClip();status('✓ JSON importado e salvo. Atualize o jogo para aplicar.');
 }catch(error){status('JSON inválido: '+error.message)}
 $('file').value='';
};
(async()=>{
 try{
  const [resModel,resPoses]=await Promise.all([
    fetch('assets/equipment/manifest.json?v=1'),
    fetch('assets/poses/overrides.json?v=1')
  ]);
  if(!resModel.ok)throw Error('manifest.json de equipamentos indisponível');
  equipment=await resModel.json();
  const shipped=resPoses.ok?await resPoses.json():{version:1,profiles:{}};
  store=readPoseProfiles(globalThis.localStorage,shipped);
  updateJobs();await loadCharacter();
 }catch(e){console.error(e);status('Não foi possível iniciar: '+e.message);}
})();
render();
