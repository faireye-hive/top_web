import test from 'node:test';
import assert from 'node:assert/strict';
import {mapView,projectMap,unprojectMap,mapTileColor,mapEdgePoint,LOCAL_MAP_SPAN,mapViewRect,zoomMapAt,guidanceDirection} from '../js/navigation-map.mjs';

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

test('mapa ampliado usa largura e altura independentes sem distorcer coordenadas',()=>{
  const view=mapViewRect(world,{x:2230,z:2770},500,1.85);
  assert.equal(view.h,500);
  assert.equal(view.w,512,'não ultrapassa borda de Garner');
  const point={x:2224.25,z:2805.75},size={width:900,height:420};
  const screen=projectMap(point,view,size);
  const back=unprojectMap(screen.x,screen.y,view,size);
  assert.ok(Math.abs(back.x-point.x)<1e-8);
  assert.ok(Math.abs(back.z-point.z)<1e-8);
  assert.deepEqual(mapViewRect(world,{x:1e6,z:-999},64,2),{
    x:world.ox+world.w-128,z:world.oz,w:128,h:64
  });
});
test('zoom mantém o mundo sob o dedo na mesma coordenada da tela',()=>{
  const largeWorld={ox:0,oz:0,w:4096,h:4096};
  const view=mapViewRect(largeWorld,{x:2000,z:2000},1200,1.7);
  const focus={x:view.x+view.w*.33,z:view.z+view.h*.71};
  const zoom=zoomMapAt(largeWorld,view,focus,.5,1.7);
  assert.ok(Math.abs((focus.x-zoom.x)/zoom.w-.33)<1e-9);
  assert.ok(Math.abs((focus.z-zoom.z)/zoom.h-.71)<1e-9);
  assert.equal(zoom.h,view.h/2);
  assert.equal(zoomMapAt(largeWorld,view,focus,-1,1.7),view);
  const min=zoomMapAt(largeWorld,view,focus,.001,1.7);
  assert.equal(min.h,32);
  const max=zoomMapAt(largeWorld,view,focus,100,1.7);
  assert.equal(max.h,4096);
});
test('seta aponta em direção real ao destino e some ao chegar',()=>{
  const p={x:10,z:15};
  const east=guidanceDirection(p,{x:20,z:15});
  assert.equal(east.distance,10);
  assert.equal(east.dx,1);assert.equal(east.dz,0);
  assert.ok(Math.abs(east.bearing-Math.PI/2)<1e-9);
  assert.equal(guidanceDirection(p,{x:10.2,z:15.2}),null);
  assert.equal(guidanceDirection(p,{x:NaN,z:15}),null);
});
