import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sailableTile,sailableAt,landableAt,nearestPosition,clearTransfer,restoreSeaPosition,SEA_LEVEL,ARGENT_HARBOR,ARGENT_HARBOR_WATER} from '../js/sea-navigation.mjs';
import {resolvePrimaryAction} from '../js/context-action.mjs';

test('regra marítima histórica usa LAND e os quatro bloqueios, não altura',()=>{
  for(const region of [0,2,4,6,8,14])assert.equal(sailableTile({region,blocks:0,height:3},.25,.25),true);
  for(const region of [1,3,5,7,9,15])assert.equal(sailableTile({region,blocks:0,height:-3},.25,.25),false);
  for(let sub=0;sub<4;sub++){
    const x=(sub%2)*.5+.25,z=Math.floor(sub/2)*.5+.25;
    for(let block=0;block<4;block++)assert.equal(sailableTile({region:0,blocks:1<<block},x,z),sub!==block);
  }
  assert.equal(sailableTile(null,0,0),false);
});

test('casco não cruza terra, bloqueios nem os limites do mapa',()=>{
  const sea={region:0,blocks:0};
  assert.equal(sailableAt(()=>sea,5,5),true);
  assert.equal(sailableAt((x)=>x<3?{region:1,blocks:0}:sea,5,5),false);
  assert.equal(sailableAt((x,z)=>x<0||z<0?null:sea,1,1),false);
  assert.equal(sailableAt((x,z)=>x>5.3&&x<5.8&&z>5.3&&z<5.8?{region:0,blocks:15}:sea,5,5),false);
  assert.equal(sailableAt(()=>{throw new Error('Não deve consultar NaN');},NaN,1),false);
});

test('desembarque exige espaço em terra ou ponte mesmo com mar raso',()=>{
  assert.equal(landableAt(()=>({region:1,blocks:0}),1,1),true);
  assert.equal(landableAt(()=>({region:8,blocks:0}),1,1),true);
  assert.equal(landableAt(()=>({region:0,blocks:0,height:0}),1,1),false);
  assert.equal(landableAt(()=>({region:1,blocks:15}),1,1),false);
  assert.equal(landableAt(x=>x<1?null:{region:1,blocks:0},1,1),false);
});

test('embarque busca a posição livre mais próxima sem atravessar paredes',()=>{
  const origin={x:0,z:0};
  const destination=nearestPosition(origin,(x,z)=>x>=3&&z===0);
  assert.deepEqual(destination,{x:3,z:0,distance:9});
  assert.equal(nearestPosition(origin,()=>false),null);
  assert.equal(nearestPosition(origin,()=>true,7,()=>false),null);
  assert.equal(clearTransfer(origin,{x:3,z:0},x=>({region:0,blocks:x>1&&x<2?15:0})),false);
  assert.equal(clearTransfer(origin,{x:3,z:0},()=>({region:0,blocks:0}),x=>x>1),false);
});

test('contexto do barco nunca dispara combate e só desembarca em terra livre',()=>{
  const landing={x:1,z:2};
  assert.equal(resolvePrimaryAction({sailing:true,npc:{},pose:{}}).type,'sailing');
  assert.equal(resolvePrimaryAction({sailing:true,landing}).type,'disembark');
  assert.equal(resolvePrimaryAction({boarding:landing}).type,'embark');
  assert.equal(resolvePrimaryAction({recovering:true,sailing:true,landing}).type,'recovering');
});

test('retomada aceita apenas uma posição marítima válida e salva',()=>{
  const saved={version:1,sailing:true,x:3,z:4};
  assert.deepEqual(restoreSeaPosition(JSON.stringify(saved),()=>true),saved);
  for(const raw of ['null','{}','bad',JSON.stringify({...saved,sailing:false}),JSON.stringify({...saved,x:null})])
    assert.equal(restoreSeaPosition(raw,()=>true),null);
  assert.equal(restoreSeaPosition(JSON.stringify(saved),()=>false),null);
});

test('carregamento demorado não sobrescreve a viagem salva antes da retomada',()=>{
  const main=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
  const source=main.slice(main.indexOf('function saveSeaTravel(){'),main.indexOf('\nfunction clearTravelInput(){'));
  const saved=[];
  const ctx={seaTravelReady:false,sailing:false,playerPos:{x:0,z:0},setPref:(...args)=>saved.push(args)};
  const save=new Function('ctx','with(ctx){'+source+';saveSeaTravel();}');
  save(ctx);
  assert.equal(saved.length,0,'intervalo de autosave durante boot deve preservar a viagem anterior');
  ctx.seaTravelReady=true;ctx.sailing=true;ctx.playerPos={x:2203,z:2825.5};
  save(ctx);
  assert.deepEqual(JSON.parse(saved[0][1]),{version:1,sailing:true,x:2203,z:2825.5});
});

test('porto publicado permite ida e volta no terreno real de Argent',()=>{
  const data=gunzipSync(readFileSync(new URL('../assets/argent/region.gmap.gz',import.meta.url)));
  const ox=data.readUInt32LE(4),oz=data.readUInt32LE(8),w=data.readUInt32LE(12),h=data.readUInt32LE(16);
  const tileAt=(x,z)=>{
    const ix=Math.floor(x)-ox,iz=Math.floor(z)-oz;
    if(ix<0||iz<0||ix>=w||iz>=h)return null;
    const at=20+(iz*w+ix)*7;
    return {region:data.readUInt16LE(at+4),blocks:data[at+6],height:data.readInt8(at+1)*.1};
  };
  const port=ARGENT_HARBOR;
  const water=nearestPosition(port,(x,z)=>sailableAt(tileAt,x,z),7,(a,b)=>clearTransfer(a,b,tileAt));
  assert.ok(water,'Guppy deve caber no mar junto ao porto');
  const land=nearestPosition(water,(x,z)=>{
    const t=tileAt(x,z);
    return landableAt(tileAt,x,z)&&t.height>=SEA_LEVEL-.3&&t.height<=SEA_LEVEL+3.5;
  },7,(a,b)=>clearTransfer(a,b,tileAt));
  assert.ok(land,'o barco precisa conseguir voltar a terra');
  assert.equal(sailableAt(tileAt,port.x,port.z),false);
  assert.equal(sailableAt(tileAt,ARGENT_HARBOR_WATER.x,ARGENT_HARBOR_WATER.z),true,'botão Marcar porto deve selecionar água com espaço para o casco');
});

test('casco publicado contém geometria e textura originais e velocidade histórica',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/boats/manifest.json',import.meta.url)));
  assert.equal(manifest.speed,4.5);
  assert.equal(manifest.seaLevel,SEA_LEVEL);
  const data=readFileSync(new URL('../'+manifest.model,import.meta.url));
  assert.equal(data.toString('utf8',0,4),'glTF');
  const gltf=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
  assert.equal(gltf.nodes[0].extras.sourceFile,'2004000000.lgo');
  assert.ok(gltf.meshes[0].primitives.length>0);
  assert.ok(gltf.images.every(i=>i.bufferView!==undefined));
  assert.ok(gltf.images.length>0);
});
