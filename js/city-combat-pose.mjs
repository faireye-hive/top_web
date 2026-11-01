// Controle de postura do personagem: independente do modo de ataque automático.
// A área circular inicial é uma aproximação configurável de Argent City.
// Não representa os limites históricos exatos (ausentes no TOP Web atual).
export const ARGENT_CITY_POSE_AREA=Object.freeze({
  centerX:2222,centerZ:2775.5,radius:115
});
export const CITY_COMBAT_HOLD_MS=3500;

export function isInsideCity(x,z,area=ARGENT_CITY_POSE_AREA){
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  const dx=x-area.centerX,dz=z-area.centerZ;
  return dx*dx+dz*dz<=area.radius*area.radius;
}

export function extendCombatHold(previousUntil,now,duration=CITY_COMBAT_HOLD_MS){
  if(!Number.isFinite(now))return Number.isFinite(previousUntil)?previousUntil:0;
  return Math.max(Number.isFinite(previousUntil)?previousUntil:0,now+duration);
}

export function resolveCityCombatPose({
  inCity,moving=false,autoCombat=false,performing=false,holdUntil=0,now=0
}){
  if(performing)return 'attack';
  // A postura de combate não liga o Auto e não adquire alvos sozinha.
  const combat=!inCity||autoCombat||now<holdUntil;
  return combat?(moving?'armedRun':'guard'):(moving?'run':'idle');
}
