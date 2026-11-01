import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {createMonsterPopulation,monsterBudget} from './monster-population.mjs';

export async function createMonsterManager({scene,heightAt,findSpawn,mobile=true,url='assets/monsters/manifest.json?v=3',manifest:initialManifest=null}) {
  let manifest=initialManifest;
  if(!manifest){const response=await fetch(url);if(!response.ok)throw new Error(`Monstros: HTTP ${response.status}`);manifest=await response.json();}
  const group=new THREE.Group();group.name=manifest.streaming?'Monstros originais de Garner':'Horda da Torre';scene.add(group);
  const loader=new GLTFLoader(),cache=new Map(),budget=monsterBudget(mobile);
  let loading=0,syncTime=.5,simulationTime=0;
  function release(m){
    m.mixer?.stopAllAction();
    if(m.object){
      m.mixer?.uncacheRoot(m.object);group.remove(m.object);
      const skeletons=new Set();m.object.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);});
      for(const skeleton of skeletons)skeleton.dispose();
    }
    m.object=null;m.mixer=null;m.action=null;m.clips=null;
  }
  const population=createMonsterPopulation({manifest,findSpawn,budget,release});
  const monsters=population.monsters;
  function evict(){
    const used=new Set(monsters.filter(m=>m.object||m.pending).map(m=>m.model));
    for(const [key,entry] of cache){
      if(cache.size<=budget.models)break;
      if(used.has(key)||!entry.gltf)continue;
      const geometries=new Set(),materials=new Set(),textures=new Set();
      entry.gltf.scene.traverse(o=>{
        if(o.geometry)geometries.add(o.geometry);
        for(const material of (Array.isArray(o.material)?o.material:[o.material]))if(material){
          materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
        }
      });
      for(const value of [...geometries,...materials,...textures])value.dispose();
      cache.delete(key);
    }
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(.8,.93,32),
    new THREE.MeshBasicMaterial({color:0xffcf61,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.visible=false;group.add(ring);
  function play(monster,match,once=false,period=null) {
    if(!monster.mixer)return;
    const clip=monster.clips.find(c=>c.name.includes(match));
    if(!clip)return;
    const action=monster.mixer.clipAction(clip);
    if(!once&&monster.action===action&&action.isRunning())return;
    if(monster.action&&monster.action!==action)monster.action.fadeOut(.12);
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(period?clip.duration/period:1).fadeIn(.12);
    action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);
    action.clampWhenFinished=once;action.play();monster.action=action;
  }
  async function load(monster) {
    monster.pending=true;loading++;const version=monster.loadVersion;
    try {
      if(!cache.has(monster.model)) {
        const path=new URL(monster.model,new URL(url,location.href));
        const entry={gltf:null,promise:null};
        entry.promise=loader.loadAsync(path.href).then(gltf=>{entry.gltf=gltf;return gltf;})
          .catch(error=>{cache.delete(monster.model);throw error;});
        cache.set(monster.model,entry);
      }
      const entry=cache.get(monster.model);cache.delete(monster.model);cache.set(monster.model,entry);
      const gltf=await entry.promise;
      if(monster.loadVersion!==version||!monsters.includes(monster))return;
      monster.object=clone(gltf.scene);monster.object.name=monster.name;
      monster.object.position.set(monster.x,heightAt(monster.x,monster.z,monster),monster.z);
      monster.object.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});
      monster.clips=gltf.animations;monster.mixer=new THREE.AnimationMixer(monster.object);
      monster.mixer.addEventListener('finished',event=>{
        if(event.action===monster.action&&monster.hp>0)play(monster,monster.moving?'Correr':'Parado');
      });
      group.add(monster.object);monster.ready=true;play(monster,'Parado');
    }catch(error){if(monster.loadVersion===version)monster.failed=true;console.warn('Modelo de monstro indisponível:',monster.model,error);}
    finally{loading--;if(monster.loadVersion===version)monster.pending=false;evict();}
  }
  function update(dt,position,target,{paused=false,habitat='land'}={}) {
    syncTime+=dt;if(!paused)simulationTime+=dt;
    if(syncTime>=.5){population.sync(position,target,simulationTime,{habitat});simulationTime=0;syncTime=0;evict();}
    for(const m of monsters) {
      const near=Math.hypot(m.x-position.x,m.z-position.z)<budget.radius;
      if(near&&!m.object&&!m.pending&&!m.failed&&loading<budget.loads)void load(m);
      if(!m.object)continue;
      if(!paused){m.deathTime=Math.max(0,(m.deathTime||0)-dt);m.recoil=Math.max(0,(m.recoil||0)-dt);}
      m.object.visible=near&&(m.hp>0||m.deathTime>0);
      if(m.object.visible) {
        if(m.engaged&&!m.moving)m.object.rotation.y=Math.atan2(m.x-position.x,m.z-position.z);
        else if(m.moving)m.object.rotation.y=m.facing;
        const recoil=m.hp>0?Math.sin((m.recoil||0)/.18*Math.PI)*.12:0;
        m.object.position.set(m.x+Math.sin(m.object.rotation.y)*recoil,heightAt(m.x,m.z,m),m.z+Math.cos(m.object.rotation.y)*recoil);
        if(m.hp>0&&(!m.action||m.action.loop!==THREE.LoopOnce))play(m,m.moving?'Correr':'Parado');
        if(!paused)m.mixer.update(dt);
      }
    }
    ring.visible=!!target?.object&&target.object.visible&&target.hp>0;
    if(ring.visible)ring.position.set(target.x,heightAt(target.x,target.z)+.08,target.z);
  }
  function onEvent(event) {
    const m=event.monster;
    if(event.type==='monster-swing')play(m,'Ataque 1',true,event.period*.85);
    if((event.type==='hit'||event.type==='skillhit')&&event.damage>0)m.recoil=.18;
    if(event.type==='kill'){m.deathTime=1.1;play(m,'Morte',true,1);}
    if(event.type==='respawn'||event.type==='reset'){m.deathTime=0;m.recoil=0;play(m,'Parado');}
  }
  function pick(raycaster,{habitat='land'}={}){
    const candidates=monsters.filter(m=>m.object?.visible&&m.ready&&m.hp>0&&(m.habitat||'land')===habitat);
    const hits=raycaster.intersectObjects(candidates.map(m=>m.object),true);
    if(!hits.length)return null;
    for(const m of candidates){let object=hits[0].object;while(object){if(object===m.object)return m;object=object.parent;}}
    return null;
  }
  async function prepare(){
    await Promise.all(monsters.filter(m=>!m.ready&&!m.pending&&!m.failed).map(load));
    if(monsters.some(m=>!m.ready))throw Error('Não foi possível preparar a horda');
  }
  async function replaceWave(data){
    population.reset(data);ring.visible=false;evict();
    if(monsters.length!==data.spawns.length)throw Error('Pontos de horda bloqueados');
    await prepare();
  }
  return {monsters,mapPoints:manifest.streaming?manifest.spawns:[],update,onEvent,pick,prepare,replaceWave,
    setMobile(value){Object.assign(budget,monsterBudget(value));syncTime=.5;}};
}
