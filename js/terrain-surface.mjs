// The 3×3 IDs fit losslessly in three base-64 floats per vertex. Four atlas
// samples blend natural surfaces around cell centers, in world coordinates.
export function installTerrainBlend(material,blend=.32){
  const uniform={value:blend};
  material.onBeforeCompile=shader=>{
    shader.uniforms.terrainBlend=uniform;
    shader.uniforms.terrainAtlas={value:material.map};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec3 terrainIds;
varying vec3 vTerrainIds;
varying vec2 vTerrainWorld;`).replace('#include <begin_vertex>',`#include <begin_vertex>
vTerrainIds=terrainIds;
vTerrainWorld=position.xz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float terrainBlend;
uniform sampler2D terrainAtlas;
varying vec3 vTerrainIds;
varying vec2 vTerrainWorld;
vec3 terrainRow(float packedId){return mod(floor(floor(packedId+.5)/vec3(1.,64.,4096.)),64.);}
#ifdef USE_MAP
vec4 terrainSample(float id,vec2 p){
  vec2 cell=vec2(mod(id,8.),floor(id/8.));
  vec2 uv=(cell+(vec2(2.)+mod(p,4.)*63.)/256.)/8.;
  uv.y=1.-uv.y;
  vec2 scale=vec2(63./2048.,-63./2048.);
  return textureGrad(terrainAtlas,uv,dFdx(p)*scale,dFdy(p)*scale);
}
#endif`).replace('#include <map_fragment>',`
#ifdef USE_MAP
  vec2 p=vTerrainWorld;
  vec2 q=step(vec2(.5),fract(p));
  vec3 row0=terrainRow(vTerrainIds.x),row1=terrainRow(vTerrainIds.y),row2=terrainRow(vTerrainIds.z);
  vec3 a=mix(row0,row1,q.y),b=mix(row1,row2,q.y);
  float i00=mix(a.x,a.y,q.x),i10=mix(a.y,a.z,q.x);
  float i01=mix(b.x,b.y,q.x),i11=mix(b.y,b.z,q.x);
  vec2 noise=vec2(sin(p.y*13.+sin(p.x*7.)),sin(p.x*11.+sin(p.y*9.)))*.035;
  float width=max(.0001,terrainBlend);
  vec2 weights=smoothstep(vec2(.5-width),vec2(.5+width),fract(p-.5)+noise*step(.001,terrainBlend));
  vec4 sampledDiffuseColor=mix(mix(terrainSample(i00,p),terrainSample(i10,p),weights.x),mix(terrainSample(i01,p),terrainSample(i11,p),weights.x),weights.y);
  diffuseColor*=sampledDiffuseColor;
#endif`);
  };
  material.customProgramCacheKey=()=> 'terrain-natural-blend-v1';
  return {setBlend:value=>{uniform.value=value;}};
}

export function createTerrainGrass(THREE){
  const positions=[],colors=[],indices=[];
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,c=Math.cos(a),s=Math.sin(a),x=c*.16,z=s*.16,o=positions.length/3;
    positions.push(x-s*.035,0,z+c*.035,x+s*.035,0,z-c*.035,x+c*.12-s*.018,.65,z+s*.12+c*.018,x+c*.12+s*.018,.65,z+s*.12-c*.018,x+c*.24,1,z+s*.24);
    colors.push(.34,.43,.2,.34,.43,.2,.72,.85,.4,.72,.85,.4,1,1,.67);
    indices.push(o,o+1,o+2,o+1,o+3,o+2,o+2,o+3,o+4);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const time={value:0},focus={value:new THREE.Vector2()};
  material.onBeforeCompile=shader=>{
    shader.uniforms.grassTime=time;shader.uniforms.grassFocus=focus;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float grassTime;
uniform vec2 grassFocus;`).replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
  vec2 root=instanceMatrix[3].xz;
  float fade=1.-smoothstep(28.,48.,distance(root,grassFocus));
  transformed.y*=fade;
  transformed.x+=sin(grassTime*1.4+root.x*2.+root.y)*.07*position.y*position.y*fade;
#endif`);
  };
  const dummy=new THREE.Object3D();
  return {
    build(instances,heightAt){
      if(!instances.length)return null;
      const mesh=new THREE.InstancedMesh(geometry,material,instances.length);
      instances.forEach((item,i)=>{dummy.position.set(item.x,heightAt(item.x,item.z)+.012,item.z);dummy.rotation.set(0,item.yaw,0);dummy.scale.setScalar(item.height);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(item.color));});
      mesh.computeBoundingSphere();return mesh;
    },
    update(seconds,position){time.value=seconds;focus.value.set(position.x,position.z);}
  };
}
