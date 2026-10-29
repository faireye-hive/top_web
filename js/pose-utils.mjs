// Regras puras para interação com volumes históricos yyyy001/002.
export function seatCenter(mark) {
  return { x: (mark.minX + mark.maxX) * 0.5, z: (mark.minZ + mark.maxZ) * 0.5 };
}
export function findSafeExit(origin, canStand, maxRadius = 9) {
  if (canStand(origin.x, origin.z)) return [origin.x, origin.z];
  // Procuramos primeiro junto à posição de aproximação salva, e não dentro do banco.
  for (let r = 0.4; r <= maxRadius + 1e-6; r += 0.4) {
    const steps = Math.max(16, Math.ceil(2 * Math.PI * r / 0.45));
    for (let i = 0; i < steps; i++) {
      const theta = i * 2 * Math.PI / steps;
      const x = origin.x + Math.cos(theta) * r;
      const z = origin.z + Math.sin(theta) * r;
      if (canStand(x, z)) return [x, z];
    }
  }
  return null;
}
