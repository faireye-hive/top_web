import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FxPlayer,normalizeStore,d3d2gl} from './skill-fx-core.mjs?v=manual2';
import {petPathPose,followPetPosition} from './pet-motion.mjs';

export async function createPetManager({scene,camera,url='assets/pets/manifest.json'}){
  const response=await fetch(url);
  if(!response.ok)throw Error(`Pet: HTTP ${response.status}`);
  const manifest=await response.json(),base=new URL('.',new URL(url,location.href));
  const gltf=await new GLTFLoader().loadAsync(new URL(manifest.model,base).href),models=new Map();
  gltf.scene.traverse(mesh=>{if(mesh.isMesh)models.set(mesh.name.replace(/\.lgo$/i,''),mesh);});
  for(const resource of Object.values(manifest.resources))for(const part of resource.parts||[]){
    if(/\.lgo$/i.test(part.model)&&!models.has(part.model.replace(/\.lgo$/i,'')))
      throw Error(`Malha original do pet ausente: ${part.model}`);
  }
  const loader=new THREE.TextureLoader(),textures=new Map();
  const names=new Set(Object.values(manifest.resources).flatMap(r=>(r.parts||[]).flatMap(p=>[p.texture,...p.frames])));
  await Promise.all([...names].filter(Boolean).map(async name=>{
    const texture=await loader.loadAsync(new URL('textures/'+name,base).href);
    texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;textures.set(name,texture);
  }));
  // O pet é contínuo; as durações de emissão de skills não o fazem desaparecer.
  const paths=new Map();
  for(const resource of Object.values(manifest.resources))for(const system of resource.systems||[]){
    paths.set(system,system.path);delete system.path; // Evita copiar centenas de pontos por quadro no FxPlayer.
    system.life=Number.MAX_SAFE_INTEGER;system.range=[0,0,0];system.preview={useSocket:true};
    if(system.billboard)for(const part of manifest.resources[system.effect]?.parts||[])part.billboard=true;
  }
  const player=new FxPlayer({scene,camera,models,textureProvider:name=>textures.get(name)});
  player.root.name=manifest.name;player.root.visible=false;
  player.setSkill(manifest,normalizeStore(null),manifest.defaultPet,'pet');
  let elapsed=0,position=null,drawn=0;
  player.setSocketResolver(layer=>{
    const system=manifest.resources[layer.file].systems[layer.idx];
    const pose=petPathPose(paths.get(system),elapsed);
    if(system.modelDirection)system.angles=[[0,0,pose.yaw]];
    return d3d2gl(...pose.position);
  });
  function update(dt,owner,{paused=false}={}){
    if(!paused)elapsed+=dt;
    position=followPetPosition(position,owner,paused?0:dt);
    player.root.position.set(position.x,position.y,position.z);player.root.visible=true;
    drawn=player.update(elapsed,{particles:3,scale:1,height:0,castDelay:0},{});
  }
  function diagnostics(){return {id:manifest.defaultPet,name:manifest.name,elapsed,drawn,position,visible:player.root.visible};}
  return {update,diagnostics};
}
