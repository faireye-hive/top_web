import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {WeaponHolster,POSE_STATES,POSE_DEFAULTS,profileKey,poseProfile,
  parsePoseProfiles,readPoseProfiles,savePoseProfiles,selectPoseName,weaponDefaults,
  availableBones} from '../js/pose-studio-runtime.mjs?v=7';
import {readWeaponMaterialProfiles,applyWeaponAppearance} from '../js/weapon-materials.mjs?v=2';
import {weaponBankForJob,catalogForActor,filterHistoricalActions,historicalAction,actionNumber,ACTION_CATEGORIES,
  missingHistoricalActions,missingActionReportText,HISTORICAL_LAB_BY_ACTOR} from '../js/pose-action-catalog.mjs?v=2';

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
let weaponMaterialStore={version:1,profiles:{}};
let historicalCatalog=null,selectedHistoricalId=null;
let selectedPart='weapon-0',playing=true,loading=0,clock=new THREE.Clock();
function status(msg){$('status').textContent=msg;}
function note(msg){$('part-alert').textContent=msg;}
function ensureProfile(){
 const key=profileKey(actorEl.value,jobEl.value);
 profile=store.profiles[key]||{clips:{},stowOnIdle:true,weapons:{},placements:{}};
 store.profiles[key]=profile;
 return profile;
}
function selectedWeapon(){return holster?.parts.find(part=>part.key===selectedPart)||null;}
function currentWeaponMode(key){return profile?.placements?.[selectedState]?.[key]||'auto';}
function updateWeaponViewControls(){
 const parts=holster?.parts||[];
 const selected=selectedWeapon();
 const mode=$('weapon-mode');
 mode.disabled=!selected;
 mode.value=selected?currentWeaponMode(selected.key):'auto';
 const states=parts.map(p=>currentWeaponMode(p.key));
 for(const button of document.querySelectorAll('[data-weapon-view]')){
   button.disabled=!parts.length;
   const active=parts.length>0&&states.every(state=>state===button.dataset.weaponView);
   button.classList.toggle('active',active);
   button.setAttribute('aria-pressed',String(active));
 }
 const statusBox=$('weapon-diagnostics');
 if(!parts.length){
   let meshes=0,tagged=0,groups=0;
   model?.traverse(node=>{
     if(node.isMesh||node.isSkinnedMesh)meshes++;
     if(node.userData?.topRole==='weapon'){
       tagged++;if(!node.isMesh&&!node.isSkinnedMesh)groups++;
     }
   });
   statusBox.textContent=$('equipped').checked
     ?'Nenhuma arma controlável: '+meshes+' malhas, '+tagged+
       ' nós marcados como equipamento ('+groups+' grupos). Informe estes números para diagnóstico.'
     :'Este GLB básico não contém armas: ative Evanescence para testar as duas espadas.';
   return;
 }
 statusBox.textContent=parts.map(p=>{
   const socket=p.socketNode?.name||'socket não encontrado';
   const copy=p.holder?.parent?'cópia pronta':p.issue||'cópia não encaixada';
   return 'Arma '+(p.index+1)+' · slot '+p.slot+
     ' · '+(p.meshes?.length||0)+' submalhas · '+p.mode+' · '+socket+' · '+copy+
     (p.visualStatus?.startsWith('Não')?' ⚠ '+p.visualStatus:'');
 }).join('\n');
}
function setWeaponMode(key,mode){
 if(!['auto','hidden','hand','back'].includes(mode))return;
 ensureProfile();
 profile.placements??={};
 profile.placements[selectedState]??={};
 if(mode==='auto')delete profile.placements[selectedState][key];
 else profile.placements[selectedState][key]=mode;
 if(!Object.keys(profile.placements[selectedState]).length)
   delete profile.placements[selectedState];
 reloadHolster();
 updateWeaponViewControls();
}

function editableWeapon(){
 ensureProfile();
 const part=selectedWeapon();if(!part)return null;
 if(!profile.weapons[part.key])profile.weapons[part.key]=holster.defaultSettings(part);
 return profile.weapons[part.key];
}
function redrawWeaponFields(){
 const part=selectedWeapon();
 $('weapon-controls').hidden=!part;
 $('part').disabled=!holster?.parts.length;
 if(!part){note('Nenhuma arma reconhecida no modelo carregado. Confira o diagnóstico das malhas.');updateWeaponViewControls();return;}
 const w=editableWeapon();
 const bones=new Set(availableBones(model));
 model?.traverse(obj=>{if(obj.name?.startsWith('TOP Dummy '))bones.add(obj.name)});
 $('bone').replaceChildren();
 for(const name of bones){const option=document.createElement('option');option.value=name;option.textContent=name;$('bone').append(option);}
 $('bone').value=w.bone;
 for(const [axis,i] of [['x',0],['y',1],['z',2]]){
  $('p'+axis).value=w.position[i];$('r'+axis).value=w.rotation[i];
 }
 $('scale').value=w.scale;
 note('Peça '+(part.index+1)+' · '+part.source.name+' · slot '+part.slot+
   ' · '+(part.socketNode?.name||'sem socket GLB')+
   ' · '+(part.issue||'encaixe '+(part.holder?.parent?'pronto':'indisponível')));
 updateWeaponViewControls();
}
function reloadHolster(){
 if(!holster)return;
 holster.setProfile(profile);
 const stowed=$('stow').checked&&(selectedState==='idle'||selectedState==='run');
 holster.setStowed(stowed,selectedState);
 updateWeaponViewControls();
}
function previewClip(clip,{once=false}={}){
 if(action){action.stop();action=null;}
 if(!clip||!mixer)return;
 action=mixer.clipAction(clip);
 action.reset().setEffectiveWeight(1).play();
 action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);
 action.clampWhenFinished=once;
 action.paused=!playing;
 $('timeline').value=0;updateTime();
}
function catalogRows(){
 if(!historicalCatalog)return [];
 const bank=weaponBankForJob(jobEl.value,equipment);
 return catalogForActor(historicalCatalog,actorEl.value,bank,clips,$('catalog-bank').value);
}
function selectedHistorical(){
 return catalogRows().find(x=>x.id===selectedHistoricalId)||null;
}
function showCatalogDetail(row){
 if(!row){
  $('catalog-detail').textContent='Selecione uma ação histórica para consultar descrição e quadros.';
  $('catalog-use').disabled=true;return;
 }
 const status=row.available?'✓ Disponível neste GLB':
   row.frames?'⚠ Possui frames históricos, mas este GLB não a exportou':
   '— Sem intervalo de frames válido neste personagem';
 const original=row.original&&row.original!==row.label?'\nOriginal: '+row.original:'';
 const frames=row.frames?'\nFrames históricos: '+row.frames[0]+'–'+row.frames[1]+
   (row.frames.length>2?' · eventos: '+row.frames.slice(2).join(', '):''):'';
 const note=row.group===0&&$('equipped').checked?
   '\nAção compartilhada/base. Pode ser exibida com arma no modelo equipado; não é uma ação exclusiva do banco de arma.':'';
 $('catalog-detail').textContent=row.code+' · '+row.label+
   '\nBanco: '+row.groupName+' · Categoria: '+(ACTION_CATEGORIES[row.category]||row.category)+
   original+frames+'\n'+status+note;
 $('catalog-use').disabled=!row.clip;
}
function missingRows(){
 return missingHistoricalActions(catalogRows());
}
function currentModelPath(){
 const actor=actorEl.value,job=jobEl.value;
 return $('equipped').checked
   ?'assets/equipment/'+(equipment?.sets?.[job]?.models?.[actor]||'modelo indisponível')
   :'assets/characters/'+actor+'.glb';
}
function missingText(){
 return missingActionReportText({
   actor:actorEl.value,job:jobEl.value,modelPath:currentModelPath(),
   records:catalogRows()
 });
}
function renderMissingReport(){
 const el=$('missing-list');el.replaceChildren();
 const rows=missingRows(),actor=actorEl.value,job=jobEl.value;
 const lab=HISTORICAL_LAB_BY_ACTOR[actor]||'?';
 const actors={lance:'Lance',carsise:'Carsise',phyllis:'Phyllis',ami:'Ami'};
 const withoutFrames=catalogRows().filter(row=>row.status==='no-source-frames').length;
 $('missing-title').textContent='⚠ '+rows.length+' animações faltantes · '+(actors[actor]||actor)+' '+job;
 $('missing-source').textContent='Modelo verificado: '+currentModelPath()+
   ' · Origem: Client/animation/'+lab+
   ' · IDs/frames: Client/scripts/txt/CharacterAction.tx'+
   ($('equipped').checked?'':' · Atenção: você está visualizando o modelo SEM equipamento.');
 $('missing-summary').textContent='Nomes e IDs que faltam no GLB ('+rows.length+')';
 if(!rows.length){
   el.textContent=withoutFrames
    ?'Nenhum clipe com frames válidos está faltando. Há '+withoutFrames+' ações sem frames neste personagem.'
    :'Nenhuma ação com frames históricos está faltando neste GLB.';
 }else for(const row of rows){
   const button=document.createElement('button');button.type='button';button.className='missing-item';
   const title=document.createElement('span');title.className='missing-head';
   title.textContent=row.code+' · '+row.label+' — '+row.groupName;
   const desc=document.createElement('span');desc.className='missing-sub';
   desc.textContent='Frames '+row.frames[0]+'–'+row.frames[1]+' · ID '+row.id;
   button.append(title,desc);button.title='Ver a referência desta animação histórica';
   button.onclick=()=>{
     $('catalog-category').value='all';$('catalog-status').value='not-exported';
     $('catalog-search').value=String(row.id);
     chooseHistoricalAction(row.id);
     $('catalog-detail').scrollIntoView({block:'nearest',behavior:'smooth'});
   };
   el.append(button);
 }
}
function downloadMissingList(){
 const data=missingText(),filename=actorEl.value+'-'+jobEl.value+'-animacoes-faltantes.txt';
 const blob=new Blob([data],{type:'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
 status('✓ Lista salva: '+filename);
}
function renderCatalog(){
 const list=$('catalog-list');list.replaceChildren();
 if(!historicalCatalog){
  $('catalog-summary').textContent='Catálogo histórico indisponível.';
  $('missing-title').textContent='⚠ Catálogo histórico indisponível';
  $('catalog-use').disabled=true;return;
 }
 const all=catalogRows();
 const filtered=filterHistoricalActions(all,{
  query:$('catalog-search').value,
  category:$('catalog-category').value,
  status:$('catalog-status').value
 });
 const available=all.filter(x=>x.available).length;
 const historical=all.filter(x=>x.status==='not-exported').length;
 $('catalog-summary').textContent=filtered.length+' de '+all.length+' ações · '+
   available+' disponíveis no GLB · '+historical+' com frames, mas não exportadas';
 for(const row of filtered){
  const button=document.createElement('button');
  button.type='button';button.setAttribute('role','option');
  button.setAttribute('aria-selected',String(row.id===selectedHistoricalId));
  button.className='catalog-item '+row.status+(row.id===selectedHistoricalId?' selected':'');
  const code=document.createElement('span');code.className='code';code.textContent=row.code;
  const desc=document.createElement('span');desc.className='description';
  const title=document.createElement('span');title.className='title';
  const sharedSuffix=row.group===0&&$('equipped').checked&&[16,30,31].includes(row.id)
    ?' · no modelo armado':'';
  title.textContent=row.label+sharedSuffix;
  const sub=document.createElement('span');sub.className='sub';sub.textContent=row.groupName;
  desc.append(title,sub);
  const badge=document.createElement('span');badge.className='tag';
  badge.textContent=row.available?'✓ GLB':row.frames?'⚠ Falta':'—';
  button.append(code,desc,badge);
  button.title=row.available?'Reproduzir esta animação':'Consultar ação e disponibilidade histórica';
  button.onclick=()=>chooseHistoricalAction(row.id);
  list.append(button);
 }
 showCatalogDetail(selectedHistorical());
 renderMissingReport();
}
function chooseHistoricalAction(id){
 const row=catalogRows().find(x=>x.id===id);
 if(!row)return;
 selectedHistoricalId=row.id;
 renderCatalog();
 if(!row.clip){
  if(action){action.stop();action=null;}
  mixer?.stopAllAction();mixer?.update(0);
  $('timeline').value=0;$('clock').textContent='Sem clipe GLB';
  status('⚠ '+row.code+' · '+row.label+' ainda não está no GLB. Consulte o LAB original e regenere o modelo.');
  return;
 }
 previewClip(row.clip,{once:['combat','skills','emotes','interaction'].includes(row.category)});
 reloadHolster();
 status('▶ '+row.code+' · '+row.label+' · clipe real do GLB '+actorEl.value);
}
function showClip(){
 if(!clips.length){
  $('clip-info').textContent='⚠ Este modelo não possui clipes GLB; veja os nomes históricos faltantes abaixo.';
  $('clip').replaceChildren();renderCatalog();return;
 }
 ensureProfile();
 const chosen=selectPoseName(selectedState,profile,clips,
   $('equipped').checked?weaponBankForJob(jobEl.value,equipment):0);
 $('clip').replaceChildren();
 const automatic=document.createElement('option');automatic.value='';
 automatic.textContent='Automático ('+(chosen||'não disponível')+')';$('clip').append(automatic);
 for(const clip of clips){
  const option=document.createElement('option');option.value=clip.name;
  const id=actionNumber(clip.name);
  const record=id!==null&&historicalCatalog?historicalAction(historicalCatalog,actorEl.value,id,clips):null;
  option.textContent=record?record.code+' · '+record.label+' — '+record.groupName:clip.name;
  $('clip').append(option);
 }
 const override=profile.clips?.[selectedState]||'';
 $('clip').value=clips.some(c=>c.name===override)?override:'';
 const found=clips.find(c=>c.name===chosen);
 const foundId=actionNumber(found?.name),historical=foundId!==null&&historicalCatalog?
   historicalAction(historicalCatalog,actorEl.value,foundId,clips):null;
 const desired=POSE_DEFAULTS[selectedState];
 const original=clips.some(c=>c.name.toLowerCase().split('·').pop().trim()===desired.toLowerCase());
 const warning=!(profile.clips?.[selectedState])&&!original;
 $('clip-info').textContent=(warning?'⚠ ':'✓ ')+stateLabels[selectedState]+' · '+
   (historical?historical.code+' · '+historical.label:(found?.name||'Sem clipe'))+
   (found?' · '+found.duration.toFixed(2)+' s':'')+
   (warning?' · Verifique a ação histórica '+desired+' no catálogo; a prévia pode usar outro banco.':'');
 previewClip(found,{once:selectedState==='attack'});
 reloadHolster();
 renderCatalog();
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
  const asset=await loader.loadAsync(url?'assets/equipment/'+url+'?v=2':
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
  if($('equipped').checked)
    applyWeaponAppearance(THREE,model,actor,job,weaponMaterialStore);
  holster=$('equipped').checked?new WeaponHolster(THREE,model,job,profile,actor):null;
  skeletonHelper=new THREE.SkeletonHelper(model);skeletonHelper.visible=$('skeleton').checked;scene.add(skeletonHelper);
  $('stow').checked=profile.stowOnIdle!==false;
  $('part').replaceChildren();
  holster?.parts.forEach((part,i)=>{
    const option=document.createElement('option');option.value=part.key;
    const item=equipment?.sets?.[job]?.items?.find(v=>v.slot===part.slot);
    option.textContent='Arma '+(i+1)+' · slot '+part.slot+(item?' · '+item.name:'');
    $('part').append(option);
  });
  if(!holster?.parts.some(part=>part.key===selectedPart))selectedPart=holster?.parts[0]?.key||'';
  $('part').value=selectedPart;
  selectedHistoricalId=null;redrawWeaponFields();showClip();
  status('✓ '+actor+' · '+job+' · '+clips.length+' clipes · '+(holster?.parts.length||0)+
    ' armas reconhecidas ('+(holster?.parts.reduce((total,p)=>total+(p.meshes?.length||0),0)||0)+
    ' submalhas) · '+(holster?.parts.filter(p=>p.socketNode).length||0)+' sockets GLB');
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
  if(which==='reset'||which==='back')Object.assign(w,holster.defaultSettings(selectedWeapon()));
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
for(const id of ['catalog-bank','catalog-category','catalog-status'])
 $(id).onchange=renderCatalog;
$('catalog-search').oninput=renderCatalog;
$('missing-filter').onclick=()=>{
 $('catalog-status').value='not-exported';$('catalog-search').value='';
 $('catalog-category').value='all';renderCatalog();
 $('catalog-list').scrollIntoView({behavior:'smooth',block:'nearest'});
};
$('missing-copy').onclick=async()=>{
 const report=missingText();
 try{
   if(!navigator.clipboard?.writeText)throw new Error('Clipboard indisponível');
   await navigator.clipboard.writeText(report);
   status('✓ Copiado! Nomes, IDs, frames e origem dos arquivos históricos.');
 }catch{
   downloadMissingList();
 }
};
$('missing-download').onclick=downloadMissingList;
$('catalog-use').onclick=()=>{
 const row=selectedHistorical();if(!row?.clip)return;
 const incompatible=(selectedState==='idle'&&row.category==='movement')||
   (['run','armedRun'].includes(selectedState)&&row.category!=='movement')||
   (selectedState==='attack'&&row.category!=='combat');
 if(incompatible){
   status('⚠ '+row.code+' · '+row.label+' não corresponde a '+stateLabels[selectedState]+
     '. Escolha o estado correto (por exemplo, Correr para a ação 005).');
   return;
 }
 ensureProfile();profile.clips[selectedState]=row.clip.name;
 showClip();
 status('✓ '+row.code+' · '+row.label+' atribuído ao estado '+stateLabels[selectedState]+'. Salve para aplicar no jogo.');
};
$('clip').onchange=()=>{
 ensureProfile();
 if($('clip').value)profile.clips[selectedState]=$('clip').value;
 else delete profile.clips[selectedState];
 showClip();
};
$('part').onchange=()=>{selectedPart=$('part').value;redrawWeaponFields()};
$('weapon-mode').onchange=()=>{
 const part=selectedWeapon();if(!part)return;
 const selected=$('weapon-mode').value;
 setWeaponMode(part.key,selected);
 status('✓ '+stateLabels[selectedState]+' · Arma '+(part.index+1)+': '+selected+'. Salve para aplicar no jogo.');
};
for(const button of document.querySelectorAll('[data-weapon-view]')){
 button.onclick=()=>{
   const mode=button.dataset.weaponView;
   for(const part of holster?.parts||[])setWeaponMode(part.key,mode);
   updateWeaponViewControls();
   status('✓ '+stateLabels[selectedState]+' · '+(holster?.parts.length||0)+
     ' arma(s) em modo '+mode+'. Salve para aplicar no jogo.');
 };
}

$('bone').onchange=()=>editWeapon(w=>{w.bone=$('bone').value});
$('stow').onchange=()=>{ensureProfile();profile.stowOnIdle=$('stow').checked;reloadHolster()};
for(const [kind,key] of [['p','position'],['r','rotation']])
 for(const [axis,i]of [['x',0],['y',1],['z',2]])
  $(kind+axis).onchange=()=>editWeapon(w=>{const value=Number($(kind+axis).value);if(Number.isFinite(value))w[key][i]=value;});
$('scale').onchange=()=>editWeapon(w=>{const n=Number($('scale').value);if(Number.isFinite(n))w.scale=Math.max(.1,Math.min(5,n));});
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
  const [resModel,resPoses,resCatalog,resWeapons]=await Promise.all([
    fetch('assets/equipment/manifest.json?v=1'),
    fetch('assets/poses/overrides.json?v=1'),
    fetch('assets/poses/historical-catalog.json?v=1'),
    fetch('assets/weapons/overrides.json?v=2')
  ]);
  if(!resModel.ok)throw Error('manifest.json de equipamentos indisponível');
  equipment=await resModel.json();
  if(!resCatalog.ok)throw Error('Catálogo histórico de ações indisponível');
  historicalCatalog=await resCatalog.json();
  const shipped=resPoses.ok?await resPoses.json():{version:1,profiles:{}};
  store=readPoseProfiles(globalThis.localStorage,shipped);
  weaponMaterialStore=readWeaponMaterialProfiles(globalThis.localStorage,
    resWeapons.ok?await resWeapons.json():{version:1,profiles:{}});
  updateJobs();await loadCharacter();
 }catch(e){console.error(e);status('Não foi possível iniciar: '+e.message);}
})();
render();
