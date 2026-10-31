// Ferramentas independentes de Three.js para câmera em terceira pessoa.
export function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
export function followAngle(current, target, dt, response = 2.5) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return current;
  return current + wrapAngle(target - current) * (1 - Math.exp(-Math.max(0, dt) * response));
}
export function gentleOrbit(current,target,dt,maxSpeed=1.1){
  const wanted=wrapAngle(target-current)*(1-Math.exp(-Math.max(0,dt)*7));
  const limit=Math.max(0,dt)*maxSpeed;
  return current+Math.max(-limit,Math.min(limit,wanted));
}
export function dragOrbitDelta(pixels,viewportWidth){
  return pixels/Math.max(320,viewportWidth)*Math.PI*.8;
}
// Longe: ângulo clássico elevado. Perto: perspectiva mais horizontal (3D).
export function cameraLiftAtDistance(lift, distance) {
  const t = Math.max(0, Math.min(1, (distance - 3.2) / 9.8));
  const near = Math.min(lift, 0.78);
  const smooth = t * t * (3 - 2 * t);
  return near + (lift - near) * smooth;
}
export function cameraFovAtDistance(distance) {
  const t = Math.max(0, Math.min(1, (distance - 3.2) / 9.8));
  return 62 - 10.4 * t;
}

/**
 * Acompanha a posição do personagem sem atraso dependente do FPS.
 * O controle de rotação é independente: arrastar a tela não desliga
 * o seguimento posicional. A posição é um alvo de câmera, não o avatar.
 */
export function smoothFollowPosition(current,target,dt,response=8){
  const blend=1-Math.exp(-Math.max(0,dt)*Math.max(0,response));
  return {
    x:current.x+(target.x-current.x)*blend,
    y:current.y+(target.y-current.y)*blend,
    z:current.z+(target.z-current.z)*blend
  };
}
/** Não perseguir a direção do joystick lateral, nem combater o toque da câmera. */
export function mobileShouldFollowYaw({enabled,moving,forward,chasing,manualActive,seated}={}){
  return !!enabled && !!moving && !manualActive && !seated &&
    (forward>.22 || !!chasing);
}
