// Brilho da cena. O valor 0–100 escala a exposição e as três luzes
// juntas, e também abre o céu e a névoa. 58 é o dia de Argent.
const KEY = 'topweb_garner_brightness';
const BASE = { exposure: 0.98, hemi: 0.78, sun: 1.05, fill: 0.24 };

function scaleOf(value) {
  return 0.62 + (value / 100) * 0.95;
}

export function attachBrightness({ renderer, hemi, sun, fill, scene }) {
  const fogDark = new scene.fog.color.constructor('#5f8494');
  const fogBright = new scene.fog.color.constructor('#c5e2ea');
  const bgDark = new scene.fog.color.constructor('#567c8c');
  const bgBright = new scene.fog.color.constructor('#b7d6e0');
  const raw = localStorage.getItem(KEY);
  let stored = raw == null || raw === '' ? 58 : Number(raw);
  if (!Number.isFinite(stored)) stored = 58;
  let value = stored;

  function apply(next) {
    value = Math.max(0, Math.min(100, Math.round(Number(next))));
    const scale = scaleOf(value);
    renderer.toneMappingExposure = BASE.exposure * scale;
    hemi.intensity = BASE.hemi * scale;
    sun.intensity = BASE.sun * scale;
    fill.intensity = BASE.fill * scale;
    const u = 0.22 + (value / 100) * 0.78;
    scene.fog.color.copy(fogDark).lerp(fogBright, u);
    scene.background.copy(bgDark).lerp(bgBright, u);
    try { localStorage.setItem(KEY, String(value)); } catch { /* modo privado */ }
    return value;
  }

  apply(value);
  return {
    get value() { return value; },
    apply,
  };
}
