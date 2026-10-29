// O pingo azul do clique: um cristal que flutua no destino até a chegada.
export function createWaypoint(THREE, scene) {
  const group = new THREE.Group();
  group.name = 'Cristal do destino';
  group.visible = false;
  group.renderOrder = 6;

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.26, 0),
    new THREE.MeshBasicMaterial({ color: 0x3ec8ff, transparent: true, opacity: 0.95, depthWrite: false })
  );
  const glow = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshBasicMaterial({
      color: 0xb7f3ff, transparent: true, opacity: 0.35, depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.46, 24),
    new THREE.MeshBasicMaterial({
      color: 0x7adfff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  crystal.renderOrder = glow.renderOrder = ring.renderOrder = 6;
  group.add(ring, glow, crystal);
  scene.add(group);

  let ground = 0;
  return {
    show(x, z, y) {
      ground = y;
      group.position.set(x, y, z);
      group.visible = true;
    },
    hide() { group.visible = false; },
    get visible() { return group.visible; },
    update(dt, time) {
      if (!group.visible) return;
      const bob = Math.sin(time * 3.1) * 0.14;
      crystal.position.y = 1.05 + bob;
      glow.position.y = 1.05 + bob;
      ring.position.y = 0.08;
      crystal.rotation.y += dt * 1.7;
      glow.rotation.y -= dt * 0.8;
      crystal.rotation.x = Math.sin(time * 1.4) * 0.25;
      group.position.y = ground;
    },
  };
}
