// Valores em graus para o ajuste de câmera mobile, sem dependência de Three.js.
// Permitir 0 desliga a correção automática e 180 recupera o giro amplo anterior.
export const CAMERA_SPEED_DEFAULT_DEG=24;
export const CAMERA_TURN_DEFAULT_DEG=24;
export const CAMERA_SETTING_MAX_DEG=180;

export function cameraDegrees(value,fallback=24){
  if(value===null||value===undefined||String(value).trim()==='')return fallback;
  const number=Number(value);
  return Number.isFinite(number)
    ?Math.max(0,Math.min(CAMERA_SETTING_MAX_DEG,Math.round(number)))
    :fallback;
}
export function cameraRadians(degrees){
  return degrees*Math.PI/180;
}

export const CAMERA_TOUCH_DEFAULT=2;
export const CAMERA_TOUCH_MIN=.5;
export const CAMERA_TOUCH_MAX=5;

// Multiplicador do deslocamento do dedo. Decimal de uma casa para sliders
// e campos numéricos terem exatamente o mesmo valor e persistência.
export function cameraTouchSensitivity(value,fallback=CAMERA_TOUCH_DEFAULT){
  if(value===null||value===undefined||String(value).trim()==='')return fallback;
  const n=Number(value);
  return Number.isFinite(n)
    ?Math.round(Math.min(CAMERA_TOUCH_MAX,Math.max(CAMERA_TOUCH_MIN,n))*10)/10
    :fallback;
}
