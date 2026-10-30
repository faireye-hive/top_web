import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export async function createMonsterManager({scene,heightAt,findSpawn,url='assets/monsters/manifest.json'}) {
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Monstros: HTTP ${response.status}`);
  const manifest=await response.json();
  const group=new THREE.Group();group.name='Treino de Argent';scene.add(group);
  const loader=new GLTFLoader(),cache=new Map();
  const monsters=manifest.spawns.slice(0,12).flatMap((spawn,index)=>{
    const type=manifest.species[spawn.species];
    if(!type||!/^models\/[\w-]+\.glb$/.test(type.model))return [];
    const free=findSpawn(spawn.x,spawn.z);
    if(!free)return [];
    return [{...type,id:index,species:spawn.species,x:free[0],z:free[1],hp:type.maxHp,
      ready:false,object:null,mixer:null,pending:false,failed:false,action:null}];
  });
  const ring=new THREE.Mesh(new THREE.RingGeometry(.8,.93,32),
    new THREE.MeshBasicMaterial({color:0xffcf61,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.visible=false;group.add(ring);
  function play(monster,match,once=false,period=null) {
    if(!monster.mixer)return;
    const clip=monster.clips.find(c=>c.name.includes(match));
    if(!clip)return;
    const action=monster.mixer.clipAction(clip);
    if(monster.action&&monster.action!==action)monster.action.fadeOut(.12);
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(period?clip.duration/period:1).fadeIn(.12);
    action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);
    action.clampWhenFinished=once;action.play();monster.action=action;
  }
  async function load(monster) {
    monster.pending=true;
    try {
      if(!cache.has(monster.model)) {
        const path=new URL(monster.model,new URL(url,location.href));
        cache.set(monster.model,loader.loadAsync(path.href));
      }
      const gltf=await cache.get(monster.model);
      monster.object=clone(gltf.scene);monster.object.name=monster.name;
      monster.object.position.set(monster.x,heightAt(monster.x,monster.z),monster.z);
      monster.object.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});
      monster.clips=gltf.animations;monster.mixer=new THREE.AnimationMixer(monster.object);
      monster.mixer.addEventListener('finished',()=>play(monster,'Parado'));
      group.add(monster.object);monster.ready=true;play(monster,'Parado');
    }catch(error){monster.failed=true;console.warn('Modelo de monstro indisponível:',monster.model,error);}
    finally{monster.pending=false;}
  }
  function update(dt,position,target) {
    for(const m of monsters) {
      const near=Math.hypot(m.x-position.x,m.z-position.z)<45;
      if(near&&!m.object&&!m.pending&&!m.failed)void load(m);
      if(!m.object)continue;
      m.object.visible=near&&m.hp>0;
      if(m.object.visible) {
        if(m.engaged)m.object.rotation.y=Math.atan2(m.x-position.x,m.z-position.z);
        m.mixer.update(dt);
      }
    }
    ring.visible=!!target?.object&&target.hp>0;
    if(ring.visible)ring.position.set(target.x,heightAt(target.x,target.z)+.08,target.z);
  }
  function onEvent(event) {
    if(event.type==='hurt')play(event.monster,'Ataque 1',true,1/event.monster.attackSpeed);
    if(event.type==='respawn'||event.type==='reset')play(event.monster,'Parado');
  }
  function pick(raycaster){
    const candidates=monsters.filter(m=>m.object?.visible&&m.hp>0);
    const hits=raycaster.intersectObjects(candidates.map(m=>m.object),true);
    if(!hits.length)return null;
    for(const m of candidates){let object=hits[0].object;while(object){if(object===m.object)return m;object=object.parent;}}
    return null;
  }
  return {monsters,update,onEvent,pick};
}
