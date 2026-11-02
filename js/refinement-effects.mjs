import {normalizeRefinementStyle,styledRefinementVisual,refinementBladeRange,refinementTipWidth,REFINEMENT_COLOR_MODES,REFINEMENT_STRAND_AURAS} from './refinement-profiles.mjs?v=4';
import {isWeaponAdditiveLayer} from './weapon-materials.mjs?v=3';
import {refinementFollowsSurface,refinementSurfaceSamples,refinementSurfaceSpine} from './refinement-geometry.mjs?v=4';
// Aura vermelha/dourada baseada na referência do jogador. A malha histórica,
// suas texturas e a camada 1.BMP permanecem intactas.
export function createRefinementEffects({THREE,scene,viewportHeight=()=>600}){
  const root=new THREE.Group();root.name='Refino · energia das lâminas';root.visible=false;scene.add(root);
  const beams=[],auras=[],maxParts=2,maxParticles=96,segments=32;
  // Indexed ribbons give real width on mobile and desktop. Buffers stay fixed
  // at two weapons, four strands per weapon and 32 segments per strand.
  function stripGeometry(quads){
    const geometry=new THREE.BufferGeometry(),uv=new Float32Array(quads*8),phase=new Float32Array(quads*4),indices=[];
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(quads*12),3).setUsage(THREE.DynamicDrawUsage));
    for(let q=0;q<quads;q++){
      const t=(q%segments)/segments,next=t+1/segments,at=q*4;
      uv.set([0,t,1,t,0,next,1,next],q*8);phase.fill(Math.floor(q/segments),at,at+4);
      indices.push(at,at+1,at+2,at+2,at+1,at+3);
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    geometry.setAttribute('phase',new THREE.BufferAttribute(phase,1));geometry.setIndex(indices);
    return geometry;
  }
  let style=normalizeRefinementStyle();
  const uniforms={uTime:{value:0},uIntensity:{value:1},uColor:{value:new THREE.Color()},uCore:{value:new THREE.Color()}};
  const glowMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec2 vUv;uniform float uTime,uIntensity;uniform vec3 uColor,uCore;
      void main(){float x=abs(vUv.x*2.-1.);float end=smoothstep(0.,.08,vUv.y)*(1.-smoothstep(.96,1.,vUv.y));
      float flicker=.8+.2*sin(vUv.y*28.-uTime*9.+sin(vUv.y*13.+uTime*3.));
      float flame=pow(max(0.,1.-x),2.)*end*flicker;
      vec3 color=mix(uColor,uCore,pow(1.-x,9.));
      gl_FragColor=vec4(color,flame*uIntensity);}`});
  const auraMaterial=glowMaterial.clone();
  auraMaterial.uniforms.uColor=uniforms.uColor;auraMaterial.uniforms.uCore=uniforms.uColor;
  auraMaterial.uniforms.uTime=uniforms.uTime;
  for(let i=0;i<maxParts;i++){
    const geometry=stripGeometry(segments);
    const mesh=new THREE.Mesh(geometry,glowMaterial);mesh.frustumCulled=false;mesh.renderOrder=8;root.add(mesh);beams.push(mesh);
    const aura=new THREE.Mesh(geometry.clone(),auraMaterial);aura.frustumCulled=false;aura.renderOrder=7;root.add(aura);auras.push(aura);
  }
  const stringHalo=new THREE.Mesh(stripGeometry(segments),auraMaterial);stringHalo.frustumCulled=false;stringHalo.renderOrder=8;root.add(stringHalo);
  const sparkGeometry=new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(maxParticles*3),3).setUsage(THREE.DynamicDrawUsage));
  const sparks=new THREE.Points(sparkGeometry,new THREE.ShaderMaterial({
    uniforms:{uSize:{value:.18},uColor:uniforms.uColor,uCore:uniforms.uCore},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'uniform float uSize;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(uSize*600./max(1.,-p.z),2.,24.);gl_Position=projectionMatrix*p;}',
    fragmentShader:`uniform vec3 uColor,uCore;void main(){vec2 p=abs(gl_PointCoord*2.-1.);float halo=pow(max(0.,1.-length(p)),3.);
      float star=(pow(max(0.,1.-p.x),18.)+pow(max(0.,1.-p.y),18.))*max(0.,1.-max(p.x,p.y));
      float a=halo*.7+star*.8;gl_FragColor=vec4(mix(uColor,uCore,star),a);}`
  }));sparks.frustumCulled=false;sparks.renderOrder=9;root.add(sparks);
  // A soft halo sampled from real animated edges stays visible around open,
  // thin staff/bow geometry where an inverted-normal shell alone disappears.
  // Fixed buffers and one draw call, shared by at most two weapons.
  const haloGeometry=new THREE.BufferGeometry();
  haloGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(maxParts*96*3),3).setUsage(THREE.DynamicDrawUsage));
  const haloUniforms={uSize:{value:.3},uHeight:{value:600},uStrength:{value:0},uColor:uniforms.uColor};
  const surfaceHalo=new THREE.Points(haloGeometry,new THREE.ShaderMaterial({uniforms:haloUniforms,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`uniform float uSize,uHeight;void main(){vec4 p=modelViewMatrix*vec4(position,1.);
      gl_PointSize=clamp(uSize*projectionMatrix[1][1]*uHeight*.5/max(.1,-p.z),1.,128.);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform vec3 uColor;uniform float uStrength;void main(){float d=length(gl_PointCoord*2.-1.);
      float soft=exp(-5.*d*d)*(1.-smoothstep(.65,1.,d));gl_FragColor=vec4(uColor,soft*uStrength);}`
  }));surfaceHalo.frustumCulled=false;surfaceHalo.renderOrder=7;root.add(surfaceHalo);
  const strandUniforms={uTime:uniforms.uTime,uColorA:{value:new THREE.Color()},uColorB:{value:new THREE.Color()},
    uColorMode:{value:0},uAuraType:{value:0},uGlow:{value:1},uHalo:{value:0}};
  const strandMaterial=new THREE.ShaderMaterial({uniforms:strandUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float phase;varying vec2 vUv;varying float vPhase;
      void main(){vUv=uv;vPhase=phase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;varying float vPhase;
      uniform vec3 uColorA,uColorB;uniform float uTime,uColorMode,uAuraType,uGlow,uHalo;
      vec3 rainbow(float h){vec3 p=abs(fract(vec3(h)+vec3(0.,2./3.,1./3.))*6.-3.);return clamp(p-1.,0.,1.);}
      void main(){
        vec3 color=uColorA;
        if(uColorMode>.5&&uColorMode<1.5)color=mix(uColorA,uColorB,vUv.y);
        if(uColorMode>1.5&&uColorMode<2.5)color=mix(uColorA,uColorB,mod(vPhase,2.));
        if(uColorMode>2.5)color=rainbow(vUv.y*.8+vPhase*.17+uTime*.08);
        float edge=max(0.,1.-abs(vUv.x*2.-1.));
        float alpha=pow(edge,uHalo>.5?2.:.65);
        float ends=smoothstep(0.,.04,vUv.y)*(1.-smoothstep(.96,1.,vUv.y));
        float pattern=1.;
        if(uAuraType>1.5&&uAuraType<2.5)pattern=.65+.35*sin(vUv.y*43.-uTime*8.+sin(vUv.y*19.+uTime*3.));
        if(uAuraType>2.5)pattern=.4+.6*step(.35,sin(vUv.y*91.-uTime*19.+vPhase*3.));
        alpha*=ends*(uHalo>.5?.38*uGlow*pattern:.9);
        gl_FragColor=vec4(color,alpha);
      }`});
  const strandGeometry=stripGeometry(maxParts*4*segments),strandAuraGeometry=strandGeometry.clone();
  const strands=new THREE.Mesh(strandGeometry,strandMaterial);
  const strandAuraMaterial=strandMaterial.clone();
  for(const [key,value] of Object.entries(strandUniforms))if(key!=='uHalo')strandAuraMaterial.uniforms[key]=value;
  strandAuraMaterial.uniforms.uHalo.value=1;
  const strandAura=new THREE.Mesh(strandAuraGeometry,strandAuraMaterial);
  for(const mesh of [strands,strandAura]){mesh.frustumCulled=false;mesh.renderOrder=9;root.add(mesh);}
  let avatar=null,bindings=[],surfaceOnly=false,bow=false;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3(),side=new THREE.Vector3(),normal=new THREE.Vector3(),eye=new THREE.Vector3(),v=new THREE.Vector3(),bonePoint=new THREE.Vector3();
  const nodes=Array.from({length:segments+1},()=>new THREE.Vector3());
  const ribbonSides=Array.from({length:segments+1},()=>new THREE.Vector3());
  const surfaceCenters=Array.from({length:segments+1},()=>new THREE.Vector3()),meshScale=new THREE.Vector3();
  const p0=new THREE.Vector3(),p1=new THREE.Vector3(),tangent=new THREE.Vector3();
  function quad(geometry,index,start,end,startSide,endSide,startWidth,endWidth){
    const positions=geometry.attributes.position;
    for(let vertex=0;vertex<4;vertex++){
      v.copy(vertex<2?start:end).addScaledVector(vertex<2?startSide:endSide,(vertex%2?1:-1)*(vertex<2?startWidth:endWidth));
      positions.setXYZ(index*4+vertex,v.x,v.y,v.z);
    }
  }
  function writeStrand(offset,taper){
    for(let node=0;node<=segments;node++){
      tangent.subVectors(nodes[Math.min(segments,node+1)],nodes[Math.max(0,node-1)]);
      ribbonSides[node].crossVectors(tangent,eye).normalize();
      if(ribbonSides[node].lengthSq()<.1)ribbonSides[node].copy(side);
    }
    const halo=(style.strandAura==='flame'?5:style.strandAura==='electric'?3:4)*(taper?1:2);
    for(let segment=0;segment<segments;segment++){
      const w0=.006*style.strandWidth*(taper?refinementTipWidth(segment/segments,style):1);
      const w1=.006*style.strandWidth*(taper?refinementTipWidth((segment+1)/segments,style):1);
      quad(strandGeometry,offset,nodes[segment],nodes[segment+1],ribbonSides[segment],ribbonSides[segment+1],w0,w1);
      quad(strandAuraGeometry,offset++,nodes[segment],nodes[segment+1],ribbonSides[segment],ribbonSides[segment+1],w0*halo,w1*halo);
    }
    return offset;
  }
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
    avatar=value;bindings=[];surfaceOnly=refinementFollowsSurface(holster?.job);bow=holster?.job==='hunter';root.visible=false;avatar?.updateMatrixWorld(true);
    for(const part of (holster?.parts||[]).slice(0,maxParts)){
      const index=part.meshes.findIndex(mesh=>!isWeaponAdditiveLayer(mesh));
      if(index<0)continue;
      const source=part.meshes[index],ends=endpoints(source);
      // Keep the grip-to-tip vertex order when switching to the static back
      // copy. Reordering only the hand mesh would taper the wrong end on back.
      const bone=source.skeleton?.bones[source.geometry.attributes.skinIndex?.getX(ends[0])];
      if(bone){
        source.skeleton.update();bone.getWorldPosition(bonePoint);
        source.getVertexPosition(ends[0],a);source.localToWorld(a);
        source.getVertexPosition(ends[1],b);source.localToWorld(b);
        if(a.distanceToSquared(bonePoint)>b.distanceToSquared(bonePoint))ends.reverse();
      }
      bindings.push({part,index,source,ends,samples:surfaceOnly?refinementSurfaceSamples(source.geometry):[],spine:surfaceOnly?refinementSurfaceSpine(source.geometry,segments):[]});
    }
  }
  function setStyle(value){
    style=normalizeRefinementStyle(value);
    uniforms.uColor.value.set(style.color);uniforms.uCore.value.set(style.coreColor);
    strandUniforms.uColorA.value.set(style.strandColor);strandUniforms.uColorB.value.set(style.strandColor2);
    strandUniforms.uColorMode.value=REFINEMENT_COLOR_MODES.indexOf(style.strandColorMode);
    strandUniforms.uAuraType.value=REFINEMENT_STRAND_AURAS.indexOf(style.strandAura);
    strandUniforms.uGlow.value=style.strandGlow;
  }
  setStyle(style);
  function update(time,camera,level,{mobile=false,hidden=false}={}){
    const config=styledRefinementVisual(level,mobile,style);
    time*=style.speed;
    root.visible=!!avatar&&avatar.visible&&!hidden&&config.level>0&&bindings.length>0;
    if(!root.visible)return;
    avatar.updateMatrixWorld(true);uniforms.uTime.value=time;uniforms.uIntensity.value=config.intensity*style.intensity*(1+style.pulse*Math.sin(time*3));
    auraMaterial.uniforms.uIntensity.value=uniforms.uIntensity.value*(surfaceOnly?.5:.26)*style.aura;
    camera.getWorldDirection(eye);let particle=0,strandQuad=0,haloCount=0;
    haloUniforms.uSize.value=(.3+config.level*.02)*style.width*Math.sqrt(style.radius);
    haloUniforms.uHeight.value=viewportHeight();
    haloUniforms.uStrength.value=(.08+config.level*.007)*style.intensity*style.aura*(1+style.pulse*Math.sin(time*3));
    sparks.material.uniforms.uSize.value=(.09+config.level*.015)*style.particleSize;
    for(let i=0;i<beams.length;i++){beams[i].visible=false;auras[i].visible=false;}
    stringHalo.visible=false;
    for(const [index,binding] of bindings.entries()){
      const {part,source,ends}=binding;
      const mesh=part.mode==='back'?part.views[binding.index]:part.mode==='hand'?source:null;
      if(!mesh||!mesh.visible)continue;
      mesh.skeleton?.update();mesh.getVertexPosition(ends[0],a);mesh.localToWorld(a);
      mesh.getVertexPosition(ends[1],b);mesh.localToWorld(b);
      if(surfaceOnly){
        const count=Math.min(binding.samples.length,mobile?64:96);
        for(let n=0;n<count;n++){
          const sample=binding.samples[n];
          mesh.getVertexPosition(sample.a,a);mesh.getVertexPosition(sample.b,b);
          v.copy(a).lerp(b,sample.t);mesh.localToWorld(v);
          haloGeometry.attributes.position.setXYZ(haloCount++,v.x,v.y,v.z);
          if(n<config.particles&&particle<maxParticles)sparkGeometry.attributes.position.setXYZ(particle++,v.x,v.y,v.z);
        }
        const {spine}=binding;if(!spine.length)continue;
        mesh.getWorldScale(meshScale);const scale=Math.max(meshScale.x,meshScale.y,meshScale.z);
        for(let n=0;n<=segments;n++){
          const center=surfaceCenters[n];center.set(0,0,0);
          for(let k=0;k<spine[n].indices.length;k++){mesh.getVertexPosition(spine[n].indices[k],v);mesh.localToWorld(v);center.addScaledVector(v,spine[n].weights[k]);}
        }
        const aura=auras[index];aura.visible=style.aura>0;
        axis.subVectors(surfaceCenters[segments],surfaceCenters[0]).normalize();
        side.crossVectors(axis,eye).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
        normal.crossVectors(axis,side).normalize();
        for(let n=0;n<segments;n++){
          const widthAt=i=>spine[i].radius*scale+config.width*(.6+style.aura*.2)*style.radius;
          quad(aura.geometry,n,surfaceCenters[n],surfaceCenters[n+1],side,side,widthAt(n),widthAt(n+1));
        }
        aura.geometry.attributes.position.needsUpdate=true;
        // Actual orbiting filaments surround the curved cross sections, while
        // the center and radius follow the weapon, even during attack poses.
        for(let strand=0;strand<config.strands;strand++){
          for(let n=0;n<=segments;n++){
            const t=n/segments;
            const angle=time*3.2+t*11+strand*6.283/config.strands;
            const ripple=style.strandAura==='electric'?1+.22*Math.sin(n*7.3+Math.floor(time*12)+strand):style.strandAura==='flame'?1+.15*Math.sin(t*23-time*6+strand):1;
            const radius=(spine[n].radius*scale+config.width*.7)*style.radius*(.35+.65*Math.sin(t*Math.PI))*ripple;
            nodes[n].copy(surfaceCenters[n]).addScaledVector(side,Math.cos(angle)*radius).addScaledVector(normal,Math.sin(angle)*radius);
          }
          strandQuad=writeStrand(strandQuad,false);
        }
        if(bow){
          // The string joins the two actual limb tips, not the bounding-box
          // diagonal. Its endpoints move with the same animated vertices.
          a.copy(surfaceCenters[0]);b.copy(surfaceCenters[segments]);
          tangent.subVectors(b,a);side.crossVectors(tangent,eye).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
          const beam=beams[index],width=.005+config.level*.0004;beam.visible=true;stringHalo.visible=style.aura>0;
          for(let n=0;n<segments;n++){
            p0.copy(a).lerp(b,n/segments);p1.copy(a).lerp(b,(n+1)/segments);
            quad(beam.geometry,n,p0,p1,side,side,width,width);
            quad(stringHalo.geometry,n,p0,p1,side,side,width*6,width*6);
          }
          beam.geometry.attributes.position.needsUpdate=true;stringHalo.geometry.attributes.position.needsUpdate=true;
        }
        continue;
      }
      axis.subVectors(b,a);const length=axis.length();if(length<.05)continue;axis.normalize();
      const range=refinementBladeRange(length,config.extension,style);
      a.addScaledVector(axis,range.start);b.copy(a).addScaledVector(axis,range.end-range.start);
      side.crossVectors(axis,eye).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
      normal.crossVectors(axis,side).normalize();
      const beam=beams[index],aura=auras[index];beam.visible=true;aura.visible=style.aura>0;
      for(let segment=0;segment<segments;segment++){
        const t=segment/segments,next=(segment+1)/segments;
        p0.copy(a).lerp(b,t);p1.copy(a).lerp(b,next);
        const w0=config.width*refinementTipWidth(t,style),w1=config.width*refinementTipWidth(next,style);
        quad(beam.geometry,segment,p0,p1,side,side,w0,w1);
        quad(aura.geometry,segment,p0,p1,side,side,w0*(1.8+style.aura),w1*(1.8+style.aura));
      }
      beam.geometry.attributes.position.needsUpdate=true;aura.geometry.attributes.position.needsUpdate=true;
      const pointAt=(t,angle,radius,out)=>out.copy(a).lerp(b,t).addScaledVector(side,Math.cos(angle)*radius).addScaledVector(normal,Math.sin(angle)*radius);
      for(let n=0;n<config.particles&&particle<maxParticles;n++){
        const t=(n*.6180339+time*(.18+n%3*.035))%1,angle=time*(2+n%3)+n*2.4;
        pointAt(t,angle,config.width*style.radius*refinementTipWidth(t,style)*(.25+(n%5)*.24),v);
        sparkGeometry.attributes.position.setXYZ(particle++,v.x,v.y,v.z);
      }
      for(let strand=0;strand<config.strands;strand++){
        for(let node=0;node<=segments;node++){
          const t=node/segments,tip=refinementTipWidth(t,style);
          const ripple=style.strandAura==='electric'?1+.22*Math.sin(node*7.3+Math.floor(time*12)+strand):
            style.strandAura==='flame'?1+.15*Math.sin(t*23-time*6+strand):1;
          pointAt(t,time*3.2+t*11+strand*6.283/config.strands,config.width*style.radius*.55*Math.sin(t*Math.PI)*tip*ripple,nodes[node]);
        }
        strandQuad=writeStrand(strandQuad,true);
      }
    }
    sparkGeometry.setDrawRange(0,particle);sparkGeometry.attributes.position.needsUpdate=true;
    surfaceHalo.visible=haloCount>0&&style.aura>0;haloGeometry.setDrawRange(0,haloCount);haloGeometry.attributes.position.needsUpdate=true;
    strands.visible=strandQuad>0;strandAura.visible=strandQuad>0&&style.strandAura!=='none'&&style.strandGlow>0;
    for(const geometry of [strandGeometry,strandAuraGeometry]){
      geometry.setDrawRange(0,strandQuad*6);geometry.attributes.position.needsUpdate=true;
    }
  }
  function dispose(){
    scene.remove(root);root.traverse(o=>o.geometry?.dispose());
    for(const material of [glowMaterial,auraMaterial,sparks.material,surfaceHalo.material,strandMaterial,strandAuraMaterial])material.dispose();
  }
  return {setAvatar,setStyle,update,dispose};
}
