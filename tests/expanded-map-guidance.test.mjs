import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDestinationGuide} from '../js/destination-guide.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('seta dourada acompanha direção do destino e desaparece na chegada',()=>{
  let mesh;
  const THREE={
    DoubleSide:2,
    BufferGeometry:class{setAttribute(){}computeVertexNormals(){}dispose(){this.disposed=true}},
    Float32BufferAttribute:class{constructor(data,size){this.data=data;this.size=size}},
    MeshBasicMaterial:class{constructor(props){Object.assign(this,props)}dispose(){this.disposed=true}},
    Mesh:class{
      constructor(g,m){mesh=this;this.geometry=g;this.material=m;
        this.position={set:(x,y,z)=>{this.x=x;this.y=y;this.z=z}};
        this.rotation={};this.visible=false}
    }
  };
  const scene={children:new Set(),add(v){this.children.add(v)},remove(v){this.children.delete(v)}};
  const guide=createDestinationGuide(THREE,scene);
  const heightAt=()=>7;
  guide.update({x:0,z:0},{x:10,z:0},heightAt,0);
  assert.equal(guide.visible,true);
  assert.ok(Math.abs(mesh.rotation.y-Math.PI/2)<1e-9);
  assert.ok(Math.abs(mesh.x-1.65)<1e-9);
  assert.equal(mesh.y,7.09);
  assert.equal(mesh.renderOrder,9);
  guide.update({x:10,z:0},{x:10,z:0},heightAt,1);
  assert.equal(guide.visible,false);
  guide.dispose();
  assert.equal(scene.children.size,0);
  assert.equal(mesh.geometry.disposed,true);
  assert.equal(mesh.material.disposed,true);
});

test('mapa usa espaço disponível, suporte a pinch, wheel e destinos distintos',()=>{
 const html=read('index.html'),css=read('navigation-map.css'),main=read('js/main.js');
 assert.match(html,/id="world-map" width="960" height="620"/);
 assert.match(html,/id="map-manual" disabled/);
 assert.match(html,/id="map-travel" disabled/);
 assert.match(html,/id="map-clear" disabled/);
 assert.match(html,/navigation-map\.css\?v=\d+/);
 assert.match(html,/main\.js\?v=\d+/);
 assert.ok(css.includes('.world-map-surface{\n  position:relative;width:100%;height:100%;aspect-ratio:auto'));
 assert.ok(css.includes('touch-action:none'));
 assert.ok(main.includes("expandedMap.addEventListener('wheel'"));
 assert.ok(main.includes("expandedMap.addEventListener('pointerdown'"));
 assert.ok(main.includes("mapPointers.size===2&&pinch"));
 assert.ok(main.includes("mapZoomAt(pinch.x,pinch.y,pinch.distance/Math.max(distance,1),pinch.view)"));
 assert.ok(main.includes('zoomMapAt(world,original,mapPointAt(x,y,original),factor,aspect())'));
 assert.ok(main.includes('unprojectMap(px,py,view,{width:r.width,height:r.height})'));
 assert.ok(main.includes("navigationAuto=true"));
 assert.ok(main.includes("navigationAuto=false"));
 assert.ok(main.includes("navigationGoal={x:mapSelection.x,z:mapSelection.z}"));
 assert.ok(main.includes("destinationGuide.update(playerPos,navigationGoal,"));
 assert.ok(main.includes("mapSelectionValid=false"));
 assert.ok(main.includes("mapSelectionValid=allowed"));
 assert.ok(main.includes("if(!mapSelection||!mapSelectionValid)return"));
 assert.ok(main.includes("if(orderMove(mapSelection.x,mapSelection.z,null))"));
 assert.ok(main.includes("else if(moverTarget)"));
 assert.ok(main.includes("toast('Caminho bloqueado. Tente outra direção.')"));
 assert.ok(main.includes("drawNavigationMap($('world-map'),fullMapView(),true)"));
 assert.ok(main.includes('resizeExpandedMap();'));
});
