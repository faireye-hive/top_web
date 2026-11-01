import {cameraLiftAtDistance,cameraFovAtDistance} from './camera-behavior.mjs';
export const LAND_CAMERA_MIN=.38,LAND_CAMERA_DEFAULT=15,LAND_CAMERA_MAX=22;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function landCameraDistance(value){
  const n=Number(value);return Number.isFinite(n)?clamp(n,LAND_CAMERA_MIN,LAND_CAMERA_MAX):LAND_CAMERA_DEFAULT;
}
export function cameraProximityDistance(value){
  const n=Number(value),t=Number.isFinite(n)?clamp(n,0,100)/100:0;
  return LAND_CAMERA_MIN+(LAND_CAMERA_DEFAULT-LAND_CAMERA_MIN)*(1-t)**2;
}
export function cameraProximityValue(distance){
  return (1-Math.sqrt(clamp((landCameraDistance(distance)-LAND_CAMERA_MIN)/(LAND_CAMERA_DEFAULT-LAND_CAMERA_MIN),0,1)))*100;
}
export function landCameraPose({distance=15,lift=1.85,headHeight=1.55}={}){
  distance=landCameraDistance(distance);
  const t=clamp((3.2-distance)/(3.2-LAND_CAMERA_MIN),0,1),near=t*t*(3-2*t);
  const height=Number.isFinite(headHeight)?clamp(headHeight,.6,2.5):1.55;
  return {distance,eyeHeight:distance*cameraLiftAtDistance(lift,distance)*(1-near)+height*near,
    lookHeight:1.15*(1-near)+height*near+(1.85-lift)*near*1.25,lookAhead:near*2.5,
    fov:cameraFovAtDistance(distance),hideAvatar:distance<.85};
}
