// Jatos da fonte da praça de Argent, na base da torre do sino (by-bd015).
// O anel de água fica fora do pilar. Cada gota sobe e cai, então um quadro
// parado ainda mostra o jato.
const TOWER = { x: 2232.0, z: 2773.2 };
const RADIUS = 3.25;

export async function createArgentFountain(THREE, scene, groundY) {
  const tex = await new THREE.TextureLoader().loadAsync('assets/effects/textures/eff0049.tga.png');
  tex.colorSpace = THREE.NoColorSpace;
  const group = new THREE.Group();
  group.name = 'Fonte de Argent';
  scene.add(group);

  const drops = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    const spot = {
      x: TOWER.x + Math.cos(a) * RADIUS,
      z: TOWER.z + Math.sin(a) * RADIUS,
    };
    for (let k = 0; k < 8; k++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, color: 0xe9fbff,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 4;
      group.add(sprite);
      const life = 1.05 + (k % 3) * 0.12;
      drops.push({
        sprite, mat, spot, life,
        age: (k / 8) * life,
        speed: 3.4 + (k % 4) * 0.45,
      });
    }
  }

  const base = groundY + 0.45;
  return {
    update(dt) {
      for (const drop of drops) {
        drop.age += dt;
        if (drop.age >= drop.life) drop.age -= drop.life;
        const t = drop.age;
        const y = base + drop.speed * t - 3.6 * t * t;
        const u = t / drop.life;
        drop.sprite.position.set(drop.spot.x, y, drop.spot.z);
        drop.sprite.scale.setScalar(0.45 + u * 1.15);
        drop.mat.opacity = Math.sin(u * Math.PI) * 0.9;
      }
    },
  };
}
