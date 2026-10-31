import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraDegrees,cameraRadians,CAMERA_SPEED_DEFAULT_DEG,CAMERA_TURN_DEFAULT_DEG} from '../js/mobile-camera-settings.mjs';
import {subtleFollowTarget,gentleOrbit} from '../js/camera-behavior.mjs';

test('ajustes de câmera preservam padrão 24° e restringem valores a 0..180',()=>{
  assert.equal(CAMERA_SPEED_DEFAULT_DEG,24);
  assert.equal(CAMERA_TURN_DEFAULT_DEG,24);
  for(const v of [null,undefined,'',NaN,Infinity,'not-a-number'])assert.equal(cameraDegrees(v),24);
  for(const [raw,want] of [['0',0],['180',180],[-55,0],[999,180],['42.5',43],['17',17]])
    assert.equal(cameraDegrees(raw),want);
});
test('velocidade selecionada muda o giro por segundo sem reiniciar o jogo',()=>{
  const dt=1/60,anchor=0,target=Math.PI/2;
  let slow=anchor,fast=anchor;
  for(let i=0;i<60;i++){
    slow=gentleOrbit(slow,target,dt,cameraRadians(12));
    fast=gentleOrbit(fast,target,dt,cameraRadians(90));
  }
  assert.ok(slow>0&&slow<=cameraRadians(12)+.0001);
  assert.ok(fast>slow*4);
  assert.equal(gentleOrbit(0,target,dt,cameraRadians(0)),0);
});
test('limite de correção angular editável aceita 0°, 24° e 180°',()=>{
  const heading=Math.PI*.8;
  assert.equal(subtleFollowTarget(0,heading,cameraRadians(0)),0);
  const gentle=subtleFollowTarget(0,heading,cameraRadians(24));
  assert.ok(gentle>0&&gentle<=cameraRadians(24));
  assert.ok(subtleFollowTarget(0,heading,cameraRadians(180))>gentle);
});
