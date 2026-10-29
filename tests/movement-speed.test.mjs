import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMovementSpeed, WALK_SPEED, RUN_SPEED } from '../js/movement-speed.mjs';
test('clique e teclado caminham à mesma velocidade', () => {
  assert.equal(calculateMovementSpeed({destination:true}), WALK_SPEED);
  assert.equal(calculateMovementSpeed({digital:true}), WALK_SPEED);
});
test('clique, teclado e joystick em corrida respeitam a mesma velocidade', () => {
  assert.equal(calculateMovementSpeed({destination:true,running:true}), RUN_SPEED);
  assert.equal(calculateMovementSpeed({digital:true,running:true}), RUN_SPEED);
  assert.equal(calculateMovementSpeed({analogY:1,running:true}), RUN_SPEED);
});
test('joystick conserva velocidade gradual (somente analógico)', () => {
  assert.ok(calculateMovementSpeed({analogY:0.5}) < WALK_SPEED);
  assert.equal(calculateMovementSpeed({analogY:1}), WALK_SPEED);
});
