import {DEFAULT_TERRAIN_DESIGN,TERRAIN_DESIGN_KEY,normalizeTerrainDesign,brushTiles,paintTerrainDesign,restoreTerrainPatch} from './terrain-design.mjs';

export function createTerrainEditor({canvas,design:initial,apply,tileAt,pick,onOpen=()=>{},onHover=()=>{},canEdit=()=>true}){
  let design=initial,open=false,stroke=null,dirty=false,rebuild=null,pendingBounds=null,history=[],future=[];
  const panel=document.createElement('aside');panel.id='terrain-editor';panel.hidden=true;panel.setAttribute('aria-label','Editor de terreno e vegetação');
  panel.innerHTML=`<header><div><small>ATELIÊ DO MUNDO</small><h2>Terreno e vegetação</h2></div><button type="button" id="terrain-close" aria-label="Fechar editor">×</button></header>
  <p>Pinte no cenário para integrar o chão aos objetos. Botão direito gira; roda aproxima. No toque, desative o pincel para girar.</p>
  <label class="terrain-enable"><input type="checkbox" id="terrain-paint" checked> Pincel ativo</label>
  <label for="terrain-tool">Ferramenta<select id="terrain-tool"><option value="texture">Pintar chão</option><option value="grass">Plantar grama alta</option><option value="erase-grass">Remover grama</option><option value="restore">Restaurar área original</option><option value="pick">Conta-gotas de chão</option></select></label>
  <label for="terrain-texture">Textura do chão<select id="terrain-texture"></select></label>
  <label for="terrain-radius">Raio do pincel <output id="terrain-radius-value">1 m</output><input id="terrain-radius" type="range" min="0" max="8" step="1" value="1"></label>
  <label for="terrain-blend">Suavidade das bordas <output id="terrain-blend-value"></output><input id="terrain-blend" type="range" min="0" max="0.48" step="0.01"></label>
  <p class="terrain-note">Mistura grama, terra, areia e outros solos naturais. Preserva as bordas de calçadas e pisos.</p>
  <fieldset><legend>Grama alta · próximo traço</legend>
    <label for="terrain-height">Altura <output id="terrain-height-value">0,45 m</output><input id="terrain-height" type="range" min="0.1" max="1.2" step="0.05" value="0.45"></label>
    <label for="terrain-density">Densidade <output id="terrain-density-value">60%</output><input id="terrain-density" type="range" min="0.1" max="1" step="0.1" value="0.6"></label>
    <label for="terrain-color">Cor <input id="terrain-color" type="color" value="#648940"></label>
  </fieldset>
  <div class="terrain-actions"><button id="terrain-undo" type="button">Desfazer</button><button id="terrain-redo" type="button">Refazer</button></div>
  <div class="terrain-actions"><button id="terrain-save" type="button">Salvar no navegador</button><button id="terrain-export" type="button">Exportar projeto</button></div>
  <div class="terrain-actions"><label class="terrain-file">Importar projeto<input id="terrain-import" type="file" accept="application/json,.json"></label><button id="terrain-original" type="button">Prévia original</button></div>
  <p id="terrain-status" role="status" aria-live="polite">Prévia no cenário real. Exporte o projeto para guardar uma cópia.</p>`;
  document.body.append(panel);
  const $=id=>panel.querySelector('#terrain-'+id),status=message=>{$('status').textContent=message;};
  // Build the selector without interpolating catalog text into HTML.
  const names={2:'Pedra · brick01',3:'Pedra · brick04',4:'Pedra · brick05',5:'Grama · grass05',6:'Grama · grass11',7:'Grama · grass04',8:'Grama · grass02',9:'Grama · grass01',10:'Grama · grass03',12:'Grama · grass07',14:'Areia · sand03',15:'Areia · sand02',16:'Areia · sand01',17:'Terra · dirt03',18:'Terra · dirt04',19:'Terra · dirt05',30:'Grama · grass10',33:'Grama · grass09'};
  for(let id=1;id<=49;id++){const option=document.createElement('option');option.value=id;option.textContent=`${id} · ${names[id]||'Solo histórico'}`;$('texture').append(option);}$('texture').value='9';
  fetch('assets/textures/catalog.json').then(response=>response.json()).then(catalog=>{for(const entry of catalog.terrain||[]){const option=$('texture').querySelector(`option[value="${entry.tile}"]`);if(option)option.textContent=`${entry.tile} · ${entry.name}`;}}).catch(()=>{});
  function sync(){
    $('blend').value=design.blend;$('blend-value').value=design.blend===0?'Borda seca':design.blend.toFixed(2)+' m';
    $('undo').disabled=!history.length;$('redo').disabled=!future.length;
  }
  function flush(){if(rebuild!==null)cancelAnimationFrame(rebuild);rebuild=null;apply(design,pendingBounds);pendingBounds=null;}
  function changed(bounds=null){
    dirty=true;
    // Merge affected squares, including the neighboring transition texels.
    if(!bounds)pendingBounds=null;
    else if(rebuild===null)pendingBounds={...bounds};
    else if(pendingBounds){pendingBounds.x0=Math.min(pendingBounds.x0,bounds.x0);pendingBounds.z0=Math.min(pendingBounds.z0,bounds.z0);pendingBounds.x1=Math.max(pendingBounds.x1,bounds.x1);pendingBounds.z1=Math.max(pendingBounds.z1,bounds.z1);}
    if(rebuild===null)rebuild=requestAnimationFrame(flush);
    sync();status('Prévia alterada · salve no navegador ou exporte para guardar.');
  }
  function remember(previous){history.push(previous);if(history.length>40)history.shift();future=[];sync();}
  function historyStep(from,to){
    finish();const previous=from.pop();if(!previous)return;
    to.push(structuredClone(design));design=previous;changed();
  }
  function finish(){
    if(!stroke)return;
    const previous=structuredClone(design);restoreTerrainPatch(previous,stroke.before);
    if(Object.keys(stroke.before).length)remember(previous);
    stroke=null;sync();
  }
  function dab(event){
    const point=pick(event.clientX,event.clientY);if(!point)return;
    const x=Math.floor(point.x),z=Math.floor(point.z),key=`${x}/${z}`,base=tileAt(x,z);
    if(!base)return;
    if($('tool').value==='pick'){$('texture').value=String(base.tex);status(`Solo ${base.tex} · ${x}, ${z}`);return;}
    if(stroke.visited.has(key))return;stroke.visited.add(key);
    const points=brushTiles(x,z,Number($('radius').value));
    const additions=points.filter(([x,z])=>!design.tiles[`${x}/${z}`]).length;
    if(Object.keys(design.tiles).length+additions>20000){status('Limite de 20.000 quadrados. Exporte o projeto e restaure áreas antes de continuar.');return;}
    const before=paintTerrainDesign(design,points,$('tool').value,{tex:Number($('texture').value),height:Number($('height').value),density:Number($('density').value),color:$('color').value},tileAt);
    for(const [key,value] of Object.entries(before))if(!(key in stroke.before))stroke.before[key]=value;
    const r=Number($('radius').value)+1;changed({x0:x-r,z0:z-r,x1:x+r,z1:z+r});
  }
  const active=()=>open&&$('paint').checked&&canEdit();
  canvas.addEventListener('pointerdown',event=>{
    if(!active()||event.button!==0)return;
    event.preventDefault();event.stopImmediatePropagation();onOpen();
    stroke={id:event.pointerId,before:{},visited:new Set()};canvas.setPointerCapture(event.pointerId);dab(event);
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(!active()||event.buttons&2)return;
    event.stopImmediatePropagation();canvas.style.cursor='crosshair';
    onHover(pick(event.clientX,event.clientY),Number($('radius').value));
    if(stroke&&stroke.id===event.pointerId)dab(event);
  },true);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{
    if(!stroke||stroke.id!==event.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();finish();
  },true);
  window.addEventListener('blur',()=>{finish();onHover(null);});
  canvas.addEventListener('pointerleave',()=>onHover(null));
  $('close').onclick=()=>show(false);
  $('paint').onchange=()=>{finish();canvas.style.cursor='';onHover(null);};
  $('undo').onclick=()=>historyStep(history,future);$('redo').onclick=()=>historyStep(future,history);
  $('blend').addEventListener('pointerdown',()=>{finish();remember(structuredClone(design));});
  $('blend').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)&&!e.repeat)remember(structuredClone(design));});
  $('blend').oninput=()=>{design.blend=Number($('blend').value);apply(design,{blendOnly:true});dirty=true;sync();status('Prévia alterada · salve no navegador ou exporte para guardar.');};
  for(const name of ['radius','height','density'])$(name).oninput=()=>{$(name+'-value').value=name==='density'?Math.round(Number($(name).value)*100)+'%':$(name).value+' m';};
  $('save').onclick=()=>{
    finish();try{design=normalizeTerrainDesign(design);localStorage.setItem(TERRAIN_DESIGN_KEY,JSON.stringify(design));dirty=false;status('Salvo neste navegador. Use Exportar projeto para levar a edição para outro dispositivo.');}
    catch(error){status('Não foi possível salvar: '+error.message+' Exporte para guardar.');}
  };
  function replace(next){finish();remember(structuredClone(design));design=next;changed();}
  $('original').onclick=()=>replace({...structuredClone(DEFAULT_TERRAIN_DESIGN),blend:0});
  $('export').onclick=()=>{
    finish();const blob=new Blob([JSON.stringify(normalizeTerrainDesign(design),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download='terrain-design.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Projeto exportado. Para publicar para todos, use o arquivo em assets/terrain/design.json.');
  };
  $('import').onchange=async()=>{
    try{const file=$('import').files[0];if(!file)return;if(file.size>5*1024*1024)throw Error('Arquivo deve ter até 5 MB.');replace(normalizeTerrainDesign(JSON.parse(await file.text())));}
    catch(error){status('Não foi possível importar: '+error.message);}
    finally{$('import').value='';}
  };
  function show(value=true){
    if(value&&!canEdit())return;
    finish();onHover(null);open=value;panel.hidden=!open;document.body.classList.toggle('terrain-editing',open);
    if(open){onOpen();document.body.classList.remove('desktop-settings-open','mobile-settings-open');}
    canvas.style.cursor=open?'crosshair':'';
  }
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  sync();
  return {show,isOpen:()=>open,isPainting:active,setDesign(next){design=next;sync();}};
}
