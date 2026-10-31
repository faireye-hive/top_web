import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraTouchSensitivity,CAMERA_TOUCH_DEFAULT} from '../js/mobile-camera-settings.mjs';
import {dragOrbitDelta, gentleOrbit, movementFromYaw, subtleFollowTarget} from '../js/camera-behavior.mjs';

test('sensibilidade de toque valida e sincroniza números de 0,5 a 5',()=>{
  assert.equal(CAMERA_TOUCH_DEFAULT,2);
  for(const input of [null,undefined,'',NaN,Infinity,'abc'])assert.equal(cameraTouchSensitivity(input),2);
  for(const [input,expected] of [['0',.5],['0.5',.5],['1',1],['2.5',2.5],['5',5],['10',5],['3.27',3.3]])
    assert.equal(cameraTouchSensitivity(input),expected);
});

test('um gesto horizontal maior ou sensibilidade alta gira proporcionalmente mais',()=>{
  const a=dragOrbitDelta(70*cameraTouchSensitivity(1),390);
  const b=dragOrbitDelta(70*cameraTouchSensitivity(2),390);
  const c=dragOrbitDelta(70*cameraTouchSensitivity(5),390);
  assert.ok(a>0);
  assert.ok(Math.abs(b-2*a)<1e-10);
  assert.ok(Math.abs(c-5*a)<1e-10);
  assert.ok(b<Math.PI,'um arrasto moderado não precisa girar mais de 180 graus');
});

test('andar para trás mantém o ângulo; andar para frente ainda permite acompanhamento',()=>{
  let cameraYaw=1.2;
  let orbitYaw=cameraYaw;
  let anchorYaw=cameraYaw;
  const dt=1/60;
  function frame(forward,sideways){
    const walkingBackward=forward<-.12;
    if(walkingBackward){orbitYaw=cameraYaw;anchorYaw=null;}
    cameraYaw=gentleOrbit(cameraYaw,orbitYaw,dt,.42);
    const moving=movementFromYaw(cameraYaw,forward,sideways);
    if(!walkingBackward&&anchorYaw===null)anchorYaw=cameraYaw;
    if(!walkingBackward && Math.hypot(moving.dx,moving.dz)>0){
      orbitYaw=subtleFollowTarget(anchorYaw,Math.atan2(moving.dx,moving.dz),.42);
    }
  }
  // Alvo pendente antes de iniciar a marcha a ré.
  orbitYaw=cameraYaw+.4;
  for(let i=0;i<120;i++)frame(-1,0);
  assert.equal(cameraYaw,1.2,'andar de ré não altera o ângulo mesmo com alvo anterior');
  for(let i=0;i<120;i++)frame(1,.75);
  assert.ok(Math.abs(cameraYaw-1.2)>.05,'acompanhamento continua funcionando para frente');
});
