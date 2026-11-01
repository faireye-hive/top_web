import test from 'node:test';
import assert from 'node:assert/strict';
import {landCameraDistance,cameraProximityDistance,cameraProximityValue,landCameraPose} from '../js/camera-distance.mjs';
test('barra começa na vista de 15 m e aproxima continuamente até 38 cm',()=>{
  assert.equal(cameraProximityDistance(0),15);assert.equal(cameraProximityDistance(100),.38);
  let previous=16;
  for(let p=0;p<=100;p++){
    const d=cameraProximityDistance(p);assert.ok(d<previous);previous=d;
    assert.ok(Math.abs(cameraProximityValue(d)-p)<1e-8);
  }
  assert.equal(landCameraDistance(NaN),15);assert.equal(landCameraDistance(-8),.38);assert.equal(landCameraDistance(99),22);
});
test('vista clássica mantém posição e enquadramento, próxima fica na altura da cabeça',()=>{
  const classic=landCameraPose({distance:15});
  assert.equal(classic.eyeHeight,27.75);assert.equal(classic.lookHeight,1.15);assert.equal(classic.lookAhead,0);assert.equal(classic.hideAvatar,false);
  for(const height of [.9,1.55,1.9]){
    const near=landCameraPose({distance:.38,headHeight:height});
    assert.equal(near.eyeHeight,height);assert.equal(near.lookHeight,height);assert.ok(near.lookAhead>2);assert.equal(near.hideAvatar,true);
  }
});
test('aproximação mantém continuidade de altura e permite inclinar o olhar perto do rosto',()=>{
  let previous=landCameraPose({distance:3.2});
  for(let d=3.19;d>.38;d-=.01){const next=landCameraPose({distance:d});assert.ok(Math.abs(next.eyeHeight-previous.eyeHeight)<.03);previous=next;}
  assert.ok(landCameraPose({distance:.38,lift:2.4}).lookHeight<1.55);
  assert.ok(landCameraPose({distance:.38,lift:1.35}).lookHeight>1.55);
});
