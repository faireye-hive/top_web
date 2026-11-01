export const BOAT_CAMERA_MODES=['chase','bow','classic'];
export const BOAT_CAMERA_LABELS={chase:'Atrás 3D',bow:'Proa 3D',classic:'Vista alta'};
export function boatCameraMode(value){return BOAT_CAMERA_MODES.includes(value)?value:'chase';}

// As duas vistas 3D mantêm o eixo horizontal igual ao referencial dos
// controles. O deslocamento lateral não altera a direção de W/joystick.
export function boatCameraPose({mode='chase',yaw=0,boatYaw=0,distance=15,lift=1.85,radius=3,length=5,height=3}={}){
  mode=boatCameraMode(mode);
  if(mode==='classic')return null; // Usa a câmera de visão geral já existente.
  yaw=Number.isFinite(yaw)?yaw:0;boatYaw=Number.isFinite(boatYaw)?boatYaw:0;
  radius=Math.max(1,Number.isFinite(radius)?radius:3);
  length=Math.max(2,Number.isFinite(length)?length:5);
  height=Math.max(1,Number.isFinite(height)?height:3);
  distance=Math.max(3.2,Math.min(22,Number.isFinite(distance)?distance:15));
  lift=Math.max(1.35,Math.min(2.4,Number.isFinite(lift)?lift:1.85));
  const fwd={x:Math.sin(yaw),z:Math.cos(yaw)},right={x:-fwd.z,z:fwd.x};
  if(mode==='bow'){
    const heading=boatYaw+Math.PI,front=radius+.9;
    const eye={x:Math.sin(heading)*front,y:Math.max(1.8,height*.30),z:Math.cos(heading)*front};
    const ahead=Math.max(24,radius*3.5),slope=(lift-1.7)*.24;
    return {eye,look:{x:eye.x+fwd.x*ahead,y:eye.y-slope*ahead,z:eye.z+fwd.z*ahead},
      fov:55+(distance-3.2)/18.8*20,mode};
  }
  const back=Math.max(radius*1.4,radius*.95+distance*.6);
  const shoulder=radius*.65,ahead=Math.max(7,length*.85);
  const eye={x:right.x*shoulder-fwd.x*back,
    y:Math.max(4,height*.7)+back*(.12+(lift-1.35)*.10),z:right.z*shoulder-fwd.z*back};
  return {eye,look:{x:right.x*shoulder+fwd.x*ahead,y:Math.max(1.2,height*.12),z:right.z*shoulder+fwd.z*ahead},fov:64,mode};
}
