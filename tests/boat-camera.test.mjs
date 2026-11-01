import test from 'node:test';
import assert from 'node:assert/strict';
import {boatCameraMode,boatCameraPose,BOAT_CAMERA_MODES} from '../js/boat-camera.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`);
test('boat view preferences validate saved values and retain overview',()=>{
  assert.equal(boatCameraMode('corrupted'),'chase');
  for(const mode of BOAT_CAMERA_MODES)assert.equal(boatCameraMode(mode),mode);
  assert.equal(boatCameraPose({mode:'classic'}),null);
});
test('3D views keep horizontal camera heading aligned with movement for all rotations',()=>{
  for(const mode of ['chase','bow'])for(const yaw of [0,.5,Math.PI,5.7]){
    const {eye,look}=boatCameraPose({mode,yaw,boatYaw:yaw-Math.PI,radius:15,length:24,height:22});
    const dx=look.x-eye.x,dz=look.z-eye.z,d=Math.hypot(dx,dz);
    close(dx/d,Math.sin(yaw));close(dz/d,Math.cos(yaw));
  }
});
test('chase camera increases clearance for larger hulls and tall sails',()=>{
  const small=boatCameraPose({radius:2,length:5,height:3});
  const big=boatCameraPose({radius:15,length:24,height:22});
  assert.ok(Math.hypot(big.eye.x,big.eye.z)>15);
  assert.ok(big.eye.y>small.eye.y&&big.eye.y>22*.7);
  assert.ok(Math.abs(big.eye.x)>Math.abs(small.eye.x));
  assert.ok(big.look.z>small.look.z);
});
test('bow camera sits ahead of entire collision radius, looking into clear water',()=>{
  for(const radius of [1.6,7.5,15.3])for(const heading of [0,Math.PI/2,3.8]){
    const pose=boatCameraPose({mode:'bow',yaw:heading,boatYaw:heading-Math.PI,radius,height:20});
    const project=v=>v.x*Math.sin(heading)+v.z*Math.cos(heading);
    close(project(pose.eye),radius+.9);assert.ok(project(pose.look)>project(pose.eye));
    assert.ok(pose.eye.y>=1.8);
  }
});
test('bow zoom changes field of view within limits and tilt changes sightline',()=>{
  const near=boatCameraPose({mode:'bow',distance:-100,lift:1.35});
  const far=boatCameraPose({mode:'bow',distance:100,lift:2.4});
  close(near.fov,55);close(far.fov,75);
  assert.ok(near.look.y>near.eye.y&&far.look.y<far.eye.y);
});
test('invalid model measurements and saved camera values produce finite poses',()=>{
  for(const mode of ['chase','bow']){
    const p=boatCameraPose({mode,yaw:NaN,boatYaw:Infinity,radius:NaN,length:-5,height:Infinity,distance:NaN,lift:Infinity});
    for(const v of [...Object.values(p.eye),...Object.values(p.look),p.fov])assert.ok(Number.isFinite(v));
  }
});
