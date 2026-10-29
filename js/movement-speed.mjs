// Fonte única da velocidade de locomoção para teclado, joystick e clique.
export const WALK_SPEED = 4.8;
export const RUN_SPEED = 7.2;
export function calculateMovementSpeed({running=false,digital=false,destination=false,analogX=0,analogY=0}={}) {
  const base=running?RUN_SPEED:WALK_SPEED;
  // Clique e teclas são movimentos digitais; só o joystick tem intensidade variável.
  if(digital||destination)return base;
  const analog=Math.min(1,Math.hypot(analogX,analogY));
  return base*Math.max(0.35,analog);
}
