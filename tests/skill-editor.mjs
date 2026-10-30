// Skill FX Studio v2 — edita os campos REAIS dos .par/.eff (visuals.json).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone as skeletonClone} from 'three/addons/utils/SkeletonUtils.js';
import {FxPlayer,GLOBAL_DEFAULTS,globals,normalizeStore,layerData,resolveEff,skillRec,
  TYPE_NAMES,BLEND_NAMES,BLEND_PRESETS,curve1,clone} from '../js/skill-fx-core.mjs';
import * as ED from '../js/skill-fx-edit.mjs';

/* ---------------------------------------------------------------- helpers */
const $=id=>document.getElementById(id);
const h=(tag,props={},...kids)=>{
  const e=document.createElement(tag);
  for(const[k,v]of Object.entries(props||{})){
    if(k==='class')e.className=v;else if(k==='text')e.textContent=v;
    else if(k==='style')e.style.cssText=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);
    else if(v===true)e.setAttribute(k,'');else if(v!==false&&v!=null)e.setAttribute(k,v);}
  for(const c of kids.flat())if(c!=null&&c!==false)e.append(c.nodeType?c:document.createTextNode(String(c)));
  return e;};
const STORE_KEY='top-vfx-edits-v2',assetPrefix='assets/skills/';
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const fmt=(v,step)=>{const n=Number(v);return step>=1?String(Math.round(n)):String(+n.toFixed(step<.01?3:2));};
const RAD=180/Math.PI;

/* ------------------------------------------------------------------ estado */
let catalog=null,manifest=null,store=readStore(),usage={};
let selectedKey=null,layers=[],avatar=null,mixer=null,clips=[],texNames=[],effNames=[],lgoNames=[];
let phase=0,playing=false,loading=false,lastNow=performance.now(),loopPlay=true,token=0,toastTimer;
let undoStack=[],redoStack=[],lastSnap=0,saveTimer=0;
let classMods={};
const loader=new GLTFLoader();

function readStore(){try{return normalizeStore(JSON.parse(localStorage.getItem(STORE_KEY)||'null'));}catch{return normalizeStore(null);}}
function writeStoreNow(){try{localStorage.setItem(STORE_KEY,JSON.stringify(store));}catch(e){console.warn(e);}}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(writeStoreNow,350);}
function touch(){// guarda um ponto de desfazer no início de cada interação
  const now=Date.now();if(now-lastSnap<700)return;lastSnap=now;
  undoStack.push(JSON.stringify(store));if(undoStack.length>100)undoStack.shift();redoStack=[];updateUndo();}
function restore(json){store=normalizeStore(JSON.parse(json));writeStoreNow();structural();}
function undo(){if(!undoStack.length)return;redoStack.push(JSON.stringify(store));restore(undoStack.pop());updateUndo();}
function redo(){if(!redoStack.length)return;undoStack.push(JSON.stringify(store));restore(redoStack.pop());updateUndo();}
function updateUndo(){$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
function status(msg){$('status').textContent=msg;}

/* ------------------------------------------------------------------- cena */
const renderer=new THREE.WebGLRenderer({canvas:$('preview'),antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0c2a3a);
scene.add(new THREE.HemisphereLight(0xc1e8fc,0x5a5850,2));
const sun=new THREE.DirectionalLight(0xffe7b9,2);sun.position.set(-3,7,5);scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshLambertMaterial({color:0x315962}));
floor.rotation.x=-Math.PI/2;scene.add(floor);
const grid=new THREE.GridHelper(24,24,0x79a8ac,0x31576e);grid.position.y=.012;scene.add(grid);
const targetDummy=new THREE.Group();
const targetCore=new THREE.Mesh(new THREE.CapsuleGeometry(.27,.72,4,10),new THREE.MeshLambertMaterial({color:0x9b635b}));
targetCore.position.y=.64;targetDummy.add(targetCore);
const ring=new THREE.Mesh(new THREE.RingGeometry(.44,.54,32),new THREE.MeshBasicMaterial({color:0x66cfd1,transparent:true,opacity:.65,side:THREE.DoubleSide}));
ring.rotation.x=-Math.PI/2;ring.position.y=.025;targetDummy.add(ring);scene.add(targetDummy);
const camera=new THREE.PerspectiveCamera(50,1,.1,150);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;orbit.minDistance=2;orbit.maxDistance=28;orbit.maxPolarAngle=Math.PI/2-.04;
function resetCamera(){camera.position.set(5.1,4.8,7.8);orbit.target.set(1.4,1,0);orbit.update();}resetCamera();
const modelsMap=new Map();
const player=new FxPlayer({scene,camera,textureBase:assetPrefix+'textures/',models:modelsMap});

/* ------------------------------------------------------ componentes de UI */
function numControl(label,value,o,onChange){
  const{min=0,max=1,step=.01}=o;
  const wrap=h('div',{class:'control'});
  const cap=h('label',{text:label});
  const box=h('input',{type:'number',class:'num',step:String(step),value:fmt(value,step)});
  const rng=h('input',{type:'range',min:String(min),max:String(max),step:String(step),value:String(clamp(value,min,max))});
  const apply=(v,live)=>{if(!Number.isFinite(v))return;touch();onChange(v,live);};
  rng.addEventListener('input',()=>{box.value=fmt(rng.value,step);apply(Number(rng.value),true);});
  box.addEventListener('input',()=>{const v=Number(box.value);if(box.value!==''&&Number.isFinite(v)){rng.value=String(clamp(v,min,max));apply(v,true);}});
  box.addEventListener('change',()=>{box.value=fmt(num(box.value,value),step);});
  wrap.append(cap,box,rng);return wrap;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function checkControl(label,value,onChange){
  const box=h('input',{type:'checkbox'});box.checked=!!value;
  box.addEventListener('change',()=>{touch();onChange(box.checked);});
  return h('label',{class:'control-check'},box,label);}
function selectControl(label,value,options,onChange){
  const sel=h('select');for(const[v,t]of options)sel.add(new Option(t,String(v)));
  if(!options.some(([v])=>String(v)===String(value)))sel.add(new Option(String(value)+' (atual)',String(value)),0);
  sel.value=String(value);sel.addEventListener('change',()=>{touch();onChange(sel.value);});
  return h('label',{class:'row-sel'},label,sel);}
function vecControl(label,arr,o,onChange){
  const a=[...(arr||[0,0,0])];const row=h('div',{class:'vec'},h('span',{text:label}));
  a.forEach((v,i)=>{const inp=h('input',{type:'number',step:String(o.step||.1),value:fmt(v,o.step||.1)});
    inp.addEventListener('input',()=>{const n=Number(inp.value);if(inp.value!==''&&Number.isFinite(n)){touch();a[i]=n;onChange([...a]);}});row.append(inp);});
  return row;}
function section(title,open,...kids){return h('details',{class:'sec',open},h('summary',{text:title}),h('div',{class:'sec-body'},kids));}
const rgbHex=c=>'#'+[0,1,2].map(i=>Math.round(clamp(c[i],0,1)*255).toString(16).padStart(2,'0')).join('');
const hexRgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);

/* ----------------------------------------------------- acesso aos dados */
const sel=()=>layers.find(l=>l.key===selectedKey)||null;
const skillId=()=>String(currentSkill?.id??'');
let currentSkill=null;
function globalsNow(){return globals(store,skillId());}
function enabledMap(){const rec=store.skills[skillId()];const m={};if(rec)for(const[k,v]of Object.entries(rec.off||{}))if(v)m[k]=false;return m;}
function setField(layer,field,value,needRebuild=false){
  ED.setLayerField(store,layer,field,value);persist();
  if(needRebuild)structural();else preview(phase);}
function structural(keepPanel=false){// reconstrói objetos 3D + listas
  if(!currentSkill)return;
  layers=player.setSkill(manifest,store,skillId(),$('actor').value);
  if(!layers.find(l=>l.key===selectedKey))selectedKey=layers[0]?.key||null;
  redrawLayers();drawGlobals();if(!keepPanel)drawLayerPanel();preview(phase);}

/* -------------------------------------------------- painel: parâmetros skill */
const GF=[['scale','Escala geral',.1,4,.05],['opacity','Opacidade geral',0,2,.05],['speed','Velocidade do tempo',.1,4,.05],
  ['particles','Limite global de partículas',1,400,1],['height','Altura global (m)',-5,6,.1],['distance','Distância do alvo (m)',1,12,.1],
  ['castDelay','Atraso do disparo (s)',0,2,.05],['flightSpeed','Velocidade do projétil (0 = original)',0,40,.5],['duration','Duração da prévia (s)',1,12,.5]];
function drawGlobals(){
  const root=$('global-controls');root.replaceChildren();const g=globalsNow();
  for(const[name,label,min,max,step]of GF)
    root.append(numControl(label,g[name],{min,max,step},v=>{
      skillRec(store,skillId()).global[name]=v;persist();
      if(name==='distance'){targetDummy.position.x=v;}
      if(name==='duration')$('time-range').max=String(Math.round(v*1000));
      preview(phase);}));
  root.append(checkControl('Alcance (range) centralizado',g.centerRange>=.5,v=>{skillRec(store,skillId()).global.centerRange=v?1:0;persist();preview(phase);}));
  targetDummy.position.x=g.distance;$('time-range').max=String(Math.round(g.duration*1000));}

/* ------------------------------------------------------- lista de camadas */
function redrawLayers(){
  const list=$('layers');list.replaceChildren();$('layer-count').textContent=String(layers.length);
  const rec=store.skills[skillId()],off=rec?.off||{};
  for(const L of layers){
    const data=layerData(manifest,store,L);
    const item=h('div',{class:'layer'+(selectedKey===L.key?' active':'')+(off[L.key]?' disabled':'')+(L.custom?' custom':''),role:'listitem',tabindex:'0'});
    const box=h('input',{type:'checkbox','aria-label':'Habilitar '+L.label});box.checked=!off[L.key];
    box.addEventListener('click',e=>e.stopPropagation());
    box.addEventListener('change',()=>{touch();skillRec(store,skillId()).off[L.key]=!box.checked;persist();redrawLayers();preview(phase);});
    const icon=h('img',{alt:'',loading:'lazy'});const tex=data?.texture||data?.parts?.[0]?.texture;if(tex)icon.src=assetPrefix+'textures/'+tex;
    const sub=L.kind==='eff'?'EFF · '+(data?.parts?.length||0)+' peças':
      L.kind==='strip'?'trilha da lâmina':(TYPE_NAMES[data?.type]||('tipo '+data?.type))+' · '+(data?.count||1)+'×';
    const content=h('span',{class:'layer-text'},h('strong',{text:L.label}),h('small',{text:sub}));
    const solo=h('button',{type:'button',class:'solo'+(player.solo===L.key?' on':''),title:'Isolar esta camada',text:'◎'});
    solo.addEventListener('click',e=>{e.stopPropagation();player.solo=player.solo===L.key?null:L.key;redrawLayers();preview(phase);});
    item.append(box,icon,content,h('span',{class:'stage-badge',text:(L.channel||'').toUpperCase()}),solo);
    item.addEventListener('click',()=>{selectedKey=L.key;redrawLayers();drawLayerPanel();});
    list.append(item);}
  if(!layers.length){$('empty-warning').hidden=false;$('empty-warning').textContent='Esta skill não tem camadas PAR/EFF no visuals.json. Use ＋ Partícula para criar.';}
  else $('empty-warning').hidden=true;}

/* ---------------------------------------------------------- painel: camada */
function texturePicker(current,onPick){
  const img=h('img',{alt:'',src:current?assetPrefix+'textures/'+current:''});
  const label=h('span',{class:'hint',text:current||'(sem textura)'});
  const grid=h('div',{class:'tex-grid'});let built=false;
  const build=()=>{if(built)return;built=true;
    const none=h('button',{type:'button',title:'Sem textura',text:'∅'});none.onclick=()=>pick('');grid.append(none);
    for(const n of texNames){const b=h('button',{type:'button',class:n===current?'on':'',title:n},h('img',{src:assetPrefix+'textures/'+n,loading:'lazy',alt:n}));b.onclick=()=>pick(n);grid.append(b);}};
  function pick(n){touch();onPick(n);img.src=n?assetPrefix+'textures/'+n:'';label.textContent=n||'(sem textura)';
    for(const b of grid.querySelectorAll('button'))b.classList.toggle('on',b.title===n);}
  return h('div',{class:'row-sel'},'Textura',h('div',{class:'tex-pick'},img,label),h('details',{ontoggle:build},h('summary',{class:'hint',text:'Escolher outra textura ('+texNames.length+')'}),grid));}
function blendControls(src,dst,onChange){
  let s=src,d=dst;
  const opts=Object.entries(BLEND_NAMES).map(([k,v])=>[k,k+' · '+v]);
  const ss=selectControl('Fonte (src)',s,opts,v=>{s=Number(v);onChange(s,d);});
  const dd=selectControl('Destino (dst)',d,opts,v=>{d=Number(v);onChange(s,d);});
  const pre=selectControl('Predefinição de mistura','',[['','—'],...BLEND_PRESETS.map((p,i)=>[i,p[0]])],v=>{
    if(v==='')return;const p=BLEND_PRESETS[Number(v)];s=p[1];d=p[2];ss.querySelector('select').value=String(s);dd.querySelector('select').value=String(d);onChange(s,d);});
  return h('div',{class:'row-sel'},pre,h('div',{class:'row2'},ss,dd));}

function sizesEditor(arr,onChange){
  const root=h('div',{class:'row-sel'});const a=[...arr];
  const cv=h('canvas',{class:'curve-prev',width:240,height:34});
  const draw=()=>{const c=cv.getContext('2d');c.clearRect(0,0,240,34);c.strokeStyle='#f2c983';c.lineWidth=2;c.beginPath();
    const mx=Math.max(.01,...a);for(let i=0;i<=60;i++){const t=i/60,v=curve1(a,t,1);const x=t*236+2,y=32-(v/mx)*28;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();};
  const render=()=>{root.replaceChildren('Tamanho ao longo da vida (m)',cv);
    a.forEach((v,i)=>{const inp=h('input',{type:'number',class:'mini',step:'0.05',value:fmt(v,.05)});
      inp.addEventListener('input',()=>{const n=Number(inp.value);if(inp.value!==''&&Number.isFinite(n)){touch();a[i]=n;onChange([...a]);draw();}});
      const del=h('button',{type:'button',class:'mini-btn',text:'×',disabled:a.length<=1});del.onclick=()=>{touch();a.splice(i,1);onChange([...a]);render();};
      root.append(h('div',{class:'curve-row sz'},h('span',{text:String(i+1)}),inp,del));});
    const add=h('button',{type:'button',class:'mini-btn',text:'＋ chave'});add.onclick=()=>{touch();a.push(a[a.length-1]??1);onChange([...a]);render();};
    root.append(add);draw();};
  render();return root;}
function colorsEditor(arr,onChange){
  const root=h('div',{class:'row-sel'});const a=arr.map(c=>[...c]);
  const bar=h('div',{class:'curve-prev',style:'background:#222'});
  const grad=()=>{bar.style.background='linear-gradient(90deg,'+a.map((c,i)=>`rgba(${c.slice(0,3).map(x=>Math.round(x*255))},${c[3]}) ${a.length>1?i/(a.length-1)*100:0}%`).join(',')+'),repeating-conic-gradient(#555 0 25%,#333 0 50%) 0 0/10px 10px';};
  const render=()=>{root.replaceChildren('Cor e alfa ao longo da vida',bar);
    a.forEach((c,i)=>{const col=h('input',{type:'color',value:rgbHex(c)});
      col.addEventListener('input',()=>{touch();const r=hexRgb(col.value);a[i]=[r[0],r[1],r[2],a[i][3]];onChange(a.map(x=>[...x]));grad();});
      const al=h('input',{type:'number',class:'mini',step:'0.05',min:'0',max:'1',value:fmt(c[3],.05)});
      al.addEventListener('input',()=>{const n=Number(al.value);if(al.value!==''&&Number.isFinite(n)){touch();a[i][3]=clamp(n,0,1);onChange(a.map(x=>[...x]));grad();}});
      const del=h('button',{type:'button',class:'mini-btn',text:'×',disabled:a.length<=1});del.onclick=()=>{touch();a.splice(i,1);onChange(a.map(x=>[...x]));render();};
      root.append(h('div',{class:'curve-row'},h('span',{text:String(i+1)}),col,al,del));});
    const add=h('button',{type:'button',class:'mini-btn',text:'＋ chave'});add.onclick=()=>{touch();a.push([...(a[a.length-1]||[1,1,1,1])]);onChange(a.map(x=>[...x]));render();};
    root.append(add);grad();};
  render();return root;}
function anglesEditor(arr,onChange){
  const a=(arr||[]).map(v=>[...v]);const root=h('div',{class:'row-sel'});
  const render=()=>{root.replaceChildren('Rotação Z ao longo da vida (graus)');
    a.forEach((v,i)=>{const inp=h('input',{type:'number',class:'mini',step:'5',value:fmt(v[2]*RAD,5)});
      inp.addEventListener('input',()=>{const n=Number(inp.value);if(inp.value!==''&&Number.isFinite(n)){touch();a[i][2]=n/RAD;onChange(a.map(x=>[...x]));}});
      const del=h('button',{type:'button',class:'mini-btn',text:'×'});del.onclick=()=>{touch();a.splice(i,1);onChange(a.map(x=>[...x]));render();};
      root.append(h('div',{class:'curve-row sz'},h('span',{text:String(i+1)}),inp,del));});
    const add=h('button',{type:'button',class:'mini-btn',text:'＋ chave'});add.onclick=()=>{touch();a.push([0,0,(a[a.length-1]?.[2]||0)]);onChange(a.map(x=>[...x]));render();};
    root.append(add);};
  render();return root;}

function effEditor(layer,effFile,{canRename}={}){
  const eff=resolveEff(manifest,store,effFile);if(!eff)return h('p',{class:'hint',text:'EFF "'+effFile+'" não encontrado no visuals.json.'});
  const body=[];
  const users=usage[effFile]?.size||0;
  body.push(h('p',{class:'hint'},'Arquivo ',h('b',{text:effFile}),' · ',h('span',{class:'chip'+(users>1?' warn':''),text:users>1?'compartilhado ('+users+' usos)':'uso único'})));
  if(canRename&&users>1){const b=h('button',{type:'button',text:'Tornar este EFF exclusivo desta camada'});
    b.onclick=()=>{touch();ED.makeEffExclusive(manifest,store,skillId(),layer);persist();structural();toast('EFF duplicado só para esta camada');};body.push(b);}
  body.push(checkControl('Girar o modelo inteiro (rotating)',eff.rotating,v=>{ED.setEffTop(store,effFile,'rotating',v);persist();preview(phase);}));
  body.push(vecControl('Eixo',eff.rotation||[0,0,1],{step:.1},v=>{ED.setEffTop(store,effFile,'rotation',v);persist();preview(phase);}));
  body.push(numControl('Velocidade de giro (rad/s)',eff.rotationSpeed??1,{min:-20,max:20,step:.1},v=>{ED.setEffTop(store,effFile,'rotationSpeed',v);persist();preview(phase);}));
  eff.parts.forEach((part,pi)=>{
    const set=(f,v)=>{ED.setEffPart(store,effFile,pi,f,v);persist();preview(phase);};
    const sub=[];
    sub.push(selectControl('Modelo',part.model,[['RectPlane','RectPlane (plano no chão)'],['Rect','Rect (plano vertical)'],['Cylinder','Cylinder'],['Cone','Cone'],...lgoNames.map(n=>[n,n])],v=>{set('model',v);structural(true);}));
    sub.push(texturePicker(part.texture,v=>set('texture',v)));
    sub.push(blendControls(part.src,part.dst,(s,d)=>{set('src',s);set('dst',d);}));
    sub.push(checkControl('Billboard (olha para a câmera)',part.billboard,v=>set('billboard',v)));
    sub.push(checkControl('Repetir a animação (loop)',part.loop!==false,v=>set('loop',v)));
    const keys=clone(part.keys||[]);
    const keyHost=h('div',{class:'row-sel'});
    const commit=()=>{set('keys',keys);};
    const renderKeys=()=>{keyHost.replaceChildren('Keyframes ('+keys.length+')');
      keys.forEach((k,ki)=>{
        const mk=(arr,i,step,conv)=>{const inp=h('input',{type:'number',step:String(step),value:fmt(conv?arr[i]*RAD:arr[i],step)});
          inp.addEventListener('input',()=>{const n=Number(inp.value);if(inp.value!==''&&Number.isFinite(n)){touch();arr[i]=conv?n/RAD:n;commit();}});return inp;};
        const del=h('button',{type:'button',class:'mini-btn',text:'× chave',disabled:keys.length<=1});del.onclick=()=>{touch();keys.splice(ki,1);commit();renderKeys();};
        const col=h('input',{type:'color',value:rgbHex(k.c)});col.addEventListener('input',()=>{touch();const r=hexRgb(col.value);k.c[0]=r[0];k.c[1]=r[1];k.c[2]=r[2];commit();});
        const alpha=h('input',{type:'number',step:'0.05',min:'0',max:'1',value:fmt(k.c[3],.05)});
        alpha.addEventListener('input',()=>{const n=Number(alpha.value);if(alpha.value!==''&&Number.isFinite(n)){touch();k.c[3]=clamp(n,0,1);commit();}});
        const dur=h('input',{type:'number',step:'0.05',min:'0',value:fmt(k.d,.05)});
        dur.addEventListener('input',()=>{const n=Number(dur.value);if(dur.value!==''&&Number.isFinite(n)){touch();k.d=Math.max(0,n);commit();}});
        keyHost.append(h('div',{class:'key-box'},
          h('div',{class:'key-head'},h('span',{text:'Chave '+(ki+1)}),del),
          h('div',{class:'key-grid'},h('span',{text:'tempo'}),dur,h('span',{text:'s'}),h('span')),
          h('div',{class:'key-grid'},h('span',{text:'escala'}),mk(k.s,0,.1),mk(k.s,1,.1),mk(k.s,2,.1)),
          h('div',{class:'key-grid'},h('span',{text:'ângulo°'}),mk(k.a,0,5,true),mk(k.a,1,5,true),mk(k.a,2,5,true)),
          h('div',{class:'key-grid'},h('span',{text:'pos m'}),mk(k.p,0,.1),mk(k.p,1,.1),mk(k.p,2,.1)),
          h('div',{class:'key-grid'},h('span',{text:'cor'}),col,alpha,h('span',{text:'α'}))));});
      const add=h('button',{type:'button',class:'mini-btn',text:'＋ chave'});
      add.onclick=()=>{touch();keys.push(clone(keys[keys.length-1]||{d:.5,s:[1,1,1],a:[0,0,0],p:[0,0,0],c:[1,1,1,1]}));commit();renderKeys();};
      keyHost.append(add);};
    renderKeys();sub.push(keyHost);
    body.push(section('Peça '+(pi+1)+' · '+part.model,pi===0,sub));});
  return h('div',{class:'sec-body',style:'display:grid;gap:9px'},body);}

function drawLayerPanel(){
  const root=$('layer-controls');root.replaceChildren();const L=sel();
  $('layer-tag').textContent=L?L.channel:'';
  if(!L){$('layer-detail').textContent='Nenhuma camada disponível nesta skill.';return;}
  const data=layerData(manifest,store,L);if(!data){$('layer-detail').textContent='Dados ausentes.';return;}
  const users=usage[L.file]?.size||0,shared=!L.custom&&users>1;
  const det=$('layer-detail');det.replaceChildren(h('span',{text:L.label+' '}),
    L.custom?h('span',{class:'chip',text:'nova'}):h('span',{class:'chip'+(shared?' warn':''),text:shared?'compartilhado por '+users+' skills':'só esta skill'}));
  const actions=h('div',{class:'row2'});
  if(shared){const b=h('button',{type:'button',text:'Tornar exclusiva desta skill',title:'Copia o arquivo só para esta skill; editar não afeta as outras'});
    b.onclick=()=>{touch();ED.makeExclusive(manifest,store,skillId(),L.file);persist();selectedKey=null;structural();toast('Arquivo exclusivo criado para esta skill');};actions.append(b);}
  if(!L.custom){const b=h('button',{type:'button',text:'↺ Restaurar camada'});b.onclick=()=>{touch();ED.resetLayer(store,L);persist();structural();};actions.append(b);}
  else{const b=h('button',{type:'button',text:'🗑 Excluir camada'});b.onclick=()=>{touch();ED.removeExtra(store,skillId(),L.key);selectedKey=null;persist();structural();};actions.append(b);}
  root.append(actions);

  if(L.kind==='eff'){root.append(section('Modelo EFF (voo)',true,effEditor(L,L.file)));return;}
  if(L.kind==='strip'){
    const set=(f,v)=>setField(L,f,v);
    const sw={a0:-70,a1:110,start:0,dur:.35,r0:.25,r1:1.35,h:1.1,...(data.swing||{})};
    const sset=(f,v)=>{sw[f]=v;setField(L,'swing',{...sw});};
    root.append(section('Trilha da lâmina',true,
      texturePicker(data.texture,v=>set('texture',v)),blendControls(data.src,data.dst,(s,d)=>{set('src',s);set('dst',d);}),
      h('div',{class:'row-sel'},'Cor',h('input',{type:'color',value:rgbHex(data.color||[1,1,1,1]),oninput:e=>{touch();const r=hexRgb(e.target.value);set('color',[r[0],r[1],r[2],(data.color||[1,1,1,1])[3]]);}})),
      numControl('Vida da trilha (s)',data.life,{min:.05,max:3,step:.05},v=>set('life',v)),
      numControl('Passo de amostra (s)',data.step,{min:.005,max:.2,step:.005},v=>set('step',v))));
    root.append(section('Trajetória do golpe (só prévia)',false,
      h('p',{class:'hint',text:'O jogo calcula o arco pelos dummies da arma; aqui você simula o arco para ver a trilha.'}),
      numControl('Ângulo inicial (°)',sw.a0,{min:-360,max:360,step:5},v=>sset('a0',v)),numControl('Ângulo final (°)',sw.a1,{min:-360,max:360,step:5},v=>sset('a1',v)),
      numControl('Início (s)',sw.start,{min:0,max:2,step:.05},v=>sset('start',v)),numControl('Duração do golpe (s)',sw.dur,{min:.05,max:2,step:.05},v=>sset('dur',v)),
      numControl('Raio da base (m)',sw.r0,{min:0,max:3,step:.05},v=>sset('r0',v)),numControl('Raio da ponta (m)',sw.r1,{min:.1,max:4,step:.05},v=>sset('r1',v)),
      numControl('Altura (m)',sw.h,{min:0,max:3,step:.05},v=>sset('h',v))));return;}

  const set=(f,v,rebuild)=>setField(L,f,v,rebuild);
  const isMesh=[4,5,6,15].includes(data.type);
  const typeOpts=Object.entries(TYPE_NAMES).map(([k,v])=>[k,v]);
  root.append(section('Identidade',true,
    h('label',{class:'row-sel'},'Nome',h('input',{type:'text',class:'text-in',value:data.name||'',oninput:e=>{touch();set('name',e.target.value);}})),
    selectControl('Tipo de partícula',data.type,typeOpts,v=>set('type',Number(v),true)),
    L.custom?selectControl('Canal (onde nasce)',L.channel,[['actor','Personagem'],['target','Alvo'],['flight','Projétil'],['ground','Chão do alvo'],['item','Arma']],v=>{
      const e=skillRec(store,skillId()).extra.find(x=>x.key===L.key);if(e){e.channel=v;persist();structural();}}):null,
    h('p',{class:'hint',text:{1:'Nasce espalhada e cai/flutua com velocidade aleatória por eixo.',2:'Sobe em linha reta na direção `dir` com velocidade `vel`.',3:'Explosão: todas nascem juntas e se espalham com aceleração (gravidade).',4:'Repete o modelo EFF a cada `step`, crescendo/esmaecendo.',5:'Mostra o modelo EFF uma vez (com atraso e vida).',6:'Modelo EFF animado pelos keyframes.',9:'Orbita em volta do ponto de origem.',12:'Converge para o centro (efeito de carga).',13:'Plano no chão com curva de tamanho/cor.',15:'Cai em direção ao chão (meteoro).'}[data.type]||''})));
  root.append(section('Textura e mistura',true,
    isMesh?h('p',{class:'hint',text:'Este tipo usa as texturas das peças do EFF (seção "Modelo EFF" abaixo).'}):texturePicker(data.texture,v=>set('texture',v)),
    isMesh?null:blendControls(data.src,data.dst,(s,d)=>{set('src',s);set('dst',d);}),
    isMesh?null:checkControl('Billboard (sempre de frente para a câmera)',data.billboard,v=>set('billboard',v))));
  root.append(section('Emissão e tempo',true,
    numControl('Quantidade (count)',data.count,{min:1,max:200,step:1},v=>set('count',Math.round(v))),
    numControl('Vida de cada uma (s)',data.life,{min:.05,max:10,step:.05},v=>set('life',v)),
    numControl('Intervalo de emissão (s)',data.step,{min:0,max:3,step:.01},v=>set('step',v)),
    numControl('Atraso inicial (s)',data.delay,{min:0,max:5,step:.05},v=>set('delay',v)),
    numControl('Parar de emitir após (s) — 0 = sempre',data.play,{min:0,max:8,step:.05},v=>set('play',v)),
    numControl('Divisor aleatório (roadom)',data.roadom??2,{min:1,max:8,step:1},v=>set('roadom',Math.round(v)))));
  root.append(section('Movimento e posição',true,
    numControl('Velocidade (vel)',data.vel,{min:-60,max:60,step:.1},v=>set('vel',v)),
    vecControl('Direção',data.dir,{step:.1},v=>set('dir',v)),
    vecControl('Aceleração',data.accel,{step:.5},v=>set('accel',v)),
    vecControl('Alcance',data.range,{step:.1},v=>set('range',v)),
    vecControl('Deslocamento',data.offset,{step:.1},v=>set('offset',v)),
    h('p',{class:'hint',text:'Eixos D3D: X/Y horizontais, Z para cima. A aceleração Z negativa vira gravidade.'})));
  if(!isMesh||data.type===15||true){
    root.append(section('Curvas ao longo da vida',true,
      sizesEditor(data.sizes||[1],v=>set('sizes',v)),colorsEditor(data.colors||[[1,1,1,1]],v=>set('colors',v)),
      isMesh?null:anglesEditor(data.angles||[],v=>set('angles',v))));}
  if(isMesh){
    const file=data.effect||data.model;
    root.append(section('Modelo EFF ('+file+')',true,
      selectControl('Trocar modelo EFF',file,effNames.map(n=>[n,n]),v=>{set('effect',v);set('model',v,true);}),
      effEditor(L,file,{canRename:true})));}
  if(data.hitEffect)root.append(h('p',{class:'hint',text:'Efeito de impacto ligado: '+data.hitEffect+' (o jogo dispara ao terminar; a prévia não).'}));}

/* ------------------------------------------------------------ personagens */
async function tryImport(path){try{return await import(path);}catch{return null;}}
async function loadActor(){
  const current=++token,actor=$('actor').value;loading=true;status('Carregando '+actor+'...');
  try{
    const[base,extra]=await Promise.all([loader.loadAsync('assets/characters/'+actor+'.glb?v=3'),
      loader.loadAsync(assetPrefix+'animations/'+actor+'.glb?v=3').catch(()=>null)]);
    if(current!==token)return;
    if(avatar)scene.remove(avatar);if(mixer)mixer.stopAllAction();
    avatar=skeletonClone(base.scene);avatar.rotation.y=-Math.PI/2;
    avatar.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});scene.add(avatar);
    mixer=new THREE.AnimationMixer(avatar);clips=[...(base.animations||[]),...(extra?.animations||[])];
    avatar.visible=$('show-actor').checked;
  }catch(err){
    if(current!==token)return;console.warn(err);if(avatar){scene.remove(avatar);avatar=null;}clips=[];
    toast('Sem modelo 3D do personagem: a edição dos efeitos continua normal.');
  }finally{if(current===token)loading=false;}
  await pickSkill();}
function clipFor(){
  if(!currentSkill)return null;
  if(classMods.cls?.resolveSkillClip){try{const c=classMods.cls.resolveSkillClip(currentSkill,$('actor').value,clips);if(c)return c;}catch{}}
  const ids=[...(currentSkill.equippedActions||[]),...(currentSkill.baseActions||[])];
  for(const id of ids){const re=new RegExp('(^|\\D)'+id+'(\\D|$)');const c=clips.find(x=>re.test(x.name));if(c)return c;}
  return null;}
function updateActorAnimation(t){
  if(!mixer||!avatar)return;mixer.stopAllAction();
  const chosen=clipFor()||clips.find(c=>/parado|idle/i.test(c.name));if(!chosen)return;
  const a=mixer.clipAction(chosen);a.reset();a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();
  mixer.update(Math.min(t,Math.max(.01,chosen.duration-.001)));}

/* ------------------------------------------------------------- seleção */
function classSelected(){
  const job=$('job').value,sel=$('actor'),cur=sel.value;sel.replaceChildren();
  let list=classMods.hero?.CLASSES?.[job]?.characters||Object.keys(manifest.attachments||{});
  for(const a of list)sel.add(new Option(classMods.hero?.CHARACTERS?.[a]?.name||a,a));
  if(list.includes(cur))sel.value=cur;}
function skillSelected(){
  const job=$('job').value,s=$('skill'),cur=s.value;s.replaceChildren();
  for(const k of catalog.classes[job].skills)s.add(new Option(k.name+' (#'+k.id+')',String(k.id)));
  if([...s.options].some(o=>o.value===cur))s.value=cur;}
async function pickSkill(){
  const job=$('job').value,id=Number($('skill').value);
  const raw=catalog.classes[job].skills.find(s=>s.id===id);if(!raw)return;
  currentSkill=classMods.rules?.skillWithRules?.(raw)||raw;
  $('skill-name').textContent=currentSkill.name;$('skill-icon').src=assetPrefix+currentSkill.icon;
  selectedKey=null;player.solo=null;
  layers=player.setSkill(manifest,store,String(id),$('actor').value);selectedKey=layers[0]?.key||null;
  const clip=clipFor();$('stage-label').textContent=(clip?'ANIMAÇÃO '+clip.name:'SEM ANIMAÇÃO').toUpperCase();
  $('skill-meta').textContent='#'+id+' · '+layers.length+' camadas';
  redrawLayers();drawGlobals();drawLayerPanel();phase=0;preview(0);
  status(currentSkill.name+' · '+layers.length+' camadas');}

/* ------------------------------------------------------- prévia/animação */
function preview(t){
  if(!currentSkill)return;const g=globalsNow();
  phase=clamp(Number(t)||0,0,g.duration);
  const n=player.update(phase,g,enabledMap());updateActorAnimation(phase);
  $('time-range').value=String(Math.round(phase*1000));$('time-label').textContent=phase.toFixed(2)+' / '+g.duration.toFixed(2)+' s';
  $('perf').textContent=n+' objetos FX';}
function playToggle(){playing=!playing;$('play').textContent=playing?'Ⅱ Pausar':'▶ Reproduzir';}

/* ------------------------------------------------------ exportar/importar */
function download(name,blob){const href=URL.createObjectURL(blob),a=h('a',{href,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(href),1500);}
function exportMerged(){
  const out=ED.bakeMerged(manifest,store);
  download('visuals.json',new Blob([JSON.stringify(out)],{type:'application/json'}));
  toast('visuals.json editado exportado: substitua assets/skills/visuals.json');}
function exportEdits(){download('vfx-edits.json',new Blob([JSON.stringify(ED.exportEdits(store),null,2)+'\n'],{type:'application/json'}));toast('Edições exportadas');}
async function importFile(file){
  if(!file)return;
  try{const obj=JSON.parse(await file.text());
    if(!obj||obj.version!==2||typeof obj.res!=='object')throw Error('use um arquivo "vfx-edits.json" exportado por este editor');
    touch();store=normalizeStore(obj);writeStoreNow();selectedKey=null;structural();toast('Edições importadas ✓');}
  catch(e){toast('Erro de importação: '+e.message);}}
function resetSkill(){
  if(!currentSkill||!confirm('Descartar todas as edições desta skill? (arquivos compartilhados com outras skills também voltam ao original)'))return;
  touch();const id=skillId();
  for(const L of player.layers){if(L.file&&store.res[L.file])delete store.res[L.file];}
  delete store.skills[id];persist();selectedKey=null;structural();toast('Skill restaurada ao original');}

/* ------------------------------------------------------------------ eventos */
function bind(){
  $('job').onchange=()=>{classSelected();skillSelected();void loadActor();};
  $('actor').onchange=()=>void loadActor();
  $('skill').onchange=()=>{playing=false;$('play').textContent='▶ Reproduzir';void pickSkill();};
  $('play').onclick=playToggle;$('restart').onclick=()=>{phase=0;preview(0);};
  $('time-range').oninput=e=>{if(playing)playToggle();preview(Number(e.target.value)/1000);};
  $('save').onclick=()=>{writeStoreNow();toast('Edições salvas no navegador ✓ ('+ED.editedCount(store)+' alterações)');};
  $('export').onclick=exportMerged;$('export-edits').onclick=exportEdits;
  $('import').onclick=()=>$('import-file').click();
  $('import-file').onchange=e=>{void importFile(e.target.files?.[0]);e.target.value='';};
  $('undo').onclick=undo;$('redo').onclick=redo;
  $('reset-skill').onclick=resetSkill;
  $('all-on').onclick=()=>{touch();const rec=skillRec(store,skillId());rec.off={};player.solo=null;persist();redrawLayers();preview(phase);};
  $('add-layer').onclick=()=>{touch();selectedKey=ED.addExtra(store,skillId(),sel()?.channel||'actor');persist();structural();toast('Nova partícula criada: edite os campos à direita');};
  $('dup-layer').onclick=()=>{const L=sel();if(!L)return;touch();const k=ED.duplicateLayer(manifest,store,skillId(),L);
    if(!k){toast('Só dá para duplicar camadas de partículas');return;}selectedKey=k;persist();structural();};
  $('show-actor').onchange=e=>{if(avatar)avatar.visible=e.target.checked;};
  $('show-target').onchange=e=>{targetDummy.visible=e.target.checked;};
  $('camera-reset').onclick=resetCamera;
  $('snapshot').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(b=>{if(b)download('TOP_skill_'+(currentSkill?.id||0)+'.png',b);},'image/png');};
  window.addEventListener('keydown',e=>{
    const typing=e.target.closest?.('input,select,textarea');
    if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'&&!typing){e.preventDefault();e.shiftKey?redo():undo();return;}
    if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'&&!typing){e.preventDefault();redo();return;}
    if(typing)return;
    if(e.code==='Space'){e.preventDefault();playToggle();}
    if(e.code==='KeyR')preview(0);
    if(e.code==='KeyS'&&selectedKey){player.solo=player.solo===selectedKey?null:selectedKey;redrawLayers();preview(phase);}});}
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,Math.max(0,(now-lastNow)/1000));lastNow=now;
  const c=$('preview'),r=c.getBoundingClientRect(),w=Math.max(1,Math.floor(r.width)),hh=Math.max(1,Math.floor(r.height));
  if(c.width!==Math.floor(w*renderer.getPixelRatio())||c.height!==Math.floor(hh*renderer.getPixelRatio())){
    renderer.setSize(w,hh,false);camera.aspect=w/hh;camera.updateProjectionMatrix();}
  if(playing&&!loading&&currentSkill){
    const g=globalsNow();let t=phase+dt;if(t>=g.duration)t=loopPlay?0:g.duration;preview(t);}
  orbit.update();renderer.render(scene,camera);}

async function start(){
  bind();requestAnimationFrame(animate);updateUndo();
  try{
    const[cat,vis]=await Promise.all([
      fetch(assetPrefix+'catalog.json').then(r=>{if(!r.ok)throw Error('catalog.json HTTP '+r.status);return r.json();}),
      fetch(assetPrefix+'visuals.json').then(r=>{if(!r.ok)throw Error('visuals.json HTTP '+r.status);return r.json();})]);
    catalog=cat;manifest=vis;usage=ED.usageMap(manifest);
    texNames=[...new Set(Object.values(manifest.resources).flatMap(r=>[...(r.systems||[]),...(r.strips||[]),...(r.parts||[])].map(x=>x.texture).filter(Boolean)))].sort();
    effNames=Object.entries(manifest.resources).filter(([,r])=>r.kind==='eff').map(([n])=>n).sort();
    lgoNames=[...new Set(effNames.flatMap(n=>manifest.resources[n].parts.map(p=>p.model).filter(m=>/\.lgo$/i.test(m))))].sort();
    const[hero,cls,rules]=await Promise.all([tryImport('../js/hero-state.mjs'),tryImport('../js/class-skills.mjs'),tryImport('../js/skill-rules.mjs')]);
    classMods={hero,cls,rules};
    loader.loadAsync(assetPrefix+'models.glb').then(g=>{g.scene.traverse(o=>{if(o.isMesh){
      const n=(o.parent?.name&&o.parent.name!=='Scene'?o.parent.name:o.name).replace(/\.lgo$/i,'');modelsMap.set(n,o);modelsMap.set(o.name.replace(/\.lgo$/i,''),o);}});
      if(currentSkill)structural(true);}).catch(()=>{});
    const jobSel=$('job');jobSel.replaceChildren();
    for(const[id,c]of Object.entries(catalog.classes))jobSel.add(new Option(c.name,id));
    classSelected();skillSelected();await loadActor();
  }catch(err){console.error(err);status('ERRO: '+err.message);
    $('empty-warning').textContent='Servidor HTTP necessário. Abra /tests/skill-editor.html via python3 -m http.server 8000 (assets/skills/ precisa conter catalog.json e visuals.json).';$('empty-warning').hidden=false;}}
void start();
