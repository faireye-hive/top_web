import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {petPathPose,followPetPosition} from '../js/pet-motion.mjs';
const base=new URL('../assets/pets/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)));
test('Mordo Jr é padrão com malha, texturas e trajetórias originais publicadas',()=>{
  assert.equal(manifest.defaultPet,'mordo-jr');assert.equal(manifest.itemId,681);assert.equal(manifest.effectId,526);
  const model=readFileSync(new URL(manifest.model,base));assert.equal(model.toString('ascii',0,4),'glTF');
  const json=JSON.parse(model.toString('utf8',20,20+model.readUInt32LE(12)));assert.ok(json.meshes.length);
  assert.ok(json.nodes.some(n=>n.name==='fjlxiao1'),'nome de nó deve preservar a associação com a malha EFF');
  const systems=manifest.resources['fjlxiao1.par'].systems;assert.equal(systems.length,3);
  for(const system of systems){
    assert.equal(system.path.points.length,101);
    assert.notDeepEqual(petPathPose(system.path,0).position,petPathPose(system.path,.3).position);
    for(const part of manifest.resources[system.effect].parts)assert.ok(existsSync(new URL('textures/'+part.texture,base)));
  }
});
test('voo percorre segmentos por distância, repete sem saltos e tolera trajetória vazia',()=>{
  const path={points:[[0,0,0],[2,0,0],[2,2,0],[0,0,0]],speed:2};
  assert.deepEqual(petPathPose(path,.5).position,[1,0,0]);
  assert.deepEqual(petPathPose(path,1.5).position,[2,1,0]);
  const period=(4+Math.sqrt(8))/2;
  assert.ok(Math.hypot(...petPathPose(path,period).position)<1e-6);
  assert.deepEqual(petPathPose(null,10).position,[0,0,0]);
});
test('pet segue suavemente, pausa e acompanha teleportes e embarque',()=>{
  const current={x:0,y:1,z:0},owner={x:2,y:3,z:0};
  const next=followPetPosition(current,owner,.1);assert.ok(next.x>0&&next.x<2);assert.ok(next.y>1);
  assert.deepEqual(followPetPosition(current,owner,0),current);
  assert.deepEqual(followPetPosition(current,{x:30,y:0,z:30},.1),{x:30,y:0,z:30});
});
