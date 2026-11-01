import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monsterMapDots} from '../js/monster-map.mjs';
test('mapa agrupa posições próximas, recorta a vista e não depende de monstros ativos',()=>{
 const points=[{x:10,z:20},{x:12,z:22},{x:80,z:80},{x:-1,z:3},{x:Infinity,z:2}];
 const dots=monsterMapDots(points,{x:0,z:0,w:100,h:100},{width:100,height:100},20);
 assert.deepEqual(dots,[{x:11,y:21,count:2},{x:80,y:80,count:1}]);
 assert.equal(monsterMapDots(points,{x:0,z:0,w:0,h:100},{width:100,height:100}).length,0);
});
test('mapa original inclui habitats terrestres e marinhos e detalha áreas ao aproximar',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../assets/monsters/manifest.json',import.meta.url)));
 const view={x:0,z:0,w:4096,h:4096},size={width:800,height:800};
 const all=monsterMapDots(manifest.spawns,view,size,12);
 assert.equal(all.reduce((sum,dot)=>sum+dot.count,0),manifest.spawns.length);
 const sea=new Set(Object.entries(manifest.species).filter(([,s])=>s.habitat==='sea').map(([id])=>id));
 const seaPoints=manifest.spawns.filter(p=>sea.has(p.species));
 assert.ok(monsterMapDots(seaPoints,view,size,12).length>0);
 assert.ok(all.length<manifest.spawns.length/3);
 const near={x:2300,z:2800,w:200,h:200};
 assert.ok(monsterMapDots(manifest.spawns,near,size,12).length>0);
});
