import {weaponMeshNodes} from './pose-studio-runtime.mjs?v=7';
import {weaponPrimitives,isWeaponAdditiveLayer} from './weapon-materials.mjs?v=3';
import {refinementFollowsSurface} from './refinement-geometry.mjs?v=4';
import {normalizeRefinementStyle,REFINEMENT_SURFACE_PATTERNS,REFINEMENT_COLOR_MODES,REFINEMENT_STRAND_AURAS} from './refinement-profiles.mjs?v=4';

export const REFINEMENT_EQUIPMENT=['armor','gloves','boots','hat'];
export function refinementSurfaceNodes(avatar,actor){
  const result={weapon:[],armor:[],gloves:[],boots:[],hat:[]},seen=new Set();
  function add(kind,node){
    for(const mesh of weaponPrimitives(node))if(!seen.has(mesh)&&!isWeaponAdditiveLayer(mesh)){
      seen.add(mesh);result[kind].push(mesh);
    }
  }
  for(const node of weaponMeshNodes(avatar))add('weapon',node);
  avatar?.traverse(node=>{
    const slot=Number(node.userData?.equipmentSlot),role=node.userData?.topRole;
    const match=String(node.name||'').match(/^Parte[\s_]+([0-4])(?:[\s_·.-]|$)/i);
    const part=match?Number(match[1]):-1;
    const explicit=REFINEMENT_EQUIPMENT.includes(role)?role:({1:'hat',2:'armor',3:'gloves',4:'boots'})[slot];
    // Legacy part 0 is hair, not a hat. Only explicit headgear receives glow;
    // never paint the face (part 1) or bare hair.
    const kind=explicit||({2:'armor',3:'gloves',4:'boots'})[part];
    if(kind)add(kind,node);
  });
  return result;
}

// Add a textured glow to the existing PBR surface. No new texture downloads,
// lights or draw calls; preserve original maps and independent material edits.
export function createRefinementSurfaces({THREE}){
  let entries=[],restores=[],shells=[],avatar=null,available={},staff=false;
  let style=normalizeRefinementStyle();
  const color=new THREE.Color(),core=new THREE.Color();
  function shell(source,kind){
    if(!source.geometry?.attributes?.normal)return;
    const uniforms={uTime:{value:0},uWidth:{value:0},uIntensity:{value:0},uColor:{value:new THREE.Color()},uCore:{value:new THREE.Color()},
      uStrandA:{value:new THREE.Color()},uStrandB:{value:new THREE.Color()},uMode:{value:0},uStrands:{value:0},uStrandWidth:{value:1},uStrandGlow:{value:1},uAuraType:{value:0}};
    const material=new THREE.ShaderMaterial({uniforms,side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`#include <common>
        #include <skinning_pars_vertex>
        uniform float uWidth,uTime,uAuraType;varying vec3 vRefNormal,vRefView;varying vec2 vRefUv;
        void main(){
          #include <beginnormal_vertex>
          #include <skinbase_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          float expansion=1.;
          if(uAuraType>1.5&&uAuraType<2.5)expansion=1.+.12*sin(uv.y*23.-uTime*6.);
          if(uAuraType>2.5)expansion=1.+.12*sin(floor(uv.y*20.)*7.3+floor(uTime*12.));
          transformed+=normalize(objectNormal)*uWidth*expansion;
          vec4 mvPosition=modelViewMatrix*vec4(transformed,1.);
          vRefNormal=normalize(normalMatrix*objectNormal);vRefView=-mvPosition.xyz;vRefUv=uv;
          gl_Position=projectionMatrix*mvPosition;
        }`,
      fragmentShader:`uniform float uTime,uIntensity,uMode,uStrands,uStrandWidth,uStrandGlow,uAuraType;
        uniform vec3 uColor,uCore,uStrandA,uStrandB;varying vec3 vRefNormal,vRefView;varying vec2 vRefUv;
        vec3 rainbow(float h){vec3 p=abs(fract(vec3(h)+vec3(0.,2./3.,1./3.))*6.-3.);return clamp(p-1.,0.,1.);}
        void main(){
          float rim=pow(1.-abs(dot(normalize(vRefNormal),normalize(vRefView))),1.4);
          float flow=.5+.5*sin(vRefUv.y*18.-uTime*4.);
          vec3 color=mix(uColor,uCore,flow*.35);
          if(uStrands>.5){
            float band=pow(.5+.5*sin((vRefUv.y*25.+vRefUv.x*8.)*uStrands-uTime*4.),max(1.,10./uStrandWidth));
            vec3 strand=uStrandA;
            if(uMode>.5&&uMode<1.5)strand=mix(uStrandA,uStrandB,fract(vRefUv.y));
            if(uMode>1.5&&uMode<2.5)strand=mix(uStrandA,uStrandB,mod(floor(abs(vRefUv.y)*uStrands*8.),2.));
            if(uMode>2.5)strand=rainbow(vRefUv.y+uTime*.08);
            color=mix(color,strand,band*.8);
          }
          gl_FragColor=vec4(color,rim*uIntensity*(.75+.25*flow)*(1.+uStrandGlow*.15*flow));
        }`});
    const object=source.isSkinnedMesh?new THREE.SkinnedMesh(source.geometry,material):new THREE.Mesh(source.geometry,material);
    if(source.isSkinnedMesh){object.skeleton=source.skeleton;object.bindMode=source.bindMode;object.bindMatrix.copy(source.bindMatrix);object.bindMatrixInverse.copy(source.bindMatrixInverse);}
    object.name='Refino · aura da superfície';object.frustumCulled=false;object.renderOrder=7;object.visible=false;source.add(object);
    shells.push({kind,object,material,uniforms});
  }
  function clear(){
    for(const item of shells){item.object.parent?.remove(item.object);item.material.dispose();}shells=[];
    for(const {mesh,original,material} of restores)if(mesh.material===material)mesh.material=original;
    for(const entry of entries)entry.material.dispose();
    entries=[];restores=[];available={};avatar=null;
  }
  function bind(value,holster,actor){
    clear();avatar=value;staff=refinementFollowsSurface(holster?.job);if(!avatar)return;
    const groups=refinementSurfaceNodes(avatar,actor);
    for(const [kind,meshes] of Object.entries(groups)){
      available[kind]=meshes.length>0;const byMaterial=new Map();
      for(const mesh of meshes){
        const original=mesh.material;if(!original||Array.isArray(original))continue;
        let entry=byMaterial.get(original);
        if(!entry){
          const material=original.clone();
          const uniforms={uRefTime:{value:0},uRefColor:{value:new THREE.Color()},uRefCore:{value:new THREE.Color()},
            uRefTint:{value:0},uRefGlow:{value:0},uRefPattern:{value:0}};
          const previous=original.onBeforeCompile,previousKey=original.customProgramCacheKey?.call(original)||'';
          material.onBeforeCompile=function(shader,...args){
            previous?.call(this,shader,...args);Object.assign(shader.uniforms,uniforms);
            shader.fragmentShader=`uniform float uRefTime,uRefTint,uRefGlow,uRefPattern;uniform vec3 uRefColor,uRefCore;\n`+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
              float refWave=.5;
              if(uRefPattern>.5)refWave=.5+.5*sin(uRefTime*3.);
              #ifdef USE_MAP
              if(uRefPattern>1.5)refWave=.5+.5*sin(vMapUv.y*18.+vMapUv.x*4.-uRefTime*4.);
              #endif
              vec3 refColor=mix(uRefColor,uRefCore,refWave);
              float refDetail=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),.12,1.);
              diffuseColor.rgb=mix(diffuseColor.rgb,refColor*(.35+.65*refDetail),uRefTint);`);
            shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
              totalEmissiveRadiance+=refColor*(.2+.8*refDetail)*uRefGlow*(.65+.35*refWave);`);
          };
          material.customProgramCacheKey=()=>previousKey+'|top-refinement-surface-v1';material.needsUpdate=true;
          entry={kind,material,uniforms};entries.push(entry);byMaterial.set(original,entry);
        }
        mesh.material=entry.material;restores.push({mesh,original,material:entry.material});
        if(kind!=='weapon'||staff)shell(mesh,kind);
      }
    }
    // Holstered copies must share the same appearance as the hand surface.
    for(const part of holster?.parts||[])part.views?.forEach((view,index)=>{
      const source=part.meshes[index],original=view.material;
      if(source&&source.material!==original&&!isWeaponAdditiveLayer(source)){
        view.material=source.material;restores.push({mesh:view,original,material:source.material});
        if(staff)shell(view,'weapon');
      }
    });
  }
  function update(time,level,{hidden=false,equipped=true}={}){
    if(!avatar)return;
    const progress=level>0?.25+.75*Math.min(13,level)/13:0;
    for(const {kind,uniforms} of entries){
      const weapon=kind==='weapon',enabled=!hidden&&equipped&&(!weapon||style.weaponSurface);
      const strength=enabled?(weapon?style.surfaceGlow*progress:style[kind+'Glow']):0;
      const tint=enabled?(weapon?style.surfaceTint*progress:strength>0?style.armorTint:0):0;
      color.set(weapon||style.armorFollow?style.color:style.armorColor);
      core.set(weapon||style.armorFollow?style.coreColor:style.armorColor);
      uniforms.uRefTime.value=time*style.speed;
      uniforms.uRefColor.value.copy(color);uniforms.uRefCore.value.copy(core);
      uniforms.uRefTint.value=tint;uniforms.uRefGlow.value=strength;
      uniforms.uRefPattern.value=REFINEMENT_SURFACE_PATTERNS.indexOf(style.surfacePattern);
    }
    for(const {kind,object,uniforms} of shells){
      const state=refinementAuraState(style,kind,level),weapon=kind==='weapon';
      object.visible=!hidden&&equipped&&state.intensity>0;
      uniforms.uWidth.value=state.width;uniforms.uIntensity.value=state.intensity;uniforms.uTime.value=time*style.speed;
      uniforms.uColor.value.set(weapon||style.armorFollow?style.color:style.armorColor);
      uniforms.uCore.value.set(weapon||style.armorFollow?style.coreColor:style.armorColor);
      uniforms.uStrandA.value.set(style.strandColor);uniforms.uStrandB.value.set(style.strandColor2);
      uniforms.uMode.value=REFINEMENT_COLOR_MODES.indexOf(style.strandColorMode);
      uniforms.uStrands.value=weapon&&level>=5?Math.min(4,Math.round((1+Math.floor((level-5)/3))*style.strands)):0;
      uniforms.uStrandWidth.value=style.strandWidth;uniforms.uStrandGlow.value=weapon?style.strandGlow:0;
      uniforms.uAuraType.value=weapon?REFINEMENT_STRAND_AURAS.indexOf(style.strandAura):0;
    }
  }
  return {bind,clear,update,setStyle:value=>{style=normalizeRefinementStyle(value);},available:()=>({...available})};
}

export function refinementAuraState(style,kind,level){
  if(kind==='weapon')return {width:(.015+Math.max(0,level)*.002)*style.width*style.radius,
    intensity:level>0?(.3+Math.min(13,level)*.085)*style.intensity*style.aura:0};
  return {width:.04*style.equipmentAuraWidth,intensity:style[kind+'Aura']||0};
}
