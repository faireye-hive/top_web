import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// TOP Studio — editor de montagem não destrutiva dos GLBs convertidos de .lgo/.lab.
// Coordenadas dos meshes seguem o arquivo glTF; o grupo raiz faz Z-up -> Y-up.
const $ = id => document.getElementById(id);
const RAD = THREE.MathUtils.degToRad;
const DEG = THREE.MathUtils.radToDeg;
const STORAGE = 'top-studio-v2:';
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a182b');
scene.fog = new THREE.Fog('#0a182b', 12, 28);
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 120);
camera.position.set(4, 3, 5);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.enablePan = true;
orbit.minDistance = 0.3;
orbit.maxDistance = 50;
orbit.screenSpacePanning = true;
scene.add(new THREE.HemisphereLight('#dbedff', '#3e526c', 2.5));
const sun = new THREE.DirectionalLight('#fff0df', 3.0);
sun.position.set(4, 7, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -5;
sun.shadow.camera.right = 5;
sun.shadow.camera.top = 5;
sun.shadow.camera.bottom = -5;
sun.shadow.bias = -0.00015;
scene.add(sun);
const rim = new THREE.DirectionalLight('#8abef9', 1.8);
rim.position.set(-3, 5, -4);
scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 80), new THREE.MeshStandardMaterial({ color: '#203a53', roughness: 0.98 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(8, 24, '#3c8799', '#26475e');
scene.add(grid);

const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform.getHelper()); // Three r170: getHelper(), não scene.add(transform)
transform.setSize(0.75);
const pivot = new THREE.Object3D();
pivot.name = 'TOP_EDIT_PIVOT_NOT_FOR_EXPORT';
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();
let root = null, parts = [], selection = -1, initial = null, clips = [], mixer = null;
let skeletonHelper = null, selectionBox = null, currentAction = null;
let sourceName = 'lance_ataques.glb', playing = true, clipTime = 0;
const modelLibrary = [];
let currentModelId = null, nextModelId = 1, loadingModel = false;
let speeds = [0.5, 1, 1.5, 2], speedIndex = 1;
let undo = [], redo = [], dragStart = null, toastTimeout = 0, soloBackup = null;
let viewDistance = 4, floorY = 0, focusPoint = new THREE.Vector3(0, 1, 0);
let activeMaterial = 0, proxyIsDirty = false, lastPointer = null;
const loader = new GLTFLoader();
// Dados temporários do editor ficam fora de Object3D.userData para não inflar o GLB exportado.
const baseUV = new WeakMap();
const uvFlips = new WeakMap();

function notify(message, error = false) {
  const t = $('toast');
  t.textContent = message;
  t.style.borderColor = error ? '#fb8c91' : '#56e0cf';
  t.classList.add('on');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('on'), 3500);
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
new ResizeObserver(resize).observe(stage);
resize();
function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 12000);
}
function partLabel(mesh) {
  // GLTFLoader pode sanitizar espaços/pontos; índice permanece estável.
  return mesh.name.replace(/_/g, ' ').replace(/^Parte\s*\d+\s*[·.]\s*/i, '') || mesh.name;
}
function materialArray(mesh) { return Array.isArray(mesh.material) ? mesh.material : [mesh.material]; }
function round(n, places = 4) { return Number(n.toFixed(places)); }
function snapshot() {
  return {
    parts: parts.map(mesh => ({
      name: mesh.name,
      position: mesh.position.toArray().map(v => round(v, 7)),
      quaternion: mesh.quaternion.toArray().map(v => round(v, 8)),
      scale: mesh.scale.toArray().map(v => round(v, 7)),
      visible: mesh.visible,
      uvFlip: Boolean(uvFlips.get(mesh)),
      materials: materialArray(mesh).map(m => ({
        color: m.color ? '#' + m.color.getHexString() : '#ffffff',
        roughness: m.roughness ?? 1,
        metalness: m.metalness ?? 0
      }))
    }))
  };
}
function applyUV(mesh, flip) {
  const uv = mesh.geometry.attributes.uv;
  const original = baseUV.get(mesh);
  if (!uv || !original) return;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, original[i * 2], flip ? 1 - original[i * 2 + 1] : original[i * 2 + 1]);
  }
  uv.needsUpdate = true;
  uvFlips.set(mesh, flip);
}
function restore(state) {
  if (!state || !Array.isArray(state.parts) || state.parts.length !== parts.length) throw new Error('Projeto não corresponde à quantidade de peças do GLB.');
  parts.forEach((mesh, i) => {
    const p = state.parts[i];
    if (!Array.isArray(p.position) || !Array.isArray(p.quaternion) || !Array.isArray(p.scale)) throw new Error('Dados de transformação incompletos.');
    mesh.position.fromArray(p.position);
    mesh.quaternion.fromArray(p.quaternion).normalize();
    mesh.scale.fromArray(p.scale);
    mesh.visible = p.visible !== false;
    applyUV(mesh, Boolean(p.uvFlip));
    materialArray(mesh).forEach((m, j) => {
      const a = p.materials?.[j];
      if (!a) return;
      if (m.color && typeof a.color === 'string') m.color.set(a.color);
      if (Number.isFinite(a.roughness)) m.roughness = THREE.MathUtils.clamp(a.roughness, 0, 1);
      if (Number.isFinite(a.metalness)) m.metalness = THREE.MathUtils.clamp(a.metalness, 0, 1);
      m.needsUpdate = true;
    });
    mesh.updateMatrix();
  });
  syncPivot();
  renderParts();
  refreshPanel();
}
function autosave() {
  if (!parts.length) return;
  const payload = { version: 2, source: sourceName, ...snapshot() };
  try { localStorage.setItem(STORAGE + sourceName, JSON.stringify(payload)); }
  catch (e) { console.warn('Salvamento local indisponível', e); }
}
function history(before) {
  const after = snapshot();
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  undo.push(before);
  if (undo.length > 80) undo.shift();
  redo = [];
  autosave();
  refreshHistory();
}
function edit(fn) {
  if (!parts.length) return;
  const before = snapshot();
  fn();
  history(before);
  syncPivot();
  renderParts();
  refreshPanel();
}
function refreshHistory() {
  $('undo').disabled = undo.length === 0;
  $('redo').disabled = redo.length === 0;
}
function stepHistory(reverse) {
  const src = reverse ? undo : redo;
  const dest = reverse ? redo : undo;
  if (!src.length) return;
  dest.push(snapshot());
  restore(src.pop());
  autosave();
  refreshHistory();
}
function selected() { return parts[selection] || null; }
function ensureSelected() { if (selected()) return true; notify('Selecione uma peça primeiro.', true); return false; }

// O pivô é um controle virtual no centro da geometria, sob o mesmo pai do SkinnedMesh.
// Delta = novoPivo * inverse(pivoInicial); novaMalha = Delta * malhaInicial.
// Isso gira a região da cabeça em torno do centro sem girá-la em torno dos pés.
function syncPivot() {
  const mesh = selected();
  transform.detach();
  if (pivot.parent) pivot.removeFromParent();
  if (!mesh) return;
  mesh.parent.add(pivot);
  mesh.geometry.computeBoundingBox();
  mesh.updateMatrix();
  const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
  center.applyMatrix4(mesh.matrix);
  pivot.position.copy(center);
  pivot.quaternion.copy(mesh.quaternion);
  pivot.scale.copy(mesh.scale);
  pivot.updateMatrix();
  transform.attach(pivot);
}
function proxyDelta(startProxy, startMesh) {
  pivot.updateMatrix();
  const delta = pivot.matrix.clone().multiply(startProxy.clone().invert());
  const next = delta.multiply(startMesh);
  const mesh = selected();
  if (!mesh) return;
  next.decompose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.updateMatrix();
}
function rotateAtCenter(axis) {
  if (!ensureSelected()) return;
  edit(() => {
    syncPivot();
    const beforePivot = pivot.matrix.clone();
    const beforeMesh = selected().matrix.clone();
    const q = new THREE.Quaternion().setFromAxisAngle(
      axis === 'x' ? new THREE.Vector3(1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1), Math.PI
    );
    pivot.quaternion.multiply(q);
    proxyDelta(beforePivot, beforeMesh);
  });
  notify(`Rotação 180° no eixo ${axis.toUpperCase()} aplicada.`);
}
function selectPart(i) {
  if (i < 0 || i >= parts.length) { selection = -1; transform.detach(); refreshPanel(); return; }
  selection = i; activeMaterial = 0;
  syncPivot();
  if (selectionBox) { selectionBox.removeFromParent(); selectionBox.geometry.dispose(); selectionBox.material.dispose(); selectionBox = null; }
  selectionBox = new THREE.BoxHelper(selected(), '#8dfae1');
  scene.add(selectionBox);
  $('stageInfo').textContent = `Selecionada: Parte ${i} · ${partLabel(selected())}`;
  renderParts(); refreshPanel();
}
function renderParts() {
  const container = $('parts');
  container.innerHTML = '';
  const search = $('partSearch').value.toLowerCase().trim();
  parts.forEach((mesh, i) => {
    if (search && !(`${i} ${mesh.name} ${partLabel(mesh)}`.toLowerCase().includes(search))) return;
    const row = document.createElement('div');
    row.className = 'meshrow' + (i === selection ? ' selected' : '');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = mesh.visible;
    checkbox.title = 'Mostrar/ocultar peça';
    checkbox.addEventListener('click', e => e.stopPropagation());
    checkbox.addEventListener('change', () => edit(() => { mesh.visible = checkbox.checked; }));
    const n = document.createElement('span'); n.className = 'n'; n.textContent = i;
    const label = document.createElement('label');
    const title = document.createElement('b'); title.textContent = partLabel(mesh);
    const info = document.createElement('small'); info.textContent = `${mesh.geometry.attributes.position.count} vértices · ${mesh.isSkinnedMesh ? 'com esqueleto' : 'estático'}`;
    label.append(title, info); row.append(checkbox, n, label);
    row.addEventListener('click', () => selectPart(i));
    container.append(row);
  });
}
function refreshPanel() {
  const mesh = selected();
  $('partTitle').textContent = mesh ? `Parte ${selection} · ${partLabel(mesh)}` : 'Selecione uma peça';
  $('partDesc').textContent = mesh ? `Origem: ${mesh.name} · edição independente` : 'Clique no modelo ou na lista de componentes à esquerda.';
  $('togglePart').textContent = mesh?.visible ? 'Ocultar peça' : 'Mostrar peça';
  const fields = document.querySelectorAll('[data-transform]');
  const euler = new THREE.Euler(0, 0, 0, 'XYZ');
  if (mesh) euler.setFromQuaternion(pivot.quaternion, 'XYZ');
  fields.forEach(input => {
    input.disabled = !mesh;
    if (!mesh) { input.value = ''; return; }
    const axis = Number(input.dataset.axis);
    const kind = input.dataset.transform;
    const vec = kind === 'position' ? pivot.position : kind === 'scale' ? pivot.scale : euler;
    input.value = (kind === 'rotation' ? DEG(vec.getComponent ? vec.getComponent(axis) : [vec.x, vec.y, vec.z][axis]) : vec.getComponent(axis)).toFixed(kind === 'rotation' ? 1 : 3);
  });
  for (const b of document.querySelectorAll('[data-flip]')) b.disabled = !mesh;
  for (const id of ['resetPart', 'togglePart', 'changeTexture', 'flipUV', 'matColor', 'rough', 'metal', 'solo', 'focusSelected']) $(id).disabled = !mesh;
  $('flipUV').checked = mesh ? !!uvFlips.get(mesh) : false;
  const matSelect = $('materialList');
  matSelect.innerHTML = '';
  if (mesh) {
    const mats = materialArray(mesh);
    activeMaterial = Math.min(activeMaterial, mats.length - 1);
    mats.forEach((m, i) => matSelect.add(new Option(m.name || `Material ${i + 1}`, String(i))));
    matSelect.value = String(activeMaterial);
    const mat = mats[activeMaterial];
    $('matColor').value = mat.color ? `#${mat.color.getHexString()}` : '#ffffff';
    $('rough').value = String(mat.roughness ?? 1);
    $('metal').value = String(mat.metalness ?? 0);
    $('roughLabel').textContent = Number($('rough').value).toFixed(2);
    $('metalLabel').textContent = Number($('metal').value).toFixed(2);
  } else matSelect.add(new Option('Selecione uma peça', ''));
  matSelect.disabled = !mesh;
}
function setMode(mode) {
  transform.setMode(mode);
  for (const [name, id] of [['translate', 'modeMove'], ['rotate', 'modeRotate'], ['scale', 'modeScale']])
    $(id).classList.toggle('active', name === mode);
}
function toggleSnap() {
  const active = !$('snap').classList.contains('active');
  $('snap').classList.toggle('active', active);
  $('snap').textContent = active ? 'Snap: on' : 'Snap: off';
  transform.setTranslationSnap(active ? .05 : null);
  transform.setRotationSnap(active ? RAD(15) : null);
  transform.setScaleSnap(active ? .1 : null);
}
function setFrame(target, radius = viewDistance) {
  focusPoint.copy(target);
  viewDistance = Math.max(0.7, radius);
  orbit.target.copy(target);
  camera.position.copy(target).add(new THREE.Vector3(viewDistance * .78, viewDistance * .46, viewDistance * .91));
  camera.lookAt(target); orbit.update();
  orbit.minDistance = Math.max(0.12, viewDistance * .08);
  orbit.maxDistance = Math.max(20, viewDistance * 12);
}
function frameAll() {
  if (!root) return;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(1, size.length() * .95);
  setFrame(center, radius);
  floorY = box.min.y - 0.07; floor.position.y = floorY; grid.position.y = floorY + .015;
}
function focusPart() {
  if (!ensureSelected()) return;
  const mesh = selected();
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(.45, box.getSize(new THREE.Vector3()).length() * 1.5);
  setFrame(c, r);
}
function cameraPreset(v) {
  const d = viewDistance * 1.4;
  const directions = { front: [0, 0, d], back: [0, 0, -d], left: [-d, .08, 0], right: [d, .08, 0], top: [0, d, .001] };
  const diff = new THREE.Vector3(...(directions[v] || directions.front));
  camera.position.copy(orbit.target).add(diff);
  camera.up.set(0, 1, 0);
  camera.lookAt(orbit.target); orbit.update();
}
function setAnimation(i) {
  if (!mixer || !clips[i]) return;
  const action = mixer.clipAction(clips[i]);
  if (currentAction && currentAction !== action) currentAction.stop();
  mixer.stopAllAction();
  currentAction = action;
  currentAction.reset().setLoop(THREE.LoopRepeat).play();
  currentAction.paused = false;
  clipTime = 0;
  $('scrub').value = '0';
  $('time').textContent = '0.00 s';
  if (!playing) mixer.timeScale = 0;
  else mixer.timeScale = speeds[speedIndex];
  mixer.update(0);
}
function togglePlay() {
  playing = !playing;
  $('play').textContent = playing ? 'Ⅱ' : '▶';
  if (mixer) mixer.timeScale = playing ? speeds[speedIndex] : 0;
}
function refreshLibrary() {
  const select = $('modelPick');
  select.innerHTML = '';
  modelLibrary.forEach(model => {
    const option = new Option(`${model.name}${model.builtin ? ' · incluído' : ''}`, model.id);
    select.add(option);
  });
  if (currentModelId) select.value = currentModelId;
  select.disabled = loadingModel || modelLibrary.length === 0;
  $('removeModel').disabled = !modelLibrary.some(m => m.id === currentModelId && !m.builtin);
  $('libraryInfo').textContent = `${modelLibrary.length} modelo(s) na sessão. Importe GLBs (pode selecionar vários) e alterne entre eles sem reiniciar. Os ajustes ficam separados por nome de modelo.`;
}
function registerModel(name, data, builtin = false) {
  if (!(data instanceof ArrayBuffer)) throw new Error('Modelo inválido: esperado ArrayBuffer.');
  if (data.byteLength > 160 * 1024 * 1024) throw new Error('GLB acima do limite de 160 MB por arquivo.');
  const names = modelLibrary.map(model => model.name);
  let label = name, n = 2;
  while (names.includes(label)) {
    label = name.replace(/\.glb$/i, '') + ` (${n++}).glb`;
  }
  const entry = { id: `modelo_${nextModelId++}`, name: label, data, builtin };
  modelLibrary.push(entry);
  refreshLibrary();
  return entry;
}
async function activateLibraryModel(id) {
  if (loadingModel) return;
  const entry = modelLibrary.find(m => m.id === id);
  if (!entry) return;
  loadingModel = true;
  refreshLibrary();
  $('loading').innerHTML = '<div>Importando malhas, texturas e animações…</div>';
  $('loading').classList.remove('hidden');
  try {
    if (root) autosave();
    const gltf = await new Promise((resolve, reject) => loader.parse(entry.data.slice(0), '', resolve, reject));
    activateGltf(gltf, entry.name);
    currentModelId = entry.id;
  } catch (error) {
    $('loading').classList.add('hidden');
    console.error('Erro ao importar modelo', error);
    notify(`Falha ao carregar ${entry.name}: ${error.message || error}`, true);
  } finally {
    loadingModel = false;
    refreshLibrary();
  }
}
async function importGLBs(files) {
  const valid = [...files].filter(file => /\.glb$/i.test(file.name));
  if (!valid.length) { notify('Selecione arquivos .glb (converta antes os .lgo/.lab).', true); return; }
  let last = null;
  for (const file of valid) {
    try {
      last = registerModel(file.name, await file.arrayBuffer());
    } catch (error) { notify(`${file.name}: ${error.message}`, true); }
  }
  if (last) await activateLibraryModel(last.id);
}

function clearRig() {
  transform.detach();
  if (pivot.parent) pivot.removeFromParent();
  if (selectionBox) { selectionBox.removeFromParent(); selectionBox.geometry.dispose(); selectionBox.material.dispose(); selectionBox = null; }
  if (skeletonHelper) { skeletonHelper.removeFromParent(); skeletonHelper.geometry.dispose(); skeletonHelper.material.dispose(); skeletonHelper = null; }
  if (root) root.removeFromParent();
  if (mixer) mixer.stopAllAction();
  root = null; parts = []; selection = -1; initial = null; clips = []; mixer = null; currentAction = null;
  undo = []; redo = []; soloBackup = null;
  refreshHistory();
}
function activateGltf(gltf, filename) {
  clearRig();
  root = gltf.scene;
  sourceName = filename;
  $('fileName').textContent = `${filename} · edição de peças`;
  scene.add(root);
  root.traverse(o => {
    if (!(o.isMesh || o.isSkinnedMesh)) return;
    o.castShadow = true; o.receiveShadow = true;
    if (o.isSkinnedMesh) o.frustumCulled = false;
    o.geometry.computeBoundingBox();
    if (o.geometry.attributes.uv) baseUV.set(o, new Float32Array(o.geometry.attributes.uv.array));
    uvFlips.set(o, false);
    parts.push(o);
  });
  clips = gltf.animations || [];
  mixer = new THREE.AnimationMixer(root);
  const animations = $('animation'); animations.innerHTML = '';
  clips.forEach((clip, i) => animations.add(new Option(`${clip.name} (${clip.duration.toFixed(1)}s)`, String(i))));
  if (!clips.length) animations.add(new Option('Sem animações', '0'));
  animations.disabled = !clips.length;
  playing = true; $('play').textContent = 'Ⅱ';
  if (clips.length) setAnimation(0);
  const firstSkin = parts.find(m => m.isSkinnedMesh);
  if (firstSkin?.skeleton?.bones.length) {
    skeletonHelper = new THREE.SkeletonHelper(firstSkin.skeleton.bones[0]);
    skeletonHelper.visible = $('showBones').checked;
    scene.add(skeletonHelper);
  }
  initial = snapshot();
  const existing = localStorage.getItem(STORAGE + sourceName);
  if (existing) {
    try { restore(JSON.parse(existing)); notify('Ajustes locais anteriores restaurados.'); }
    catch (e) { console.warn('Falha ao restaurar ajustes anteriores', e); notify('Arquivo carregado. Ajustes antigos não foram aplicados.', true); }
  }
  renderParts();
  selectPart(parts.length ? 0 : -1);
  frameAll();
  $('modelInfo').textContent = `${parts.length} peças · ${firstSkin?.skeleton?.bones.length || 0} ossos · ${clips.length} animações`;
  $('loading').classList.add('hidden');
  refreshHistory();
  notify(`Modelo ${filename} carregado com ${parts.length} peças.`);
}
async function loadDefault() {
  try {
    const response = await fetch('./lance_ataques.glb');
    if (!response.ok) throw new Error(`HTTP ${response.status} ao carregar lance_ataques.glb`);
    const model = registerModel('Lance · 30 animações.glb', await response.arrayBuffer(), true);
    await activateLibraryModel(model.id);
  } catch (e) {
    $('loading').innerHTML = `<div style="color:#ffb0a9"><b>Falha ao carregar o modelo 3D</b><br>${String(e.message || e).replaceAll('<', '&lt;')}<br>Execute: python3 -m http.server 8000<br>Abra http://localhost:8000</div>`;
    console.error(e);
  }
}

transform.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; });
transform.addEventListener('mouseDown', () => {
  if (!selected()) return;
  selected().updateMatrix();
  pivot.updateMatrix();
  dragStart = { proxy: pivot.matrix.clone(), mesh: selected().matrix.clone(), before: snapshot() };
});
transform.addEventListener('objectChange', () => {
  if (!dragStart || !selected()) return;
  proxyDelta(dragStart.proxy, dragStart.mesh);
  proxyIsDirty = true;
  refreshPanel();
});
transform.addEventListener('mouseUp', () => {
  if (!dragStart) return;
  history(dragStart.before);
  dragStart = null; proxyIsDirty = false;
  syncPivot(); refreshPanel();
});

for (const [btn, mode] of [['modeMove', 'translate'], ['modeRotate', 'rotate'], ['modeScale', 'scale']]) $(btn).addEventListener('click', () => setMode(mode));
$('space').addEventListener('click', () => { const local = transform.space !== 'local'; transform.setSpace(local ? 'local' : 'world'); $('space').textContent = local ? 'Local' : 'Mundo'; });
$('snap').addEventListener('click', toggleSnap);
$('partSearch').addEventListener('input', renderParts);
$('undo').addEventListener('click', () => stepHistory(true));
$('redo').addEventListener('click', () => stepHistory(false));
$('resetPart').addEventListener('click', () => { if (!ensureSelected()) return; edit(() => {
  const p = initial.parts[selection], mesh = selected();
  mesh.position.fromArray(p.position); mesh.quaternion.fromArray(p.quaternion); mesh.scale.fromArray(p.scale);
  mesh.visible = p.visible; applyUV(mesh, p.uvFlip);
  materialArray(mesh).forEach((mat, j) => { const m = p.materials?.[j]; if (!m) return; mat.color?.set(m.color); mat.roughness = m.roughness; mat.metalness = m.metalness; });
}); notify('Peça restaurada para a posição original.'); });
$('resetAll').addEventListener('click', () => { if (!initial || !confirm('Restaurar TODAS as peças para os ajustes originais?')) return; edit(() => restore(initial)); notify('Todas as transformações restauradas.'); });
$('togglePart').addEventListener('click', () => { if (!ensureSelected()) return; edit(() => { selected().visible = !selected().visible; }); });
$('showAll').addEventListener('click', () => edit(() => { parts.forEach(o => { o.visible = true; }); soloBackup = null; }));
$('solo').addEventListener('click', () => { if (!ensureSelected()) return; edit(() => {
  if (!soloBackup) { soloBackup = parts.map(p => p.visible); parts.forEach((p, i) => p.visible = i === selection); notify('Somente a peça selecionada está visível.'); }
  else { parts.forEach((p, i) => p.visible = soloBackup[i]); soloBackup = null; notify('Visibilidade anterior restaurada.'); }
}); });
for (const button of document.querySelectorAll('[data-flip]')) button.addEventListener('click', () => rotateAtCenter(button.dataset.flip));
for (const input of document.querySelectorAll('[data-transform]')) input.addEventListener('change', () => {
  if (!ensureSelected()) return;
  const value = Number(input.value);
  if (!Number.isFinite(value) || Math.abs(value) > 1e6) { refreshPanel(); notify('Número inválido.', true); return; }
  const kind = input.dataset.transform, axis = Number(input.dataset.axis);
  if (kind === 'scale' && Math.abs(value) < .001) { notify('Evite escala igual a zero.', true); refreshPanel(); return; }
  edit(() => {
    syncPivot();
    const oldProxy = pivot.matrix.clone(), oldMesh = selected().matrix.clone();
    if (kind === 'rotation') {
      const euler = new THREE.Euler().setFromQuaternion(pivot.quaternion, 'XYZ');
      ['x', 'y', 'z'].forEach((name, i) => { if (i === axis) euler[name] = RAD(value); });
      pivot.quaternion.setFromEuler(euler);
    } else {
      const vec = kind === 'position' ? pivot.position : pivot.scale;
      vec.setComponent(axis, value);
    }
    proxyDelta(oldProxy, oldMesh);
  });
});
$('flipUV').addEventListener('change', () => { if (!ensureSelected()) return; const checked = $('flipUV').checked; edit(() => applyUV(selected(), checked)); notify(`UV vertical ${checked ? 'invertido' : 'restaurado'}.`); });
$('materialList').addEventListener('change', e => { activeMaterial = Number(e.target.value); refreshPanel(); });
$('matColor').addEventListener('change', e => { if (!ensureSelected()) return; edit(() => materialArray(selected())[activeMaterial]?.color?.set(e.target.value)); });
for (const [id, field] of [['rough', 'roughness'], ['metal', 'metalness']]) $(id).addEventListener('change', e => {
  if (!ensureSelected()) return;
  edit(() => { const m = materialArray(selected())[activeMaterial]; if (m) m[field] = Number(e.target.value); });
});
$('rough').addEventListener('input', e => { $('roughLabel').textContent = Number(e.target.value).toFixed(2); });
$('metal').addEventListener('input', e => { $('metalLabel').textContent = Number(e.target.value).toFixed(2); });
$('changeTexture').addEventListener('click', () => { if (ensureSelected()) $('textureInput').click(); });
$('textureInput').addEventListener('change', async e => {
  const file = e.target.files[0], mesh = selected();
  if (!file || !mesh) return;
  try {
    const u = URL.createObjectURL(file);
    let texture;
    try { texture = await new THREE.TextureLoader().loadAsync(u); }
    finally { URL.revokeObjectURL(u); }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.needsUpdate = true;
    const mat = materialArray(mesh)[activeMaterial];
    mat.map = texture;
    mat.needsUpdate = true;
    autosave();
    notify(`Imagem aplicada. Exporte o GLB para mantê-la: ${file.name}`);
  } catch (ex) { notify('Erro ao carregar textura. Utilize PNG/JPG.', true); console.error(ex); }
  e.target.value = '';
});
$('showGrid').addEventListener('change', e => { floor.visible = grid.visible = e.target.checked; });
$('showBones').addEventListener('change', e => { if (skeletonHelper) skeletonHelper.visible = e.target.checked; });
$('wireframe').addEventListener('change', e => { parts.forEach(mesh => materialArray(mesh).forEach(mat => { mat.wireframe = e.target.checked; mat.needsUpdate = true; })); });
$('autoOrbit').addEventListener('change', e => { orbit.autoRotate = e.target.checked; orbit.autoRotateSpeed = 1.3; });
$('frameAll').addEventListener('click', frameAll);
$('focusSelected').addEventListener('click', focusPart);
for (const btn of document.querySelectorAll('[data-view]')) btn.addEventListener('click', () => cameraPreset(btn.dataset.view));
$('capture').addEventListener('click', () => { renderer.render(scene, camera); renderer.domElement.toBlob(blob => { if (blob) saveFile(blob, 'top-studio-captura.png'); }, 'image/png'); });
$('play').addEventListener('click', togglePlay);
$('animation').addEventListener('change', e => setAnimation(Number(e.target.value)));
$('speed').addEventListener('click', () => { speedIndex = (speedIndex + 1) % speeds.length; $('speed').textContent = speeds[speedIndex] + '×'; if (mixer && playing) mixer.timeScale = speeds[speedIndex]; });
$('scrub').addEventListener('input', e => {
  if (!mixer || !clips.length) return;
  const clip = clips[Number($('animation').value)];
  if (!clip) return;
  if (playing) togglePlay();
  clipTime = Number(e.target.value) * clip.duration;
  mixer.setTime(clipTime); mixer.update(0);
  $('time').textContent = clipTime.toFixed(2) + ' s';
});

function saveJSON() {
  if (!parts.length) return;
  const project = { format: 'TOP-Studio-parts', version: 2, source: sourceName, created: new Date().toISOString(), ...snapshot() };
  saveFile(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'top-studio-ajustes.json');
  notify('Arquivo de ajustes JSON salvo.');
}
$('saveJSON').addEventListener('click', saveJSON);
$('saveJSON2').addEventListener('click', saveJSON);
$('loadJSON').addEventListener('click', () => $('jsonInput').click());
$('jsonInput').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== 'TOP-Studio-parts' || data.version !== 2) throw new Error('Formato de projeto inválido.');
    if (data.source !== sourceName) throw new Error(`Projeto criado para ${data.source}, mas o modelo atual é ${sourceName}.`);
    edit(() => restore(data));
    notify(`Ajustes de ${file.name} aplicados.`);
  } catch (ex) { notify(ex.message || 'Projeto JSON inválido', true); console.error(ex); }
  e.target.value = '';
});
async function exportGLB() {
  if (!root) return;
  $('exportGLB').disabled = true; $('exportGLB2').disabled = true;
  notify('Gerando GLB com o esqueleto e as animações…');
  const oldWire = $('wireframe').checked;
  // Não exportar detalhes de visualização ou gizmos.
  transform.detach();
  if (pivot.parent) pivot.removeFromParent();
  parts.forEach(m => materialArray(m).forEach(mat => { mat.wireframe = false; }));
  root.updateMatrixWorld(true);
  try {
    const exporter = new GLTFExporter();
    const output = await exporter.parseAsync(root, {
      binary: true, onlyVisible: false, trs: true, animations: clips,
      maxTextureSize: 4096
    });
    saveFile(new Blob([output], { type: 'model/gltf-binary' }), sourceName.replace(/\.glb$/i, '') + '_editado.glb');
    notify(`GLB exportado com ${clips.length} animações. Reimporte para conferir.`);
  } catch (e) {
    console.error('Falha na exportação GLB', e);
    notify('Erro ao exportar GLB. Salve o JSON e veja o console (F12).', true);
  } finally {
    parts.forEach(m => materialArray(m).forEach(mat => { mat.wireframe = oldWire; }));
    syncPivot();
    $('exportGLB').disabled = false; $('exportGLB2').disabled = false;
  }
}
$('exportGLB').addEventListener('click', exportGLB);
$('exportGLB2').addEventListener('click', exportGLB);
$('compareUV').addEventListener('click', async () => {
  if (!confirm('Abrir a versão sem inversão UV? Os ajustes atuais permanecem salvos localmente.')) return;
  $('loading').classList.remove('hidden');
  try {
    const response = await fetch('./lance_uv_sem_inversao.glb');
    if (!response.ok) throw new Error('Falha ao obter GLB');
    const model = registerModel('Lance · UV alternativo.glb', await response.arrayBuffer(), true);
    $('loading').classList.add('hidden');
    await activateLibraryModel(model.id);
    notify('Versão com UV original do .lgo carregada para comparação.');
  } catch (ex) { $('loading').classList.add('hidden'); notify('Erro ao abrir o GLB alternativo.', true); console.error(ex); }
});
$('openGLB').addEventListener('click', () => $('glbInput').click());
$('addModels').addEventListener('click', () => $('glbInput').click());
$('glbInput').addEventListener('change', async e => {
  try { await importGLBs(e.target.files); }
  finally { e.target.value = ''; }
});
$('modelPick').addEventListener('change', async e => { await activateLibraryModel(e.target.value); });
$('removeModel').addEventListener('click', async () => {
  const idx = modelLibrary.findIndex(m => m.id === currentModelId);
  if (idx < 0 || modelLibrary[idx].builtin) return;
  modelLibrary.splice(idx, 1);
  currentModelId = null;
  const next = modelLibrary[0];
  if (next) await activateLibraryModel(next.id);
  refreshLibrary();
});
let dragDepth = 0;
for (const eventName of ['dragenter','dragover']) {
  stage.addEventListener(eventName, event => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
    if (eventName === 'dragenter') dragDepth++;
    stage.classList.add('drop-hover');
  });
}
stage.addEventListener('dragleave', event => {
  event.preventDefault(); dragDepth = Math.max(0,dragDepth-1);
  if (dragDepth === 0) stage.classList.remove('drop-hover');
});
stage.addEventListener('drop', async event => {
  event.preventDefault(); dragDepth = 0; stage.classList.remove('drop-hover');
  if (event.dataTransfer?.files) await importGLBs(event.dataTransfer.files);
});
window.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', e => { if (e.dataTransfer?.files) e.preventDefault(); });

renderer.domElement.addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (e.button !== 0 || !lastPointer || !parts.length || transform.dragging) return;
  const moved = Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y);
  lastPointer = null;
  if (moved > 5) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX - bounds.left) / bounds.width * 2 - 1, -((e.clientY - bounds.top) / bounds.height) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  // Se estiver sobre um gizmo, não modificar a seleção.
  if (transform.axis) return;
  const hits = raycaster.intersectObjects(parts.filter(p => p.visible), false);
  if (hits[0]) selectPart(parts.indexOf(hits[0].object));
});
window.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); stepHistory(!e.shiftKey); return; }
  if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); stepHistory(false); return; }
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (key === 'w') setMode('translate');
  if (key === 'e') setMode('rotate');
  if (key === 'r') setMode('scale');
  if (key === 'f') focusPart();
});
window.addEventListener('beforeunload', autosave);
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.06);
  if (mixer) {
    mixer.update(dt);
    const c = clips[Number($('animation').value)];
    if (c && currentAction) {
      clipTime = currentAction.time % c.duration;
      if (playing) $('scrub').value = String(clipTime / c.duration);
      $('time').textContent = clipTime.toFixed(2) + ' s';
    }
  }
  if (selectionBox && selected()) selectionBox.update();
  if (skeletonHelper?.visible) skeletonHelper.update();
  orbit.update();
  renderer.render(scene, camera);
}
refreshHistory();
loop();
loadDefault();
