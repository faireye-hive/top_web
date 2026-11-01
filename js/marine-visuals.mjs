export function waveHeight(x,z,time,strength=.65){
  return (Math.sin(x*.24+z*.17+time*1.15)*.10+Math.sin(x*-.16+z*.31-time*.9)*.065)*strength;
}
export function createSeaMaterial(THREE,settings={waves:.65,sparkle:.55},{lightweight=false}={}){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:true,
    defines:lightweight?{LIGHT_WATER:1}:{},
    uniforms:{uTime:{value:0},uWaves:{value:settings.waves},uSparkle:{value:settings.sparkle}},
    vertexShader:`
      attribute float aShore;
      uniform float uTime,uWaves;
      varying float vShore;
      varying vec3 vSurface;
      void main(){
        vShore=aShore;vec3 p=position;
        p.y+=(sin(p.x*.24+p.z*.17+uTime*1.15)*.10+sin(p.x*-.16+p.z*.31-uTime*.9)*.065)*uWaves*aShore;
        vSurface=(modelMatrix*vec4(p,1.0)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(vSurface,1.0);
      }`,
    fragmentShader:`
      uniform float uTime,uWaves,uSparkle;
      varying float vShore;
      varying vec3 vSurface;
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);
        float b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453);
        float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453);
        float d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453);
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
      void main(){
        vec2 p=vSurface.xz;
        float a=cos(dot(p,vec2(.24,.17))+uTime*1.15);
        float b=cos(dot(p,vec2(-.16,.31))-uTime*.9);
        #ifdef LIGHT_WATER
          vec2 ripple=vec2(sin(p.x*.85+p.y*.51+uTime*.38),cos(p.y*.71-p.x*.43-uTime*.29))*.55;
        #else
          vec2 ripple=vec2(noise(p*.85+vec2(uTime*.38,-uTime*.21)),noise(p*.71+vec2(17.3-uTime*.29,uTime*.18)))*2.0-1.0;
        #endif
        vec3 normal=normalize(vec3(-(.024*a-.0104*b+ripple.x*.055)*uWaves,1.0,-(.017*a+.02015*b+ripple.y*.055)*uWaves));
        vec3 eye=normalize(cameraPosition-vSurface);
        float fresnel=pow(1.0-max(dot(normal,eye),0.0),3.0);
        float swell=sin(p.x*.43+p.y*.28+uTime*.8)*.35+.5+ripple.x*.15;
        vec3 color=mix(vec3(.005,.065,.17),vec3(.012,.19,.31),swell*.55);
        color=mix(color,vec3(.10,.32,.43),fresnel*.65);
        vec3 halfLight=normalize(eye+normalize(vec3(-.35,.8,.4)));
        float sparkle=pow(max(dot(normal,halfLight),0.0),100.0)*uSparkle;
        color+=vec3(.55,.8,1.0)*sparkle*.65;
        float shore=(1.0-smoothstep(.32,.78,vShore))*smoothstep(.02,.22,vShore);
        float foam=smoothstep(.50,.90,sin(p.x*2.0+p.y*2.7-uTime*1.5)*.5+.5)*shore;
        color=mix(color,vec3(.38,.68,.72),foam*.55);
        float alpha=smoothstep(0.0,.72,vShore)*.95;
        if(alpha<.015)discard;
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}
export function decorateBoat(THREE,root,settings){
  root.scale.setScalar(settings.scale);
  root.traverse(o=>{if(o.isMesh){
    o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
    for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.color?.set(settings.color);
  }});
  const sails=[];
  if(settings.sails){
    const wood=new THREE.MeshStandardMaterial({color:0x694829,roughness:.9});
    for(const z of [-.8,.65]){
      const mast=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,2.4,8),wood);
      mast.position.set(0,1.55,z);root.add(mast);
      const yard=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,1.65,8),wood);
      yard.rotation.z=Math.PI/2;yard.position.set(0,2.4,z);root.add(yard);
      const geo=new THREE.PlaneGeometry(1.5,1.35,10,10);
      const mat=new THREE.MeshStandardMaterial({color:settings.sailColor,side:THREE.DoubleSide,roughness:.9});
      const sail=new THREE.Mesh(geo,mat);sail.position.set(0,1.73,z);root.add(sail);
      sails.push({sail,base:geo.attributes.position.array.slice()});
    }
  }
  return {update(time){
    for(const {sail,base} of sails){
      const p=sail.geometry.attributes.position;
      for(let i=0;i<p.count;i++)p.setZ(i,base[i*3+2]+Math.sin((base[i*3]+.75)/1.5*Math.PI)*(.14+.045*Math.sin(time*2+base[i*3+1]*3)));
      p.needsUpdate=true;sail.geometry.computeVertexNormals();
    }
  }};
}
export function createBoatEffects(THREE,scene){
  const count=144,geometry=new THREE.PlaneGeometry(1,1);
  const alpha=new THREE.InstancedBufferAttribute(new Float32Array(count),1);geometry.setAttribute('aOpacity',alpha);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`attribute float aOpacity;varying vec2 vUv;varying float vAlpha;
      void main(){vUv=uv;vAlpha=aOpacity;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv;varying float vAlpha;
      void main(){vec2 p=vUv*2.0-1.0;float r=length(p);float foam=(1.0-smoothstep(.28,1.0,r))*(.7+.3*sin(p.x*28.0+p.y*16.0));
      gl_FragColor=vec4(.7,.94,1.0,foam*vAlpha);}`});
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.renderOrder=5;scene.add(mesh);
  const particles=[],dummy=new THREE.Object3D();let carry=0,last=null;
  return {update(dt,position,yaw,active,settings,length=4.8){
    const distance=last?Math.hypot(position.x-last.x,position.z-last.z):0;
    const speed=dt>0?distance/dt:0;
    if(active&&distance<10&&speed>.1){
      carry+=distance*1.8;
      while(carry>=1){
        carry--;const side=particles.length%2?1:-1,half=length*settings.scale*.58;
        particles.push({x:position.x+Math.sin(yaw)*half+Math.cos(yaw)*side*.6*settings.scale,
          z:position.z+Math.cos(yaw)*half-Math.sin(yaw)*side*.6*settings.scale,
          age:0,life:4+Math.random()*2,width:.8*settings.scale,yaw,side});
      }
    }else carry=0;
    last={x:position.x,z:position.z};
    for(const p of particles)p.age+=dt;
    while(particles.length&&(particles[0].age>particles[0].life||particles.length>count))particles.shift();
    mesh.visible=active||particles.length>0;mesh.count=particles.length;
    for(let i=0;i<particles.length;i++){
      const p=particles[i],fade=Math.max(0,1-p.age/p.life);
      dummy.position.set(p.x+Math.cos(p.yaw)*p.side*p.age*.4,.10,p.z-Math.sin(p.yaw)*p.side*p.age*.4);dummy.rotation.set(-Math.PI/2,0,p.yaw);
      dummy.scale.setScalar(p.width*(1+p.age*.65));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      alpha.setX(i,fade*.68*settings.wake);
    }
    alpha.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;
    return speed;
  },stats(){return {particles:particles.length};},reset(){particles.length=0;last=null;carry=0;mesh.count=0;}};
}
