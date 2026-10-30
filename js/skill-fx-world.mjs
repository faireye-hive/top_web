// Conversão entre o referencial do mundo de Garner (X/Z) e a prévia das skills
// (ataque ao longo de +X local). Mantido sem dependências Three.js para testes.
export function skillWorldTransform(from,to,facing=0){
  const fx=Number(from?.x)||0, fz=Number(from?.z)||0;
  const tx=Number(to?.x);const tz=Number(to?.z);
  const dx=Number.isFinite(tx)?tx-fx:0,dz=Number.isFinite(tz)?tz-fz:0;
  const distance=Math.hypot(dx,dz);
  // Rotação Y de Three.js transforma +X local em (cos(yaw),0,-sin(yaw)).
  // Se não existe alvo, usa a orientação atual do personagem.
  const yaw=distance>1e-4?-Math.atan2(dz,dx):(Number(facing)||0);
  return {x:fx,z:fz,distance,yaw};
}
export function skillPlaybackLimit(duration,mobile=false){
  const n=Number(duration);
  if(!Number.isFinite(n)||n<=0)return 1;
  return Math.min(mobile?12:20,Math.max(.1,n));
}
