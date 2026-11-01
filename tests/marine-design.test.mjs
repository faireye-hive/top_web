import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DEFAULT_MARINE_DESIGN,normalizeMarineDesign,readMarineDesign,saveMarineDesign,paintTerrain,editedTile} from '../js/marine-design.mjs';
import {waveHeight} from '../js/marine-visuals.mjs';
import {sailableAt,nearestPosition,clearTransfer,ARGENT_HARBOR} from '../js/sea-navigation.mjs';
import {decodeTerrain,terrainTile} from '../js/streamed-world.mjs';
test('editor mantém configurações de barco, água e terreno ao salvar e importar',()=>{
  let raw=null;const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};
  const design=readMarineDesign(storage);design.boat.scale=4;design.water.waves=1;paintTerrain(design,2300,2900,2,'land',2.3);
  saveMarineDesign(design,storage);assert.deepEqual(readMarineDesign(storage),design);
  assert.equal(Object.keys(design.tiles).length,13);
});
test('pintura não altera o mapa original e devolve o estado anterior para desfazer',()=>{
  const design=structuredClone(DEFAULT_MARINE_DESIGN),base={tex:8,height:1,region:1,blocks:0};
  const before=paintTerrain(design,10,20,0,'water');assert.deepEqual(before,{'10/20':null});
  assert.deepEqual(editedTile(base,10.5,20.5,design),{tex:22,height:-2,region:0,blocks:0});
  assert.equal(base.region,1);paintTerrain(design,10,20,0,'block');assert.equal(editedTile(base,10,20,design).blocks,15);
  paintTerrain(design,10,20,0,'restore');assert.deepEqual(editedTile(base,10,20,design),base);
  assert.equal(editedTile(null,10,20,design),null,'edição não inventa setor não carregado');
});
test('importação recusa coordenadas inválidas e limita tamanho, velocidade e cores',()=>{
  assert.throws(()=>normalizeMarineDesign({version:1,tiles:{'5000/1':{height:0}}}),/Coordenada/);
  assert.throws(()=>normalizeMarineDesign({version:1,tiles:{'1/1':{height:99}}}),/Valor/);
  assert.throws(()=>normalizeMarineDesign({version:9}),/inválido/);
  const result=normalizeMarineDesign({version:1,boat:{scale:100,speed:999,color:'url(test)'}});
  assert.equal(result.boat.scale,5);assert.equal(result.boat.speed,12);assert.equal(result.boat.color,'#ffffff');
});
test('veleiro grande tem mais de 12 m e consegue embarcar com o casco inteiro livre',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/boats/manifest.json',import.meta.url)));
  const selected=manifest.boats.find(b=>b.slug==='phantom-galley'),scale=3.5;
  assert.ok(selected.length*scale>12);const radius=selected.radius*scale;
  const b=gunzipSync(readFileSync(new URL('../assets/argent/region.gmap.gz',import.meta.url)));
  const data=decodeTerrain(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),tileAt=(x,z)=>terrainTile(data,x,z);
  const destination=nearestPosition(ARGENT_HARBOR,(x,z)=>sailableAt(tileAt,x,z,radius),radius+6,(a,b)=>clearTransfer(a,b,tileAt));
  assert.ok(destination,'cais de Argent deve permitir o veleiro grande');
  assert.equal(sailableAt(tileAt,ARGENT_HARBOR.x,ARGENT_HARBOR.z,radius),false);
  const glb=readFileSync(new URL('../'+selected.model,import.meta.url)),gltf=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
  assert.ok(gltf.images.length&&gltf.meshes.length,'casco e textura originais devem estar incluídos');
});
test('barco padrão volta ao Guppy pequeno, sem mastros adicionais',()=>{
  const d=readMarineDesign({getItem:()=>null});
  assert.equal(d.boat.hull,'guppy');assert.equal(d.boat.scale,1);assert.equal(d.boat.sails,false);
  const manifest=JSON.parse(readFileSync(new URL('../assets/boats/manifest.json',import.meta.url)));
  assert.equal(manifest.defaultBoat,'guppy');assert.ok(manifest.boats[0].length*d.boat.scale<5);
});
test('migração do barco antigo preserva terreno e mar e só acontece uma vez',()=>{
  let raw=JSON.stringify({version:1,boat:{hull:'phantom-galley',scale:3.5,sails:true},water:{waves:1.2},tiles:{'10/20':{height:2}}});
  const storage={getItem:()=>raw,setItem:(_,s)=>raw=s};
  const d=readMarineDesign(storage);assert.equal(d.boat.hull,'guppy');assert.equal(d.boat.scale,1);
  assert.equal(d.water.waves,1.2);assert.deepEqual(d.tiles,{'10/20':{height:2}});
  d.boat.scale=2;d.boat.sails=true;saveMarineDesign(d,storage);
  assert.equal(readMarineDesign(storage).boat.scale,2,'edições novas não são sobrescritas');
  assert.equal(readMarineDesign(storage).boat.sails,true);
});
test('importar e salvar um barco grande explicitamente continua permitido',()=>{
  let raw=null;const storage={getItem:()=>raw,setItem:(_,s)=>raw=s};
  saveMarineDesign({version:1,boat:{hull:'phantom-galley',scale:4}},storage);
  assert.equal(readMarineDesign(storage).boat.scale,4);
});
test('ondulação é contínua e limitada sem alterar a altura física do personagem',()=>{
  for(let t=0;t<20;t+=.1){const h=waveHeight(2218,2825,t,1.5);assert.ok(Number.isFinite(h)&&Math.abs(h)<=.2476);assert.ok(Math.abs(h-waveHeight(2218,2825,t+.001,1.5))<.001);}
  assert.equal(waveHeight(1,1,1,0),0);
});
