import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createTextureRepository,parseTexturePack,textureQuality,readGlbImage} from '../js/texture-library.mjs?v=1';
import {adjustTexturePixels,textureOutputSize} from '../js/texture-pixels.mjs?v=1';

const $=id=>document.getElementById(id),repository=createTextureRepository();
const before=$('before'),after=$('after'),paint=document.createElement('canvas'),base=document.createElement('canvas');
const paintContext=paint.getContext('2d'),undo=[],redo=[],buffers=new Map(),drafts=new Map();
let catalog,entries=[],selected=null,original=null,working=null,loaded=0,dirty=false,renderTimer,pointer=null,groundPending=false;
let saved=new Map(),quality=textureQuality(),comparisonImage=null,legacyAtlas=null,comparisonRevision=0,searchTimer;
const status=message=>$('status').textContent=message;
for(const anchor of document.querySelectorAll('.mobile-jumps a'))anchor.href=location.pathname+location.search+anchor.hash;
const label=entry=>entry.id.startsWith('terrain:')?(entry.name.startsWith('grass')?'Grama · ':entry.name.startsWith('dirt')||entry.name.startsWith('drit')?'Terra · ':entry.name.startsWith('sand')?'Areia · ':entry.name.startsWith('snow')?'Neve · ':'')+entry.name:
  entry.asset.split('/').at(-1).replace('.glb','')+' / '+entry.name;
const loadImage=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Não foi possível abrir a imagem.'));image.src=url;});
function imageFromBlob(blob){const url=URL.createObjectURL(blob);return loadImage(url).finally(()=>URL.revokeObjectURL(url));}
async function response(url){const res=await fetch(url);if(!res.ok)throw Error('Arquivo indisponível: '+url);return res;}
async function originalImage(entry){
  if(entry.image===undefined)return loadImage(new URL(entry.asset,document.baseURI).href);
  if(!buffers.has(entry.asset)){
    if(buffers.size>=2)buffers.delete(buffers.keys().next().value);
    const request=response(entry.asset).then(r=>r.arrayBuffer()).catch(error=>{buffers.delete(entry.asset);throw error;});buffers.set(entry.asset,request);
  }
  return imageFromBlob(readGlbImage(await buffers.get(entry.asset),entry.image));
}
function diagnostic(){
  $('source-name').textContent=selected.name;$('source-info').replaceChildren();
  for(const [title,text] of [
    ['Resolução original',`${selected.width} × ${selected.height} px`],
    ['Formato / tamanho',`${selected.mime.replace('image/','').toUpperCase()} · ${(selected.bytes/1024).toFixed(1)} KB`],
    ['Origem',selected.id.startsWith('terrain:')?`Terreno ${selected.tile} · cliente histórico (${selected.sourceFormat})`:selected.asset],
    ['Edição salva',saved.has(selected.id)?'Sim, neste navegador':'Não']
  ]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=title;dd.textContent=text;$('source-info').append(dt,dd);}
  $('diagnosis').textContent=selected.id.startsWith('terrain:')?
    `A imagem original tem ${selected.width} px de largura. No atlas padrão, cada repetição cobre 4 m com 252 pixels úteis (63 px/m). O modo HD preserva até 504 pixels úteis de uma imagem nova. O arquivo JPEG anterior acrescentava compressão. A repetição distorcida foi corrigida. Use Menu → Editor de terreno e vegetação para suavizar as bordas entre solos, pintar o mapa e plantar grama alta.`:
    `Esta imagem ${Math.max(selected.width,selected.height)<=256?'tem resolução pequena':'é compartilhada pelo material do modelo'}. Aumentar a resolução sem acrescentar detalhes apenas amplia os pixels. Importe uma imagem melhor ou use o pincel; a aplicação preserva os encaixes da textura e a transparência.`;
}
function resetAdjustments(){for(const id of ['brightness','contrast','saturation'])$(id).value='1';$('sharpness').value='0';}
function rememberPaint(){undo.push(paintContext.getImageData(0,0,paint.width,paint.height));if(undo.length>6)undo.shift();redo.length=0;historyButtons();}
function historyButtons(){$('undo').disabled=!undo.length;$('redo').disabled=!redo.length;}
function clearPaint(){paintContext.clearRect(0,0,paint.width,paint.height);undo.length=redo.length=0;historyButtons();}
function outputSize(){return textureOutputSize(working.width,working.height,Number($('resolution').value));}
function resizeEditing(){
  const size=outputSize();if(after.width===size.width&&after.height===size.height)return;
  const previous=document.createElement('canvas');previous.width=paint.width;previous.height=paint.height;previous.getContext('2d').drawImage(paint,0,0);
  for(const canvas of [before,after,paint,base]){canvas.width=size.width;canvas.height=size.height;}
  if(previous.width&&previous.height)paintContext.drawImage(previous,0,0,paint.width,paint.height);
  undo.length=redo.length=0;historyButtons();
}
function zoom(){
  for(const canvas of [before,after]){
    const host=canvas.parentElement,scale=Math.min(host.clientWidth/canvas.width,host.clientHeight/canvas.height);
    canvas.style.width=canvas.width*($('zoom').value==='fit'?scale:Number($('zoom').value))+'px';
    canvas.style.imageRendering=$('pixels').checked?'pixelated':'auto';
  }
}
function composite(){
  const ctx=after.getContext('2d');ctx.clearRect(0,0,after.width,after.height);ctx.drawImage(base,0,0);ctx.drawImage(paint,0,0);updateGround();
}
function render(){
  if(!working||!original)return;
  clearTimeout(renderTimer);resizeEditing();
  const context=base.getContext('2d',{willReadFrequently:true});context.clearRect(0,0,base.width,base.height);context.drawImage(working,0,0,base.width,base.height);
  const settings={};for(const id of ['brightness','contrast','saturation','sharpness']){settings[id]=Number($(id).value);$(id+'-value').value=settings[id].toFixed(2);}
  context.putImageData(adjustTexturePixels(context.getImageData(0,0,base.width,base.height),settings),0,0);
  const reference=comparisonImage||original,beforeContext=before.getContext('2d');beforeContext.clearRect(0,0,before.width,before.height);beforeContext.drawImage(reference,0,0,before.width,before.height);
  $('original-size').textContent=`${reference.width} × ${reference.height}`;$('edited-size').textContent=`${after.width} × ${after.height}`;
  $('dimensions').textContent=`${after.width} × ${after.height} px`;zoom();composite();
}
function changed(){dirty=true;status('Prévia atualizada. Salve no jogo ou baixe a edição PNG.');clearTimeout(renderTimer);renderTimer=setTimeout(render,100);}
async function selectTexture(){
  const entry=entries.find(e=>e.id===$('texture').value);if(!entry)return;
  if(dirty&&working&&selected){render();drafts.set(selected.id,after.toDataURL('image/png'));}
  const version=++loaded;selected=entry;working=null;dirty=false;$('edit-controls').disabled=true;$('save').disabled=$('save-mobile').disabled=true;$('download-original').disabled=true;
  $('title').textContent=label(entry);status('Abrindo imagem original…');
  try{
    const source=await originalImage(entry),data=drafts.get(entry.id)||saved.get(entry.id)?.data,image=data?await loadImage(data):source;
    if(version!==loaded)return;
    original=source;comparisonImage=null;working=image;dirty=drafts.has(entry.id);$('resolution').value='0';resetAdjustments();clearPaint();render();diagnostic();
    $('baseline').disabled=!entry.id.startsWith('terrain:');void compareSource();
    $('edit-controls').disabled=false;$('save').disabled=$('save-mobile').disabled=false;$('download-original').disabled=false;status(dirty?'Rascunho recuperado. Salve para aplicar no jogo.':'Original preservado. Ajuste os detalhes e compare os dois lados.');
  }catch(error){if(version===loaded)status(error.message);}
}
async function compareSource(){
  const version=loaded,comparison=++comparisonRevision;comparisonImage=null;$('baseline-label').textContent='ORIGINAL';
  if(selected?.id.startsWith('terrain:')&&$('baseline').value==='jpeg'){
    try{legacyAtlas??=loadImage(new URL('assets/terrain_atlas.jpg',document.baseURI).href);const image=await legacyAtlas;if(version!==loaded||comparison!==comparisonRevision)return;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=252;
      canvas.getContext('2d').drawImage(image,selected.tile%8*256+2,Math.floor(selected.tile/8)*256+2,252,252,0,0,252,252);
      comparisonImage=canvas;$('baseline-label').textContent='JPEG ANTERIOR';
    }catch(error){status(error.message);}
  }
  render();
}
function filterLibrary(){
  const query=$('search').value.trim().toLocaleLowerCase('pt-BR'),previous=$('texture').value;
  const visible=entries.filter(entry=>entry.category===$('category').value&&(`${label(entry)} ${entry.asset}`).toLocaleLowerCase('pt-BR').includes(query));
  $('texture').replaceChildren();for(const entry of visible){const option=document.createElement('option');option.value=entry.id;option.textContent=label(entry);$('texture').append(option);}
  $('count').textContent=`${visible.length} texturas nesta seleção · ${entries.length} na biblioteca`;
  if(visible.some(entry=>entry.id===previous))$('texture').value=previous;
  else if($('category').value==='Terreno'&&!query&&visible.some(e=>e.id==='terrain:9'))$('texture').value='terrain:9';
  else if(visible.length)$('texture').value=visible[0].id;
  else status('Nenhuma textura encontrada. Tente outro nome; a edição aberta permanece disponível.');
  if(visible.length&&$('texture').value!==selected?.id)void selectTexture();
}
function download(blob,name){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function png(canvas,name){canvas.toBlob(blob=>{if(blob)download(blob,name);else status('Não foi possível exportar o PNG.');},'image/png');}
function filename(){return (selected?.name||'textura').replace(/\.[^.]+$/,'').replace(/[^\w-]/g,'_');}
function qualityFields(){
  $('atlas-quality').value=quality.atlas;$('cell-size').value=String(quality.cellSize);$('game-filter').value=quality.filter;$('anisotropy').value=String(quality.anisotropy);memory();
}
function currentQuality(){return textureQuality({atlas:$('atlas-quality').value,cellSize:Number($('cell-size').value),filter:$('game-filter').value,anisotropy:Number($('anisotropy').value)});}
function memory(){const size=Number($('cell-size').value)*8,bytes=size*size*4*4/3;$('memory').textContent=`Atlas ${size} × ${size} · cerca de ${(bytes/1048576).toFixed(0)} MB na GPU com mipmaps. O modo HD é útil para texturas novas com mais detalhes.`;}
async function save(){
  if(!working)return;render();const version=loaded;quality=currentQuality();$('save').disabled=$('save-mobile').disabled=true;
  try{const row=await repository.put({id:selected.id,data:after.toDataURL('image/png'),width:after.width,height:after.height});
    saved.set(row.id,row);drafts.delete(row.id);await repository.quality(quality);if(version!==loaded)return;dirty=false;diagnostic();
    status('Salvo! O jogo aberto neste mesmo endereço aplica a textura. Exporte um pacote para levar a edição para outro dispositivo.');
  }catch(error){status(error.message||'Sem espaço para salvar. Baixe o PNG para guardar sua edição.');}finally{if(version===loaded)$('save').disabled=$('save-mobile').disabled=!working;}
}
const renderer=new THREE.WebGLRenderer({canvas:$('ground'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#172019');scene.add(new THREE.HemisphereLight(0xffffff,0x777777,2));
const sun=new THREE.DirectionalLight(0xffffff,1.2);sun.position.set(4,8,3);scene.add(sun);
const camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(6,6,7);
const controls=new OrbitControls(camera,$('ground'));controls.minDistance=3;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.48;controls.target.set(0,0,0);controls.update();
const groundTexture=new THREE.CanvasTexture(after);groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshLambertMaterial({map:groundTexture,side:THREE.DoubleSide}));ground.rotation.x=-Math.PI/2;scene.add(ground);
function drawGround(){const canvas=$('ground'),w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);
}
function updateGround(){if(groundPending)return;groundPending=true;requestAnimationFrame(()=>{
  groundPending=false;groundTexture.needsUpdate=true;groundTexture.repeat.setScalar(Number($('repeat').value));groundTexture.magFilter=$('pixels').checked?THREE.NearestFilter:THREE.LinearFilter;
  groundTexture.anisotropy=Math.min(Number($('anisotropy').value),renderer.capabilities.getMaxAnisotropy());drawGround();
});}
controls.addEventListener('change',drawGround);new ResizeObserver(drawGround).observe($('ground'));
new ResizeObserver(zoom).observe(before.parentElement);new ResizeObserver(zoom).observe(after.parentElement);

function paintPoint(event){const rect=after.getBoundingClientRect();return {x:(event.clientX-rect.left)*after.width/rect.width,y:(event.clientY-rect.top)*after.height/rect.height};}
function stroke(point){
  paintContext.globalCompositeOperation=$('tool').value==='erase'?'destination-out':'source-over';paintContext.globalAlpha=Number($('opacity').value);
  paintContext.lineCap=paintContext.lineJoin='round';paintContext.strokeStyle=$('paint-color').value;paintContext.lineWidth=Math.max(1,Math.min(120,Number($('brush-size').value)||12));
  paintContext.beginPath();paintContext.moveTo(pointer.x,pointer.y);paintContext.lineTo(point.x+.001,point.y+.001);paintContext.stroke();
  paintContext.globalAlpha=1;paintContext.globalCompositeOperation='source-over';pointer={...point,id:pointer.id};dirty=true;composite();
}
after.addEventListener('pointerdown',event=>{
  if($('tool').value==='inspect'||!working||event.button!==0)return;
  event.preventDefault();rememberPaint();pointer={...paintPoint(event),id:event.pointerId};after.setPointerCapture(event.pointerId);stroke(pointer);
});
after.addEventListener('pointermove',event=>{if(pointer?.id===event.pointerId)stroke(paintPoint(event));});
for(const event of ['pointerup','pointercancel','lostpointercapture'])after.addEventListener(event,()=>{pointer=null;});
$('tool').addEventListener('change',()=>{after.style.touchAction=$('tool').value==='inspect'?'auto':'none';after.style.cursor=$('tool').value==='inspect'?'default':'crosshair';});
for(const [name,from,to] of [['undo',undo,redo],['redo',redo,undo]])$(name).addEventListener('click',()=>{
  if(!from.length)return;to.push(paintContext.getImageData(0,0,paint.width,paint.height));paintContext.putImageData(from.pop(),0,0);dirty=true;historyButtons();composite();
});
$('opacity').addEventListener('input',()=>$('opacity-value').value=Number($('opacity').value).toFixed(2));
for(const id of ['brightness','contrast','saturation','sharpness'])$(id).addEventListener('input',changed);
$('resolution').addEventListener('change',changed);$('zoom').addEventListener('change',zoom);$('pixels').addEventListener('change',()=>{zoom();updateGround();});$('repeat').addEventListener('change',updateGround);
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(filterLibrary,180);});
$('category').addEventListener('change',()=>{$('search').value='';clearTimeout(searchTimer);filterLibrary();});$('texture').addEventListener('change',()=>void selectTexture());
$('baseline').addEventListener('change',()=>void compareSource());
$('save').addEventListener('click',()=>void save());
$('save-mobile').addEventListener('click',()=>void save());
$('detail-preset').addEventListener('click',()=>{$('brightness').value='1.03';$('contrast').value='1.12';$('saturation').value='1.08';$('sharpness').value='.4';changed();});
$('reset-adjustments').addEventListener('click',()=>{resetAdjustments();changed();});
$('upload').addEventListener('change',async()=>{
  const file=$('upload').files[0],version=loaded;if(!file)return;
  try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>24*1024*1024)throw Error('Use um PNG, JPG ou WebP de até 24 MB.');
    const image=await imageFromBlob(file);if(version!==loaded)return;if(image.width*image.height>4096*4096)throw Error('Importe uma imagem com até 16 milhões de pixels.');
    working=image;clearPaint();resetAdjustments();$('resolution').value='0';changed();
  }catch(error){status(error.message);}finally{$('upload').value='';}
});
$('download-original').addEventListener('click',()=>{if(!original)return;const canvas=document.createElement('canvas');canvas.width=original.width;canvas.height=original.height;canvas.getContext('2d').drawImage(original,0,0);png(canvas,filename()+'-original.png');});
$('download-edited').addEventListener('click',()=>{render();png(after,filename()+'-editada.png');});
$('restore').addEventListener('click',async()=>{
  if(!selected)return;const id=selected.id,version=loaded;try{await repository.remove(id);saved.delete(id);drafts.delete(id);if(version!==loaded)return;working=original;$('resolution').value='0';resetAdjustments();clearPaint();dirty=false;render();diagnostic();status('Textura original restaurada neste navegador e no jogo aberto.');}catch(error){status(error.message);}
});
$('cell-size').addEventListener('change',memory);$('anisotropy').addEventListener('change',updateGround);
$('save-quality').addEventListener('click',async()=>{try{quality=currentQuality();await repository.quality(quality);status('Qualidade aplicada ao jogo neste navegador.');}catch(error){status(error.message);}});
$('export-pack').addEventListener('click',async()=>{
  try{const rows=await repository.list(),pack=parseTexturePack({version:1,entries:rows.filter(row=>row.id!=='@quality'),quality:rows.find(row=>row.id==='@quality')?.quality??currentQuality()});
    download(new Blob([JSON.stringify(pack)],{type:'application/json'}),'topweb-texturas.json');status('Pacote exportado com as texturas salvas. Edições ainda não salvas ficam fora do pacote.');
  }catch(error){status(error.message);}
});
$('import-pack').addEventListener('click',()=>$('pack-file').click());
$('pack-file').addEventListener('change',async()=>{
  const file=$('pack-file').files[0];if(!file)return;
  try{if(file.size>100*1024*1024)throw Error('Pacote grande demais.');const pack=await repository.import(await file.text());
    const rows=await repository.list();saved=new Map(rows.filter(row=>row.id!=='@quality').map(row=>[row.id,row]));drafts.clear();dirty=false;quality=pack.quality;qualityFields();await selectTexture();status('Pacote importado. O jogo aberto neste endereço recebe as texturas.');
  }catch(error){status(error.message);}finally{$('pack-file').value='';}
});
async function init(){
  try{
    catalog=await (await response('assets/textures/catalog.json?v=2')).json();entries=[...catalog.terrain,...catalog.textures];
    try{const rows=await repository.list();saved=new Map(rows.filter(row=>row.id!=='@quality').map(row=>[row.id,row]));quality=textureQuality(rows.find(row=>row.id==='@quality')?.quality);}catch(error){status(error.message);}
    $('category').replaceChildren();for(const category of [...new Set(entries.map(e=>e.category))]){const option=document.createElement('option');option.textContent=category;$('category').append(option);}
    qualityFields();filterLibrary();
    const terrain=new URLSearchParams(location.search).get('terrain');
    if(terrain&&entries.some(entry=>entry.id==='terrain:'+terrain)){$('texture').value='terrain:'+terrain;void selectTexture();}
  }catch(error){status('Não foi possível abrir a biblioteca: '+error.message);}
}
void init();
