import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parseTexturePack,parseTextureEntry,textureQuality,textureAssetPath,readGlbImage,validTextureId} from '../js/texture-library.mjs';
import {adjustTexturePixels,textureOutputSize} from '../js/texture-pixels.mjs';
const entry={id:'terrain:9',width:512,height:512,data:'data:image/png;base64,AAAA'};
test('pacote preserva textura HD, identidade e configurações, recusando caminhos e conteúdo executável',()=>{
  const pack=parseTexturePack(JSON.stringify({version:1,entries:[entry],quality:{cellSize:512,filter:'pixel',anisotropy:16}}));
  assert.deepEqual(pack.entries,[entry]);assert.equal(pack.quality.cellSize,512);
  for(const id of ['terrain:64','image:https://example.com/x.png','glb:assets/../secret.glb#0','image:assets/x.svg','__proto__'])assert.equal(validTextureId(id),false);
  for(const data of ['data:image/svg+xml;base64,AAAA','javascript:alert(1)','https://example.com/x.png'])assert.throws(()=>parseTextureEntry({...entry,data}));
  assert.throws(()=>parseTextureEntry({...entry,width:4096}));assert.throws(()=>parseTexturePack({version:1,entries:[entry,entry]}));
  assert.equal(textureQuality({cellSize:999999,anisotropy:999999}).cellSize,256);
});
test('identidade do GLB funciona em subpasta de hospedagem e ignora versões de cache',()=>{
  const root=new URL('https://example.com/top_web/');
  assert.equal(textureAssetPath('assets/monsters/a.glb?v=7',root),'assets/monsters/a.glb');
  assert.equal(textureAssetPath('https://example.com/top_web/assets/a.glb?v=1',root),'assets/a.glb');
  assert.equal(textureAssetPath('https://outside.test/assets/a.glb',root),null);
  assert.equal(textureAssetPath('https://example.com/other/a.glb',root),null);
});
test('catálogo cobre originais do terreno e texturas incorporadas reais com identificadores únicos',async()=>{
  const catalog=JSON.parse(readFileSync(new URL('../assets/textures/catalog.json',import.meta.url))),all=[...catalog.terrain,...catalog.textures];
  assert.equal(catalog.terrain.length,49);assert.ok(all.length>1000);
  assert.equal(new Set(all.map(row=>row.id)).size,all.length);
  for(const row of all){assert.ok(validTextureId(row.id),row.id);assert.ok(row.width>0&&row.height>0);}
  const sample=all.find(row=>row.id.startsWith('glb:assets/monsters/'));
  const raw=readFileSync(new URL('../'+sample.asset,import.meta.url)),buffer=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
  const image=readGlbImage(buffer,sample.image);assert.equal(image.size,sample.bytes);assert.equal(image.type,sample.mime);
  assert.throws(()=>readGlbImage(new ArrayBuffer(40),0));
});
test('ajustes preservam transparência, identidade neutra e proporção ao aumentar resolução',()=>{
  const bytes=new Uint8ClampedArray([10,20,30,0,100,150,200,127]);
  const image={data:bytes.slice(),width:2,height:1};adjustTexturePixels(image,{});assert.deepEqual(image.data,bytes);
  adjustTexturePixels(image,{brightness:1.2,saturation:0});assert.equal(image.data[3],0);assert.equal(image.data[7],127);assert.equal(image.data[4],image.data[5]);
  assert.deepEqual(textureOutputSize(256,128,1024),{width:1024,height:512});assert.deepEqual(textureOutputSize(4096,2048),{width:2048,height:1024});
});
