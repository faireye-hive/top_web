import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const mix=(a,b,t)=>a+(b-a)*t;
const sample=(values,t)=>{
  const x=Math.max(0,Math.min(.999,t))*(values.length-1),i=Math.floor(x),j=Math.min(values.length-1,i+1);
  return values[i].map((v,k)=>mix(v,values[j][k],x-i));
};
export function createSkillVisuals({scene,heightAt}){
  const group=new THREE.Group();group.name='Skills · texturas originais';scene.add(group);
  const loader=new THREE.TextureLoader(),cache=new Map(),active=[];
  let manifest=null;const originalShapes=new Map();
  const modelReady=new GLTFLoader().loadAsync('assets/skills/models.glb?v=1').then(gltf=>{gltf.scene.traverse(o=>{if(o.isMesh){originalShapes.set(o.name.replace(/_/g,' '),o.geometry);originalShapes.set(o.name,o.geometry);o.material.dispose();}});}).catch(e=>console.warn(e.message));
  const manifestReady=fetch('assets/skills/visuals.json?v=1').then(r=>{if(!r.ok)throw Error('VFX indisponíveis');return r.json();}).then(x=>manifest=x).catch(e=>console.warn(e.message));
  const ready=Promise.all([modelReady,manifestReady]);
  function texture(name){
    if(!cache.has(name))cache.set(name,loader.loadAsync('assets/skills/textures/'+name).then(map=>{map.colorSpace=THREE.SRGBColorSpace;return map;}).catch(()=>null));
    return cache.get(name);
  }
  async function warm(skills){
    await ready;
    const names=new Set(skills.flatMap(s=>manifest?.skills?.[s.id]?.layers?.map(l=>l.texture)||[]));
    await Promise.all([...names].map(texture));
  }
  // Geometrias compartilhadas pequenas evitam desenhar atlas cilíndricos como quadrados.
  const shapes={Cylinder:new THREE.CylinderGeometry(.5,.5,1,12,1,true),Cone:new THREE.ConeGeometry(.5,1,12,1,true),
    sphere:new THREE.SphereGeometry(.5,12,8),plane:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),rect:new THREE.PlaneGeometry(1,1)};
  function layerObject(layer){
    const geometry=originalShapes.get(layer.model.replace(/\./g,''))||originalShapes.get(layer.model)||shapes[layer.model]||(/sphere/i.test(layer.model)?shapes.sphere:
      layer.shape==='plane'?shapes.plane:layer.shape==='rect'?shapes.rect:null);
    const options={transparent:true,opacity:0,depthWrite:false,blending:layer.dst===2||layer.maskBlack?THREE.AdditiveBlending:THREE.NormalBlending};
    return geometry?new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({...options,side:THREE.DoubleSide})):
      new THREE.Sprite(new THREE.SpriteMaterial(options));
  }
  function base(position,height=1){return new THREE.Vector3(position.x,heightAt(position.x,position.z)+height,position.z);}
  function remove(record){
    record.object.removeFromParent();record.object.material.map?.dispose();record.object.material.dispose();
    if(record.customGeometry)record.object.geometry.dispose();
  }
  function beam(from,to,kind,delay,duration){
    if(active.length>=64)return;
    const points=[];
    for(let i=0;i<=12;i++){
      const p=from.clone().lerp(to,i/12);
      if(i&&i<12&&kind==='lightning'){p.x+=Math.sin(i*11)*.16;p.z+=Math.cos(i*7)*.16;}
      points.push(p);
    }
    const geometry=new THREE.BufferGeometry().setFromPoints(points);
    const material=new THREE.LineBasicMaterial({color:kind==='lightning'?0xb6e8ff:0xf9a3b0,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending});
    const object=new THREE.Line(geometry,material);object.visible=false;group.add(object);
    active.push({object,age:-delay,duration,kind:'line',customGeometry:true});
  }
  function play(skill,position,target,flight=0){
    if(!manifest)return;
    const layers=manifest.skills[skill.id]?.layers||[];
    const from=base(position),to=base(target||position,.8),kind=skill.fx;
    const delay=skill.windup||.15;
    if(kind==='lightning')beam(to.clone().add(new THREE.Vector3(0,5,0)),to,kind,delay,.35);
    if(kind==='beam')beam(from,to,kind,delay,Math.max(.5,flight));
    const duration=['heal','aura','shield','crystal','stealth','rage'].includes(kind)?Math.min(2.5,skill.duration||1.5):Math.max(.8,flight+.5);
    for(let i=0;i<Math.min(8,layers.length)&&active.length<64;i++){
      const layer=layers[i];
      const object=layerObject(layer),material=object.material;object.visible=false;group.add(object);
      const record={object,age:0,duration:duration+delay,delay,kind,layer,index:i,from:from.clone(),to:to.clone(),flight:Math.max(.12,flight),origin:position};
      active.push(record);
      void texture(layer.texture).then(map=>{if(!object.parent||!map)return;material.map=map.clone();material.map.needsUpdate=true;material.needsUpdate=true;record.loaded=true;if(originalShapes.has(layer.model.replace(/\./g,''))||originalShapes.has(layer.model)){material.map.flipY=false;material.map.needsUpdate=true;}});
    }
  }
  function basic(hero,position,target,flight,period=1){
    if(flight<=0)return;
    const kind=hero.job==='hunter'?'arrows':hero.job==='sharpshooter'?'shot':'bolt';
    const id=hero.job==='hunter'?90:hero.job==='sharpshooter'?94:99;
    play({id,fx:kind,windup:period*.35},position,target,flight);
  }
  function impact(skill,monster){
    if(!manifest)return;
    const layer=manifest.skills[skill?.id]?.layers?.at(-1);
    if(!layer||active.length>=64)return;
    const material=new THREE.SpriteMaterial({transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    const object=new THREE.Sprite(material);group.add(object);
    const record={object,age:0,duration:.45,delay:0,kind:'impact',layer,index:0,from:base(monster),to:base(monster),flight:0};
    active.push(record);void texture(layer.texture).then(map=>{if(object.parent&&map){material.map=map.clone();material.map.needsUpdate=true;material.needsUpdate=true;record.loaded=true;if(originalShapes.has(layer.model.replace(/\./g,''))||originalShapes.has(layer.model)){material.map.flipY=false;material.map.needsUpdate=true;}}});
  }
  function update(dt){
    for(let i=active.length-1;i>=0;i--){
      const r=active[i];r.age+=dt;
      if(r.age>=r.duration){remove(r);active.splice(i,1);continue;}
      if(r.kind==='line'){r.object.visible=r.age>=0;r.object.material.opacity=Math.max(0,1-r.age/r.duration);continue;}
      const age=r.age-r.delay,t=Math.max(0,Math.min(1,age/(r.duration-r.delay)));
      r.object.visible=r.loaded&&age>=0;
      if(!r.object.visible)continue;
      const frames=r.layer.uv;
      if(frames?.length){
        const frame=frames[Math.floor(age/Math.max(.02,r.layer.uvTime||.1))%frames.length];
        const map=r.object.material.map;
        map.repeat.set(frame[2]-frame[0],frame[3]-frame[1]);map.offset.set(frame[0],1-frame[3]);
      }
      const colors=sample(r.layer.color,t),sizes=sample(r.layer.size,t),offset=sample(r.layer.off,t);
      r.object.material.color.setRGB(colors[0],colors[1],colors[2]);
      r.object.material.opacity=Math.max(0,colors[3])*Math.sin(Math.PI*Math.min(.99,t));
      const sx=Math.max(.15,Math.min(4.5,Math.abs(sizes[0]))),sy=Math.max(.15,Math.min(4.5,Math.abs(sizes[1])));
      if(r.object.geometry===shapes.plane)r.object.scale.set(sx,1,sy);else r.object.scale.set(sx,sy,r.object.isMesh?sx:1);r.object.material.rotation=(r.layer.spin||0);
      if(r.object.isMesh)r.object.rotation.y=r.layer.spin||0;
      if(/arrow\.lgo/i.test(r.layer.model))r.object.rotation.y=Math.atan2(r.to.x-r.from.x,r.to.z-r.from.z)+Math.PI;
      const angle=r.index*2.4+age*5;
      const targeted=['bolt','shot','arrows','ice','poison','wave','slash'].includes(r.kind);
      if(targeted){
        const travel=Math.min(1,age/r.flight);
        r.object.position.copy(r.from).lerp(r.to,travel);
        r.object.scale.multiplyScalar(r.kind==='wave'?1.3:.5);
        if(r.kind==='arrows')r.object.position.x+=r.index%2?.12:-.12;
      }else if(r.kind==='meteor'){
        const phase=Math.max(0,Math.min(1,age/.7-r.index*.08));
        r.object.position.copy(r.to);r.object.position.y+=(1-phase)*5;
        r.object.position.x+=Math.sin(r.index*7)*1.7;r.object.position.z+=Math.cos(r.index*7)*1.7;
        r.object.scale.multiplyScalar(.6);
      }else if(r.kind==='tornado'){
        r.object.position.copy(r.to);r.object.position.x+=Math.cos(angle)*(.5+r.index*.08);
        r.object.position.z+=Math.sin(angle)*(.5+r.index*.08);r.object.position.y+=r.index*.25;
        r.object.scale.multiplyScalar(.65);r.object.material.rotation=age*4;if(r.object.isMesh)r.object.rotation.y=age*4;
      }else{
        r.object.position.copy(r.to);
        if(['aura','heal','shield','crystal','rage','stealth'].includes(r.kind)){
          if(r.origin)r.object.position.set(r.origin.x,heightAt(r.origin.x,r.origin.z)+.7,r.origin.z);
          r.object.position.x+=Math.cos(angle)*.5;r.object.position.z+=Math.sin(angle)*.5;
          r.object.position.y+=r.index*.13;r.object.scale.multiplyScalar(.6);
        }
        if(['smash','roar','howl'].includes(r.kind)){
          r.object.position.x+=Math.cos(angle)*t*3;r.object.position.z+=Math.sin(angle)*t*3;
          r.object.position.y=.2+heightAt(r.to.x,r.to.z);r.object.scale.multiplyScalar(.8);
        }
      }
      r.object.position.x+=Math.max(-1,Math.min(1,offset[0]));
      r.object.position.y+=Math.max(-.3,Math.min(1,offset[1]));
      r.object.position.z+=Math.max(-1,Math.min(1,offset[2]));
    }
  }
  function clear(){for(const record of active)remove(record);active.length=0;}
  function dispose(){clear();group.removeFromParent();for(const promise of cache.values())void promise.then(map=>map?.dispose());for(const geometry of new Set([...Object.values(shapes),...originalShapes.values()]))geometry.dispose();}
  return {ready,warm,play,basic,impact,update,clear,dispose,get activeCount(){return active.length;}};
}
