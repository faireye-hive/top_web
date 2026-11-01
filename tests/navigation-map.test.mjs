import test from 'node:test';
import assert from 'node:assert/strict';
import {mapView,projectMap,unprojectMap,mapTileColor,mapEdgePoint,LOCAL_MAP_SPAN} from '../js/navigation-map.mjs';

const world={ox:1984,oz:2528,w:512,h:512};
test('minimapa mostra 96 m e mantém o jogador no centro',()=>{
  const player={x:2218.5,z:2776.5},view=mapView(world,player);
  assert.equal(view.w,LOCAL_MAP_SPAN);assert.equal(view.h,LOCAL_MAP_SPAN);
  assert.deepEqual(projectMap(player,view,256),{x:128,y:128});
  assert.ok(view.w<world.w/4,'visão local deve ampliar os arredores');
});
test('arredores ficam dentro do mapa nas bordas e mapas pequenos',()=>{
  for(const p of [{x:world.ox,z:world.oz},{x:2495,z:3039}]){
    const v=mapView(world,p);
    assert.ok(v.x>=world.ox&&v.z>=world.oz);
    assert.ok(v.x+v.w<=world.ox+world.w&&v.z+v.h<=world.oz+world.h);
  }
  assert.deepEqual(mapView({ox:0,oz:0,w:32,h:24},{x:1,z:1}),{x:0,z:0,w:32,h:24});
});
test('seleção no mapa completo retorna a coordenada exata sem teletransporte',()=>{
  const view={x:world.ox,z:world.oz,w:512,h:512},point={x:2204.5,z:2819.5};
  const projected=projectMap(point,view,768);
  assert.deepEqual(unprojectMap(projected.x,projected.y,view,768),point);
  assert.deepEqual(unprojectMap(384,384,view,768),{x:2240,z:2784});
});
test('porto distante fica indicado na borda circular do minimapa',()=>{
  const view=mapView(world,{x:2218.5,z:2776.5});
  const point=mapEdgePoint({x:2204.5,z:3000},view,256,30);
  assert.equal(point.edge,true);
  assert.ok(Math.abs(Math.hypot(point.x-128,point.y-128)-98)<1e-9);
});
test('cores de água, terra, areia e pontes permanecem distintas sem branco',()=>{
  const water=mapTileColor({region:0,height:-1,tex:22,blocks:0,rgb:65535});
  assert.ok(water[2]>water[1]&&water[1]>water[0]*3);
  const road=mapTileColor({region:1,height:3,tex:3,blocks:0,rgb:65535});
  assert.ok(road.every(v=>v<220));
  assert.notDeepEqual(road,water);
  assert.notDeepEqual(mapTileColor({region:1,tex:16}),mapTileColor({region:1,tex:8}));
  assert.notDeepEqual(mapTileColor({region:8,tex:22}),water);
});
