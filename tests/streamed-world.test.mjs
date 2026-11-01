import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {decodeTerrain,terrainTile,createStreamedWorld} from '../js/streamed-world.mjs';
const manifest=JSON.parse(readFileSync(new URL('../assets/garner/manifest.json',import.meta.url)));
function sector(x=0,z=0){
  const b=new ArrayBuffer(20+256*256*7),v=new DataView(b);
  [0x31524e47,x*256,z*256,256,256].forEach((n,i)=>v.setUint32(i*4,n,true));
  return b;
}
function fixture(options={}){
  const calls=[];
  const fetcher=async url=>{
    calls.push(url);
    if(url.includes('manifest'))return {ok:true,json:async()=>manifest};
    const match=url.match(/(\d+)-(\d+)\.gmap/);return {ok:true,arrayBuffer:async()=>sector(Number(match[1]),Number(match[2]))};
  };
  return {calls,create:()=>createStreamedWorld({fetcher,...options})};
}
test('Garner original tem 4096 × 4096 e 256 setores válidos',()=>{
  assert.deepEqual(manifest.size,[4096,4096]);assert.equal(manifest.sectorSize,256);
  for(let z=0;z<16;z++)for(let x=0;x<16;x++){
    const raw=gunzipSync(readFileSync(new URL(`../assets/garner/terrain/${x}-${z}.gmap.gz`,import.meta.url)));
    const terrain=decodeTerrain(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
    assert.equal(terrain.ox,x*256);assert.equal(terrain.oz,z*256);
  }
});
test('setores novos preservam os tiles históricos do recorte de Argent',()=>{
  const decode=path=>{const b=gunzipSync(readFileSync(new URL(path,import.meta.url)));return decodeTerrain(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
  const original=decode('../assets/argent/region.gmap.gz');
  for(const [x,z] of [[2218.5,2776.5],[2204.5,2819.5],[2203,2825.5]]){
    const streamed=decode(`../assets/garner/terrain/${Math.floor(x/256)}-${Math.floor(z/256)}.gmap.gz`);
    assert.deepEqual(terrainTile(streamed,x,z),terrainTile(original,x,z));
  }
});
test('terreno não carregado e fora dos limites nunca é considerado mar livre',async()=>{
  const {create}=fixture(),world=await create();
  assert.equal(world.tileAt(2218,2776),null);assert.equal(world.tileAt(-1,0),null);
  await world.ensureAround(2218,2776,0);assert.ok(world.tileAt(2218,2776));
  assert.equal(world.tileAt(4096,0),null);
  await assert.rejects(world.ensureAround(5000,0),/fora/);
});
test('requisições iguais são compartilhadas e a memória de setores é limitada',async()=>{
  const {create,calls}=fixture({maxSectors:3}),world=await create();
  await Promise.all([world.ensureAround(12,12,0),world.ensureAround(12,12,0)]);
  assert.equal(calls.filter(c=>c.includes('0-0.gmap')).length,1);
  await world.focus(12,12,0);
  for(const x of [300,600,900,1200])await world.ensureAround(x,12,0);
  assert.ok(world.tileAt(12,12),'região ativa continua protegida');
  assert.ok(world.stats().loaded<=3);
  assert.ok(world.stats().bytes<=3*(20+256*256*7));
});
test('setores corrompidos são recusados e erro de download permite nova tentativa',async()=>{
  assert.throws(()=>decodeTerrain(new ArrayBuffer(12)),/inválido/);
  let attempts=0;
  const world=await createStreamedWorld({fetcher:async url=>url.includes('manifest')?{ok:true,json:async()=>manifest}:
    ++attempts===1?{ok:false,status:503}:{ok:true,arrayBuffer:async()=>sector()}});
  await assert.rejects(world.ensureAround(1,1,0),/503/);
  await world.ensureAround(1,1,0);assert.ok(world.tileAt(1,1));
});
