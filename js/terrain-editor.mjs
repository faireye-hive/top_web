import {DEFAULT_TERRAIN_DESIGN,TERRAIN_DESIGN_KEY,normalizeTerrainDesign,brushTiles,paintTerrainDesign} from './terrain-design.mjs';
import {appendStrokePoint,strokeBounds,distanceToStroke,paintSoftEdge} from './terrain-strokes.mjs';

export function createTerrainEditor({canvas,design:initial,apply,tileAt,pick,pickAsset=()=>null,clearAsset=()=>{},onOpen=()=>{},onHover=()=>{},canEdit=()=>true}){
  let design=initial,open=false,stroke=null,dirty=false,rebuild=null,pendingBounds=null,history=[],future=[],pinnedAsset=null;
  const panel=document.createElement('aside');panel.id='terrain-editor';panel.hidden=true;panel.setAttribute('aria-label','Editor de terreno e vegetação');
  panel.innerHTML=`<header><div><small>ATELIÊ DO MUNDO</small><h2>Terreno e vegetação</h2></div><button type="button" id="terrain-close" aria-label="Fechar editor">×</button></header>
  <p>Pinte no cenário. Botão direito gira; roda aproxima. Desative o pincel para navegar por toque.</p>
  <label class="terrain-enable"><input type="checkbox" id="terrain-paint" checked> Pincel ativo</label>
  <label for="terrain-tool">Ferramenta<select id="terrain-tool"><option value="texture">Pintar detalhes do chão</option><option value="path">Desenhar caminhos</option><option value="soften">Suavizar uma borda do mapa</option><option value="grass">Plantar grama alta</option><option value="erase-grass">Remover grama</option><option value="erase-stroke">Apagar traço inteiro</option><option value="restore">Restaurar quadrado original · 1 m</option><option value="pick">Conta-gotas de chão</option><option value="asset">Selecionar objeto do cenário</option></select></label>
  <section id="terrain-asset-panel" hidden><p>Passe sobre o objeto para identificar. Clique para fixar a seleção.</p><strong id="terrain-asset-name">Nenhum objeto selecionado</strong><p id="terrain-asset-file"></p><p id="terrain-asset-position"></p><a id="terrain-asset-textures" target="_blank" rel="noopener" hidden>Abrir textura deste objeto ↗</a><button id="terrain-asset-release" type="button">Soltar seleção</button></section>
  <section id="terrain-brush-panel">
  <label for="terrain-texture">Textura do chão<select id="terrain-texture"></select></label>
  <div id="terrain-path-presets" class="terrain-actions" hidden><button type="button" data-path-texture="18">Terra</button><button type="button" data-path-texture="14">Areia</button><button type="button" data-path-texture="2">Pedra</button></div>
  <label for="terrain-radius">Raio do pincel <output id="terrain-radius-value">1 m</output><input id="terrain-radius" type="range" min="0.03" max="8" step="0.01" value="1"></label>
  <label for="terrain-radius-number">Raio exato (m)<input id="terrain-radius-number" type="number" min="0.03" max="8" step="0.01" value="1"></label>
  <div class="terrain-actions terrain-presets"><button type="button" data-radius="0.03">3 cm</button><button type="button" data-radius="0.1">10 cm</button><button type="button" data-radius="0.25">25 cm</button><button type="button" data-radius="1">1 m</button></div>
  <fieldset id="terrain-stroke-controls"><legend>Bordas do traço · próximos traços</legend>
    <label for="terrain-feather">Suavidade <output id="terrain-feather-value">65%</output><input id="terrain-feather" type="range" min="0" max="1" step="0.01" value="0.65"></label>
    <label for="terrain-edge">Aplicar suavidade<select id="terrain-edge"><option value="both">Nos dois lados</option><option value="left">Mais na esquerda do traço</option><option value="right">Mais na direita do traço</option></select></label>
    <label for="terrain-opacity">Intensidade <output id="terrain-opacity-value">100%</output><input id="terrain-opacity" type="range" min="0.05" max="1" step="0.01" value="1"></label>
    <p>Esquerda e direita acompanham a direção em que você desenha. O diâmetro do pincel é a largura do caminho.</p>
  </fieldset>
  <fieldset id="terrain-local-controls" hidden><legend>Borda local do mapa</legend>
    <label for="terrain-local-side">Borda do quadrado<select id="terrain-local-side"><option value="all">Todas</option><option value="north">Norte · −Z</option><option value="south">Sul · +Z</option><option value="east">Leste · +X</option><option value="west">Oeste · −X</option></select></label>
    <label for="terrain-local-blend">Suavidade local <output id="terrain-local-blend-value">0.80 m</output><input id="terrain-local-blend" type="range" min="0" max="1" step="0.01" value="0.8"></label>
    <p>Pinte a borda escolhida. O ajuste acompanha os cantos compartilhados do terreno para manter a transição contínua.</p>
  </fieldset>
  <fieldset id="terrain-grass-controls" hidden><legend>Grama alta · próximos traços</legend>
    <label for="terrain-height">Altura <output id="terrain-height-value">0,45 m</output><input id="terrain-height" type="range" min="0.1" max="1.2" step="0.05" value="0.45"></label>
    <label for="terrain-density">Densidade <output id="terrain-density-value">60%</output><input id="terrain-density" type="range" min="0.1" max="1" step="0.1" value="0.6"></label>
    <label for="terrain-color">Cor <input id="terrain-color" type="color" value="#648940"></label>
  </fieldset></section>
  <details><summary>Suavidade geral do mapa</summary><label for="terrain-blend">Mistura dos solos <output id="terrain-blend-value"></output><input id="terrain-blend" type="range" min="0" max="1" step="0.01"></label><p>Mistura mais ampla entre solos naturais. Pisos e calçadas preservam o recorte. Bordas locais pintadas têm prioridade.</p></details>
  <div class="terrain-actions"><button id="terrain-undo" type="button">Desfazer</button><button id="terrain-redo" type="button">Refazer</button></div>
  <div class="terrain-actions"><button id="terrain-save" type="button">Salvar no navegador</button><button id="terrain-export" type="button">Exportar projeto</button></div>
  <div class="terrain-actions"><label class="terrain-file">Importar projeto<input id="terrain-import" type="file" accept="application/json,.json"></label><button id="terrain-original" type="button">Prévia original</button></div>
  <p id="terrain-status" role="status" aria-live="polite">Prévia no cenário real. Exporte o projeto para guardar uma cópia.</p>`;
  document.body.append(panel);
  const $=id=>panel.querySelector('#terrain-'+id),status=message=>{$('status').textContent=message;};
  for(let id=1;id<=49;id++){const option=document.createElement('option');option.value=id;option.textContent=`${id} · Solo histórico`;$('texture').append(option);}$('texture').value='9';
  fetch('assets/textures/catalog.json').then(response=>response.json()).then(catalog=>{for(const entry of catalog.terrain||[]){const option=$('texture').querySelector(`option[value="${entry.tile}"]`);if(option)option.textContent=`${entry.tile} · ${entry.name}`;}}).catch(()=>{});
  function sync(){
    $('blend').value=design.blend;$('blend-value').value=design.blend===0?'Borda seca':design.blend.toFixed(2)+' m';
    $('undo').disabled=!history.length;$('redo').disabled=!future.length;
  }
  function flush(){if(rebuild!==null)cancelAnimationFrame(rebuild);rebuild=null;apply(design,pendingBounds);pendingBounds=null;}
  function changed(bounds=null){
    dirty=true;
    if(!bounds)pendingBounds=null;
    else if(rebuild===null)pendingBounds={...bounds};
    else if(pendingBounds){pendingBounds.x0=Math.min(pendingBounds.x0,bounds.x0);pendingBounds.z0=Math.min(pendingBounds.z0,bounds.z0);pendingBounds.x1=Math.max(pendingBounds.x1,bounds.x1);pendingBounds.z1=Math.max(pendingBounds.z1,bounds.z1);}
    if(rebuild===null)rebuild=requestAnimationFrame(flush);
    sync();status('Prévia alterada · salve no navegador ou exporte para guardar.');
  }
  function remember(previous){history.push(previous);if(history.length>40)history.shift();future=[];sync();}
  function finish(){if(!stroke)return;if(stroke.changed)remember(stroke.previous);stroke=null;sync();}
  function historyStep(from,to){finish();const previous=from.pop();if(!previous)return;to.push(structuredClone(design));design=previous;changed();}
  function radius(){return Math.max(.03,Math.min(8,Number($('radius').value)||.03));}
  function setRadius(value){const r=Math.max(.03,Math.min(8,Number(value)||.03));$('radius').value=r;$('radius-number').value=r;$('radius-value').value=r<1?Math.round(r*100)+' cm':r.toFixed(2)+' m';}
  function assetInfo(asset){
    if(!asset){if(!pinnedAsset){$('asset-name').textContent='Nenhum objeto sob o cursor';$('asset-file').textContent='';$('asset-position').textContent='';$('asset-textures').hidden=true;}return;}
    $('asset-name').textContent=asset.label;$('asset-file').textContent=asset.file+' · OBJ #'+asset.id;$('asset-position').textContent=`${asset.x.toFixed(2)}, ${asset.z.toFixed(2)}`;
    $('asset-textures').hidden=!asset.textureId;
    if(asset.textureId)$('asset-textures').href='./tests/texture-editor.html?texture='+encodeURIComponent(asset.textureId);
  }
  function dab(event){
    const tool=$('tool').value;
    if(tool==='asset'){const asset=pickAsset(event.clientX,event.clientY);if(asset){pinnedAsset=asset;assetInfo(asset);status('Objeto selecionado. Abra sua textura pelo atalho acima.');}return;}
    const point=pick(event.clientX,event.clientY);if(!point)return;
    const x=point.x,z=point.z,base=tileAt(x,z);if(!base)return;
    if(tool==='pick'){
      const painted=[...(design.strokes||[])].reverse().find(s=>['texture','path'].includes(s.tool)&&distanceToStroke(x,z,s)<s.radius);
      $('texture').value=String(painted?.tex??base.tex);status(`Solo ${$('texture').value} · ${x.toFixed(2)}, ${z.toFixed(2)}`);return;
    }
    if(!(base.region&1)||base.height<0){status('Pinte em terra firme carregada.');return;}
    const r=radius(),bounds={x0:x-r-2,z0:z-r-2,x1:x+r+2,z1:z+r+2};
    if(['texture','path','grass','erase-grass'].includes(tool)){
      design.strokes??=[];
      if(stroke.pointCount>=100000){status('Limite de 100.000 pontos alcançado. Exporte o projeto antes de continuar.');return;}
      if(!stroke.paint){
        if(design.strokes.length>=2000){status('Limite de 2.000 traços. Exporte o projeto antes de continuar.');return;}
        const paint={tool,radius:r,points:[]};
        if(['texture','path'].includes(tool))Object.assign(paint,{tex:Number($('texture').value),edge:$('edge').value,feather:Number($('feather').value),opacity:Number($('opacity').value)});
        if(tool==='grass')paint.grass={height:Number($('height').value),density:Number($('density').value),color:$('color').value};
        design.strokes.push(paint);stroke.paint=paint;
      }
      if(stroke.paint.points.length>=4096){status('Traço completo. Solte o pincel para começar outro.');return;}
      if(!appendStrokePoint(stroke.paint,x,z))return;stroke.pointCount++;
      const previous=stroke.paint.points.at(-2);if(previous){bounds.x0=Math.min(bounds.x0,previous[0]-r-2);bounds.z0=Math.min(bounds.z0,previous[1]-r-2);bounds.x1=Math.max(bounds.x1,previous[0]+r+2);bounds.z1=Math.max(bounds.z1,previous[1]+r+2);}
    }else if(tool==='erase-stroke'){
      const removed=(design.strokes||[]).filter(s=>distanceToStroke(x,z,s)<=r+s.radius);if(!removed.length)return;
      design.strokes=design.strokes.filter(s=>!removed.includes(s));for(const s of removed){const b=strokeBounds(s);bounds.x0=Math.min(bounds.x0,b.x0);bounds.z0=Math.min(bounds.z0,b.z0);bounds.x1=Math.max(bounds.x1,b.x1);bounds.z1=Math.max(bounds.z1,b.z1);}
    }else{
      if(tool==='soften'&&Object.keys(design.tiles).length>19600){status('Limite de quadrados editados alcançado. Exporte para guardar.');return;}
      if(tool==='soften')paintSoftEdge(design,x,z,$('local-side').value,Number($('local-blend').value),r);
      else paintTerrainDesign(design,brushTiles(x,z,r),'restore',{},tileAt);
    }
    stroke.changed=true;changed(bounds);
  }
  const active=()=>open&&$('paint').checked&&canEdit();
  canvas.addEventListener('pointerdown',event=>{
    if(!active()||event.button!==0)return;
    event.preventDefault();event.stopImmediatePropagation();finish();onOpen();
    stroke={id:event.pointerId,previous:structuredClone(design),changed:false,pointCount:(design.strokes||[]).reduce((sum,s)=>sum+s.points.length,0)};canvas.setPointerCapture(event.pointerId);dab(event);
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(!active()||event.buttons&2)return;
    event.stopImmediatePropagation();canvas.style.cursor='crosshair';
    if($('tool').value==='asset'){onHover(null);if(!pinnedAsset)assetInfo(pickAsset(event.clientX,event.clientY));}
    else onHover(pick(event.clientX,event.clientY),radius(),$('tool').value==='soften'?$('local-side').value:null);
    if(stroke&&stroke.id===event.pointerId)dab(event);
  },true);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{if(!stroke||stroke.id!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();finish();},true);
  window.addEventListener('blur',()=>{finish();onHover(null);});canvas.addEventListener('pointerleave',()=>{onHover(null);if(!pinnedAsset)clearAsset();});
  $('close').onclick=()=>show(false);$('paint').onchange=()=>{finish();canvas.style.cursor='';onHover(null);};
  $('undo').onclick=()=>historyStep(history,future);$('redo').onclick=()=>historyStep(future,history);
  $('tool').onchange=()=>{
    finish();onHover(null);clearAsset();pinnedAsset=null;const tool=$('tool').value;
    $('asset-panel').hidden=tool!=='asset';$('brush-panel').hidden=tool==='asset';$('path-presets').hidden=tool!=='path';$('stroke-controls').hidden=!['texture','path'].includes(tool);$('local-controls').hidden=tool!=='soften';$('grass-controls').hidden=tool!=='grass';
    if(tool==='path'){$('texture').value='18';setRadius(.8);}
  };
  $('asset-release').onclick=()=>{pinnedAsset=null;clearAsset();assetInfo(null);};
  $('radius').oninput=()=>setRadius($('radius').value);$('radius-number').onchange=()=>setRadius($('radius-number').value);
  for(const button of panel.querySelectorAll('[data-radius]'))button.onclick=()=>setRadius(button.dataset.radius);
  for(const button of panel.querySelectorAll('[data-path-texture]'))button.onclick=()=>{$('texture').value=button.dataset.pathTexture;};
  $('blend').addEventListener('pointerdown',()=>{finish();remember(structuredClone(design));});
  $('blend').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)&&!e.repeat)remember(structuredClone(design));});
  $('blend').oninput=()=>{design.blend=Number($('blend').value);apply(design,{blendOnly:true});dirty=true;sync();status('Mistura geral alterada. Bordas locais pintadas mantêm seu ajuste.');};
  for(const name of ['height','density','feather','opacity','local-blend'])$(name).oninput=()=>{$(name+'-value').value=['density','feather','opacity'].includes(name)?Math.round(Number($(name).value)*100)+'%':Number($(name).value).toFixed(2)+' m';};
  $('save').onclick=()=>{finish();try{design=normalizeTerrainDesign(design);flush();localStorage.setItem(TERRAIN_DESIGN_KEY,JSON.stringify(design));dirty=false;status('Salvo neste navegador. Exporte para guardar uma cópia.');}catch(error){status('Não foi possível salvar: '+error.message);}};
  function replace(next){finish();remember(structuredClone(design));design=next;changed();}
  $('original').onclick=()=>replace({...structuredClone(DEFAULT_TERRAIN_DESIGN),blend:0});
  $('export').onclick=()=>{
    finish();try{const blob=new Blob([JSON.stringify(normalizeTerrainDesign(design),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='terrain-design.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Projeto exportado com caminhos, bordas e vegetação.');}catch(error){status(error.message);}
  };
  $('import').onchange=async()=>{try{const file=$('import').files[0];if(!file)return;if(file.size>8*1024*1024)throw Error('Arquivo deve ter até 8 MB.');replace(normalizeTerrainDesign(JSON.parse(await file.text())));}catch(error){status('Não foi possível importar: '+error.message);}finally{$('import').value='';}};
  function show(value=true){
    if(value&&!canEdit())return;finish();onHover(null);clearAsset();open=value;panel.hidden=!open;document.body.classList.toggle('terrain-editing',open);
    if(open){onOpen();document.body.classList.remove('desktop-settings-open','mobile-settings-open');}canvas.style.cursor=open?'crosshair':'';
  }
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  sync();return {show,isOpen:()=>open,isPainting:active,setDesign(next){design=next;sync();}};
}
