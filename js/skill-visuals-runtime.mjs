// Renderer das skills usado DENTRO do jogo. Reutiliza o mesmo FxPlayer do
// Skill FX Studio em tests/, em vez de simplificar cada PAR/EFF como um sprite.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FxPlayer,GLOBAL_DEFAULTS,normalizeStore,layerData,resolveEff} from './skill-fx-core.mjs';
import {buildTimeline} from './skill-fx-timing.mjs';
import {poseForSkill} from './skill-fx-pose.mjs';
import {skillWorldTransform,skillPlaybackLimit} from './skill-fx-world.mjs';
import {readLocalPresets,mergePresetStores,skillPreset} from './skill-vfx-data.mjs';

const resourcePath='assets/skills/';
const emptyEdits=normalizeStore(null);
const editorStorageKey='top-vfx-edits-v2';
function editorEdits(manifest){
  // Se visuals.json já foi exportado pelo Studio, as edições estão
  // incorporadas: não adicionar novamente as camadas "extra".
  if(String(manifest?.source||'').includes('editado no Skill FX Studio'))return emptyEdits;
  try{return normalizeStore(JSON.parse(localStorage.getItem(editorStorageKey)||'null'));}
  catch{return emptyEdits;}
}
const mobile=()=>matchMedia('(max-width: 770px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);

export function createSkillVisuals({scene,camera,heightAt,maxSprites=100}){
  if(!camera)throw Error('Skill VFX: câmera necessária para billboards PAR/EFF');
  const textureLoader=new THREE.TextureLoader(),textureCache=new Map(),models=new Map();
  const active=[];
  let manifest=null,historical=null,basePresets={version:1,skills:{}},disposed=false;
  let actor='lance',clips=[],catalog=null;
  const loadJson=(name)=>fetch(resourcePath+name,{cache:'no-cache'})
    .then(r=>{if(!r.ok)throw Error(name+' HTTP '+r.status);return r.json();});
  const manifestReady=loadJson('visuals.json').then(data=>{manifest=data;return data;})
    .catch(err=>{console.error('Skill VFX: visuals.json indisponível',err);return null;});
  const metadataReady=Promise.all([
    loadJson('historical.json').then(data=>{historical=data;}).catch(()=>{}),
    loadJson('catalog.json').then(data=>{catalog=data;}).catch(()=>{}),
    fetch(resourcePath+'vfx-presets.json',{cache:'no-cache'})
      .then(r=>r.ok?r.json():null).then(data=>{if(data)basePresets=data;}).catch(()=>{})
  ]);
  const modelReady=new GLTFLoader().loadAsync(resourcePath+'models.glb')
    .then(gltf=>{gltf.scene.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const name=mesh.name.replace(/\.lgo$/i,'');
      models.set(name,mesh);
      models.set(mesh.name.toLowerCase().replace(/\.lgo$/i,''),mesh);
      if(mesh.parent?.name&&mesh.parent.name!=='Scene')
        models.set(mesh.parent.name.replace(/\.lgo$/i,''),mesh);
    });}).catch(err=>console.warn('Skill VFX: modelos EFF não disponíveis',err));
  const ready=Promise.all([manifestReady,metadataReady]).then(()=>manifest);

  function sharedTexture(name){
    if(!name)return null;
    let tex=textureCache.get(name);
    if(tex)return tex;
    tex=textureLoader.load(resourcePath+'textures/'+encodeURIComponent(name),undefined,
      undefined,err=>console.warn('Skill VFX: textura ausente',name,err));
    tex.colorSpace=THREE.SRGBColorSpace;tex.flipY=false;
    textureCache.set(name,tex);
    return tex;
  }
  function getCatalogSkill(skill){
    const job=skill?.job;
    if(job&&catalog?.classes?.[job])return catalog.classes[job].skills.find(s=>s.id===skill.id)||skill;
    for(const cls of Object.values(catalog?.classes||{})){
      const item=cls.skills?.find(s=>Number(s.id)===Number(skill?.id));
      if(item)return item;
    }
    return skill;
  }
  function defaultSettings(skill,overrides){
    const local=mergePresetStores(basePresets,readLocalPresets());
    const all=overrides?mergePresetStores(local,overrides):local;
    return skillPreset(all,skill.id).global;
  }
  function stop(entry){
    if(!entry)return;
    entry.player.clear();
    entry.player.root.removeFromParent();
    const idx=active.indexOf(entry);
    if(idx>=0)active.splice(idx,1);
  }
  function spawn(skill,from,to,flight,overrides,options={}){
    if(disposed||!manifest?.skills?.[String(skill?.id)])return false;
    const isMobile=mobile();
    const maxActive=isMobile?4:8;
    while(active.length>=maxActive)stop(active[0]);
    const chosenActor=options.actor||actor;
    const mappedSkill=getCatalogSkill(skill);
    const clip=options.clip||null;
    const world=skillWorldTransform(from,to,options.facing);
    const dist=Math.max(.15,world.distance);
    const preset=defaultSettings(skill,overrides);
    const g={...GLOBAL_DEFAULTS,
      scale:preset.scale,opacity:preset.opacity,speed:1,
      particles:Math.min(maxSprites,isMobile?48:150,Math.max(1,preset.particles||100)),
      height:preset.height, distance:dist,castDelay:0};
    const edits=editorEdits(manifest);
    const player=new FxPlayer({scene,camera,models,textureProvider:sharedTexture});
    const layers=player.setSkill(manifest,edits,String(skill.id),chosenActor);
    player.root.position.set(world.x,heightAt(world.x,world.z)||0,world.z);
    player.root.rotation.y=world.yaw;
    const source=historical?.skills?.[String(skill.id)]||null;
    const pose=poseForSkill(mappedSkill,chosenActor,clip);
    const timeline=buildTimeline({layers,
      resolve:L=>layerData(manifest,edits,L),
      resolveEff:file=>resolveEff(manifest,edits,file),
      historical:source,clip,clipDuration:clip?.duration||0,
      pose,distance:dist,flightSpeed:flight>0&&dist>0?dist/flight:0});
    const duration=skillPlaybackLimit(timeline.duration,isMobile);
    const entry={player,skillId:Number(skill.id),elapsed:0,duration,
      settings:{...g,flightSpeed:flight>0&&dist>0?dist/flight:0,
        timelineMode:'historical',timelineStarts:timeline.stage.starts},
      timeline};
    active.push(entry);
    player.update(0,entry.settings,{});
    return true;
  }
  function play(skill,from,to,flight=0,overrides=null,options={}){
    if(!skill)return false;
    const start=()=>spawn(skill,from,to||from,flight,overrides,options);
    if(!manifest){void ready.then(()=>{if(!disposed)start();});return true;}
    return start();
  }
  function basic(hero,position,target,flight=0,period=1){
    if(flight<=0)return false;
    const id=hero.job==='hunter'?90:hero.job==='sharpshooter'?94:99;
    return play({id},position,target,flight,null,{actor:hero.character,clip:null});
  }
  // Os efeitos de alvo/impacto são agendados pela timeline do cast. Não criar
  // uma segunda cópia no evento skillhit, pois duplicava partículas.
  function impact(){return true;}
  function update(dt){
    const delta=Math.max(0,Math.min(.1,Number(dt)||0));
    for(let i=active.length-1;i>=0;i--){
      const item=active[i];item.elapsed+=delta;
      if(item.elapsed>=item.duration){stop(item);continue;}
      item.player.update(item.elapsed,item.settings,{});
    }
  }
  function clear(){for(const entry of [...active])stop(entry);}
  function dispose(){
    disposed=true;clear();
    for(const texture of textureCache.values())texture.dispose();
    textureCache.clear();
    // Geometrias dos modelos vêm do GLB compartilhado, não dos FxPlayer.
    models.clear();
  }
  function setActor(value,actorClips=[]){
    actor=value||actor;clips=actorClips||[];
  }
  function warm(skills=[]){
    return Promise.all([ready,modelReady]).then(()=>{
      if(disposed||!manifest)return null;
      // Pré-carrega somente recursos das skills atuais, sem instanciar efeitos.
      const names=new Set();
      for(const skill of skills.slice(0,8)){
        const rec=manifest.skills?.[String(skill.id)];
        for(const ch of rec?.channels||[])for(const vis of ch.visual||[]){
          for(const file of vis.files||[]){
            const res=manifest.resources[file];if(!res)continue;
            for(const obj of [...(res.systems||[]),...(res.strips||[]),...(res.parts||[])])
              if(obj.texture)names.add(obj.texture);
          }
        }
      }
      for(const name of names)sharedTexture(name);
      return manifest;
    });
  }
  return {ready,warm,play,basic,impact,update,clear,dispose,setActor,
    get activeCount(){return active.length;},
    get visualManifest(){return manifest;},
    get rendererMode(){return 'shared FxPlayer / PAR + EFF + strip + keyframes';},
    diagnostics(){return {mode:this.rendererMode,active:active.length,
      loaded:!!manifest,loadedResources:Object.keys(manifest?.resources||{}).length,
      editorDraftsApplied:!!manifest&&!String(manifest.source||'').includes('editado no Skill FX Studio')&&
        Object.keys(editorEdits(manifest).res).length>0,
      source:manifest?.source||null,
      activeSkills:active.map(r=>({id:r.skillId,time:r.elapsed,duration:r.duration,
        timelineLayers:r.timeline.tracks.length}))};}
  };
}
