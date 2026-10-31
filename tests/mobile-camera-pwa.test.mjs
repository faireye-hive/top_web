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
