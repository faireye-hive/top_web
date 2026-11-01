import {normalizeRefinementStyle,styledRefinementVisual} from './refinement-profiles.mjs';
import {isWeaponAdditiveLayer} from './weapon-materials.mjs?v=3';
// Aura vermelha/dourada baseada na referência do jogador. A malha histórica,
// suas texturas e a camada 1.BMP permanecem intactas.
export function createRefinementEffects({THREE,scene}){
  const root=new THREE.Group();root.name='Refino · energia das lâminas';root.visible=false;scene.add(root);
  const beams=[],auras=[],maxParts=2,maxParticles=96;
  let style=normalizeRefinementStyle();
  const uniforms={uTime:{value:0},uIntensity:{value:1},uColor:{value:new THREE.Color()},uCore:{value:new THREE.Color()}};
  const glowMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vUv;uniform float uTime,uIntensity;uniform vec3 uColor,uCore;
      void main(){float x=abs(vUv.x*2.-1.);float end=smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.88,1.,vUv.y));
      float flicker=.8+.2*sin(vUv.y*28.-uTime*9.+sin(vUv.y*13.+uTime*3.));
      float flame=pow(max(0.,1.-x),2.)*end*flicker;
      vec3 color=mix(uColor,uCore,pow(1.-x,9.));
      gl_FragColor=vec4(color,flame*uIntensity);}`});
  const auraMaterial=glowMaterial.clone();
  auraMaterial.uniforms.uColor=uniforms.uColor;auraMaterial.uniforms.uCore=uniforms.uColor;
  auraMaterial.uniforms.uTime=uniforms.uTime;
  for(let i=0;i<maxParts;i++){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));geometry.setIndex([0,1,2,2,1,3]);
    const mesh=new THREE.Mesh(geometry,glowMaterial);mesh.frustumCulled=false;mesh.renderOrder=8;root.add(mesh);beams.push(mesh);
    const aura=new THREE.Mesh(geometry.clone(),auraMaterial);aura.frustumCulled=false;aura.renderOrder=7;root.add(aura);auras.push(aura);
  }
  const sparkGeometry=new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(maxParticles*3),3).setUsage(THREE.DynamicDrawUsage));
  const sparks=new THREE.Points(sparkGeometry,new THREE.ShaderMaterial({
    uniforms:{uSize:{value:.18},uColor:uniforms.uColor,uCore:uniforms.uCore},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'uniform float uSize;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(uSize*600./max(1.,-p.z),2.,24.);gl_Position=projectionMatrix*p;}',
    fragmentShader:`uniform vec3 uColor,uCore;void main(){vec2 p=abs(gl_PointCoord*2.-1.);float halo=pow(max(0.,1.-length(p)),3.);
      float star=(pow(max(0.,1.-p.x),18.)+pow(max(0.,1.-p.y),18.))*max(0.,1.-max(p.x,p.y));
      float a=halo*.7+star*.8;gl_FragColor=vec4(mix(uColor,uCore,star),a);}`
  }));sparks.frustumCulled=false;sparks.renderOrder=9;root.add(sparks);
  const lineGeometry=new THREE.BufferGeometry();
  lineGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(maxParts*4*12*2*3),3).setUsage(THREE.DynamicDrawUsage));
  const strands=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0xff6e21,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));
  strands.frustumCulled=false;strands.renderOrder=9;root.add(strands);
  let avatar=null,bindings=[];
  const a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3(),side=new THREE.Vector3(),normal=new THREE.Vector3(),eye=new THREE.Vector3(),v=new THREE.Vector3(),bonePoint=new THREE.Vector3();
  function endpoints(mesh){
    const position=mesh.geometry.attributes.position;
    let first=0,last=0,max=-1;const origin=new THREE.Vector3().fromBufferAttribute(position,0),point=new THREE.Vector3();
    for(let pass=0;pass<2;pass++){
      max=-1;
      for(let i=0;i<position.count;i++){
        point.fromBufferAttribute(position,i);const d=point.distanceToSquared(origin);
        if(d>max){max=d;if(pass===0)first=i;else last=i;}
      }
      origin.fromBufferAttribute(position,first);
    }
    return [first,last];
  }
  function setAvatar(value,holster){
    avatar=value;bindings=[];root.visible=false;
    for(const part of (holster?.parts||[]).slice(0,maxParts)){
      const index=part.meshes.findIndex(mesh=>!isWeaponAdditiveLayer(mesh));
      if(index<0)continue;
      const source=part.meshes[index];bindings.push({part,index,source,ends:endpoints(source)});
    }
  }
  function setStyle(value){
    style=normalizeRefinementStyle(value);
    uniforms.uColor.value.set(style.color);uniforms.uCore.value.set(style.coreColor);
    strands.material.color.set(style.strandColor);
  }
  setStyle(style);
  function update(time,camera,level,{mobile=false,hidden=false}={}){
    const config=styledRefinementVisual(level,mobile,style);
    time*=style.speed;
    root.visible=!!avatar&&avatar.visible&&!hidden&&config.level>0&&bindings.length>0;
    if(!root.visible)return;
    avatar.updateMatrixWorld(true);uniforms.uTime.value=time;uniforms.uIntensity.value=config.intensity*style.intensity*(1+style.pulse*Math.sin(time*3));
    auraMaterial.uniforms.uIntensity.value=uniforms.uIntensity.value*.26*style.aura;
    camera.getWorldDirection(eye);let particle=0,line=0;
    sparks.material.uniforms.uSize.value=(.09+config.level*.015)*style.particleSize;
    for(let i=0;i<beams.length;i++){beams[i].visible=false;auras[i].visible=false;}
    for(const [index,binding] of bindings.entries()){
      const {part,source,ends}=binding;
      const mesh=part.mode==='back'?part.views[binding.index]:part.mode==='hand'?source:null;
      if(!mesh||!mesh.visible)continue;
      mesh.skeleton?.update();mesh.getVertexPosition(ends[0],a);mesh.localToWorld(a);
      mesh.getVertexPosition(ends[1],b);mesh.localToWorld(b);
      if(part.mode==='hand'&&mesh.skeleton){
        const bone=mesh.geometry.attributes.skinIndex?.getX(ends[0]);
        mesh.skeleton.bones[bone]?.getWorldPosition(bonePoint);
        if(a.distanceToSquared(bonePoint)>b.distanceToSquared(bonePoint)){v.copy(a);a.copy(b);b.copy(v);}
      }
      axis.subVectors(b,a);const length=axis.length();if(length<.05)continue;axis.normalize();
      a.addScaledVector(axis,length*.14-config.extension);b.addScaledVector(axis,config.extension);
      side.crossVectors(axis,eye).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
      normal.crossVectors(axis,side).normalize();
      const beam=beams[index],aura=auras[index],positions=beam.geometry.attributes.position,auraPositions=aura.geometry.attributes.position;beam.visible=true;aura.visible=style.aura>0;
      for(let vertex=0;vertex<4;vertex++){
        v.copy(vertex<2?a:b).addScaledVector(side,(vertex%2?1:-1)*config.width);
        positions.setXYZ(vertex,v.x,v.y,v.z);
        v.copy(vertex<2?a:b).addScaledVector(side,(vertex%2?1:-1)*config.width*(1.8+style.aura));
        auraPositions.setXYZ(vertex,v.x,v.y,v.z);
      }
      positions.needsUpdate=true;auraPositions.needsUpdate=true;
      const pointAt=(t,angle,radius,out)=>out.copy(a).lerp(b,t).addScaledVector(side,Math.cos(angle)*radius).addScaledVector(normal,Math.sin(angle)*radius);
      for(let n=0;n<config.particles&&particle<maxParticles;n++){
        const t=(n*.6180339+time*(.18+n%3*.035))%1,angle=time*(2+n%3)+n*2.4;
        pointAt(t,angle,config.width*style.radius*(.25+(n%5)*.24),v);
        sparkGeometry.attributes.position.setXYZ(particle++,v.x,v.y,v.z);
      }
      for(let strand=0;strand<config.strands;strand++)for(let segment=0;segment<12;segment++)for(let end=0;end<2;end++){
        const t=(segment+end)/12;pointAt(t,time*3.2+t*11+strand*6.283/config.strands,config.width*style.radius*.55*Math.sin(t*Math.PI),v);
        lineGeometry.attributes.position.setXYZ(line++,v.x,v.y,v.z);
      }
    }
    sparkGeometry.setDrawRange(0,particle);sparkGeometry.attributes.position.needsUpdate=true;
    lineGeometry.setDrawRange(0,line);lineGeometry.attributes.position.needsUpdate=true;
  }
  function dispose(){
    scene.remove(root);root.traverse(o=>o.geometry?.dispose());
    for(const material of [glowMaterial,auraMaterial,sparks.material,strands.material])material.dispose();
  }
  return {setAvatar,setStyle,update,dispose};
}
