import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapAngle, followAngle, cameraLiftAtDistance, cameraFovAtDistance } from '../js/camera-behavior.mjs';
import { seatCenter, findSafeExit } from '../js/pose-utils.mjs';
test('câmera contorna a borda -PI/PI pelo caminho mais curto', () => {
  const a = followAngle(Math.PI - .08, -Math.PI + .08, .1);
  assert.ok(a > Math.PI - .08 && a < Math.PI + .08);
  assert.ok(Math.abs(wrapAngle(3 * Math.PI) + Math.PI) < 1e-8 || Math.abs(wrapAngle(3 * Math.PI) - Math.PI) < 1e-8);
});
test('zoom perto reduz a inclinação e abre o campo de visão', () => {
  assert.ok(cameraLiftAtDistance(1.85, 3.2) < cameraLiftAtDistance(1.85, 15));
  assert.equal(cameraLiftAtDistance(1.85, 15), 1.85);
  assert.ok(cameraFovAtDistance(3.2) > cameraFovAtDistance(15));
});
test('sentar no centro do marcador em vez da face de entrada', () => {
  assert.deepEqual(seatCenter({ minX: -1, maxX: 3, minZ: -2, maxZ: 2 }), {x:1, z:0});
});
test('ao levantar, usa posição anterior válida ou encontra outra próxima', () => {
  assert.deepEqual(findSafeExit({x:12,z:8}, (x,z) => x === 12 && z === 8), [12,8]);
  const exit = findSafeExit({x:0,z:0}, (x,z)=>x>1.5 && x<3.1 && Math.abs(z)<0.8);
  assert.ok(exit && exit[0]>1.5 && Math.abs(exit[1])<.8);
  assert.equal(findSafeExit({x:0,z:0},()=>false,1),null);
});
