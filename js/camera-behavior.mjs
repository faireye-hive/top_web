// Ferramentas independentes de Three.js para câmera em terceira pessoa.
export function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
export function followAngle(current, target, dt, response = 2.5) {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return current;
  return current + wrapAngle(target - current) * (1 - Math.exp(-Math.max(0, dt) * response));
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
