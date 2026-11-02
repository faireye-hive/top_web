import {strokeBounds,intersectsBounds,strokeTriangles,strokeEdgeStyle} from './terrain-strokes.mjs';

export function createTerrainPaint(THREE){
  const material=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false,alphaTest:.005,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  material.onBeforeCompile=shader=>{
    shader.uniforms.paintAtlas={value:material.map};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec2 brushCoord;
attribute vec4 brushStyle;
attribute vec2 brushCap;
varying vec2 vBrushCap;
varying vec2 vBrushCoord;
varying vec4 vBrushStyle;
varying vec2 vPaintWorld;`).replace('#include <begin_vertex>',`#include <begin_vertex>
vBrushCap=brushCap;vBrushCoord=brushCoord;vBrushStyle=brushStyle;vPaintWorld=position.xz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D paintAtlas;
varying vec2 vBrushCap;
varying vec2 vBrushCoord;
varying vec4 vBrushStyle;
varying vec2 vPaintWorld;`).replace('#include <map_fragment>',`
#ifdef USE_MAP
  vec2 cell=vec2(mod(vBrushStyle.x,8.),floor(vBrushStyle.x/8.));
  vec2 uv=(cell+(2.+mod(vPaintWorld,4.)*63.)/256.)/8.;uv.y=1.-uv.y;
  vec2 scale=vec2(63./2048.,-63./2048.);
  diffuseColor*=textureGrad(paintAtlas,uv,dFdx(vPaintWorld)*scale,dFdy(vPaintWorld)*scale);
#endif
  float feather=vBrushCoord.x>=0.?vBrushStyle.y:vBrushStyle.z;
  if(abs(vBrushCap.x)>.5)feather=vBrushCap.y*smoothstep(0.,.2,vBrushCoord.y*vBrushCap.x);
  float coverage=1.-smoothstep(1.-max(.001,feather),1.,length(vBrushCoord));
  diffuseColor.a*=coverage*vBrushStyle.w;
`);
  };
  material.customProgramCacheKey=()=> 'terrain-precision-paint-v2';
  return {setAtlas(atlas){if(material.map!==atlas){material.map=atlas;material.needsUpdate=true;}},
    build(design,tileAt,heightAt,tintAt,x0,z0,w,h){
      const bounds={x0,z0,x1:x0+w,z1:z0+h},positions=[],colors=[],coords=[],styles=[],caps=[];
      let triangles=0;
      for(const stroke of design.strokes||[]){
        if(!['texture','path'].includes(stroke.tool)||!intersectsBounds(strokeBounds(stroke),bounds))continue;
        const {left,right,cap,feather}=strokeEdgeStyle(stroke);
        strokeTriangles(stroke,(a,b,c)=>{
          const x=(a[0]+b[0]+c[0])/3,z=(a[1]+b[1]+c[1])/3;
          if(x<x0||z<z0||x>=x0+w||z>=z0+h||triangles>=100000)return;
          const tile=tileAt(x,z);if(!tile||!(tile.region&1)||tile.height<0)return;
          for(const v of [a,b,c]){positions.push(v[0],heightAt(v[0],v[1])+.035,v[1]);coords.push(v[2],v[3]);styles.push(stroke.tex,left,right,stroke.opacity);caps.push(cap,feather);colors.push(...tintAt(tile,x,z));}
          triangles++;
        });
      }
      if(!triangles)return null;
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('brushCoord',new THREE.Float32BufferAttribute(coords,2));geometry.setAttribute('brushStyle',new THREE.Float32BufferAttribute(styles,4));geometry.setAttribute('brushCap',new THREE.Float32BufferAttribute(caps,2));
      // map presence enables Three's standard color-space and map feature flags.
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=1;return mesh;
    }
  };
}
