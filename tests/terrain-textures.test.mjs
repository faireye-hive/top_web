import test from 'node:test';import assert from 'node:assert/strict';
import {terrainAtlasUV,paintAtlasCell} from '../js/terrain-textures.mjs';
test('cada quadrado cobre um quarto da textura, inclusive nos limites de repetição a cada quatro metros',()=>{
  for(let x=0;x<12;x++)for(let z=0;z<12;z++){
    const a=terrainAtlasUV(9,x,z),b=terrainAtlasUV(9,x,z,1,1);
    assert.equal(b[0]-a[0],63/2048);assert.equal(a[1]-b[1],63/2048);
    assert.ok(a[0]>=1/8&&b[0]<2/8);assert.ok(a[1]>6/8&&b[1]<7/8);
  }
  assert.equal(terrainAtlasUV(9,3,0,1)[0],(256+254)/2048);
  assert.equal(terrainAtlasUV(9,4,0)[0],(256+2)/2048);
  assert.deepEqual(terrainAtlasUV(999,0,0),terrainAtlasUV(0,0,0));
});
test('atlas HD conserva as coordenadas normalizadas e extruda as bordas sem invadir outra célula',()=>{
  for(const cell of [256,512]){
    const calls=[],image={width:1024,height:1024};paintAtlasCell({drawImage:(...args)=>calls.push(args)},image,9,cell);
    assert.equal(calls.length,5);
    const pad=cell/128;assert.deepEqual(calls[0].slice(5),[cell+pad,cell+pad,cell-2*pad,cell-2*pad]);
    for(const call of calls){const [x,y,w,h]=call.slice(5);assert.ok(x>=cell&&y>=cell&&x+w<=cell*2&&y+h<=cell*2);}
  }
});
