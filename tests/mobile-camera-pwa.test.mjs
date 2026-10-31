import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {followFactor,shouldSnapFollow,updateFollowTarget} from '../js/mobile-camera-follow.mjs';
const read=rel=>readFileSync(new URL('../'+rel,import.meta.url),'utf8');

function point(x=0,y=0,z=0){return {x,y,z,
  copy(p){this.x=p.x;this.y=p.y;this.z=p.z;return this;},
  lerp(p,a){this.x+=(p.x-this.x)*a;this.y+=(p.y-this.y)*a;this.z+=(p.z-this.z)*a;return this;}}}
test('tracking suave independentemente da taxa de quadros',()=>{
  const a=point(),b=point(),target=point(1,0,0);
  for(let i=0;i<60;i++)updateFollowTarget(a,target,1/60);
  for(let i=0;i<30;i++)updateFollowTarget(b,target,1/30);
  assert.ok(a.x>0 && a.x<1);
  assert.ok(Math.abs(a.x-b.x)<1e-7,'30/60fps devem produzir resultado equivalente');
  assert.ok(followFactor(-1)===0);
});
test('teleporte grande move a câmera imediatamente sem animação longa',()=>{
  const focus=point(0,0,0),destination=point(100,3,100);
  assert.equal(shouldSnapFollow(focus,destination),true);
  updateFollowTarget(focus,destination,1/60);
  assert.deepEqual([focus.x,focus.y,focus.z],[100,3,100]);
});
test('desktop permanece usando playerPos sem smoothing',()=>{
  const code=read('js/main.js');
  assert.match(code,/cameraPivot=MOBILE_UI\?mobileCameraFocus:playerPos/);
  assert.match(code,/if\(MOBILE_UI\)updateFollowTarget/);
  assert.match(code,/response:6\.5,snapDistance:13/);
});
test('loop do jogo atualiza o foco mobile após mover o personagem e antes de placeCamera',()=>{
  const code=read('js/main.js');
  const start=code.indexOf('function update(dt){');
  const end=code.indexOf('let qualitySampleTime=0',start);
  assert.ok(start>=0 && end>start,'loop update(dt) deve existir');
  const frame=code.slice(start,end);
  const pos=frame.indexOf('playerPos.y=THREE.MathUtils.lerp(');
  const follow=frame.indexOf('if(MOBILE_UI)updateFollowTarget(mobileCameraFocus,playerPos,dt');
  const camera=frame.indexOf('placeCamera();');
  assert.ok(pos>=0 && pos<follow && follow<camera,
    'o foco deve seguir a posição final do avatar a cada frame, antes de placeCamera');
  assert.equal(frame.match(/updateFollowTarget\(mobileCameraFocus/g)?.length,1,
    'não duplicar o smoothing em outras fases do frame');
  assert.match(code,/const cameraPivot=MOBILE_UI\?mobileCameraFocus:playerPos/);
});
test('teleporte e mudanças diretas de posição centralizam sem dt indefinido',()=>{
  const code=read('js/main.js');
  const teleport=code.slice(code.indexOf('function teleport(x,z){'),code.indexOf('function updateHUD(){'));
  assert.match(teleport,/mobileCameraFocus\.copy\(playerPos\)/);
  assert.doesNotMatch(teleport,/updateFollowTarget\(|\bdt\b/);
  assert.match(teleport,/if\(avatar\)avatar\.position\.copy\(playerPos\)/);
  const mobileStart=code.indexOf("mobileQuery.addEventListener('change'");
  const mobileChange=code.slice(mobileStart,code.indexOf("window.addEventListener('resize'",mobileStart));
  assert.match(mobileChange,/mobileCameraFocus\.copy\(playerPos\)/);
  const sit=code.slice(code.indexOf('function sitDown('),code.indexOf('function standUp(){'));
  const stand=code.slice(code.indexOf('function standUp(){'),code.indexOf('function indexScenePlaces(){'));
  assert.match(sit,/mobileCameraFocus\.copy\(playerPos\)/);
  assert.match(stand,/mobileCameraFocus\.copy\(playerPos\)/);
});
test('seguimento mantém avatar próximo do centro ao andar sem saltar abruptamente',()=>{
  const focus=point(),player=point();
  let previous=0;
  for(let frame=0;frame<180;frame++){
    player.x+=4/60; // caminhada/corrida de 4 unidades por segundo
    updateFollowTarget(focus,player,1/60,{response:6.5,snapDistance:13});
    assert.ok(focus.x>=previous && focus.x<=player.x);
    previous=focus.x;
  }
  assert.ok(player.x-focus.x<1,'após 3 segundos de caminhada a câmera não pode ficar para trás');
});
test('PWA instalável com manifest, serviço worker e alternativa mobile',()=>{
  const index=read('index.html'),manifest=JSON.parse(read('manifest.webmanifest'));
  const worker=read('sw.js'),install=read('js/pwa-install.mjs');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'./');
  assert.equal(manifest.orientation,'landscape');
  assert.ok(manifest.icons.some(icon=>icon.type==='image/svg+xml'));
  assert.match(index,/rel="manifest"/);
  assert.match(index,/pwa-install-button/);
  assert.match(install,/beforeinstallprompt/);
  assert.match(install,/Adicionar à Tela de Início/);
  assert.match(worker,/serviceWorker|addEventListener\('install'/);
  assert.match(worker,/req.mode!=='navigate'/);
  assert.doesNotMatch(worker,/cache\.addAll\(\['\.\/assets/);
});

test('opção mobile segue direção ou mantém órbita livre, persistida nas configurações',()=>{
  const code=read('js/main.js'),page=read('index.html');
  assert.match(page,/id="mobile-camera-mode"/);
  assert.match(page,/option value="follow"/);
  assert.match(page,/option value="free"/);
  assert.match(code,/getPref\('topweb_mobile_camera_mode','follow'\)/);
  assert.match(code,/setPref\('topweb_mobile_camera_mode',mobileCameraMode\)/);
  assert.match(page,/main\.js\?v=40/);
  assert.match(code,/movementFromYaw\(mobileSteeringReferenceYaw,fw,sideways\)/);
  assert.match(code,/if\(steering&&mobileSteeringReferenceYaw===null\)\{\s*mobileSteeringReferenceYaw=CAM\.yaw/);
  assert.match(code,/if\(!steering\)\{mobileSteeringReferenceYaw=null;mobileFollowAnchorYaw=null;\}/);
  assert.match(code,/mobileCameraMode==='follow'&&moved&&!seated/);
  assert.match(code,/performance\.now\(\)>cameraManualUntil/);
  assert.match(code,/mobileOrbitYaw=subtleFollowTarget\(mobileFollowAnchorYaw,/);
});

test('a redução da rotação vale apenas para câmera automática, não arrastar manual',()=>{
  const code=read('js/main.js');
  assert.match(code,/const manualOrbit=performance\.now\(\)<cameraManualUntil/);
  assert.match(code,/mobileCameraMode==='follow'&&!manualOrbit\?cameraRadians\(mobileCameraSpeedDeg\):1\.1/);
  assert.match(code,/mobileOrbitYaw=subtleFollowTarget\(mobileFollowAnchorYaw,/);
});

test('sliders numéricos alteram câmera automaticamente e guardam a preferência',()=>{
  const html=read('index.html'),code=read('js/main.js');
  for(const id of ['mobile-camera-speed','mobile-camera-speed-number',
    'mobile-camera-turn','mobile-camera-turn-number','mobile-camera-reset']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(code,/getPref\('topweb_mobile_camera_speed_deg'/);
  assert.match(code,/getPref\('topweb_mobile_camera_turn_deg'/);
  assert.match(code,/setPref\(key,degrees\)/);
  assert.match(code,/slider\.addEventListener\('input',e=>apply\(e\.target\.value\)\)/);
  assert.match(code,/number\.addEventListener\('change',e=>apply\(e\.target\.value\)\)/);
  assert.match(code,/subtleFollowTarget\(mobileFollowAnchorYaw,[\s\S]*?cameraRadians\(mobileCameraTurnDeg\)\)/);
  assert.match(code,/mobileCameraMode==='follow'&&!manualOrbit\?cameraRadians\(mobileCameraSpeedDeg\):1\.1/);
  assert.match(code,/mobileCameraTuning\.querySelectorAll\('input'\)/);
  assert.match(code,/element\.disabled=mobileCameraMode==='free'/);
  assert.match(code,/setCameraSpeed\?\.\(CAMERA_SPEED_DEFAULT_DEG\)/);
  assert.match(code,/setCameraTurn\?\.\(CAMERA_TURN_DEFAULT_DEG\)/);
});

test('marcha a ré não provoca novo giro automático de 180 graus',()=>{
  const code=read('js/main.js');
  const frame=code.slice(code.indexOf('function update(dt){'),code.indexOf('let qualitySampleTime=0'));
  const input=frame.indexOf("const walkingBackward=fw<-.12;");
  const reset=frame.indexOf("if(mobileCameraMode==='follow'&&walkingBackward)");
  const yawUpdate=frame.indexOf("CAM.yaw=gentleOrbit");
  const follow=frame.indexOf("if(MOBILE_UI&&mobileCameraMode==='follow'&&moved&&!seated&&!walkingBackward&&");
  assert.ok(input>=0&&input<reset&&reset<yawUpdate,
    'cancelar rotação pendente antes de atualizar yaw');
  assert.ok(follow>yawUpdate,'não recalcular o ângulo para trás no deslocamento');
  assert.match(frame,/mobileOrbitYaw=CAM\.yaw;\s*mobileFollowAnchorYaw=null/);
  assert.match(frame,/if\(steering&&!walkingBackward&&mobileFollowAnchorYaw===null\)mobileFollowAnchorYaw=CAM\.yaw/);
});

test('controle de toque manual funciona também em Câmera livre e responde imediatamente',()=>{
  const code=read('js/main.js'),page=read('index.html');
  for(const id of ['mobile-touch-sensitivity','mobile-touch-sensitivity-number','mobile-touch-reset']){
    assert.match(page,new RegExp('id="'+id+'"'));
  }
  assert.match(code,/getPref\('topweb_mobile_touch_sensitivity'/);
  assert.match(code,/setPref\('topweb_mobile_touch_sensitivity',mobileTouchSensitivity\)/);
  assert.match(code,/dragOrbitDelta\(dx\*mobileTouchSensitivity\*horizontalSign,innerWidth\)/);
  assert.match(code,/dy\*\.0018\*mobileTouchSensitivity\*verticalSign/);
  assert.match(code,/CAM\.yaw=mobileOrbitYaw;CAM\.lift=mobileOrbitLift;clampCam\(\)/);
  assert.match(code,/setTouchSensitivity\?\.\(CAMERA_TOUCH_DEFAULT\)/);
  const disabled=code.slice(code.indexOf('function updateCameraTuningDisabled()'),
    code.indexOf('function bindMobileCameraTuning('));
  assert.match(disabled,/mobileCameraTuning\.querySelectorAll\('input'\)/);
  assert.doesNotMatch(disabled,/mobile-touch-sensitivity/);
  assert.match(page,/main\.js\?v=40/);
});

test('eixos de toque podem ser invertidos separadamente com preferência salva',()=>{
  const page=read('index.html'),code=read('js/main.js');
  for(const id of ['mobile-touch-invert-x','mobile-touch-invert-y'])
    assert.match(page,new RegExp('id="'+id+'"'));
  assert.match(code,/getPref\('topweb_mobile_touch_invert_x','0'\)/);
  assert.match(code,/getPref\('topweb_mobile_touch_invert_y','0'\)/);
  assert.match(code,/bindTouchInversion\('mobile-touch-invert-x','topweb_mobile_touch_invert_x'/);
  assert.match(code,/bindTouchInversion\('mobile-touch-invert-y','topweb_mobile_touch_invert_y'/);
  assert.match(code,/const horizontalSign=invertTouchHorizontal\?-1:1/);
  assert.match(code,/const verticalSign=invertTouchVertical\?-1:1/);
  assert.match(code,/dragOrbitDelta\(dx\*mobileTouchSensitivity\*horizontalSign,innerWidth\)/);
  assert.match(code,/dy\*\.0018\*mobileTouchSensitivity\*verticalSign/);
  assert.match(code,/setPref\(key,checkbox.checked\?'1':'0'\)/);
  assert.match(page,/main\.js\?v=40/);
});
test('Auto tem botão pequeno acima do Alvo e o grande é manual',()=>{
  const page=read('index.html'),code=read('js/main.js'),css=read('mobile-landscape.css');
  assert.match(page,/id="mobile-auto"/);
  assert.match(page,/id="mobile-attack"[^>]*aria-label="Atacar manualmente"/);
  assert.match(css,/#mobile-auto\{[\s\S]*?right:84px;bottom:58px/);
  assert.match(code,/\$\('mobile-auto'\)\.addEventListener\('click',toggleAutoAttack\)/);
  assert.match(code,/if\(context.type==='attack'\)return manualAttack\(\)/);
  assert.match(code,/combat\.manualAttack\(playerPos\)/);
  assert.match(code,/if\(combat\.auto\)return false/);
  assert.match(code,/context.type==='attack'&&!!combat\?\.auto/);
  assert.match(code,/\['mobile-auto','atk'\]/);
  assert.match(code,/\$\('atk'\)\.addEventListener\('click',toggleAutoAttack\)/);
  assert.match(page,/mobile-landscape\.css\?v=4/);
});
