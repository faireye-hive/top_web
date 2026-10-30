import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CLASSES,CHARACTERS} from '../js/hero-state.mjs';
import {getActionId,resolveSkillClip} from '../js/class-skills.mjs';
import {skillWithRules} from '../js/skill-rules.mjs';
import {createSkillVisuals} from '../js/skill-visuals.mjs';
import {
 GLOBAL_DEFAULTS,LAYER_DEFAULTS,compileSkillLayers,
 newPresetStore,readLocalPresets,writeLocalPresets,
 normalizePresetStore,mergePresetStores,skillPreset,layerSettings
} from '../js/skill-vfx-data.mjs';

const $=id=>document.getElementById(id);
const assetPrefix='assets/skills/';
let catalog=null,manifest=null,presets=readLocalPresets(),production=newPresetStore();
let selectedSkill=null,selectedLayer=null,layers=[],avatar=null,mixer=null,clips=[];
let phase=0,playing=false,loading=false,lastNow=performance.now(),lastStatus='',token=0;
const loader=new GLTFLoader();
const renderer=new THREE.WebGLRenderer({canvas:$('preview'),antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));
renderer.setClearColor(0x102b40);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0c2a3a);
const hemi=new THREE.HemisphereLight(0xc1e8fc,0x5a5850,2);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe7b9,2);sun.position.set(-3,7,5);scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshLambertMaterial({color:0x315962}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=false;scene.add(floor);
const grid=new THREE.GridHelper(24,24,0x79a8ac,0x31576e);grid.position.y=.012;scene.add(grid);
const origin={x:0,z:0},target={x:3.8,z:0};
const targetDummy=new THREE.Group();
const targetCore=new THREE.Mesh(new THREE.CapsuleGeometry(.27,.72,4,10),new THREE.MeshLambertMaterial({color:0x9b635b}));
targetCore.position.y=.64;targetDummy.add(targetCore);
const ring=new THREE.Mesh(new THREE.RingGeometry(.44,.54,32),new THREE.MeshBasicMaterial({color:0x66cfd1,transparent:true,opacity:.65,side:THREE.DoubleSide}));
ring.rotation.x=-Math.PI/2;ring.position.y=.025;targetDummy.add(ring);
scene.add(targetDummy);
const camera=new THREE.PerspectiveCamera(50,1,.1,150);
function resetCamera(){
  camera.position.set(5.1,4.8,7.8);orbit.target.set(1.4,1,0);orbit.update();
}
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;orbit.minDistance=2;orbit.maxDistance=28;orbit.maxPolarAngle=Math.PI/2-.04;
resetCamera();
const fx=createSkillVisuals({scene,heightAt:()=>0,camera,maxSprites:48});
const charCache=new Map();
const fields={
  global:[
    ['scale','Escala geral',.1,4,.05],
    ['opacity','Opacidade geral',0,2,.05],
    ['speed','Velocidade',.1,4,.05],
    ['particles','Limite de partículas',1,48,1],
    ['duration','Duração global',.1,4,.05],
    ['height','Altura global (m)',-5,6,.1],
    ['distance','Distância do alvo (m)',1,12,.1]
  ],
  layer:[
    ['scale','Tamanho',.05,5,.05],
    ['opacity','Opacidade',0,2,.05],
    ['x','Posição X (m)',-6,6,.1],
    ['y','Altura Y (m)',-6,6,.1],
    ['z','Posição Z (m)',-6,6,.1],
    ['delay','Atraso (s)',-2,3,.05],
    ['duration','Duração ×',.1,5,.05],
    ['spin','Giro (rad/s)',-8,8,.1],
    ['count','Cópias da camada',1,5,1]
  ]
};
let toastTimer;
function toast(message){
  const el=$('toast');el.textContent=message;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
}
function status(message){lastStatus=message;$('status').textContent=message;}
function options(select,values,value){
  select.replaceChildren();
  for(const [id,label] of values){select.add(new Option(label,String(id)));}
  if(values.some(([v])=>String(v)===String(value)))select.value=String(value);
}
function classSelected(){
  const id=$('job').value;
  const possibles=CLASSES[id]?.characters||Object.keys(CHARACTERS);
  const current=$('actor').value;
  options($('actor'),possibles.map(p=>[p,CHARACTERS[p].name]),current);
}
function skillSelected(){
  const id=$('job').value,choice=$('skill').value;
  options($('skill'),catalog.classes[id].skills.map(s=>[s.id,s.name]),choice);
}
function currentStore(){return mergePresetStores(production,presets);}
function currentPreset(){return skillPreset(currentStore(),selectedSkill?.id||0);}
function editRecord(){
  const id=String(selectedSkill.id);
  return presets.skills[id] ||= {global:{},layers:{}};
}
function applyChange(scope,field,value){
  if(!selectedSkill)return;
  const record=editRecord();
  if(scope==='global'){
    record.global[field]=value;
  }else if(selectedLayer){
    const settings=record.layers[selectedLayer.id] ||= {};
    settings[field]=value;
  }
  presets=writeLocalPresets(presets);
  if(scope==='global'&&field==='distance'){
    target.x=value;targetDummy.position.x=value;
  }
  redrawLayers();
  preview(phase);
}
function makeControl(scope,name,label,min,max,step){
  const wrap=document.createElement('div');
  wrap.className='control';const cap=document.createElement('label');cap.textContent=label;
  const out=document.createElement('output');
  const input=document.createElement('input');input.type='range';
  input.min=min;input.max=max;input.step=step;
  input.id='ctrl-'+scope+'-'+name;
  const preset=currentPreset();
  const val=scope==='global'?preset.global[name]:layerSettings(preset,selectedLayer)[name];
  input.value=val;out.textContent=Number(val).toFixed(step>=1?0:2);
  input.addEventListener('input',()=>{
    const n=Number(input.value);
    out.textContent=n.toFixed(step>=1?0:2);
    applyChange(scope,name,n);
  });
  wrap.append(cap,out,input);return wrap;
}
function drawGlobals(){
  const root=$('global-controls');root.replaceChildren();
  for(const field of fields.global)root.append(makeControl('global',...field));
}
function drawLayerControls(){
  const root=$('layer-controls');root.replaceChildren();
  if(!selectedLayer){$('layer-detail').textContent='Nenhuma camada disponível nesta skill.';return;}
  const layer=selectedLayer;
  $('layer-detail').textContent=layer.stage.toUpperCase()+' · '+layer.source+' · '+layer.model+
    ' · textura '+(layer.texture||'(sem)');
  const settings=layerSettings(currentPreset(),layer);
  const toggle=document.createElement('label');toggle.className='control-check';
  const box=document.createElement('input');box.type='checkbox';box.checked=settings.enabled;
  box.addEventListener('change',()=>applyChange('layer','enabled',box.checked));
  toggle.append(box,document.createTextNode('Exibir camada'));
  root.append(toggle);
  for(const field of fields.layer)root.append(makeControl('layer',...field));
  const colorWrap=document.createElement('label');colorWrap.className='field';colorWrap.textContent='Tonalidade adicional';
  const color=document.createElement('input');color.type='color';color.value=settings.color;
  color.style.cssText='width:100%;height:36px;background:#0e2939;border:1px solid #456477;border-radius:8px';
  color.addEventListener('input',()=>applyChange('layer','color',color.value));
  colorWrap.append(color);root.append(colorWrap);
}
function redrawLayers(){
  const list=$('layers');list.replaceChildren();
  const preset=currentPreset();$('layer-count').textContent=String(layers.length);
  for(const layer of layers){
    const edit=layerSettings(preset,layer);
    const item=document.createElement('button');item.type='button';
    item.className='layer'+(selectedLayer?.id===layer.id?' active':'')+(edit.enabled?'':' disabled');
    const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=edit.enabled;
    toggle.setAttribute('aria-label','Habilitar '+layer.label);
    toggle.addEventListener('click',e=>e.stopPropagation());
    toggle.addEventListener('change',()=>{selectedLayer=layer;applyChange('layer','enabled',toggle.checked);drawLayerControls();});
    const icon=document.createElement('img');icon.alt='';icon.loading='lazy';
    if(layer.texture)icon.src=assetPrefix+'textures/'+layer.texture;
    const content=document.createElement('span');content.className='layer-text';
    const title=document.createElement('strong');title.textContent=layer.source;
    const sub=document.createElement('small');sub.textContent=layer.model+' · '+layer.kind;
    content.append(title,sub);
    const badge=document.createElement('span');badge.className='stage-badge';badge.textContent=layer.stage.toUpperCase();
    item.append(toggle,icon,content,badge);
    item.addEventListener('click',()=>{selectedLayer=layer;redrawLayers();drawLayerControls();});
    list.append(item);
  }
}
async function loadActor(){
  const current=++token,actor=$('actor').value;
  loading=true;status('Carregando '+actor+'...');
  try{
    if(!charCache.has(actor)){
      charCache.set(actor,(async()=>{
        const base=await loader.loadAsync('assets/characters/'+actor+'.glb?v=3');
        let extras=[];
        try{const x=await loader.loadAsync('assets/skills/animations/'+actor+'.glb?v=3');extras=x.animations||[];}
        catch{ /* Ami e outras versões podem não precisar de clipes extras. */ }
        return {base,clips:[...(base.animations||[]),...extras]};
      })().catch(e=>{charCache.delete(actor);throw e;}));
    }
    const {base,clips:actions}=await charCache.get(actor);
    if(current!==token)return;
    if(avatar)scene.remove(avatar);
    if(mixer)mixer.stopAllAction();
    const {clone}=await import('three/addons/utils/SkeletonUtils.js');
    avatar=clone(base.scene);avatar.position.set(0,0,0);avatar.rotation.y=-Math.PI/2;
    avatar.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});
    scene.add(avatar);
    mixer=new THREE.AnimationMixer(avatar);
    clips=actions;
    $('show-actor').checked=true;
    await pickSkill();
  }catch(err){
    if(current!==token)return;
    console.error(err);status('Personagem indisponível: '+err.message);
    toast('Sem personagem 3D; os efeitos ainda podem ser editados');
    if(avatar){scene.remove(avatar);avatar=null;}
    clips=[];await pickSkill();
  }finally{if(current===token)loading=false;}
}
async function pickSkill(){
  const job=$('job').value,id=Number($('skill').value);
  const raw=catalog.classes[job].skills.find(s=>s.id===id);
  if(!raw)return;
  selectedSkill=skillWithRules(raw)||raw;
  $('skill-name').textContent=selectedSkill.name;
  $('skill-icon').src=assetPrefix+selectedSkill.icon;
  layers=compileSkillLayers(manifest,id,{maxLayers:48});
  $('skill-meta').textContent='#'+id+' · '+(selectedSkill.fx||'visual')+' · '+layers.length+' camadas';
  selectedLayer=layers.find(l=>l.id===selectedLayer?.id)||layers[0]||null;
  $('empty-warning').hidden=layers.length>0;
  if(!layers.length){
    $('empty-warning').textContent='Nenhuma camada visual encontrada para esta skill nos canais PAR/EFF. Confira visuals.json e seus recursos.';
  }
  const match=resolveSkillClip(selectedSkill,$('actor').value,clips);
  const availableText=match?'Animação '+getActionId(match):'Animação ausente';
  $('stage-label').textContent=availableText.toUpperCase();
  drawGlobals();redrawLayers();drawLayerControls();
  await fx.warm([selectedSkill]);
  phase=0;preview(0);
  status(selectedSkill.name+' · '+layers.length+' camadas · '+availableText);
}
function updateActorAnimation(t){
  if(!mixer||!avatar||!selectedSkill)return;
  mixer.stopAllAction();
  const clip=resolveSkillClip(selectedSkill,$('actor').value,clips);
  const rest=clips.find(c=>/parado|idle/i.test(c.name));
  const chosen=clip||rest;
  if(chosen){
    const action=mixer.clipAction(chosen);
    action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    mixer.update(Math.min(t,Math.max(.01,chosen.duration-.001)));
  }
}
function preview(t){
  if(!selectedSkill)return;
  phase=Math.max(0,Math.min(5,Number(t)||0));
  fx.clear();
  target.x=currentPreset().global.distance;targetDummy.position.x=target.x;
  fx.play(selectedSkill,origin,selectedSkill.kind==='buff'||selectedSkill.kind==='heal'?origin:target,
    Math.max(.3,target.x/12),presets);
  fx.update(phase);
  updateActorAnimation(phase);
  $('time-range').value=String(Math.round(phase*1000));
  $('time-label').textContent=phase.toFixed(2)+' / 5.00 s';
  $('perf').textContent=fx.activeCount+' / 48 objetos FX';
}
function playToggle(){
  playing=!playing;$('play').textContent=playing?'Ⅱ Pausar':'▶ Reproduzir';
}
function save(){presets=writeLocalPresets(presets);toast('Configurações salvas no navegador ✓');}
function download(filename,blob){
  const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=filename;
  a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
function exportFile(){
  const data=mergePresetStores(production,presets);
  download('vfx-presets.json',new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));
  toast('JSON exportado: copie para assets/skills/vfx-presets.json');
}
async function importFile(file){
  if(!file)return;
  try{
    const obj=JSON.parse(await file.text()),merged=normalizePresetStore(obj);
    if(!obj||obj.version!==1||typeof obj.skills!=='object')throw Error('Versão/formato não compatível');
    presets=writeLocalPresets(merged);
    drawGlobals();redrawLayers();drawLayerControls();preview(0);
    toast('Arquivo importado e aplicado ✓');
  }catch(err){toast('Erro de importação: '+err.message);}
}
function resetSkill(){
  if(!selectedSkill)return;
  const id=String(selectedSkill.id);
  delete presets.skills[id];
  const factory={global:{...GLOBAL_DEFAULTS},layers:{}};
  for(const layer of layers)factory.layers[layer.id]={...LAYER_DEFAULTS};
  presets.skills[id]=factory;presets=writeLocalPresets(presets);
  drawGlobals();redrawLayers();drawLayerControls();preview(0);
  toast('Skill restaurada aos padrões do editor');
}
function bind(){
  $('job').onchange=()=>{classSelected();skillSelected();void loadActor();};
  $('actor').onchange=()=>void loadActor();
  $('skill').onchange=()=>{playing=false;$('play').textContent='▶ Reproduzir';void pickSkill();};
  $('play').onclick=playToggle;
  $('restart').onclick=()=>{phase=0;preview(0);};
  $('time-range').oninput=e=>{if(playing)playToggle();preview(Number(e.target.value)/1000);};
  $('save').onclick=save;$('export').onclick=exportFile;
  $('import').onclick=()=>$('import-file').click();
  $('import-file').onchange=e=>{void importFile(e.target.files?.[0]);e.target.value='';};
  $('reset-skill').onclick=resetSkill;
  $('all-on').onclick=()=>{
    for(const layer of layers){const entry=editRecord().layers[layer.id]||={};entry.enabled=true;}
    presets=writeLocalPresets(presets);
    redrawLayers();drawLayerControls();preview(0);
  };
  $('show-actor').onchange=e=>{if(avatar)avatar.visible=e.target.checked;};
  $('show-target').onchange=e=>targetDummy.visible=e.target.checked;
  $('camera-reset').onclick=resetCamera;
  $('snapshot').onclick=()=>{
    renderer.render(scene,camera);
    renderer.domElement.toBlob(blob=>{
      if(blob)download('TOP_skill_'+(selectedSkill?.id||0)+'.png',blob);
    },'image/png');
  };
  window.addEventListener('keydown',e=>{
    if(e.target.closest('input,select,textarea'))return;
    if(e.code==='Space'){e.preventDefault();playToggle();}
    if(e.code==='KeyR'){preview(0);}
  });
}
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,Math.max(0,(now-lastNow)/1000));lastNow=now;
  const canvas=$('preview'),rect=canvas.getBoundingClientRect();
  const width=Math.max(1,Math.floor(rect.width)),height=Math.max(1,Math.floor(rect.height));
  if(renderer.domElement.width!==Math.floor(width*renderer.getPixelRatio())||
     renderer.domElement.height!==Math.floor(height*renderer.getPixelRatio())){
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  if(playing&&!loading&&selectedSkill){
    phase+=dt;
    if(phase>=5)phase=0,preview(0);
    else{
      fx.update(dt);
      mixer?.update(dt);
      $('time-range').value=String(Math.round(phase*1000));
      $('time-label').textContent=phase.toFixed(2)+' / 5.00 s';
    }
  }
  $('perf').textContent=fx.activeCount+' / 48 objetos FX';
  orbit.update();renderer.render(scene,camera);
}
async function start(){
  bind();requestAnimationFrame(animate);
  try{
    const [skillCatalog,visualManifest,defaults]=await Promise.all([
      fetch('assets/skills/catalog.json').then(r=>{if(!r.ok)throw Error('catalog.json HTTP '+r.status);return r.json();}),
      fetch('assets/skills/visuals.json').then(r=>{if(!r.ok)throw Error('visuals.json HTTP '+r.status);return r.json();}),
      fetch('assets/skills/vfx-presets.json').then(r=>r.ok?r.json():newPresetStore()).catch(()=>newPresetStore()),
      fx.ready
    ]);
    catalog=skillCatalog;manifest=visualManifest;production=normalizePresetStore(defaults);
    options($('job'),Object.entries(catalog.classes).map(([id,preset])=>[id,preset.name]));
    classSelected();skillSelected();await loadActor();
  }catch(err){console.error(err);status('ERRO: '+err.message);$('empty-warning').textContent='Servidor HTTP necessário. Abra /tests/skill-editor.html usando python3 -m http.server 8000';$('empty-warning').hidden=false;}
}
void start();
