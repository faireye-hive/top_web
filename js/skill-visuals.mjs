import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {
  compileSkillLayers,GLOBAL_DEFAULTS,layerSettings,
  mergePresetStores,readLocalPresets,skillPreset
} from './skill-vfx-data.mjs';

const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(a,l,h)=>Math.max(l,Math.min(h,a));
const vec=(p,y=0)=>new THREE.Vector3(Number(p?.x)||0,y,Number(p?.z)||0);
const BLEND=new Map([[2,THREE.AdditiveBlending],[6,THREE.AdditiveBlending],[7,THREE.AdditiveBlending]]);
function curve(values,t,defaultValue){
  if(!Array.isArray(values)||!values.length)return defaultValue;
  if(!Array.isArray(values[0]))return values;
  const f=clamp(t,0,.9999)*(values.length-1),a=Math.floor(f),b=Math.min(values.length-1,a+1);
  return values[a].map((v,i)=>lerp(v,values[b][i],f-a));
}
export function createSkillVisuals({scene,heightAt,camera=null,maxSprites=48}){
  const root=new THREE.Group();root.name='Skill VFX (visuals.json)';scene.add(root);
  const textureLoader=new THREE.TextureLoader(),textures=new Map(),originalGeometry=new Map();
  const live=[],geometries={
    horizontal:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),
    vertical:new THREE.PlaneGeometry(1,1),
    sphere:new THREE.SphereGeometry(.5,10,8),
    cylinder:new THREE.CylinderGeometry(.5,.5,1,12,1,true),
    cone:new THREE.ConeGeometry(.5,1,12,1,true)
  };
  let manifest=null,basePresets={version:1,skills:{}},disposed=false;
  const manifestReady=fetch('assets/skills/visuals.json?v=3')
    .then(r=>{if(!r.ok)throw Error('visuals.json HTTP '+r.status);return r.json();})
    .then(value=>{manifest=value;return value;})
    .catch(err=>{console.warn('Skill VFX: manifesto indisponível',err);return null;});
  const presetsReady=fetch('assets/skills/vfx-presets.json?v=1')
    .then(r=>r.ok?r.json():null).then(value=>{if(value)basePresets=value;})
    .catch(()=>{});
  const modelsReady=new GLTFLoader().loadAsync('assets/skills/models.glb?v=1')
    .then(gltf=>gltf.scene.traverse(mesh=>{
      if(mesh.isMesh){
        originalGeometry.set(mesh.name.toLowerCase(),mesh.geometry);
        mesh.material?.dispose?.();
      }
    })).catch(()=>{});
  const ready=Promise.all([manifestReady,presetsReady,modelsReady]);
  function loadTexture(name){
    if(!name)return Promise.resolve(null);
    if(!textures.has(name)){
      textures.set(name,textureLoader.loadAsync('assets/skills/textures/'+encodeURIComponent(name))
        .then(map=>{map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;return map;})
        .catch(()=>null));
    }
    return textures.get(name);
  }
  function descriptors(skill){
    return compileSkillLayers(manifest,skill?.id||skill,{maxLayers:48});
  }
  async function warm(skills=[]){
    await ready;
    const names=new Set((skills||[]).flatMap(s=>descriptors(s).map(l=>l.texture).filter(Boolean)));
    await Promise.all([...names].map(loadTexture));
  }
  function getPreset(skillId,overrides){
    const stored=mergePresetStores(basePresets,readLocalPresets());
    const merged=overrides?mergePresetStores(stored,overrides):stored;
    return skillPreset(merged,skillId);
  }
  function makeObject(layer){
    const model=String(layer.model||'').toLowerCase();
    const geometry=originalGeometry.get(model)||originalGeometry.get(model.replace(/_/g,' '))||
      (/sphere/i.test(model)?geometries.sphere:/cylinder/i.test(model)?geometries.cylinder:
      /cone/i.test(model)?geometries.cone:/plane|rect|triangle|quad/i.test(model)?
        layer.billboard?null:geometries.vertical:null);
    const materialOptions={color:0xffffff,transparent:true,opacity:0,depthWrite:false,
      blending:BLEND.get(layer.blend)||THREE.NormalBlending,side:THREE.DoubleSide,
      toneMapped:false};
    if(geometry)return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial(materialOptions));
    return new THREE.Sprite(new THREE.SpriteMaterial(materialOptions));
  }
  function remove(record){
    record.object.removeFromParent();
    record.object.material.dispose();
    if(record.customGeometry)record.object.geometry.dispose();
  }
  function burst(skill,from,to,flight,overrides,{impactOnly=false}={}){
    if(!manifest||disposed)return false;
    const global=getPreset(skill.id,overrides);
    const settings=global.global;
    const original=descriptors(skill);
    const layers=impactOnly?original.filter(l=>l.stage==='target'||l.stage==='ground'):original;
    let available=Math.max(0,Math.min(maxSprites-live.length,Math.round(settings.particles)));
    if(!impactOnly&&['beam','lightning'].includes(skill.fx)&&available>0){
      const a=vec(from,(heightAt(from.x,from.z)||0)+1.3);
      const b=vec(to,(heightAt(to.x,to.z)||0)+.9);
      if(skill.fx==='lightning')a.copy(b).add(new THREE.Vector3(0,4,0));
      const points=[];
      for(let i=0;i<=10;i++){
        const point=a.clone().lerp(b,i/10);
        if(i>0&&i<10&&skill.fx==='lightning'){point.x+=Math.sin(i*17)*.16;point.z+=Math.cos(i*9)*.17;}
        points.push(point);
      }
      const g=new THREE.BufferGeometry().setFromPoints(points),m=new THREE.LineBasicMaterial({
        color:skill.fx==='lightning'?0x9deaff:0xffb7c5,
        transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending
      });
      const object=new THREE.Line(g,m);root.add(object);
      live.push({kind:'beam',object,age:0,delay:skill.windup||.1,duration:.48,customGeometry:true});
      available--;
    }
    for(let index=0;index<layers.length && available>0;index++){
      const layer=layers[index],edit=layerSettings(global,layer);
      if(edit.enabled===false)continue;
      const count=Math.min(available,Math.max(1,Math.round(edit.count)));
      for(let n=0;n<count;n++){
        const object=makeObject(layer);
        object.visible=false;
        root.add(object);
        const record={
          kind:'layer',object,layer,edit,index,n,loaded:false,age:0,
          duration:clamp((layer.life||1)*edit.duration*settings.duration,.08,12),
          delay:Math.max(0,(layer.delay||0)+edit.delay+(skill.windup||0)),
          from:vec(from),to:vec(to),flight:Math.max(.12,flight||.35),
          global:settings,original:skill
        };
        live.push(record);available--;
        void loadTexture(layer.texture).then(map=>{
          if(disposed||!object.parent)return;
          if(map){
            object.material.map=map;
            object.material.needsUpdate=true;
            record.loaded=true;
          }
        });
      }
    }
    return live.length>0;
  }
  function play(skill,position,target,flight=0,overrides=null){
    if(!skill)return false;
    return burst(skill,position,target||position,flight,overrides);
  }
  function basic(hero,position,target,flight,period=1){
    if(flight<=0)return;
    const id=hero.job==='hunter'?90:hero.job==='sharpshooter'?94:99;
    const fx=hero.job==='hunter'?'arrows':hero.job==='sharpshooter'?'shot':'bolt';
    play({id,fx,windup:period*.35},position,target,flight);
  }
  function impact(skill,monster,overrides=null){
    if(!skill||!monster)return;
    burst(skill,monster,monster,0,overrides,{impactOnly:true});
  }
  function update(dt){
    const delta=Math.max(0,Number(dt)||0);
    for(let i=live.length-1;i>=0;i--){
      const r=live[i];r.age+=delta*(r.global?.speed||1);
      const t0=r.age-r.delay;
      if(t0<0){r.object.visible=false;continue;}
      if(t0>=r.duration){remove(r);live.splice(i,1);continue;}
      const t=clamp(t0/r.duration,0,1),fade=Math.sin(Math.PI*t);
      if(r.kind==='beam'){
        r.object.visible=true;r.object.material.opacity=.86*fade;continue;
      }
      r.object.visible=r.loaded;
      if(!r.loaded)continue;
      const {layer,edit,global,object}=r;
      const size=layer.size||[1,1],motion=layer.stage,offset=layer.offset||[0,0,0];
      const color=layer.rgb||[1,1,1,1],tint=new THREE.Color(edit.color);
      tint.multiply(new THREE.Color(clamp(color[0],0,1),clamp(color[1],0,1),clamp(color[2],0,1)));
      object.material.color.copy(tint);
      object.material.opacity=clamp((color[3]??1)*edit.opacity*global.opacity*fade,0,1);
      const multiplier=global.scale*edit.scale;
      let sx=clamp(Math.abs(size[0]||1)*multiplier,.06,8);
      let sy=clamp(Math.abs(size[1]||size[0]||1)*multiplier,.06,8);
      const swirl=t0*(1+Math.abs(edit.spin));
      if(object.isSprite)object.scale.set(sx,sy,1);
      else object.scale.set(sx,sy,sx);
      const fromH=heightAt(r.from.x,r.from.z)||0,toH=heightAt(r.to.x,r.to.z)||0;
      let pos;
      if(motion==='actor'||motion==='item'||motion==='itemExtra'){
        pos=r.from.clone().setY(fromH+1+(motion==='item'?.2:0));
      }else if(motion==='ground'){
        pos=r.to.clone().setY(toH+.12);
      }else if(motion==='flight'){
        pos=r.from.clone().lerp(r.to,clamp(t0/r.flight,0,1)).add(new THREE.Vector3(0,1,0));
      }else{
        pos=r.to.clone().setY(toH+.9);
      }
      if(r.original.fx==='tornado'){
        const theta=swirl*4+r.index*2.4+r.n*1.7;
        pos.x+=Math.cos(theta)*(.35+.05*r.index);pos.z+=Math.sin(theta)*(.35+.05*r.index);
        pos.y+=Math.min(2,r.index*.15);
      }
      if(r.original.fx==='meteor'&&motion!=='actor'&&motion!=='item'){
        pos.y+=(1-t)*4;
        pos.x+=Math.sin(r.index*2.2)*1.2;
        pos.z+=Math.cos(r.index*2.2)*1.2;
      }
      if(motion==='flight'&&r.n>0){pos.x+=(r.n%2?-.14:.14)*r.n;}
      pos.x+=(offset[0]||0)+edit.x;pos.y+=(offset[1]||0)+edit.y+global.height;
      pos.z+=(offset[2]||0)+edit.z;
      object.position.copy(pos);
      if(object.isSprite)object.material.rotation=(edit.spin||0)*t0;
      else {
        object.rotation.y=(edit.spin||0)*t0;
        if(/arrow|bullet|shot/i.test(layer.model))object.rotation.y+=Math.atan2(r.to.x-r.from.x,r.to.z-r.from.z);
      }
    }
  }
  function clear(){for(const item of live)remove(item);live.length=0;}
  function dispose(){
    disposed=true;clear();root.removeFromParent();
    for(const map of textures.values())void map.then(tex=>tex?.dispose());
    for(const g of new Set([...Object.values(geometries),...originalGeometry.values()]))g.dispose();
  }
  return {ready,warm,play,basic,impact,update,clear,dispose,
    get activeCount(){return live.length;},
    get visualManifest(){return manifest;},
    descriptors
  };
}
