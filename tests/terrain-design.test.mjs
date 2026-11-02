import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TERRAIN_DESIGN,normalizeTerrainDesign,readTerrainDesign,terrainVisualTile,brushTiles,paintTerrainDesign,restoreTerrainPatch,packedTerrainNeighborhood,grassInstances} from '../js/terrain-design.mjs';
import {installTerrainBlend} from '../js/terrain-surface.mjs';
const land={tex:9,height:1,rgb:65535,region:1,blocks:15};
const design=()=>structuredClone(DEFAULT_TERRAIN_DESIGN);
test('visual map edits preserve collision, height, region and original terrain data',()=>{
  const d=design(),before=paintTerrainDesign(d,[[2,3]],'texture',{tex:17},()=>land);
  const result=terrainVisualTile(land,2.9,3.1,d);
  assert.deepEqual(result,{...land,tex:17});assert.equal(land.tex,9);
  restoreTerrainPatch(d,before);assert.equal(terrainVisualTile(land,2,3,d),land);
  assert.equal(terrainVisualTile(null,2,3,d),null);
});
test('round brushes stay within Garner and reject nonfinite coordinates',()=>{
  assert.deepEqual(brushTiles(0,0,1),[[0,0],[1,0],[0,1]]);
  assert.equal(brushTiles(5,5,0).length,1);assert.deepEqual(brushTiles(NaN,2,1),[]);
  assert.ok(brushTiles(4095,4095,8).every(([x,z])=>x<=4095&&z<=4095));
});
test('grass can decorate blocked land around assets, skips sea and unloaded squares, and restores with undo',()=>{
  const d=design(),tileAt=(x)=>x===0?land:x===1?{...land,region:0,height:-2}:null;
  const before=paintTerrainDesign(d,[[0,0],[1,0],[2,0]],'grass',{height:.8,density:.9,color:'#779944'},tileAt);
  assert.ok(d.tiles['0/0'].grass);assert.equal(d.tiles['1/0'],undefined);assert.equal(d.tiles['2/0'],undefined);
  const packed=normalizeTerrainDesign(d);assert.deepEqual(packed,d);
  paintTerrainDesign(d,[[0,0]],'erase-grass',{},tileAt);assert.equal(d.tiles['0/0'].grass,null);
  restoreTerrainPatch(d,before);assert.deepEqual(d.tiles,{});
});
test('saved and published map projects validate bounds, textures and grass parameters',()=>{
  for(const patch of [{blend:NaN},{blend:1},{map:'arena'},{tiles:{'4096/0':{tex:9}}},{tiles:{'1/0':{tex:64}}},{tiles:{'1/0':{grass:{height:-1,density:1,color:'#ffffff'}}}},{tiles:[]}])assert.throws(()=>normalizeTerrainDesign({...design(),...patch}));
  assert.deepEqual(readTerrainDesign(design(),{getItem:()=>'{invalid'}),design());
  const published={...design(),blend:.2};assert.deepEqual(readTerrainDesign(published,{getItem:()=>null}),published);
  const local={...design(),blend:0};assert.deepEqual(readTerrainDesign(published,{getItem:()=>JSON.stringify(local)}),local);
});
test('3×3 neighborhood retains all nine texture IDs and preserves paving edges',()=>{
  const natural=[5,6,7,8,9,10,11,12,14];
  const packed=packedTerrainNeighborhood((x,z)=>({...land,tex:natural[(z+1)*3+x+1]}),0,0);
  assert.deepEqual(packed.flatMap(v=>[v%64,Math.floor(v/64)%64,Math.floor(v/4096)%64]),natural);
  assert.deepEqual(packedTerrainNeighborhood(()=>({...land,tex:2}),0,0),[2+2*64+2*4096,2+2*64+2*4096,2+2*64+2*4096]);
  const fallback=packedTerrainNeighborhood((x,z)=>x===0&&z===0?land:{...land,tex:2},0,0);
  assert.deepEqual(fallback,[9+9*64+9*4096,9+9*64+9*4096,9+9*64+9*4096]);
});
test('grass placement is deterministic, bounded and follows rendering budgets',()=>{
  const d=design();paintTerrainDesign(d,brushTiles(4,4,3),'grass',{},()=>land);
  const a=grassInstances(d,()=>land,0,0,8,8,16),b=grassInstances(d,()=>land,0,0,8,8,16);
  assert.equal(a.length,16);assert.deepEqual(a,b);assert.ok(a.every(p=>p.x>=0&&p.x<8&&p.z>=0&&p.z<8));
  assert.deepEqual(grassInstances(d,()=>({...land,region:0}),0,0,8,8),[]);
});
test('terrain shader owns its atlas uniform and supports disabling blending and diagnostic modes',()=>{
  const material={map:{image:'atlas'}},blend=installTerrainBlend(material),shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'};
  material.onBeforeCompile(shader);blend.setBlend(0);
  assert.equal(shader.uniforms.terrainBlend.value,0);assert.equal(shader.uniforms.terrainAtlas.value,material.map);
  assert.ok(shader.fragmentShader.includes('textureGrad(terrainAtlas,uv,dFdx(p)*scale,dFdy(p)*scale)'));assert.ok(shader.fragmentShader.includes('#ifdef USE_MAP'));
});
