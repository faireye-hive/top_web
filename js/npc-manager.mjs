import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import {isArenaAdministrator} from './arena-state.mjs';
import {NPC_NAMEPLATE_LIMITS,visibleNpcNameCandidates,
  npcLabelScreenPosition,overlapsNpcLabel} from './npc-nameplates.mjs';

// Loader opcional: sem NPCs em manifest.json, não carrega modelos nem cria draw calls.
// Modelos são GLBs com texturas embutidas; tipos repetidos compartilham GPU assets.
export async function createNpcManager({THREE,scene,heightAt,url='assets/npcs/manifest.json?v=2'}) {
  const res=await fetch(url);
  if(!res.ok)throw new Error('Manifesto de NPCs não encontrado: '+url);
  const manifest=await res.json();
  if(!manifest||!Array.isArray(manifest.npcs))throw new Error('Manifesto de NPCs inválido');
  const records=manifest.npcs.filter(n=>n&&typeof n.model==='string'&&n.model.startsWith('models/')&&
    Number.isFinite(n.x)&&Number.isFinite(n.z)).map(n=>({
      ...n,visible:false,object:null,mixer:null,label:null,anchor:null,pending:false
    }));
  const group=new THREE.Group();group.name='NPCs de Garner';scene.add(group);
  // One DOM layer for all nearby labels, zero additional WebGL draws.
  // pointer-events:none ensures NPC interaction and camera controls still work.
  const nameLayer=records.length?document.createElement('div'):null;
  if(nameLayer){
    nameLayer.id='npc-nameplates';
    nameLayer.setAttribute('aria-hidden','true');
    document.body.append(nameLayer);
  }
  const projected=new THREE.Vector3();
  const bbox=new THREE.Box3();
  const loader=new (await import('three/addons/loaders/GLTFLoader.js')).GLTFLoader();
  const glbCache=new Map();
  // 404/rede falha uma vez por GLB e não é repetido a cada atualização do jogo.
  const failedModels=new Set();
  const maxDistance=70, maxDistance2=maxDistance*maxDistance;
  const activeMax=20;
  let lastUpdate=0,playerX=NaN,playerZ=NaN,disposed=false,lastLabelUpdate=-Infinity;
  async function loadModel(path){
    if(failedModels.has(path))return null;
    if(!glbCache.has(path)){
      const modelUrl=new URL(path,new URL(url,location.href)).href;
      // Uma promise por modelo; personagens repetidos compartilham o download.
      // Se o arquivo estiver ausente, registra uma falha definitiva nesta sessão.
      // Ao publicar novos GLBs, basta atualizar a página para tentar novamente.
      glbCache.set(path,loader.loadAsync(modelUrl).catch(error=>{
        failedModels.add(path);
        console.warn('Modelo GLB de NPC indisponível (verifique assets/npcs/models):',path,error);
        return null;
      }));
    }
    return glbCache.get(path);
  }
  async function showNpc(npc){
    npc.pending=true;
    try{
      const gltf=await loadModel(npc.model);
      if(!gltf){npc.failed=true;return;}
      if(disposed)return;
      const object=cloneSkeleton(gltf.scene);
      object.name='NPC · '+npc.name;
      object.position.set(npc.x,heightAt(npc.x,npc.z),npc.z);
      object.rotation.y=Math.PI-THREE.MathUtils.degToRad(npc.yaw||0);
      object.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});
      npc.object=object;group.add(object);
      // Position the label slightly above the real 3D model, independent
      // of the character type, skin, animations and terrain elevation.
      bbox.setFromObject(object);
      const head=bbox.max.y;
      const relativeHeight=head-object.position.y;
      const top=Number.isFinite(relativeHeight)&&relativeHeight>.4&&relativeHeight<9
        ?head:object.position.y+2.3;
      npc.anchor=new THREE.Vector3(npc.x,top+.28,npc.z);
      if(nameLayer){
        const label=document.createElement('span');
        label.className='npc-nameplate';
        label.textContent=npc.name; // textContent, never HTML from manifest.
        label.hidden=true;
        label.dataset.serial=String(npc.serial??npc.characterId??'');
        npc.label=label;nameLayer.append(label);
      }
      const idle=gltf.animations.find(a=>/parado|idle/i.test(a.name));
      if(idle){
        npc.mixer=new THREE.AnimationMixer(object);
        npc.mixer.clipAction(idle).play();
      }
    }catch(error){
      npc.failed=true;
      console.warn('Falha ao instanciar NPC:',npc.characterId,npc.model,error);
    }finally{npc.pending=false}
  }
  function update(dt,px,pz){
    if(disposed)return;
    for(const npc of records)if(npc.object?.visible && npc.mixer)npc.mixer.update(dt);
    lastUpdate+=dt;
    if(lastUpdate<.75&&Math.hypot(px-playerX,pz-playerZ)<10)return;
    playerX=px;playerZ=pz;lastUpdate=0;
    const close=records.map(npc=>({npc,d2:(npc.x-px)**2+(npc.z-pz)**2}))
      .filter(a=>a.d2<maxDistance2).sort((a,b)=>a.d2-b.d2).slice(0,activeMax);
    const visible=new Set(close.map(item=>item.npc));
    for(const npc of records)if(npc.object)npc.object.visible=visible.has(npc);
    for(const {npc} of close){
      if(!npc.object&&!npc.pending&&!npc.failed)void showNpc(npc);
    }
  }
  function updateLabels(camera,canvas,px,pz,mobile=false){
    if(disposed||!nameLayer||!camera||!canvas)return;
    const now=performance.now();
    const limits=mobile?NPC_NAMEPLATE_LIMITS.mobile:NPC_NAMEPLATE_LIMITS.desktop;
    if(now-lastLabelUpdate<limits.intervalMs)return;
    lastLabelUpdate=now;
    // No labels covering panels/maps while NPC animation continues.
    if(document.hidden||document.body.classList.contains('rpg-open')||
      document.body.classList.contains('map-open')||
      document.body.classList.contains('mobile-settings-open')){
      nameLayer.hidden=true;return;
    }
    nameLayer.hidden=false;
    for(const npc of records)if(npc.label)npc.label.hidden=true;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;
    const occupied=[];
    for(const {npc,d2} of visibleNpcNameCandidates(records,px,pz,mobile)){
      projected.copy(npc.anchor).project(camera);
      const screen=npcLabelScreenPosition(projected,rect,{mobile});
      if(!screen||occupied.some(point=>overlapsNpcLabel(point,screen,mobile)))continue;
      occupied.push(screen);
      npc.label.style.left=screen.x.toFixed(1)+'px';
      npc.label.style.top=screen.y.toFixed(1)+'px';
      npc.label.style.opacity=String(Math.max(.65,1-Math.sqrt(d2)/limits.distance*.28));
      npc.label.hidden=false;
    }
  }
  function nearest(px,pz,radius=2.3){
    let best=null, distance2=Infinity;
    for(const npc of records){
      if(!npc.object?.visible)continue;
      const d2=(npc.x-px)**2+(npc.z-pz)**2;
      const limit=isArenaAdministrator(npc)?Math.max(radius,5):radius;
      if(d2<limit*limit&&d2<distance2){best=npc;distance2=d2}
    }
    return best;
  }
  function dispose(){
    disposed=true;for(const npc of records)if(npc.object)group.remove(npc.object);
    nameLayer?.remove();
    scene.remove(group);
  }
  return {update,updateLabels,nearest,dispose,count:records.length};
}
