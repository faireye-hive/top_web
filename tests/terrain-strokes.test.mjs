import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTerrainDesign,DEFAULT_TERRAIN_DESIGN,grassInstances} from '../js/terrain-design.mjs';
import {strokeTriangles,strokeBounds,distanceToStroke,appendStrokePoint,paintSoftEdge} from '../js/terrain-strokes.mjs';
import {sceneAssetFromHit} from '../js/scene-asset-picker.mjs';
const design=()=>structuredClone(DEFAULT_TERRAIN_DESIGN),land=()=>({tex:9,region:1,height:1});
const path=(options={})=>({tool:'path',tex:18,radius:.03,feather:.8,edge:'left',opacity:1,points:[[10.123,20.456],[11.5,20.456]],...options});
test('centimeter brushes retain coordinates, exact width and round caps without tile snapping',()=>{
  const stroke=path(),vertices=[];strokeTriangles(stroke,(...tri)=>vertices.push(...tri));
  assert.ok(vertices.length>6);assert.ok(vertices.every(v=>v.every(Number.isFinite)));
  const zs=vertices.map(v=>v[1]);assert.ok(Math.abs(Math.max(...zs)-Math.min(...zs)-.06)<1e-8);
  assert.equal(distanceToStroke(10.5,20.456,stroke),0);assert.ok(distanceToStroke(10.5,20.5,stroke)>.03);
  const d=normalizeTerrainDesign({...design(),strokes:[stroke]});assert.deepEqual(d.strokes[0],stroke);
});
test('long gestures interpolate continuously and do not leave holes between pointer events',()=>{
  const stroke=path({radius:.1,points:[[1,1],[20,1]]}),vertices=[];strokeTriangles(stroke,(...tri)=>vertices.push(...tri));
  assert.ok(vertices.some(v=>v[0]>10&&v[0]<10.5));
  assert.equal(appendStrokePoint(stroke,20.001,1),false);assert.equal(appendStrokePoint(stroke,20.1,1),true);
  assert.equal(stroke.points.at(-1)[0],20.1);assert.equal(strokeBounds(stroke).x1,20.200000000000003);
});
test('local north edge edits only its two shared terrain corners',()=>{
  const d=design();paintSoftEdge(d,10.3,20.8,'north',1,.03);
  assert.deepEqual(d.tiles,{'10/20':{softness:1},'11/20':{softness:1}});
  assert.equal(normalizeTerrainDesign(d).tiles['10/20'].softness,1);
  paintSoftEdge(d,4095,4095,'all',.2,0);assert.ok(Object.keys(d.tiles).every(k=>k.split('/').every(n=>+n<4096)));
});
test('legacy projects load and invalid fine stroke data cannot be saved',()=>{
  const legacy=normalizeTerrainDesign({version:1,map:'garner',blend:.32,tiles:{'1/2':{tex:9}}});assert.deepEqual(legacy.strokes,[]);
  for(const change of [{radius:.001},{points:[[NaN,2]]},{points:[[4096,1]]},{tex:80},{edge:'nonsense'},{feather:2},{opacity:0},{points:[]}])assert.throws(()=>normalizeTerrainDesign({...design(),strokes:[path(change)]}));
  assert.throws(()=>normalizeTerrainDesign({...design(),tiles:{'1/2':{softness:Infinity}}}));
});
test('precise grass plants a small tuft and a later path clears vegetation in its exact footprint',()=>{
  const d=design();d.strokes=[{tool:'grass',radius:.03,points:[[.51,.52]],grass:{height:.4,density:1,color:'#778844'}}];
  const before=grassInstances(d,land,0,0,1,1);assert.ok(before.some(p=>p.x===.51&&p.z===.52));
  d.strokes.push(path({radius:.08,points:[[.4,.52],[.6,.52]]}));assert.deepEqual(grassInstances(d,land,0,0,1,1),[]);
});
test('scene selector resolves the clicked instance and material instead of guessing a model name',()=>{
  const object={userData:{sourceFile:'tree.lmo',sceneRecords:[[4,5,12],[8,9,22]],textureIds:['glb:assets/modelos_cenario.glb#1','glb:assets/modelos_cenario.glb#9']}};
  const actual=sceneAssetFromHit({object,instanceId:1,face:{materialIndex:1}},{22:{label:'Palmeira'}});
  assert.deepEqual(actual,{id:22,label:'Palmeira',file:'tree.lmo',x:8,z:9,textureId:'glb:assets/modelos_cenario.glb#9'});
  assert.equal(sceneAssetFromHit({object,instanceId:100}),null);assert.equal(sceneAssetFromHit(null),null);
});

test('drawn paths appear on both navigation map scales without drawing other brush marks',async()=>{
  const {drawTerrainPaths}=await import('../js/terrain-strokes.mjs'),calls=[];
  const ctx={save(){},restore(){},beginPath(){},moveTo:(...p)=>calls.push(p),lineTo:(...p)=>calls.push(p),stroke(){calls.push('stroke');}};
  const strokes=[path({radius:.1,points:[[10,20],[20,30]]}),path({tool:'texture'}),path({points:[[200,200]]})];
  assert.equal(drawTerrainPaths(ctx,strokes,{x:0,z:0,w:100,h:100},{width:200,height:200},()=>'#fff'),1);
  assert.deepEqual(calls,[[20,40],[40,60],'stroke']);
});

test('edge options persist all, none, left, right and either cap independently',async()=>{
  const {strokeEdgeStyle}=await import('../js/terrain-strokes.mjs');
  const expected={both:[.8,.8,0],none:[0,0,0],left:[.8,0,0],right:[0,.8,0],top:[0,0,1],bottom:[0,0,-1]};
  for(const [edge,values] of Object.entries(expected)){
    const stroke=path({edge}),saved=normalizeTerrainDesign({...design(),strokes:[stroke]}).strokes[0];
    assert.equal(saved.edge,edge);const {left,right,cap}=strokeEdgeStyle(saved);assert.deepEqual([left,right,cap],values);
  }
});
test('top and bottom coordinates identify the actual end and start caps after reversing the stroke',()=>{
  for(const points of [[[10,10],[12,10]],[[12,10],[10,10]],[[10,10],[10,12]]]){
    const vertices=[];strokeTriangles(path({points,radius:.3}),(a,b,c)=>vertices.push(a,b,c));
    const first=points[0],last=points.at(-1),dx=last[0]-first[0],dz=last[1]-first[1];
    for(const v of vertices){if(v[3]>.01)assert.ok((v[0]-last[0])*dx+(v[1]-last[1])*dz>=-1e-8);if(v[3]<-.01)assert.ok((v[0]-first[0])*dx+(v[1]-first[1])*dz<=1e-8);}
  }
});
