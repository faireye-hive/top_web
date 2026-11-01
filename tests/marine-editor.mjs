import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createStreamedWorld} from '../js/streamed-world.mjs';
import {DEFAULT_MARINE_DESIGN,readMarineDesign,saveMarineDesign,normalizeMarineDesign,paintTerrain,editedTile} from '../js/marine-design.mjs?v=2';
import {createSeaMaterial,decorateBoat,createBoatEffects,waveHeight} from '../js/marine-visuals.mjs?v=2';
import {mapView,projectMap,unprojectMap,mapTileColor} from '../js/navigation-map.mjs';
import {sailableAt,landableAt,ARGENT_HARBOR} from '../js/sea-navigation.mjs';
const $=id=>document.getElementById(id),status=text=>{$('status').textContent=text;};
let design=readMarineDesign(),world=null,overview=null,catalog=null,boat=null,decoration=null,profile=null;
let previewRevision=0,previewTime=0,tab='boat',center={...ARGENT_HARBOR},span=128;
let dirty=false,undo=[],redo=[],stroke=null,drag=null,mapRevision=0;
const tileAt=(x,z)=>editedTile(world?.tileAt(x,z),x,z,design);
const renderer=new THREE.WebGLRenderer({canvas:$('boat-preview'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#7caec4');scene.fog=new THREE.Fog('#7caec4',90,200);
scene.add(new THREE.HemisphereLight(0xdff4ff,0x3b5a67,2));const sun=new THREE.DirectionalLight(0xffedcc,2.2);sun.position.set(-20,40,10);scene.add(sun);
const camera=new THREE.PerspectiveCamera(48,1,.1,500);camera.position.set(20,17,24);
const controls=new OrbitControls(camera,$('boat-preview'));controls.enableDamping=true;controls.target.set(0,4,0);controls.minDistance=9;controls.maxDistance=70;controls.maxPolarAngle=Math.PI*.48;
const waterMaterial=createSeaMaterial(THREE,design.water),waterGeo=new THREE.PlaneGeometry(240,240,80,80);waterGeo.rotateX(-Math.PI/2);
waterGeo.setAttribute('aShore',new THREE.Float32BufferAttribute(new Float32Array(waterGeo.attributes.position.count).fill(1),1));
const water=new THREE.Mesh(waterGeo,waterMaterial);scene.add(water);const effects=createBoatEffects(THREE,scene);
let previousZ=0;
function resize(){const rect=$('boat-preview').getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe($('boat-preview'));
function dispose(object){const geometries=new Set(),materials=new Set();object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose();});}
async function rebuildBoat(){
  if(!catalog)return;const revision=++previewRevision;
  try{
    const selected=catalog.boats.find(b=>b.slug===design.boat.hull)||catalog.boats[0];
    const loaded=(await new GLTFLoader().loadAsync(selected.model)).scene;
    if(revision!==previewRevision){dispose(loaded);return;}
    if(boat){scene.remove(boat);dispose(boat);}boat=loaded;profile=selected;decoration=decorateBoat(THREE,boat,design.boat);scene.add(boat);effects.reset();
    $('boat-summary').textContent=`${selected.name} · ${(selected.length*design.boat.scale).toFixed(1)} m de comprimento`;
  }catch(error){status('Não foi possível carregar o casco: '+error.message);}
}
function syncControls(){
  for(const [id,key] of [['boat-hull','hull'],['boat-scale','scale'],['boat-speed','speed'],['boat-color','color'],['sail-color','sailColor'],['boat-wake','wake'],['boat-bob','bob']])$(id).value=design.boat[key];
  $('boat-sails').checked=design.boat.sails;$('water-waves').value=design.water.waves;$('water-sparkle').value=design.water.sparkle;
  $('boat-scale-value').textContent=design.boat.scale.toFixed(2)+'×';
}
function changed(){dirty=true;status('Alterações na prévia. Use “Salvar no jogo” para aplicar.');}
let rebuildTimer=null;
for(const [id,key] of [['boat-hull','hull'],['boat-scale','scale'],['boat-speed','speed'],['boat-color','color'],['sail-color','sailColor'],['boat-wake','wake'],['boat-bob','bob']])$(id).addEventListener('input',()=>{
  design.boat[key]=['hull','color','sailColor'].includes(key)?$(id).value:Number($(id).value);changed();syncControls();
  if(['hull','scale','color','sailColor'].includes(key)){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(rebuildBoat,120);}
});
$('boat-sails').addEventListener('change',()=>{design.boat.sails=$('boat-sails').checked;changed();void rebuildBoat();});
for(const [id,key] of [['water-waves','waves'],['water-sparkle','sparkle']])$(id).addEventListener('input',()=>{design.water[key]=Number($(id).value);changed();});
$('boat-reset').onclick=()=>{design.boat=structuredClone(DEFAULT_MARINE_DESIGN.boat);design.water=structuredClone(DEFAULT_MARINE_DESIGN.water);syncControls();changed();void rebuildBoat();};
function save(){try{design=saveMarineDesign(design);dirty=false;status('Projeto salvo. Reabra o jogo para usar seu barco, mar e terreno.');return true;}catch(error){status('Não foi possível salvar: '+error.message+'. Você pode exportar o projeto.');return false;}}
$('save').onclick=save;
$('export').onclick=()=>{try{const validated=normalizeMarineDesign(design),url=URL.createObjectURL(new Blob([JSON.stringify(validated,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='marina-garner.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Projeto exportado.');}catch(error){status(error.message);}};
$('import').onclick=()=>$('file').click();
$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>8*1024*1024)throw Error('Arquivo muito grande');const next=normalizeMarineDesign(JSON.parse(await file.text()));design=next;undo=[];redo=[];syncControls();changed();void rebuildBoat();drawMap();}catch(error){status('Importação recusada: '+error.message);}finally{$('file').value='';}};
function switchTab(next){tab=next;$('boat-panel').hidden=next!=='boat';$('map-panel').hidden=next!=='map';for(const name of ['boat','map'])$('tab-'+name).setAttribute('aria-selected',String(name===next));if(next==='boat')resize();else void refreshMap();}
$('tab-boat').onclick=()=>switchTab('boat');$('tab-map').onclick=()=>switchTab('map');
const view=()=>mapView(world,center,span);
async function refreshMap(){
  if(!world)return;const revision=++mapRevision;drawMap();
  if(span<=512){try{await world.focus(center.x,center.z,Math.min(270,span/2+24));if(revision===mapRevision)drawMap();}catch(error){status('Terreno indisponível: '+error.message);}}
}
function drawMap(){
  if(!world||!overview)return;const canvas=$('terrain-preview'),ctx=canvas.getContext('2d'),v=view(),size=canvas.width,ratio=overview.width/world.w;
  ctx.imageSmoothingEnabled=false;ctx.drawImage(overview,(v.x-world.ox)*ratio,(v.z-world.oz)*ratio,v.w*ratio,v.h*ratio,0,0,size,size);
  if(span<=512){
    const res=Math.min(512,Math.ceil(v.w)),temp=document.createElement('canvas');temp.width=temp.height=res;const tc=temp.getContext('2d'),img=tc.createImageData(res,res);
    for(let z=0;z<res;z++)for(let x=0;x<res;x++){
      const t=tileAt(v.x+(x+.5)/res*v.w,v.z+(z+.5)/res*v.h),color=mapTileColor(t),at=(z*res+x)*4;
      if(t?.blocks===15){color[0]=Math.min(240,color[0]+55);color[1]=Math.round(color[1]*.6);}
      img.data[at]=color[0];img.data[at+1]=color[1];img.data[at+2]=color[2];img.data[at+3]=255;
    }
    tc.putImageData(img,0,0);ctx.drawImage(temp,0,0,size,size);
  }
  const port=projectMap(ARGENT_HARBOR,v,size);ctx.fillStyle='#ffdb8f';ctx.beginPath();ctx.arc(port.x,port.y,7,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#fff2be';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(size/2-12,size/2);ctx.lineTo(size/2+12,size/2);ctx.moveTo(size/2,size/2-12);ctx.lineTo(size/2,size/2+12);ctx.stroke();
  $('edit-count').textContent=`${Object.keys(design.tiles).length.toLocaleString('pt-BR')} tiles editados · vista de ${Math.round(v.w)} m`;
  $('undo').disabled=undo.length===0;$('redo').disabled=redo.length===0;
  const t=tileAt(center.x,center.z);$('tile-info').textContent=`Centro: ${Math.floor(center.x)}, ${Math.floor(center.z)}${t?' · '+t.height.toFixed(1)+' m · '+((t.region&9)?'terra':'água'):span>512?' · aproxime para editar':' · carregando terreno'}`;
}
function changeHistory(from,to){if(!from.length)return;const patch=from.pop(),opposite={};for(const [key,tile] of Object.entries(patch)){opposite[key]=design.tiles[key]?{...design.tiles[key]}:null;if(tile===null)delete design.tiles[key];else design.tiles[key]={...tile};}to.push(opposite);changed();drawMap();}
$('undo').onclick=()=>changeHistory(undo,redo);$('redo').onclick=()=>changeHistory(redo,undo);
$('map-clear').onclick=()=>{if(!Object.keys(design.tiles).length)return;undo.push(structuredClone(design.tiles));for(const key of Object.keys(design.tiles))undo.at(-1)[key]=structuredClone(design.tiles[key]);design.tiles={};redo=[];changed();drawMap();};
function zoom(factor){span=Math.max(32,Math.min(4096,span*factor));void refreshMap();}
$('map-less').onclick=()=>zoom(2);$('map-more').onclick=()=>zoom(.5);$('map-all').onclick=()=>{center={x:2048,z:2048};span=4096;void refreshMap();};$('map-port').onclick=()=>{center={...ARGENT_HARBOR};span=128;void refreshMap();};
const canvas=$('terrain-preview');
function point(event){const r=canvas.getBoundingClientRect();return unprojectMap((event.clientX-r.left)/r.width*768,(event.clientY-r.top)/r.height*768,view(),768);}
function paint(event){
  if(span>512){status('Aproxime o mapa para pintar o terreno.');return;}
  const p=point(event),r=Number($('brush-radius').value);
  if(!world.hasArea(p.x,p.z,r+1)){status('Aguarde o carregamento do terreno antes de pintar.');return;}
  const before=paintTerrain(design,p.x,p.z,r,$('map-tool').value,Number($('brush-height').value));
  for(const [key,tile] of Object.entries(before))if(!(key in stroke))stroke[key]=tile;
  changed();drawMap();
}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);if($('map-tool').value==='pan'){drag={x:e.clientX,y:e.clientY,center:{...center}};}else{stroke={};paint(e);}});
canvas.addEventListener('pointermove',e=>{if(drag){const r=canvas.getBoundingClientRect();center={x:Math.max(0,Math.min(4095,drag.center.x-(e.clientX-drag.x)/r.width*span)),z:Math.max(0,Math.min(4095,drag.center.z-(e.clientY-drag.y)/r.height*span))};drawMap();}else if(stroke)paint(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{if(stroke&&Object.keys(stroke).length){undo.push(stroke);if(undo.length>30)undo.shift();redo=[];}stroke=null;if(drag){drag=null;void refreshMap();}drawMap();});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.25:.8);},{passive:false});
$('test-location').onclick=()=>{
  if(!world||span>512){status('Aproxime e carregue o ponto que deseja testar.');return;}
  const hull=catalog.boats.find(b=>b.slug===design.boat.hull),sea=sailableAt(tileAt,center.x,center.z,hull.radius*design.boat.scale);
  if(!sea&&!landableAt(tileAt,center.x,center.z)){status('O centro precisa ter terra livre ou água com espaço para o casco. Mova o mapa para escolher outro ponto.');return;}
  if(save())window.open(`index.html?spawn=${center.x.toFixed(1)},${center.z.toFixed(1)}&boat=${sea?1:0}`,'_blank','noopener');
};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
syncControls();
const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const dt=Math.min(.05,clock.getDelta());if(tab!=='boat')return;previewTime+=dt;waterMaterial.uniforms.uTime.value=previewTime;waterMaterial.uniforms.uWaves.value=design.water.waves;waterMaterial.uniforms.uSparkle.value=design.water.sparkle;
  if(boat){const z=-(previewTime*design.boat.speed)%60,delta=z-previousZ;previousZ=z;boat.position.set(0,-.1+waveHeight(0,z,previewTime,design.water.waves)*design.boat.bob,z);boat.rotation.z=Math.sin(previewTime*.9)*.025*design.boat.bob;boat.rotation.x=Math.sin(previewTime*1.15)*.014*design.boat.bob;decoration?.update(previewTime);water.position.z=z;camera.position.z+=delta;controls.target.z+=delta;effects.update(dt,boat.position,0,true,design.boat,profile.length);}
  controls.update();renderer.render(scene,camera);
}
animate();
try{
  catalog=await fetch('assets/boats/manifest.json?v=2').then(r=>{if(!r.ok)throw Error('Barcos indisponíveis');return r.json();});await rebuildBoat();
  world=await createStreamedWorld();overview=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=world.manifest.overview;});await refreshMap();status('Pronto. Ajuste o barco ou abra o editor de mapa.');
}catch(error){status('Falha no carregamento: '+error.message);console.error(error);}
