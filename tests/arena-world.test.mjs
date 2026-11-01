import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createArenaWorld} from '../js/arena-world.mjs';
const root=new URL('../',import.meta.url);
const fetcher=async path=>({ok:true,json:async()=>JSON.parse(readFileSync(new URL(path,root))),arrayBuffer:async()=>{
  const bytes=gunzipSync(readFileSync(new URL(path,root)));return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}});
test('Arena original teampk carrega 96×96 e mantém bloqueios sem carregar setores de Garner',async()=>{
  const world=await createArenaWorld({fetcher});assert.equal(world.w,96);assert.equal(world.h,96);assert.equal(world.stats().loaded,1);
  assert.equal(world.tileAt(44.5,35.5).blocks,0);assert.equal(world.tileAt(44,44).blocks,15);
  assert.equal(world.tileAt(-1,1),null);assert.equal(world.tileAt(96,0),null);await assert.rejects(world.ensureAround(2207,2891));
  assert.equal(world.manifest.source,'Client/map/teampk.map + teampk.obj');
});
test('cenário publicado contém as onze malhas e texturas originais, sem faltas no relatório',()=>{
  const manifest=JSON.parse(readFileSync(new URL('assets/arena/manifest.json',root)));
  for(const path of [manifest.overview,manifest.objects,manifest.scenery,manifest.terrain])assert.ok(existsSync(new URL(path,root)));
  const b=readFileSync(new URL(manifest.scenery,root));assert.equal(b.toString('ascii',0,4),'glTF');
  const gltf=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  assert.equal(gltf.nodes[0].children.length,11);assert.equal(gltf.images.length,13);
  const report=JSON.parse(readFileSync(new URL('assets/arena/build-report.json',root)));assert.deepEqual(report.scenery.problemas,{});
});
