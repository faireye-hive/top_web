import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

// Loader opcional: sem NPCs em manifest.json, não carrega modelos nem cria draw calls.
// Modelos são GLBs com texturas embutidas; tipos repetidos compartilham GPU assets.
export async function createNpcManager({THREE,scene,heightAt,url='assets/npcs/manifest.json'}) {
  const res=await fetch(url);
  if(!res.ok)throw new Error('Manifesto de NPCs não encontrado: '+url);
  const manifest=await res.json();
  if(!manifest||!Array.isArray(manifest.npcs))throw new Error('Manifesto de NPCs inválido');
  const records=manifest.npcs.filter(n=>n&&typeof n.model==='string'&&n.model.startsWith('models/')&&
    Number.isFinite(n.x)&&Number.isFinite(n.z)).map(n=>({
      ...n,visible:false,object:null,mixer:null,pending:false
    }));
  const group=new THREE.Group();group.name='NPCs de Garner';scene.add(group);
  const loader=new (await import('three/addons/loaders/GLTFLoader.js')).GLTFLoader();
  const glbCache=new Map();
  const maxDistance=70, maxDistance2=maxDistance*maxDistance;
  const activeMax=20;
  let lastUpdate=0,playerX=NaN,playerZ=NaN,disposed=false;
  async function loadModel(path){
    if(!glbCache.has(path)){
      const modelUrl=new URL(path,new URL(url,location.href)).href;
      glbCache.set(path,loader.loadAsync(modelUrl).catch(error=>{
        glbCache.delete(path);throw error;
      }));
    }
    return glbCache.get(path);
  }
  async function showNpc(npc){
    npc.pending=true;
    try{
      const gltf=await loadModel(npc.model);
      if(disposed)return;
      const object=cloneSkeleton(gltf.scene);
      object.name='NPC · '+npc.name;
      object.position.set(npc.x,heightAt(npc.x,npc.z),npc.z);
      object.rotation.y=Math.PI-THREE.MathUtils.degToRad(npc.yaw||0);
      object.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});
      npc.object=object;group.add(object);
      const idle=gltf.animations.find(a=>/parado|idle/i.test(a.name));
      if(idle){
        npc.mixer=new THREE.AnimationMixer(object);
        npc.mixer.clipAction(idle).play();
      }
    }catch(error){
      console.warn('NPC não carregado:',npc.characterId,npc.model,error);
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
      if(!npc.object&&!npc.pending)void showNpc(npc);
    }
  }
  function nearest(px,pz,radius=2.3){
    let best=null, distance2=radius*radius;
    for(const npc of records){
      if(!npc.object)continue;
      const d2=(npc.x-px)**2+(npc.z-pz)**2;
      if(d2<distance2){best=npc;distance2=d2}
    }
    return best;
  }
  function dispose(){
    disposed=true;for(const npc of records)if(npc.object)group.remove(npc.object);
    scene.remove(group);
  }
  return {update,nearest,dispose,count:records.length};
}
