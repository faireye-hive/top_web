import {updateFollowTarget} from './mobile-camera-follow.mjs';
import {cameraDegrees,cameraRadians,CAMERA_SPEED_DEFAULT_DEG,CAMERA_TURN_DEFAULT_DEG,CAMERA_TOUCH_DEFAULT,cameraTouchSensitivity} from './mobile-camera-settings.mjs?v=2';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { attachBrightness } from './brightness.js?v=2';
import { applyCursor } from './cursors.js?v=1';
import { createWaypoint } from './waypoint.js?v=1';
import { createArgentFountain } from './fountain.js?v=3';
import { initMobileControls } from './mobile-controls.js?v=2';
import { initRpgHud } from './rpg-hud.mjs?v=5';
import { loadMobileSkillCatalog, SKILL_ANIMATION_ACTORS, resolveSkillClip, getActionId } from './class-skills.mjs?v=3';
import { CHARACTERS, CLASSES, restoreHero, heroSnapshot, selectClass, refreshHero, serializeHero } from './hero-state.mjs?v=4';
import { resolvePrimaryAction } from './context-action.mjs?v=2';
import { createCombat, COMBAT } from './combat-state.mjs?v=4';
import { createMonsterManager } from './monster-manager.mjs?v=2';
import { calculateMovementSpeed } from './movement-speed.mjs';
import { createNpcManager } from './npc-manager.mjs?v=4';
import { followAngle, cameraLiftAtDistance, cameraFovAtDistance, gentleOrbit, dragOrbitDelta, movementFromYaw, subtleFollowTarget } from './camera-behavior.mjs?v=4';
import { basicAttackRange, skillWithRules } from './skill-rules.mjs';
import { createSkillVisuals } from './skill-visuals-runtime.mjs?v=2';
import { seatCenter, findSafeExit } from './pose-utils.mjs';
import {WeaponHolster,readPoseProfiles,poseProfile,selectPoseName} from './pose-studio-runtime.mjs?v=5';

// Cliente web do Garner. Este arquivo é o laço: mapa, câmera, colisão e ator
// compartilham um referencial só. O que pode crescer com o porte fica ao lado:
//   brightness.js  brilho
//   cursors.js     cursor de cada ação
//   waypoint.js    cristal azul do clique
//   fountain.js    jatos da fonte de Argent
// TOP Web — Garner em setores. A câmera clássica e o WASD saem do mesmo yaw:
// yaw 0 olha para +Z; yaw π olha para −Z e o olho fica no +Z (o lado do rosto).
// W anda nesse olhar. D anda na direita da tela (no yaw π, isso é +X).
const $ = id => document.getElementById(id);
const mobileQuery=window.matchMedia('(pointer: coarse), (max-width: 780px), (orientation: landscape) and (max-height: 600px)');
let MOBILE_UI=mobileQuery.matches;
document.body.classList.toggle('mobile-ui', MOBILE_UI);
const ORIGIN = { x: 2218.5, z: 2776.5 };
const CHUNK=64, RADIUS=3, STRIDE=7;
const LOOK_H=1.15;
const BODY_R=0.22;
// Mesmos limites de sources/Engine/include/top/ClassicCamera.h.
const CAM={yaw:Math.PI-0.35,dist:15,lift:1.85};
const getPref=(key,fallback)=>{try{return localStorage.getItem(key)??fallback}catch{return fallback}};
const setPref=(key,val)=>{try{localStorage.setItem(key,String(val))}catch{}};
let autoCameraEnabled=getPref('topweb_auto_camera','1')!=='0';
// Modo novo por padrão; o jogador pode escolher a órbita livre e o valor fica salvo.
let mobileCameraMode=getPref('topweb_mobile_camera_mode','follow')==='free'?'free':'follow';
// Graus por segundo e graus máximos por gesto, ajustáveis no painel (0–180).
let mobileCameraSpeedDeg=cameraDegrees(getPref('topweb_mobile_camera_speed_deg',String(CAMERA_SPEED_DEFAULT_DEG)));
let mobileCameraTurnDeg=cameraDegrees(getPref('topweb_mobile_camera_turn_deg',String(CAMERA_TURN_DEFAULT_DEG)));
let mobileTouchSensitivity=cameraTouchSensitivity(getPref('topweb_mobile_touch_sensitivity',String(CAMERA_TOUCH_DEFAULT)));
let invertTouchHorizontal=getPref('topweb_mobile_touch_invert_x','0')==='1';
let invertTouchVertical=getPref('topweb_mobile_touch_invert_y','0')==='1';
// O botão pequeno Auto seleciona apenas o MODO do botão grande.
// Combate automático só começa quando o botão grande é pressionado.
let mobileAutoModeEnabled=getPref('topweb_mobile_attack_mode','manual')==='auto';
let mobileSteeringReferenceYaw=null; // travado enquanto o joystick estiver pressionado
let mobileFollowAnchorYaw=null; // limita giro automático a ~24° por gesto
let cameraManualUntil=0;
let cameraFollowTarget=null;
let mobileOrbitYaw=CAM.yaw,mobileOrbitLift=CAM.lift;
let seatFacingReversed=getPref('topweb_seat_reverse','1')!=='0';
let visualMode=getPref('topweb_visual_mode','classic');
function manualCamera(){cameraManualUntil=performance.now()+2500}
function clampCam(){
  CAM.dist=THREE.MathUtils.clamp(Number.isFinite(CAM.dist)?CAM.dist:15,3.2,22);
  CAM.lift=THREE.MathUtils.clamp(Number.isFinite(CAM.lift)?CAM.lift:1.85,1.35,2.4);
}
// Único lugar que constrói o referencial da câmera. O olho é colocado com este
// mesmo vetor; o movimento não recalcula o yaw com outro sin/cos.
const _fwd=new THREE.Vector3(), _right=new THREE.Vector3();
const _eye=new THREE.Vector3(), _look=new THREE.Vector3();
function cameraBasis(){
  _fwd.set(Math.sin(CAM.yaw),0,Math.cos(CAM.yaw));
  _right.set(-_fwd.z,0,_fwd.x); // frente × cima = direita. yaw π → direita (1,0,0)
  return {fwd:_fwd,right:_right};
}
const keys=new Set();
const touchMove={sideways:0,forward:0};
let touchRunning=false;
let world, player, objects=[], markers=[], moverTarget=null, pendingPose=null, objectCatalog={};
let avatar=null, mixer=null, animations=[], runningAction=null, currentClip='';
let headBone=null, tailBone=null;
let attackPlaying=false, testing=false;
let rpgHud=null, npcManager=null, monsterManager=null, combat=null, changingCharacter=false;
let mobileSkillCatalog=null;
let skillActionQueue=[];
let skillAnimationLocked=false; // só libera no mixer.finished do último clipe GLB
// Pacote binário opcional: até ser instalado, o jogo conserva o HUD anterior.
const skillCatalogReady=loadMobileSkillCatalog().then(catalog=>{
  mobileSkillCatalog=catalog;
  if(rpgHud&&catalog)rpgHud.setClassSkills(catalog,hero.job,hero.character,animations);
  return catalog;
});
const hero=restoreHero(getPref('topweb_hero_v2','null'),getPref('topweb_character','lance'));
let equipmentManifest=null,changingLoadout=false;
let poseProfiles={version:1,profiles:{}},activePoseProfile=null,weaponHolster=null;
const poseProfilesReady=fetch('assets/poses/overrides.json?v=1')
  .then(r=>r.ok?r.json():{version:1,profiles:{}})
  .catch(()=>({version:1,profiles:{}}))
  .then(data=>{poseProfiles=readPoseProfiles(globalThis.localStorage,data);return poseProfiles;});
const saveHero=()=>setPref('topweb_hero_v2',serializeHero(hero));
let storedPosition=null, nextDraw=0, lastObjUpdate=0, forceChunks=true;
const clock=new THREE.Clock();
const playerPos=new THREE.Vector3(ORIGIN.x,0,ORIGIN.z);
const mobileCameraFocus=playerPos.clone();
const scene=new THREE.Scene();
scene.background=new THREE.Color('#7ea8b6');
scene.fog=new THREE.FogExp2(0x8aafba,.0042); // menos névoa desbotando o cenário
const renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:!MOBILE_UI, powerPreference:'high-performance'});
let maxPixelRatio=Math.min(window.devicePixelRatio || 1,MOBILE_UI?1.15:1.65);
let renderPixelRatio=maxPixelRatio;
renderer.setPixelRatio(renderPixelRatio);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping; // clássico: evita a perda de saturação do ACES
renderer.toneMappingExposure=1.12;
const camera=new THREE.PerspectiveCamera(51.6,1,.3,800);
const skillVisuals=createSkillVisuals({scene,camera,heightAt:(x,z)=>world?sampleHeight(x,z):0});
window.__skillVfxInfo=()=>skillVisuals.diagnostics();
const hemi=new THREE.HemisphereLight(0xd5e4ee,0x4a5850,0.9);
scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe6b0,1.22); sun.position.set(-50,90,70); scene.add(sun);
const ambient=new THREE.DirectionalLight(0x9ad4e2,.3); ambient.position.set(40,30,-50);scene.add(ambient);
const brightness=attachBrightness({renderer, hemi, sun, fill:ambient, scene});
const waypoint=createWaypoint(THREE, scene);
let fountain=null;
const shadow=new THREE.Mesh(new THREE.CircleGeometry(.62,24),new THREE.MeshBasicMaterial({color:0x07141c,transparent:true,opacity:.38,depthWrite:false}));
shadow.rotation.x=-Math.PI/2; shadow.renderOrder=2; scene.add(shadow);
let terrainAtlas=null;
const landMat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
const ATLAS_DIV=8, ATLAS_CELL=256, ATLAS_PAD=2;
function writeAtlasUV(dest, offset, tileId, x, z){
  // O client histórico repete a textura original a cada quatro tiles.
  const id=(tileId>=0&&tileId<64)?tileId:0;
  const px=ATLAS_PAD+(x%4)*((ATLAS_CELL-2*ATLAS_PAD)/4);
  const py=ATLAS_PAD+(z%4)*((ATLAS_CELL-2*ATLAS_PAD)/4);
  dest[offset]=(id%ATLAS_DIV+px/ATLAS_CELL)/ATLAS_DIV;
  dest[offset+1]=1-(Math.floor(id/ATLAS_DIV)+py/ATLAS_CELL)/ATLAS_DIV;
}
// Água no nível 0, quadras de 4 m, como MPMap::RenderSea. O alpha do vértice
// some quando o terreno está acima de −0,5 m, para a praia não ficar coberta.
const seaMat=new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, toneMapped:true,
  uniforms:{uTime:{value:0}},
  vertexShader:`
    attribute float aShore;
    uniform float uTime;
    varying float vShore;
    varying vec2 vWorld;
    void main(){
      vShore=aShore;
      vec3 p=position;
      float wave=sin(p.x*0.72+uTime*1.35)*cos(p.z*0.58-uTime*1.05);
      p.y+=wave*0.04*aShore;
      vWorld=p.xz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
    }`,
  fragmentShader:`
    uniform float uTime;
    varying float vShore;
    varying vec2 vWorld;
    void main(){
      float spark=sin(vWorld.x*1.6+uTime*0.8)*sin(vWorld.y*1.25-uTime*0.55);
      vec3 deep=vec3(0.18,0.45,0.66);
      vec3 crest=vec3(0.62,0.84,0.90);
      vec3 col=mix(deep,crest,spark*0.5+0.5);
      col=mix(col,vec3(0.549,0.549,0.863),0.42);
      float alpha=vShore*(0.78+0.08*spark);
      if(alpha<0.015) discard;
      gl_FragColor=vec4(col,alpha);
    }`
});
const chunkMap=new Map();
const objGroup=new THREE.Group();scene.add(objGroup);
let sceneObjs3D=null;
let modelInstances=[]; // instancing dinâmico: geometria única por modelo
let modelGroups=new Map(), spatialGroups=new Map();
let sceneVisibilityRadius=MOBILE_UI?100:180, lastScenePosition=new THREE.Vector3(Infinity,Infinity,Infinity);
let sceneStats={loaded:0,missing:0,active:0};
const instanceTemp=new THREE.Object3D();

const markerGeo=new THREE.BoxGeometry(.5,.8,.5), markerMat=new THREE.MeshBasicMaterial({color:0xffd18f});
const effectGeo=new THREE.IcosahedronGeometry(.37,0),effectMat=new THREE.MeshBasicMaterial({color:0xc389ff});
let objectMeshes=[];
let colorMode='textured', showWater=true, showMarkers=false, wireframe=false, allowBlocked=false;
const tempColor=new THREE.Color(), tempHue=new THREE.Color();
const palette={0:'#746d65',2:'#b3a99a',3:'#9babb3',4:'#ab9786',5:'#cfbe94',6:'#c7baa4',7:'#ddbf8c',8:'#81a66b',9:'#7e966e',10:'#b6a984',12:'#8eab78',13:'#9b987b',14:'#8ba07b',16:'#a8be8f',18:'#a6b492',19:'#d7c59d',22:'#62969c',24:'#a4b08c',25:'#c7ad88',33:'#85a89b'};
const TERRAIN_LABELS={"1":"subtract.bmp","2":"brick01.bmp","3":"brick04.bmp","4":"brick05.bmp","5":"grass05.bmp","6":"grass11.bmp","7":"grass04.bmp","8":"grass02.bmp","9":"grass01.bmp","10":"grass03.bmp","11":"snow05.bmp","12":"grass07.bmp","13":"brick09.bmp","14":"sand03.bmp","15":"sand02.bmp","16":"sand01.bmp","17":"dirt03.bmp","18":"dirt04.bmp","19":"dirt05.bmp","20":"brick02.bmp","21":"brick03.bmp","22":"brick06.bmp","23":"dirt07.bmp","24":"rock01.bmp","25":"rock02.bmp","26":"snow01.bmp","27":"snow02.bmp","28":"snow03.bmp","29":"snow04.bmp","30":"grass10.bmp","31":"dirt06.bmp","32":"snow06.bmp","33":"grass09.bmp","34":"sand05.bmp","35":"sand06.bmp","36":"sand07.bmp","37":"brick08.bmp","38":"snow07.bmp","39":"drit08.bmp","40":"drit09.bmp","41":"snow08.bmp","42":"dirt02.bmp","43":"dirt01.bmp","44":"sand08.BMP","45":"sand09.BMP","46":"drit10.bmp","47":"brick10.bmp","48":"brick109.bmp","49":"brick110.bmp"};
const paletteRGB={};
for(const [id,h] of Object.entries(palette)){const c=new THREE.Color(h); paletteRGB[id]=[c.r,c.g,c.b]}
const tintRGB=new Float32Array(3);
let lastToast=0;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');lastToast=performance.now();}
function progress(amount,message){$('progressbar').style.width=`${amount}%`;if(message)$('loadingmessage').textContent=message;}
function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
window.addEventListener('resize',resize);resize();
function getTile(x,z){
  const ix=Math.floor(x)-world.ox, iz=Math.floor(z)-world.oz;
  if(ix<0||iz<0||ix>=world.w||iz>=world.h)return null;
  const i=20+(iz*world.w+ix)*STRIDE, v=world.dv;
  return {tex:v.getUint8(i),height:v.getInt8(i+1)*.1,
          rgb:v.getUint16(i+2,true),region:v.getUint16(i+4,true),blocks:v.getUint8(i+6)};
}
function sampleHeight(x,z){
  const tile=getTile(x,z);if(!tile)return 0;
  const fx=x-Math.floor(x),fz=z-Math.floor(z);
  const a=tile.height;
  const t1=getTile(x+1,z),t2=getTile(x,z+1),t3=getTile(x+1,z+1);
  const b=t1?.height??a,c=t2?.height??a,d=t3?.height??a;
  return fx+fz<=1?a+fx*(b-a)+fz*(c-a):d+(1-fx)*(c-d)+(1-fz)*(b-d);
}
function walkable(x,z){
  const t=getTile(x,z);if(!t)return false;
  if(allowBlocked)return true;
  if((t.region&9)===0)return false; // LAND=1, BRIDGE=8, conforme MapFile.cpp
  const sub=(Math.floor((z%1)*2)*2)+Math.floor((x%1)*2);
  return (t.blocks&(1<<sub))===0;
}
function findFree(x,z){
  if(walkable(x,z))return [x,z];
  for(let r=1;r<=18;r++){
    for(let a=0;a<Math.PI*2;a+=Math.PI/(r*4)){
      let nx=x+Math.cos(a)*r,nz=z+Math.sin(a)*r;
      if(walkable(nx,nz))return [nx,nz];
    }
  }
  return null;
}
function getTint(rgb){
  const r=(rgb>>11)&31,g=(rgb>>5)&63,b=rgb&31;
  tintRGB[0]=r/31;tintRGB[1]=g/63;tintRGB[2]=b/31;
  return tintRGB;
}
function colorFor(t,x,z){
  if(!t)return [.12,.22,.24];
  const tint=getTint(t.rgb);
  if(colorMode==='textured'){
    const sum=tint[0]+tint[1]+tint[2];
    if(sum<.12)return [1,1,1]; // Compatível com o fallback do MapFile.
    return [Math.max(.12,tint[0]),Math.max(.12,tint[1]),Math.max(.12,tint[2])];
  }
  if(colorMode==='rgb')return [.16+.84*tint[0],.16+.84*tint[1],.16+.84*tint[2]];
  let base;
  if(colorMode==='ids'){
    tempHue.setHSL(((t.tex*0.61803398875)%1),.53,.45);
    base=[tempHue.r,tempHue.g,tempHue.b];
  }else{
    base=paletteRGB[t.tex];
    if(!base){tempHue.setHSL(((t.tex*.618)%1),.18,.50);base=[tempHue.r,tempHue.g,tempHue.b]}
  }
  const varNoise=(((Math.imul(x+7,73856093)^Math.imul(z+19,19349663))>>>0)%23)/460;
  const shade=.77+varNoise;
  return [base[0]*shade*(.65+.35*tint[0]),base[1]*shade*(.65+.35*tint[1]),base[2]*shade*(.65+.35*tint[2])];
}
function chunkKey(cx,cz){return `${cx}/${cz}`}
function gridHeight(ix,iz){
  const t=getTile(ix,iz);
  return t?t.height:0;
}
// Normal pela diferença central da altura. O mesmo vértice na borda de dois
// setores recebe o mesmo vetor, então a luz não racha entre os chunks.
// Plano: (0, 1, 0). Subida em +x (dhx>0): componente x negativa.
function writeNormal(out,offset,x,z){
  const dhx=gridHeight(x+1,z)-gridHeight(x-1,z);
  const dhz=gridHeight(x,z+1)-gridHeight(x,z-1);
  const nx=-dhx, ny=2, nz=-dhz;
  const len=Math.hypot(nx,ny,nz)||1;
  out[offset]=nx/len; out[offset+1]=ny/len; out[offset+2]=nz/len;
}
function buildChunk(cx,cz){
  const baseX=world.ox+cx*CHUNK,baseZ=world.oz+cz*CHUNK;
  const sideX=Math.min(CHUNK,world.w-cx*CHUNK),sideZ=Math.min(CHUNK,world.h-cz*CHUNK);
  if(sideX<=0||sideZ<=0)return null;
  const count=sideX*sideZ, positions=new Float32Array(count*12),normals=new Float32Array(count*12),colors=new Float32Array(count*12),indices=new Uint16Array(count*6),uvs=new Float32Array(count*8);
  let j=0,ii=0,sea=false;
  for(let z=0;z<sideZ;z++)for(let x=0;x<sideX;x++){
    const gx=baseX+x,gz=baseZ+z, t=getTile(gx,gz),clr=colorFor(t,gx,gz);
    const h00=t?.height??-2,h10=getTile(gx+1,gz)?.height??h00;
    const h01=getTile(gx,gz+1)?.height??h00,h11=getTile(gx+1,gz+1)?.height??h00;
    if(h00<-.05||h10<-.05||h01<-.05||h11<-.05)sea=true;
    const verts=[gx,h00,gz, gx+1,h10,gz, gx,h01,gz+1, gx+1,h11,gz+1];
    positions.set(verts,j*12);
    writeNormal(normals,j*12,gx,gz);
    writeNormal(normals,j*12+3,gx+1,gz);
    writeNormal(normals,j*12+6,gx,gz+1);
    writeNormal(normals,j*12+9,gx+1,gz+1);
    for(let k=0;k<4;k++)colors.set(clr,j*12+k*3);
    // 4 vertices: (x,z), (x+1,z), (x,z+1), (x+1,z+1)
    writeAtlasUV(uvs,j*8,t?.tex??0,gx,gz);
    writeAtlasUV(uvs,j*8+2,t?.tex??0,gx+1,gz);
    writeAtlasUV(uvs,j*8+4,t?.tex??0,gx,gz+1);
    writeAtlasUV(uvs,j*8+6,t?.tex??0,gx+1,gz+1);
    const offset=j*4;
    indices.set([offset,offset+2,offset+1,offset+1,offset+2,offset+3],ii);
    ii+=6;j++;
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geom.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geom.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geom.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geom.setIndex(new THREE.BufferAttribute(indices,1));
  const mesh=new THREE.Mesh(geom,landMat);mesh.userData.terrain=true;mesh.frustumCulled=true;scene.add(mesh);
  const chunk={mesh,water:null,cx,cz};
  if(sea){
    const seaPos=[], shore=[];
    const x0=Math.ceil(baseX/4)*4, z0=Math.ceil(baseZ/4)*4;
    const x1=baseX+sideX, z1=baseZ+sideZ;
    for(let gz=z0;gz+4<=z1+1e-4;gz+=4)for(let gx=x0;gx+4<=x1+1e-4;gx+=4){
      const corners=[[gx,gz],[gx+4,gz],[gx,gz+4],[gx+4,gz+4]];
      const alpha=corners.map(([x,z])=>{
        const h=gridHeight(x,z);
        return h<=-.5?207/255:0;
      });
      if(alpha.every(a=>a===0))continue;
      const y=0;
      seaPos.push(gx,y,gz, gx,y,gz+4, gx+4,y,gz, gx+4,y,gz, gx,y,gz+4, gx+4,y,gz+4);
      // Cantos na mesma ordem dos dois triângulos: 0,2,1 e 1,2,3.
      shore.push(alpha[0],alpha[2],alpha[1], alpha[1],alpha[2],alpha[3]);
    }
    if(seaPos.length){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(seaPos,3));
      geo.setAttribute('aShore',new THREE.Float32BufferAttribute(shore,1));
      const waterMesh=new THREE.Mesh(geo,seaMat);waterMesh.visible=showWater;waterMesh.renderOrder=2;waterMesh.frustumCulled=true;scene.add(waterMesh);chunk.water=waterMesh;
    }
  }
  return chunk;
}
function clearChunks(){for(const c of chunkMap.values()){scene.remove(c.mesh);c.mesh.geometry.dispose();if(c.water){scene.remove(c.water);c.water.geometry.dispose()}}chunkMap.clear()}
function updateChunks(){
  const cx=Math.floor((playerPos.x-world.ox)/CHUNK),cz=Math.floor((playerPos.z-world.oz)/CHUNK);
  const need=new Set();let created=0;
  for(let dz=-RADIUS;dz<=RADIUS;dz++)for(let dx=-RADIUS;dx<=RADIUS;dx++){
    const x=cx+dx,z=cz+dz;
    if(x<0||z<0||x*CHUNK>=world.w||z*CHUNK>=world.h)continue;
    const key=chunkKey(x,z);need.add(key);
    if(!chunkMap.has(key)){const c=buildChunk(x,z);if(c){chunkMap.set(key,c);created++}}
  }
  for(const [key,c] of chunkMap){if(!need.has(key)){
    scene.remove(c.mesh);c.mesh.geometry.dispose();if(c.water){scene.remove(c.water);c.water.geometry.dispose()}
    chunkMap.delete(key);
  }}
  return created;
}
function mapPixels(){
  const cnv=$('minimap'),ctx=cnv.getContext('2d',{willReadFrequently:false});
  const img=ctx.createImageData(256,256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const xx=world.ox+(x+.5)/256*world.w,zz=world.oz+(y+.5)/256*world.h;
    const t=getTile(xx,zz),clr=colorFor(t,Math.floor(xx),Math.floor(zz));
    const at=(y*256+x)*4;
    const sea=t?.height<-.4;
    img.data[at]=Math.floor(Math.min(1,sea ? .25+clr[0]*.9 : clr[0])*255);
    img.data[at+1]=Math.floor(Math.min(1,sea ? .45+clr[1]*.7 : clr[1])*255);
    img.data[at+2]=Math.floor(Math.min(1,sea ? .57+clr[2]*.7 : clr[2])*255);
    img.data[at+3]=255;
  }
  return img;
}
let minimapBackground=null;
function generateMinimap(){
  const hidden=document.createElement('canvas');hidden.width=256;hidden.height=256;
  hidden.getContext('2d').putImageData(mapPixels(),0,0);
  minimapBackground=hidden;
}
function drawMinimap(){
  if(!minimapBackground)return;
  const ctx=$('minimap').getContext('2d');ctx.clearRect(0,0,256,256);
  ctx.drawImage(minimapBackground,0,0);
  const mx=(playerPos.x-world.ox)/world.w*256,mz=(playerPos.z-world.oz)/world.h*256;
  const {fwd}=cameraBasis();
  ctx.beginPath();ctx.moveTo(mx,mz);ctx.lineTo(mx+fwd.x*18,mz+fwd.z*18);
  ctx.strokeStyle='#fff3c4';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(mx,mz,4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#072633';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(mx,mz,9,0,Math.PI*2);ctx.strokeStyle='#b2fff0';ctx.lineWidth=1.4;ctx.stroke();
  if(moverTarget){ctx.beginPath();ctx.arc((moverTarget.x-world.ox)/world.w*256,(moverTarget.z-world.oz)/world.h*256,3,0,Math.PI*2);ctx.strokeStyle='#ffe6ad';ctx.stroke()}
}
function clearObjectMarkers(){objectMeshes.forEach(m=>{objGroup.remove(m);m.dispose?.()});objectMeshes=[];objGroup.clear()}
// CSceneObj::_UpdateYaw: o short do .obj entra em Angle2Radian, em graus.
// lwMatrix44RotateZ(-yaw + π). No Three, com a malha já em Y-up, isso é rotation.y.
// Tipo 1 guarda o short/100 em radianos (EffectObj); esses registros não viram casa.
function objectYaw(rec){
  const rad=rec[3]===0 ? THREE.MathUtils.degToRad(rec[5]) : rec[5];
  return Math.PI-rad;
}
function updateObjectMarkers(){
  clearObjectMarkers();if(!showMarkers)return;
  const radiusSq=110*110;
  const groups=[[],[]];
  for(const rec of objects){
    const dx=rec[0]-playerPos.x,dz=rec[1]-playerPos.z;
    if(dx*dx+dz*dz>radiusSq)continue;
    const index=rec[3]===1?1:0;
    groups[index].push(rec);
  }
  const dummy=new THREE.Object3D();
  groups.forEach((grp,which)=>{
    if(grp.length===0)return;
    const mesh=new THREE.InstancedMesh(which?effectGeo:markerGeo,which?effectMat:markerMat,grp.length);
    grp.forEach((rec,i)=>{
      dummy.position.set(rec[0],sampleHeight(rec[0],rec[1])+.65+rec[4],rec[1]);
      dummy.rotation.y=objectYaw(rec);
      dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
    mesh.userData.records=grp;
    objGroup.add(mesh);objectMeshes.push(mesh);
  });
}
function placeCamera(){
  const cameraPivot=MOBILE_UI?mobileCameraFocus:playerPos;
  clampCam();
  const pitch=cameraLiftAtDistance(CAM.lift,CAM.dist);
  const desiredFov=cameraFovAtDistance(CAM.dist);
  if(Math.abs(camera.fov-desiredFov)>.05){camera.fov=desiredFov;camera.updateProjectionMatrix();}
  const {fwd}=cameraBasis();
  _look.set(cameraPivot.x,cameraPivot.y+LOOK_H,cameraPivot.z);
  let dist=CAM.dist;
  const eyeY=cameraPivot.y+CAM.dist*pitch;
  const steps=12;
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    const x=_look.x-fwd.x*CAM.dist*t;
    const z=_look.z-fwd.z*CAM.dist*t;
    const y=_look.y+(eyeY-_look.y)*t;
    if(sampleHeight(x,z)+.55>y){dist=Math.max(2.4,CAM.dist*(i-1)/steps);break;}
  }
  _eye.set(_look.x-fwd.x*dist,cameraPivot.y+dist*pitch,_look.z-fwd.z*dist);
  camera.position.copy(_eye);
  camera.lookAt(_look);
}
function occupied(x,z){
  return walkable(x,z)&&walkable(x+BODY_R,z)&&walkable(x-BODY_R,z)&&walkable(x,z+BODY_R)&&walkable(x,z-BODY_R);
}
// O GLB do Lance já aplica Rx(−90°): a cara histórica (+Y no Z-up) fica no −Z do grupo.
// Medido no mesh da face (Y local −0,07…+0,21) e conferido com a cabeça contra o rabo de cavalo.
function faceTravel(dx,dz,dt){
  if(!avatar||attackPlaying)return;
  const target=Math.atan2(-dx,-dz);
  const diff=THREE.MathUtils.euclideanModulo(target-avatar.rotation.y+Math.PI,Math.PI*2)-Math.PI;
  avatar.rotation.y+=THREE.MathUtils.clamp(diff,-dt*12,dt*12);
}
function teleport(x,z){
  stopCombat(true);
  x=THREE.MathUtils.clamp(x,world.ox+.01,world.ox+world.w-1.01);
  z=THREE.MathUtils.clamp(z,world.oz+.01,world.oz+world.h-1.01);
  const free=findFree(x,z);
  if(!free){toast('Nenhuma posição navegável próxima. Ative “Ignorar bloqueios”.');return false;}
  // Teleporte também deve soltar a pose; serve como saída de emergência.
  if(seated){seated=null;attackPlaying=false;playClip('Parado');}
  playerPos.set(free[0],sampleHeight(free[0],free[1]),free[1]);
  // Teleporte é uma descontinuidade: centralizar imediatamente, sem rastro.
  mobileCameraFocus.copy(playerPos);
  mobileSteeringReferenceYaw=null;
  mobileFollowAnchorYaw=null;
  if(avatar)avatar.position.copy(playerPos);
  shadow.position.set(playerPos.x,playerPos.y+.04,playerPos.z);
  moverTarget=null;pendingPose=null;waypoint.hide();
  placeCamera();
  updateChunks();updateSceneInstances(true);updateEffectInstances(true);updateObjectMarkers();updateHUD();drawMinimap();
  return true;
}
function updateHUD(){
  const t=getTile(playerPos.x,playerPos.z);
  $('textureinfo').textContent=t?`Textura #${t.tex} · ${TERRAIN_LABELS[t.tex]||'sem nome'}`:'—';
  $('coords').textContent=`${playerPos.x.toFixed(1)}, ${playerPos.z.toFixed(1)}`;
  $('height').textContent=`${playerPos.y.toFixed(2)} m`;
  $('texid').textContent=t?`#${t.tex}`:'fora';
  $('region').textContent=t?`${t.region} ${t.region&9?'· terra':'· sem passagem'}`:'fora';
  $('objcount').textContent=objects.length.toLocaleString('pt-BR');
  const cam=$('caminfo'); if(cam) cam.textContent=`${CAM.dist.toFixed(0)} m · ${Math.round(Math.atan(cameraLiftAtDistance(CAM.lift,CAM.dist))*180/Math.PI)}°`;
  const sitBtn=$('sit');
  if(sitBtn) sitBtn.classList.toggle('active', !!seated || !!poseHere(playerPos.x, playerPos.z));
}
function primaryContext(){
  return resolvePrimaryAction({recovering:hero.hp<=0,seated:!!seated,
    npc:npcManager?.nearest(playerPos.x,playerPos.z),pose:poseHere(playerPos.x,playerPos.z)});
}
function primaryAction(){
  if(changingLoadout||changingCharacter||rpgHud?.isOpen())return;
  const context=primaryContext();
  if(context.type==='attack')return mobileAutoModeEnabled?toggleAutoAttack():manualAttack();
  return tryPose();
}
function tryPose(){
  if(skillAnimationLocked){toast('Aguarde a animação da skill terminar.');return false;}
  stopCombat();
  const context=primaryContext();
  if(context.type==='recovering')return false;
  if(context.type==='stand'){if(standUp())toast('Em pé.');return true;}
  if(context.type==='npc'){toast(context.npc.name+' · diálogo em desenvolvimento');return true;}
  if(context.type==='pose'){
    if(hero.character!=='lance'){toast('As poses de banco ainda estão disponíveis apenas para Lance.');return false;}
    sitDown(context.pose);return true;
  }
  toast('Chegue perto de um banco, parede ou NPC.');return false;
}
function currentWeaponPoseBank(){
  const bank=hero.equipped?Number(equipmentManifest?.sets?.[hero.job]?.pose):0;
  return Number.isInteger(bank)&&bank>=0&&bank<=6?bank:0;
}
function isRunningPose(){
  return currentClip.toLowerCase().includes('correr') ||
    ['run','armedRun'].some(state=>selectPoseName(state,activePoseProfile,animations,currentWeaponPoseBank())===currentClip);
}
function poseResolvedName(match){
  const state=match==='Parado'?(combat?.auto?'guard':'idle'):
    match==='Correr'?(combat?.auto?'armedRun':'run'):
    match==='Ataque 1'?'attack':null;
  return state?selectPoseName(state,activePoseProfile,animations,currentWeaponPoseBank()):match;
}
function playClip(match,once=false){
  if(!mixer||!animations.length)return false;
  const requested=poseResolvedName(match);
  const want=requested.toLowerCase();
  const clip=animations.find(a=>a.name===requested)
    ||animations.find(a=>a.name.toLowerCase().split('·').pop().trim()===want)
    ||animations.find(a=>a.name.toLowerCase().includes(want));
  if(!clip)return false;
  if(currentClip===clip.name&&!once)return true;
  const next=mixer.clipAction(clip);
  if(runningAction&&runningAction!==next)runningAction.fadeOut(.17);
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).fadeIn(.17);
  next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);
  next.clampWhenFinished=once;
  next.play();runningAction=next;currentClip=clip.name;
  for(const b of ['idle','run','atk','dance'])$(b).classList.remove('active');
  if(once && match.toLowerCase().includes('ataque'))$('atk').classList.add('active');
  else $('run').classList.toggle('active',!once && match==='Correr');
  if(!once&&match==='Parado')$('idle').classList.add('active');
  return true;
}
function stopCombat(force=false){
  // Um movimento, clique ou abertura de HUD não deve interromper a skill GLB.
  // Interrupção explícita só para troca de personagem/teleporte/derrota.
  if(skillAnimationLocked&&!force)return;
  if(force)skillAnimationLocked=false;
  skillActionQueue=[];
  const wasActive=!!combat?.auto||attackPlaying;
  combat?.stop(); // Trocar de guarda para descanso só depois de desativar Auto.
  if(wasActive){attackPlaying=false;playClip('Parado');}
}
function selectMobileAutoMode(){
  if(skillAnimationLocked){toast('Aguarde a animação da skill terminar.');return false;}
  if(changingCharacter||changingLoadout)return false;
  mobileAutoModeEnabled=!mobileAutoModeEnabled;
  // Desmarcar o modo Auto desliga o combate ativo, sem iniciar outro ataque.
  if(!mobileAutoModeEnabled&&combat?.auto)combat.toggle();
  setPref('topweb_mobile_attack_mode',mobileAutoModeEnabled?'auto':'manual');
  toast(mobileAutoModeEnabled
    ?'Modo Auto selecionado. Toque no botão grande para começar.'
    :'Modo manual selecionado. O botão grande dá um golpe por toque.');
  updateCombatHud();
  return mobileAutoModeEnabled;
}
function toggleAutoAttack(){
  if(skillAnimationLocked){toast('Aguarde a animação da skill terminar.');return false;}
  if(!combat||changingCharacter||changingLoadout||rpgHud?.isOpen()||hero.hp<=0)return false;
  if(seated){toast('Levante antes de combater.');return false;}
  if(combat.auto){
    combat.toggle(); // Desativa auto, mas conserva alvo para o ataque manual.
    if(!attackPlaying)playClip('Parado');
    toast('Ataque automático desligado.');return false;
  }
  keys.clear();touchMove.forward=0;touchMove.sideways=0;
  moverTarget=null;pendingPose=null;waypoint.hide();
  combat.toggle();
  if(!attackPlaying)playClip('Parado'); // Guarda configurada (quando disponível).
  toast('Ataque automático ligado. Toque no botão grande novamente para parar.');
  return true;
}
function manualAttack(){
  if(skillAnimationLocked){toast('Aguarde a animação da skill terminar.');return false;}
  if(!combat||changingCharacter||changingLoadout||rpgHud?.isOpen()||hero.hp<=0)return false;
  if(seated){toast('Levante antes de combater.');return false;}
  if(combat.auto)return false; // O botão grande é exclusivamente manual.
  const fired=combat.manualAttack(playerPos);
  if(fired){moverTarget=null;pendingPose=null;waypoint.hide();}
  return fired;
}
function clearAvatar(){
  weaponHolster?.dispose();weaponHolster=null;
  mixer?.stopAllAction();if(avatar)mixer?.uncacheRoot(avatar);
  if(!avatar)return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  avatar.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  scene.remove(avatar);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});
}
async function loadCharacter(id){
  if(changingCharacter||!CHARACTERS[id])return;
  changingCharacter=true;stopCombat(true);
  const selector=$('hero-character');if(selector)selector.disabled=true;
  try{
    const relative=hero.equipped?equipmentManifest?.sets?.[hero.job]?.models?.[id]:null;
    if(hero.equipped&&!relative)throw new Error('Conjunto indisponível para esse personagem.');
    const model=relative?'assets/equipment/'+relative:CHARACTERS[id].model;
    const gltf=await new GLTFLoader().loadAsync(model+'?v=5');
    let extraClips=[];
    if(await skillCatalogReady && SKILL_ANIMATION_ACTORS.includes(id)){
      try{
        const extra=await new GLTFLoader().loadAsync('assets/skills/animations/'+id+'.glb?v=2');
        extraClips=extra.animations||[];
      }catch(err){console.info('Ações extras ausentes para '+id,err);}
    }
    const yaw=avatar?.rotation.y||0;clearAvatar();
    hero.character=id;setPref('topweb_character',id);
    avatar=gltf.scene;avatar.name=CHARACTERS[id].name;scene.add(avatar);
    headBone=null;tailBone=null;
    avatar.traverse(o=>{
      if(o.isMesh)o.frustumCulled=false;
      if(o.name.includes('Ponytail1Nub'))tailBone=o;
      else if((o.name.includes('Bip01_Head')||o.name.includes('Bip01 Head'))&&!o.name.includes('Nub'))headBone=o;
    });
    avatar.position.copy(playerPos);avatar.rotation.y=yaw;
    animations=[...gltf.animations,...extraClips];runningAction=null;currentClip='';attackPlaying=false;skillAnimationLocked=false;
    await poseProfilesReady;
    activePoseProfile=poseProfile(poseProfiles,id,hero.job);
    weaponHolster=hero.equipped?new WeaponHolster(THREE,avatar,hero.job,activePoseProfile,id):null;
    skillVisuals.setActor(id,animations,{avatar,job:hero.job,equipped:hero.equipped});
    mixer=new THREE.AnimationMixer(avatar);
    skillActionQueue=[];
    mixer.addEventListener('finished',event=>{
      if(event.action!==runningAction)return;
      // NÃO finalizar a skill no primeiro clipe: algumas classes têm
      // uma sequência de ações GLB que deve tocar até o último finished.
      if(skillActionQueue.length&&!seated){
        const next=skillActionQueue.shift();
        if(playClip(next,true))return;
      }
      if(seated){if(seated.role==='sit'&&!currentClip.toLowerCase().includes('sentado'))playClip('Sentado');return;}
      skillAnimationLocked=false;
      attackPlaying=false;playClip('Parado');
    });
    playClip('Parado');weaponHolster?.setStowed(true);rpgHud?.setClips(animations);
    if(mobileSkillCatalog)rpgHud?.setClassSkills(mobileSkillCatalog,hero.job,id,animations);
    rpgHud?.setStats(heroSnapshot(hero));
    void skillVisuals.warm(mobileSkillCatalog?.classes?.[hero.job]?.skills||[]);
  }finally{
    changingCharacter=false;if(selector){selector.disabled=false;selector.value=hero.character;}
  }
}
function combatReachable(a,b){
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.3));
  let previous=sampleHeight(a.x,a.z);
  for(let i=1;i<=steps;i++){
    const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps,h=sampleHeight(x,z);
    if(!occupied(x,z)||solidAt(x,z,h)||Math.abs(h-previous)>STEP_UP)return false;
    previous=h;
  }
  return true;
}
function combatLineOfSight(a,b){
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.4));
  const start=sampleHeight(a.x,a.z)+1,end=sampleHeight(b.x,b.z)+.9;
  for(let i=1;i<steps;i++){
    const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=start+(end-start)*t;
    if(!getTile(x,z)||sampleHeight(x,z)>y||solidAt(x,z,y))return false;
  }
  return true;
}
function playSkillAnimation(skill){
  if(skillAnimationLocked)return false;
  const clip=resolveSkillClip(skill,hero.character,animations);
  if(!clip)return false;
  const chain=(skill.actions?.[hero.character]||[]).map(item=>animations.find(a=>getActionId(a)===item.id)).filter(Boolean);
  skillActionQueue=chain.slice(1).map(a=>a.name);
  const played=playClip(clip.name,true);
  if(!played){skillActionQueue=[];return false;}
  skillAnimationLocked=true;
  attackPlaying=true;
  return true;
}
let stealthAvatar=null,stealthActive=false;
function updateStealth(){
  const active=(combat?.buffs.stealth||0)>0;
  if(stealthAvatar===avatar&&stealthActive===active)return;
  stealthAvatar=avatar;stealthActive=active;
  avatar?.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){
    m.userData.normalOpacity??=m.opacity;m.userData.normalTransparent??=m.transparent;
    m.opacity=active?.28:m.userData.normalOpacity;m.transparent=active||m.userData.normalTransparent;m.needsUpdate=true;
  }});
}
function combatEvent(event){
  monsterManager?.onEvent(event);
  if(event.type==='notice')toast(event.message);
  if(event.type==='interrupt'&&!skillAnimationLocked){skillActionQueue=[];attackPlaying=false;playClip('Parado');}
  if(event.type==='cast'){
    if(event.monster&&avatar)avatar.rotation.y=Math.atan2(playerPos.x-event.monster.x,playerPos.z-event.monster.z);
    playSkillAnimation(event.skill);
    skillVisuals.play(event.skill,playerPos,event.monster,event.flight,null,{
      actor:hero.character,clip:resolveSkillClip(event.skill,hero.character,animations),
      facing:avatar?.rotation.y||0});saveHero();
  }
  if(event.type==='skillhit'){skillVisuals.impact(event.skill,event.monster);saveHero();}
  if(['healed','buff','dot'].includes(event.type))saveHero();
  if(event.type==='practice'){saveHero();if(event.improved)toast('Sua prática de ataque melhorou!');}

  if(event.type==='swing'){
    if(avatar)avatar.rotation.y=Math.atan2(playerPos.x-event.monster.x,playerPos.z-event.monster.z);
    attackPlaying=playClip('Ataque 1',true);
    skillVisuals.basic(hero,playerPos,event.monster,event.flight,event.period);
    if(attackPlaying&&runningAction)runningAction.setEffectiveTimeScale(runningAction.getClip().duration/(event.period*.85));
  }
  const feedback=$('combat-feedback');
  if(event.type==='hit'){saveHero();if(event.improved)toast('Sua prática de ataque melhorou!');}
  if(event.type==='kill')saveHero();
  if(event.type==='hit'&&feedback)feedback.textContent=event.damage?`${event.monster.name}: −${event.damage} HP`:'O alvo esquivou.';
  if(event.type==='hurt'&&feedback)feedback.textContent=event.damage?`Você recebeu ${event.damage} de dano.`:'Você esquivou.';
  if(event.type==='kill')toast(`${event.monster.name} derrotado · +${event.monster.xp} XP${event.levels?' · Nível '+hero.level+'!':''}`);
  if(event.type==='defeat'){skillAnimationLocked=false;skillActionQueue=[];attackPlaying=false;playClip('Parado');toast('Você caiu. Recuperando em 5 segundos…');}
  if(event.type==='revive'){teleport(2218.5,2776.5);toast('Recuperado em Argent.');}
}
function updateCombatHud(){
  rpgHud?.setStats(heroSnapshot(hero));
  rpgHud?.setCombatState({cooldowns:combat?.cooldowns||{},mp:hero.mp});
  const target=combat?.target;
  $('combat-target').textContent=target?`${target.name} · ${target.hp} / ${target.maxHp} HP`:'Toque num monstro ou use Alvo';
  $('combat-target-fill').style.width=target?`${100*target.hp/target.maxHp}%`:'0%';
  $('combat-mode').textContent=hero.hp<=0?'Recuperando…':combat?.auto
    ?(target?'Auto · combatendo':'Auto · procurando alvo')
    :(mobileAutoModeEnabled&&MOBILE_UI?'Modo Auto · pronto':'Modo manual');
  const desktopAuto=$('atk');
  desktopAuto?.setAttribute('aria-pressed',String(!!combat?.auto));
  desktopAuto?.classList.toggle('auto-active',!!combat?.auto);
  const autoModeButton=$('mobile-auto');
  if(autoModeButton){
    autoModeButton.disabled=hero.hp<=0||changingCharacter||changingLoadout||!!skillAnimationLocked||!!seated;
    autoModeButton.setAttribute('aria-pressed',String(mobileAutoModeEnabled));
    autoModeButton.setAttribute('aria-label',mobileAutoModeEnabled?'Usar ataque manual':'Usar ataque automático no botão grande');
    autoModeButton.classList.toggle('auto-active',mobileAutoModeEnabled);
  }
  const context=primaryContext(),button=$('mobile-attack');
  const combatAction=context.type==='attack';
  const autoAction=combatAction&&mobileAutoModeEnabled;
  button?.setAttribute('aria-label',autoAction?(combat?.auto?'Parar ataque automático':'Iniciar ataque automático')
    :combatAction?'Atacar manualmente':context.label);
  if(autoAction)button?.setAttribute('aria-pressed',String(!!combat?.auto));
  else button?.removeAttribute('aria-pressed');
  if(context.npc){$('combat-mode').textContent='Conversa disponível';$('combat-target').textContent=context.npc.name;}
  button?.classList.toggle('interaction-ready',!combatAction&&context.type!=='recovering');
  button?.classList.toggle('auto-mode-selected',autoAction);
  button?.classList.toggle('auto-active',autoAction&&!!combat?.auto);
  button?.classList.remove('manual-unavailable');
  const icon=button?.querySelector('use');if(icon)icon.setAttribute('href',context.icon);
  const label=button?.querySelector('small');if(label)label.textContent=combatAction?(mobileAutoModeEnabled?'Auto':'Atacar'):context.label;
  if(button)button.disabled=hero.hp<=0||changingCharacter||changingLoadout;
  $('mobile-target').disabled=hero.hp<=0||changingCharacter||changingLoadout;
  $('equipment-toggle').disabled=!equipmentManifest||changingLoadout||changingCharacter||hero.hp<=0;

}

function showLoadingError(error){console.error(error);$('loadingmessage').textContent=`Erro: ${error?.message||error}`;$('loadinghint').textContent='Abra via http://localhost:8000 e verifique sua conexão com a internet.';$('retry').hidden=false;}
async function fetchMap(){
  const response=await fetch('assets/argent/region.gmap.gz');
  if(!response.ok)throw new Error(`Não foi possível carregar o terreno (${response.status})`);
  if(!('DecompressionStream' in window))throw new Error('Este navegador não oferece DecompressionStream(gzip). Atualize o Firefox/Chrome.');
  const downloaded=await response.arrayBuffer();
  const isGzip=new Uint8Array(downloaded,0,2);
  const buffer=isGzip[0]===0x1f&&isGzip[1]===0x8b
      ? await new Response(new Blob([downloaded]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : downloaded;
  const dv=new DataView(buffer);
  if(String.fromCharCode(...new Uint8Array(buffer,0,4))!=='GNR1')throw new Error('Arquivo .gmap inválido');
  const ox=dv.getUint32(4,true),oz=dv.getUint32(8,true),w=dv.getUint32(12,true),h=dv.getUint32(16,true);
  if(buffer.byteLength!==20+w*h*STRIDE||w>4096||h>4096)throw new Error('Formato ou tamanho de mapa incorreto');
  return {dv,ox,oz,w,h};
}
// Volumes do editor em sceneobjinfo (tipo ≠ 0). O cliente histórico não desenha
// esses cubos: yyyy001 senta, yyyy002 encosta, vermelho bloqueia, azul é piso.
const EDITOR_ROLE={
  'yyyy001.lmo':'sit','yyyy002.lmo':'lean',
  'yyyy003.lmo':'solid','yyyy006.lmo':'solid',
  'yyyy004.lmo':'floor','yyyy005.lmo':'floor'
};
function editorRole(file){
  const name=(file||'').toLowerCase();
  if(EDITOR_ROLE[name])return EDITOR_ROLE[name];
  if(name.startsWith('yyyy'))return 'hide';
  return '';
}
const STEP_UP=0.72;
const poseMarks=[], floorSlabs=[], solidSlabs=[], walkPlaces=[];
const poseCells=new Map(), slabCells=new Map(), walkPlaceCells=new Map();
const walkByFile=new Map();
let seated=null;
const _yawObj=new THREE.Object3D();
function cell16(x,z){return `${Math.floor(x/16)}/${Math.floor(z/16)}`}
function pushCell(map,x,z,item){
  const key=cell16(x,z);
  if(!map.has(key))map.set(key,[]);
  map.get(key).push(item);
}
// Colunas da matriz de rotation.y, a mesma do InstancedMesh. O inverso é a
// transposta. Não recalcula o yaw com sen/cos.
function yawBasis(yaw){
  _yawObj.rotation.set(0,yaw,0);
  _yawObj.position.set(0,0,0);
  _yawObj.scale.set(1,1,1);
  _yawObj.updateMatrix();
  const e=_yawObj.matrix.elements;
  return [e[0],e[2],e[8],e[10]];
}
function localOf(basis,dx,dz){
  return [basis[0]*dx+basis[1]*dz, basis[2]*dx+basis[3]*dz];
}
function worldFrom(mark,lx,lz){
  const b=mark.basis;
  return [mark.x+b[0]*lx+b[2]*lz, mark.z+b[1]*lx+b[3]*lz];
}
function slabContains(slab,x,z){
  const [lx,lz]=localOf(slab.basis,x-slab.x,z-slab.z);
  return lx>=slab.minX && lx<=slab.maxX && lz>=slab.minZ && lz<=slab.maxZ;
}
function triHeight(tri,lx,lz){
  const x0=tri[0],y0=tri[1],z0=tri[2],x1=tri[3],y1=tri[4],z1=tri[5],x2=tri[6],y2=tri[7],z2=tri[8];
  const den=(x1-x0)*(z2-z0)-(z1-z0)*(x2-x0);
  if(Math.abs(den)<1e-5)return null;
  const w0=((x1-lx)*(z2-lz)-(z1-lz)*(x2-lx))/den;
  const w1=((lx-x0)*(z2-z0)-(lz-z0)*(x2-x0))/den;
  const w2=1-w0-w1;
  if(w0<-0.04||w1<-0.04||w2<-0.04)return null;
  return w0*y0+w1*y1+w2*y2;
}
function nearby(map,x,z,span){
  const cx=Math.floor(x/16), cz=Math.floor(z/16), out=[];
  for(let dz=-span;dz<=span;dz++)for(let dx=-span;dx<=span;dx++){
    const list=map.get(`${cx+dx}/${cz+dz}`);
    if(list)out.push(list);
  }
  return out;
}
function footSurface(x,z,hint){
  let best=sampleHeight(x,z);
  const limit=(Number.isFinite(hint)?hint:best)+STEP_UP;
  const consider=h=>{if(h>best && h<=limit+1e-4)best=h;};
  for(const list of nearby(slabCells,x,z,1))for(const slab of list){
    if(slab.solid||!slabContains(slab,x,z))continue;
    consider(slab.base+slab.top);
  }
  for(const list of nearby(walkPlaceCells,x,z,2))for(const place of list){
    const dx=x-place.x, dz=z-place.z;
    if(dx*dx+dz*dz>(place.radius+0.6)*(place.radius+0.6))continue;
    const walk=walkByFile.get(place.file);
    if(!walk)continue;
    const [lx,lz]=localOf(place.basis,dx,dz);
    const bucket=walk.cells.get(`${Math.floor(lx/2)}/${Math.floor(lz/2)}`);
    if(!bucket)continue;
    for(let i=0;i<bucket.length;i++){
      const h=triHeight(bucket[i],lx,lz);
      if(h!=null)consider(place.base+h);
    }
  }
  return best;
}
function solidAt(x,z,feet){
  for(const list of nearby(slabCells,x,z,1))for(const slab of list){
    if(!slab.solid||!slabContains(slab,x,z))continue;
    const top=slab.base+slab.top;
    if(feet<top+1.5 && feet+1.6>top-0.15)return true;
  }
  return false;
}
// O cubo verde fica no banco, quase sempre sobre um tile bloqueado.
// 1,35 m a partir da borda alcança quem está parado ao lado.
const POSE_REACH=1.35;
function poseHere(x,z){
  let best=null, bestD=1e9;
  for(const list of nearby(poseCells,x,z,1))for(const mark of list){
    const [lx,lz]=localOf(mark.basis,x-mark.x,z-mark.z);
    let d=0;
    if(lx<mark.minX||lx>mark.maxX||lz<mark.minZ||lz>mark.maxZ){
      const cx=Math.max(mark.minX,Math.min(mark.maxX,lx));
      const cz=Math.max(mark.minZ,Math.min(mark.maxZ,lz));
      d=Math.hypot(lx-cx,lz-cz);
      if(d>POSE_REACH)continue;
    }
    if(d<bestD){best=mark;bestD=d;}
  }
  return best;
}
function sitDown(mark){
  const clip=mark.role==='lean'?'Encostar':'Banco';
  const played=playClip(clip,true)||playClip(mark.role==='lean'?'Encostar':'Sentar',true);
  if(!played){toast('A animação desse ponto ainda não está no Lance.');return false;}
  // Guarda o lado pelo qual entrou: o .obj pode marcar piso bloqueado no assento.
  seated={...mark,returnPosition:playerPos.clone(),returnYaw:avatar?.rotation.y??0};
  moverTarget=null;pendingPose=null;waypoint.hide();
  attackPlaying=false;
  // Para bancos, o marcador indica o CENTRO da pose (não a face mais próxima).
  // Encostar continua escolhendo a face do lado de aproximação.
  let sx,sz;
  if(mark.role==='sit'){
    const center=seatCenter(mark);
    [sx,sz]=worldFrom(mark,center.x,center.z);
  }else{
    const [lx,lz]=localOf(mark.basis,playerPos.x-mark.x,playerPos.z-mark.z);
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    let ex=clamp(lx,mark.minX,mark.maxX),ez=clamp(lz,mark.minZ,mark.maxZ);
    if(lx>=mark.minX&&lx<=mark.maxX&&lz>=mark.minZ&&lz<=mark.maxZ){
      const faces=[[Math.abs(lx-mark.minX),mark.minX,ez],[Math.abs(mark.maxX-lx),mark.maxX,ez],[Math.abs(lz-mark.minZ),ex,mark.minZ],[Math.abs(mark.maxZ-lz),ex,mark.maxZ]];
      faces.sort((a,b)=>a[0]-b[0]);ex=faces[0][1];ez=faces[0][2];
    }
    const midX=(mark.minX+mark.maxX)/2,midZ=(mark.minZ+mark.maxZ)/2;
    const vx=midX-ex,vz=midZ-ez,span=Math.hypot(vx,vz)||1;
    [sx,sz]=worldFrom(mark,ex-vx/span*0.28,ez-vz/span*0.28);
  }
  const seat=footSurface(sx,sz,Math.max(sampleHeight(sx,sz),mark.base)+0.45);
  playerPos.set(sx,seat,sz);
  mobileCameraFocus.copy(playerPos);
  if(avatar){
    avatar.position.copy(playerPos);
    avatar.rotation.y=mark.yaw+(mark.role==='sit'&&seatFacingReversed?Math.PI:0);
  }
  shadow.position.set(playerPos.x,playerPos.y+.04,playerPos.z);
  toast(mark.role==='lean'?'Encostado na parede. Insert levanta.':'Sentado. Insert levanta.');
  return true;
}
function standUp(){
  if(!seated)return true;
  const previous=seated;
  const origin=previous.returnPosition||playerPos;
  const canStand=(x,z)=>{
    if(!occupied(x,z))return false;
    const feet=footSurface(x,z,origin.y);
    return !solidAt(x,z,feet);
  };
  const exit=findSafeExit(origin,canStand,9);
  if(!exit){
    toast('Não encontrei espaço seguro para levantar. Use o minimapa para sair.');
    return false;
  }
  seated=null;attackPlaying=false;pendingPose=null;moverTarget=null;waypoint.hide();
  const y=footSurface(exit[0],exit[1],origin.y);
  playerPos.set(exit[0],y,exit[1]);
  mobileCameraFocus.copy(playerPos);
  if(avatar){avatar.position.copy(playerPos);avatar.rotation.y=previous.returnYaw;}
  playClip('Parado');
  return true;
}
function indexScenePlaces(){
  poseMarks.length=0;floorSlabs.length=0;solidSlabs.length=0;walkPlaces.length=0;
  poseCells.clear();slabCells.clear();walkPlaceCells.clear();
  spatialGroups.clear();
  for(const rec of objects){
    if(rec[3]!==0)continue;
    const file=objectCatalog[rec[2]]?.file;
    if(!file)continue;
    const key=file.toLowerCase();
    const role=editorRole(key);
    const yaw=objectYaw(rec);
    const basis=yawBasis(yaw);
    const base=sampleHeight(rec[0],rec[1])+(rec[4]||0);
    if(role==='sit'||role==='lean'){
      const mark={x:rec[0],z:rec[1],yaw,basis,role,base,minX:-0.55,maxX:0.55,minZ:-0.55,maxZ:0.55,file:key};
      poseMarks.push(mark);pushCell(poseCells,mark.x,mark.z,mark);
    }else if(role==='solid'||role==='floor'){
      const slab={x:rec[0],z:rec[1],yaw,basis,base,solid:role==='solid',top:0,minX:-0.5,maxX:0.5,minZ:-0.5,maxZ:0.5,file:key};
      (role==='solid'?solidSlabs:floorSlabs).push(slab);
      pushCell(slabCells,slab.x,slab.z,slab);
    }else if(role==='hide'){
      continue;
    }else{
      const place={x:rec[0],z:rec[1],yaw,basis,base,file:key,radius:6,rec};
      walkPlaces.push(place);pushCell(walkPlaceCells,place.x,place.z,place);
      const cell=`${Math.floor(rec[0]/64)}/${Math.floor(rec[1]/64)}`;
      if(!spatialGroups.has(cell))spatialGroups.set(cell,[]);
      spatialGroups.get(cell).push([key,rec]);
    }
  }
}
function applyEditorBounds(file,box){
  const pad=file.startsWith('yyyy00')&&(EDITOR_ROLE[file]==='sit'||EDITOR_ROLE[file]==='lean')?0.2:0.05;
  const minX=box.min.x-pad, maxX=box.max.x+pad, minZ=box.min.z-pad, maxZ=box.max.z+pad, top=box.max.y;
  const touch=item=>{
    if(item.file!==file)return;
    item.minX=minX;item.maxX=maxX;item.minZ=minZ;item.maxZ=maxZ;
    if('top' in item)item.top=top;
  };
  poseMarks.forEach(touch);floorSlabs.forEach(touch);solidSlabs.forEach(touch);
}
function buildWalk(file,meshes){
  const cells=new Map();
  let maxR=1;
  const p=new THREE.Vector3();
  const put=tri=>{
    let minX=tri[0],maxX=tri[0],minZ=tri[2],maxZ=tri[2];
    for(let k=1;k<3;k++){
      minX=Math.min(minX,tri[k*3]);maxX=Math.max(maxX,tri[k*3]);
      minZ=Math.min(minZ,tri[k*3+2]);maxZ=Math.max(maxZ,tri[k*3+2]);
    }
    if(maxX-minX>40||maxZ-minZ>40)return;
    maxR=Math.max(maxR,Math.hypot(minX,minZ),Math.hypot(maxX,minZ),Math.hypot(minX,maxZ),Math.hypot(maxX,maxZ));
    for(let cz=Math.floor(minZ/2);cz<=Math.floor(maxZ/2);cz++)for(let cx=Math.floor(minX/2);cx<=Math.floor(maxX/2);cx++){
      const key=`${cx}/${cz}`;
      let bucket=cells.get(key);
      if(!bucket){bucket=[];cells.set(key,bucket);}
      bucket.push(tri);
    }
  };
  for(const mesh of meshes){
    const pos=mesh.geometry.getAttribute('position');
    const index=mesh.geometry.getIndex();
    const mat=mesh.userData.localMatrix;
    const count=index?index.count:pos.count;
    const vert=i=>{
      p.fromBufferAttribute(pos,index?index.getX(i):i).applyMatrix4(mat);
      return [p.x,p.y,p.z];
    };
    for(let i=0;i+2<count;i+=3){
      const a=vert(i),b=vert(i+1),c=vert(i+2);
      const ex1=b[0]-a[0],ey1=b[1]-a[1],ez1=b[2]-a[2];
      const ex2=c[0]-a[0],ey2=c[1]-a[1],ez2=c[2]-a[2];
      const nx=ey1*ez2-ez1*ey2, ny=ez1*ex2-ex1*ez2, nz=ex1*ey2-ey1*ex2;
      const len=Math.hypot(nx,ny,nz);
      if(len<1e-4||Math.abs(ny)<0.65*len)continue;
      put([a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]]);
    }
  }
  walkByFile.set(file,{cells,radius:maxR});
  for(const place of walkPlaces)if(place.file===file)place.radius=maxR;
}
// Um único GLB com malhas LMO distintas. Os objetos de Garner mantêm suas
// 50 mil posições no JSON: InstancedMesh desenha só os próximos ao Lance.
function createSceneLibrary(gltf){
  sceneObjs3D=new THREE.Group();sceneObjs3D.name='Objetos reais de Garner';
  sceneObjs3D.visible=$('scene3d').checked;
  scene.add(sceneObjs3D);
  const libraryRoot=gltf.scene.children[0] ?? gltf.scene;
  const positions=new Map();
  indexScenePlaces();
  for(const place of walkPlaces){
    if(!positions.has(place.file))positions.set(place.file,[]);
    positions.get(place.file).push(place.rec);
  }
  for(const prototype of libraryRoot.children){
    const name=(prototype.userData?.sourceFile || prototype.name).toLowerCase();
    const role=editorRole(name);
    const records=positions.get(name) || [];
    prototype.updateWorldMatrix(true,true);
    if(role){
      const box=new THREE.Box3();
      prototype.traverse(obj=>{
        if(!obj.isMesh||!obj.geometry)return;
        if(!obj.geometry.boundingBox)obj.geometry.computeBoundingBox();
        box.union(obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld));
      });
      if(!box.isEmpty())applyEditorBounds(name,box);
      continue;
    }
    if(!records.length)continue;
    const meshes=[];
    prototype.traverse(obj=>{
      if(!obj.isMesh||obj.isSkinnedMesh)return;
      const instance=new THREE.InstancedMesh(obj.geometry,obj.material,records.length);
      instance.name=name+' · '+obj.name;
      instance.frustumCulled=false;
      instance.count=0;
      instance.userData.localMatrix=obj.matrixWorld.clone();
      instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      sceneObjs3D.add(instance);
      meshes.push(instance);
      modelInstances.push(instance);
    });
    if(meshes.length){
      modelGroups.set(name,{meshes,cap:records.length});
      buildWalk(name,meshes);
    }
  }
  sceneStats.loaded=modelGroups.size;
  sceneStats.missing=positions.size-modelGroups.size;
  if(sceneStats.missing)console.warn('Modelos que faltaram na biblioteca:',sceneStats.missing);
  console.info('TOP Cenário: modelos',sceneStats.loaded,'posicionamentos',objects.length,'geometrias instanciadas',modelInstances.length);
}
function updateSceneInstances(force=false){
  if(!sceneObjs3D)return;
  if(!force && playerPos.distanceToSquared(lastScenePosition)<16*16)return;
  lastScenePosition.copy(playerPos);
  for(const group of modelGroups.values())for(const mesh of group.meshes)mesh.count=0;
  const radius2=sceneVisibilityRadius*sceneVisibilityRadius;
  const nearest=Math.ceil(sceneVisibilityRadius/64);
  const sx=Math.floor(playerPos.x/64),sz=Math.floor(playerPos.z/64);
  const active=new Map();
  for(let dz=-nearest;dz<=nearest;dz++)for(let dx=-nearest;dx<=nearest;dx++){
    const recs=spatialGroups.get(`${sx+dx}/${sz+dz}`);
    if(!recs)continue;
    for(const [file,rec] of recs){
      const dist=(rec[0]-playerPos.x)**2+(rec[1]-playerPos.z)**2;
      if(dist>radius2 || !modelGroups.has(file))continue;
      if(!active.has(file))active.set(file,[]);
      active.get(file).push(rec);
    }
  }
  let amount=0;
  const base=new THREE.Matrix4(),local=new THREE.Matrix4();
  for(const [file,recs] of active){
    const group=modelGroups.get(file);
    for(let i=0;i<recs.length;i++){
      const rec=recs[i];
      const yaw=objectYaw(rec);
      instanceTemp.position.set(rec[0],sampleHeight(rec[0],rec[1])+rec[4],rec[1]);
      instanceTemp.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,yaw);
      instanceTemp.scale.set(1,1,1);
      instanceTemp.updateMatrix();base.copy(instanceTemp.matrix);
      for(const mesh of group.meshes){
        local.multiplyMatrices(base,mesh.userData.localMatrix);
        mesh.setMatrixAt(i,local);
      }
    }
    for(const mesh of group.meshes){mesh.count=recs.length;mesh.instanceMatrix.needsUpdate=true;}
    amount+=recs.length;
  }
  sceneStats.active=amount;
  $('scenevisible').textContent=amount.toLocaleString('pt-BR');
}

// Efeitos de cena (.par/.eff). O yaw do tipo 1 já está em radianos.
// RectPlane deitado: setGroundMatrix. Rect em pé (feixe): setRectMatrix.
// O deslocamento do emissor é rotation.y = -yaw, via offsetByEffectYaw.
const FX_CAP=MOBILE_UI?450:1200;
let effectCatalog=null, effectGroup=null, effectBatches=[], effectCells=new Map();
let effectStats={active:0}, lastEffectPos=new THREE.Vector3(Infinity,Infinity,Infinity);
const _fxObj=new THREE.Object3D(), _fxM=new THREE.Matrix4(), _fxV=new THREE.Vector3();
let effectPlane=null, effectRect=null;
function effectPlaneGeo(){
  if(effectPlane)return effectPlane;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5,0,-0.5, -0.5,0,0.5, 0.5,0,0.5, 0.5,0,-0.5
  ]),3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
    0,1, 0,0, 1,0, 1,1
  ]),2));
  geo.setIndex([0,1,2, 0,2,3]);
  geo.computeVertexNormals();
  effectPlane=geo;
  return geo;
}
function effectRectGeo(){
  if(effectRect)return effectRect;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5,0,0, -0.5,1,0, 0.5,1,0, 0.5,0,0
  ]),3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
    0,1, 0,0, 1,0, 1,1
  ]),2));
  geo.setIndex([0,1,2, 0,2,3]);
  geo.computeVertexNormals();
  effectRect=geo;
  return geo;
}
function effectHeight(x,z,dh){return Math.max(sampleHeight(x,z),0)+(dh||0)}
function offsetByEffectYaw(x,z,yaw){
  _fxObj.rotation.set(0,-yaw,0);
  _fxObj.position.set(0,0,0);
  _fxObj.scale.set(1,1,1);
  _fxObj.updateMatrix();
  _fxV.set(x,0,z).applyMatrix4(_fxObj.matrix);
  return [_fxV.x,_fxV.z];
}
// Roll histórico no plano, depois yaw do D3D, depois a troca Z-up → Y-up.
// spin 0 e yaw π/2 levam (1,0,0) a (0,-1,0). spin π leva o mesmo ponto a (0,1,0).
function setGroundMatrix(m,x,y,z,yaw,spin){
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cs=Math.cos(spin), ss=Math.sin(spin);
  const xx=cs*cy, xy=-cs*sy, xz=ss;
  const zx=-ss*cy, zy=ss*sy, zz=cs;
  const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
  m.set(xx,yx,zx,x, xy,yy,zy,y, xz,yz,zz,z, 0,0,0,1);
}
// Rect local (x, altura, 0). yaw π/2 deita o topo (0,1,0) em (1,0,0).
function setRectMatrix(m,x,y,z,yaw){
  const c=Math.cos(yaw), s=Math.sin(yaw);
  m.set(c,s,0,x, -s,c,0,y, 0,0,1,z, 0,0,0,1);
}
function fxHash(n){
  let x=Math.imul(n|0,0x6d2b79f5);
  x=Math.imul(x^(x>>>15),x|1);
  x^=x+Math.imul(x^(x>>>7),x|61);
  return ((x^(x>>>14))>>>0)/4294967296;
}
function particleMotion(part,slot,seed){
  const pos=[0,0,0], vel=[0,0,0];
  if(!part.motion)return {pos,vel};
  const h=ch=>fxHash(seed+slot*131+ch*17);
  const range=part.range, dir=part.dir, speed=part.vel;
  pos[0]=h(1)*range[0]; pos[1]=h(2)*range[1]; pos[2]=h(3)*range[2];
  if(part.type===2){
    const n=Math.hypot(dir[0],dir[1],dir[2])||1;
    vel[0]=dir[0]/n*speed; vel[1]=dir[1]/n*speed; vel[2]=dir[2]/n*speed;
  }else if(part.type===1){
    const lower=1/Math.max(1,part.roadom||2);
    for(let c=0;c<3;c++){
      const mag=speed*(lower+(1-lower)*h(4+c));
      vel[c]=mag*dir[c]*(c===2?1:(h(8+c)<0.5?-1:1));
    }
  }else if(part.type===3){
    for(let c=0;c<3;c++){
      const mag=speed*h(4+c);
      vel[c]=mag*dir[c]*(c===2?1:(c===1?-1:1)*(h(8+c)<0.5?-1:1));
    }
  }
  return {pos,vel};
}
function burstCount(part){
  const n=Math.max(1,part.count|0);
  if(n>30)return 24;
  if(n>12)return 12;
  return n;
}
const FX_BLEND={
  1:THREE.ZeroFactor,2:THREE.OneFactor,3:THREE.SrcColorFactor,4:THREE.OneMinusSrcColorFactor,
  5:THREE.SrcAlphaFactor,6:THREE.OneMinusSrcAlphaFactor,7:THREE.DstAlphaFactor,
  8:THREE.OneMinusDstAlphaFactor,9:THREE.DstColorFactor,10:THREE.OneMinusDstColorFactor,
  11:THREE.SrcAlphaSaturateFactor
};
function effectMaterial(part,map){
  const size=part.size, color=part.color, off=part.off, uv=part.uv;
  const uSize=[], uColor=[], uOff=[], uUV=[];
  for(let i=0;i<8;i++){
    const s=size[Math.min(i,size.length-1)];
    const c=color[Math.min(i,color.length-1)];
    const o=off[Math.min(i,off.length-1)]||[0,0,0];
    const r=uv[Math.min(i,uv.length-1)]||[0,0,1,1];
    uSize.push(new THREE.Vector2(s[0],s[1]));
    uColor.push(new THREE.Vector4(c[0],c[1],c[2],c[3]));
    uOff.push(new THREE.Vector3(o[0],o[1],o[2]));
    uUV.push(new THREE.Vector4(r[0],r[1],r[2],r[3]));
  }
  const mode=part.shape==='rect'?1:part.shape==='billboard'?2:0;
  const mat=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, depthTest:true, side:THREE.DoubleSide,
    blending:THREE.CustomBlending,
    blendSrc:FX_BLEND[part.src]||THREE.SrcAlphaFactor,
    blendDst:FX_BLEND[part.dst]||THREE.OneMinusSrcAlphaFactor,
    blendEquation:THREE.AddEquation,
    polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2,
    uniforms:{
      uMap:{value:map}, uTime:{value:0}, uLife:{value:Math.max(0.05,part.life||1)},
      uMode:{value:mode}, uMaskBlack:{value:part.maskBlack?1:0},
      uUvTime:{value:part.uvTime||0}, uUvCount:{value:uv.length}, uUvSnap:{value:part.uvSnap?1:0},
      uSize:{value:uSize}, uColor:{value:uColor}, uOff:{value:uOff}, uUV:{value:uUV}
    },
    vertexShader:`
      attribute float aPhase;
      uniform float uTime, uLife, uUvTime;
      uniform int uMode, uUvCount, uUvSnap;
      uniform vec2 uSize[8];
      uniform vec4 uColor[8];
      uniform vec3 uOff[8];
      uniform vec4 uUV[8];
      varying vec2 vUv;
      varying vec4 vColor;
      varying vec3 vWorld;
      vec2 sizeAt(float t){
        float x=clamp(t,0.0,1.0)*7.0;
        if(x<1.0) return mix(uSize[0],uSize[1],x);
        if(x<2.0) return mix(uSize[1],uSize[2],x-1.0);
        if(x<3.0) return mix(uSize[2],uSize[3],x-2.0);
        if(x<4.0) return mix(uSize[3],uSize[4],x-3.0);
        if(x<5.0) return mix(uSize[4],uSize[5],x-4.0);
        if(x<6.0) return mix(uSize[5],uSize[6],x-5.0);
        return mix(uSize[6],uSize[7],x-6.0);
      }
      vec4 colorAt(float t){
        float x=clamp(t,0.0,1.0)*7.0;
        if(x<1.0) return mix(uColor[0],uColor[1],x);
        if(x<2.0) return mix(uColor[1],uColor[2],x-1.0);
        if(x<3.0) return mix(uColor[2],uColor[3],x-2.0);
        if(x<4.0) return mix(uColor[3],uColor[4],x-3.0);
        if(x<5.0) return mix(uColor[4],uColor[5],x-4.0);
        if(x<6.0) return mix(uColor[5],uColor[6],x-5.0);
        return mix(uColor[6],uColor[7],x-6.0);
      }
      vec3 offAt(float t){
        float x=clamp(t,0.0,1.0)*7.0;
        if(x<1.0) return mix(uOff[0],uOff[1],x);
        if(x<2.0) return mix(uOff[1],uOff[2],x-1.0);
        if(x<3.0) return mix(uOff[2],uOff[3],x-2.0);
        if(x<4.0) return mix(uOff[3],uOff[4],x-3.0);
        if(x<5.0) return mix(uOff[4],uOff[5],x-4.0);
        if(x<6.0) return mix(uOff[5],uOff[6],x-5.0);
        return mix(uOff[6],uOff[7],x-6.0);
      }
      void main(){
        float life=max(uLife,0.05);
        float age=fract(uTime/life+aPhase)*life;
        float t=age/life;
        vec2 size=abs(sizeAt(t));
        vColor=colorAt(t);
        vec3 off=offAt(t);
        vec4 rect=uUV[0];
        if(uUvCount>1){
          float span=max(uUvTime,0.05);
          float f=uTime/span;
          if(uUvSnap==1){
            rect=uUV[int(mod(floor(f), float(uUvCount)))];
          }else{
            float u=fract(f);
            float x=u*float(uUvCount-1);
            int i=int(min(floor(x), float(uUvCount-1)));
            int j=int(min(float(i+1), float(uUvCount-1)));
            rect=mix(uUV[i], uUV[j], x-float(i));
          }
        }
        vUv=vec2(mix(rect.x,rect.z,uv.x), mix(rect.y,rect.w,uv.y));
        vec3 world;
        if(uMode==2){
          vec3 center=(instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz+off;
          vec3 right=vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up=vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          world=center+right*position.x*size.x+up*position.z*size.y;
        }else if(uMode==1){
          vec3 local=vec3(position.x*size.x, position.y*size.y, 0.0)+off;
          world=(instanceMatrix*vec4(local,1.0)).xyz;
        }else{
          vec3 local=vec3(position.x*size.x, 0.0, position.z*size.y)+off;
          world=(instanceMatrix*vec4(local,1.0)).xyz;
        }
        vWorld=world;
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);
      }`,
    fragmentShader:`
      uniform sampler2D uMap;
      uniform int uMaskBlack;
      varying vec2 vUv;
      varying vec4 vColor;
      varying vec3 vWorld;
      void main(){
        vec4 tex=texture2D(uMap, vUv);
        vec3 lin=pow(max(tex.rgb,0.0), vec3(2.2));
        float mask=uMaskBlack==1 ? smoothstep(0.04,0.22,max(lin.r,max(lin.g,lin.b))) : 1.0;
        float alpha=tex.a*vColor.a*mask;
        if(alpha<0.02) discard;
        vec3 rgb=lin*vColor.rgb;
        float dist=length(vWorld-cameraPosition);
        float fog=1.0-exp(-dist*dist*0.00003844);
        rgb=mix(rgb, vec3(0.710,0.816,0.847), clamp(fog,0.0,0.8));
        gl_FragColor=vec4(rgb, alpha);
      }`
  });
  return mat;
}
function indexEffects(){
  effectCells=new Map();
  const place=rec=>{
    const key=`${Math.floor(rec[0]/64)}/${Math.floor(rec[1]/64)}`;
    if(!effectCells.has(key))effectCells.set(key,[]);
    effectCells.get(key).push(rec);
  };
  for(const rec of objects) if(rec[3]===1) place(rec);
}
async function createEffects(){
  const response=await fetch('assets/effects/catalog.json?v=1');
  if(!response.ok)throw new Error('catálogo de efeitos ausente');
  effectCatalog=await response.json();
  effectGroup=new THREE.Group();
  effectGroup.name='Efeitos de cena';
  effectGroup.renderOrder=3;
  effectGroup.frustumCulled=false;
  effectGroup.visible=!$('fx')||$('fx').checked;
  scene.add(effectGroup);
  const maps=new Map();
  const loader=new THREE.TextureLoader();
  for(const [id,entry] of Object.entries(effectCatalog.effects||{})){
    for(const part of entry.parts){
      if(!maps.has(part.texture)){
        const map=await loader.loadAsync('assets/effects/textures/'+part.texture);
        map.colorSpace=THREE.NoColorSpace;
        map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
        map.magFilter=THREE.LinearFilter;
        map.minFilter=THREE.LinearMipmapLinearFilter;
        map.needsUpdate=true;
        maps.set(part.texture,map);
      }
      const geo=(part.shape==='rect'?effectRectGeo():effectPlaneGeo()).clone();
      geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(FX_CAP),1));
      const mesh=new THREE.InstancedMesh(geo, effectMaterial(part, maps.get(part.texture)), FX_CAP);
      if(part.motion){
        mesh.userData.motion={
          x:new Float32Array(FX_CAP*3), v:new Float32Array(FX_CAP*3),
          a:new Float32Array(FX_CAP*3), phase:new Float32Array(FX_CAP)
        };
      }
      mesh.count=0;
      mesh.frustumCulled=false;
      mesh.renderOrder=3;
      mesh.userData.part=part;
      mesh.userData.id=Number(id);
      effectGroup.add(mesh);
      effectBatches.push(mesh);
    }
  }
  updateEffectInstances(true);
  const report=selfTestEffects();
  if(report.some(line=>line.startsWith('FAIL')))console.error(report.join('\n'));
  else console.info('Efeitos de cena', effectStats.active, report.filter(l=>l.startsWith('ok')).length, 'checagens');
}
function updateEffectInstances(force=false){
  if(!effectGroup)return;
  if(!force && playerPos.distanceToSquared(lastEffectPos)<16*16)return;
  lastEffectPos.copy(playerPos);
  for(const mesh of effectBatches)mesh.count=0;
  const radius2=sceneVisibilityRadius*sceneVisibilityRadius;
  const reach=Math.ceil(sceneVisibilityRadius/64);
  const sx=Math.floor(playerPos.x/64), sz=Math.floor(playerPos.z/64);
  const near=[];
  for(let dz=-reach;dz<=reach;dz++)for(let dx=-reach;dx<=reach;dx++){
    const recs=effectCells.get(`${sx+dx}/${sz+dz}`);
    if(!recs)continue;
    for(const rec of recs){
      const dist=(rec[0]-playerPos.x)**2+(rec[1]-playerPos.z)**2;
      if(dist<=radius2)near.push(rec);
    }
  }
  near.sort((a,b)=>{
    const da=(a[0]-playerPos.x)**2+(a[1]-playerPos.z)**2;
    const db=(b[0]-playerPos.x)**2+(b[1]-playerPos.z)**2;
    return da-db;
  });
  for(const rec of near){
    const yaw=rec[5];
    for(const mesh of effectBatches){
      if(mesh.userData.id!==rec[2] || mesh.count>=FX_CAP)continue;
      const part=mesh.userData.part;
      const phase=mesh.geometry.getAttribute('aPhase');
      const mot=mesh.userData.motion;
      const n=burstCount(part);
      const seed=(Math.floor(rec[0]*10)*1000+Math.floor(rec[1]*10))|0;
      for(let s=0;s<n && mesh.count<FX_CAP;s++){
        const motion=particleMotion(part,s,seed);
        const spread=offsetByEffectYaw(motion.pos[0],motion.pos[1],yaw);
        const flown=offsetByEffectYaw(motion.vel[0],motion.vel[1],yaw);
        const x=rec[0]+spread[0], z=rec[1]+spread[1];
        const y=effectHeight(x,z,rec[4])+motion.pos[2]+(part.shape==='plane'?0.08:0);
        if(part.shape==='plane')setGroundMatrix(_fxM,x,y,z,yaw,part.spin||0);
        else if(part.shape==='rect')setRectMatrix(_fxM,x,y,z,yaw);
        else{
          _fxObj.position.set(x,y,z);
          _fxObj.rotation.set(0,0,0);
          _fxObj.scale.set(1,1,1);
          _fxObj.updateMatrix();
          _fxM.copy(_fxObj.matrix);
        }
        const i=mesh.count;
        mesh.setMatrixAt(i,_fxM);
        const ph=fxHash(seed+s*29);
        phase.setX(i, ph);
        if(mot){
          const o=i*3;
          mot.x[o]=x; mot.x[o+1]=y; mot.x[o+2]=z;
          mot.v[o]=flown[0]; mot.v[o+1]=motion.vel[2]; mot.v[o+2]=flown[1];
          if(part.type===3){
            const a=offsetByEffectYaw(part.accel[0],part.accel[1],yaw);
            mot.a[o]=a[0]; mot.a[o+1]=part.accel[2]; mot.a[o+2]=a[1];
          }else{mot.a[o]=mot.a[o+1]=mot.a[o+2]=0;}
          mot.phase[i]=ph;
        }
        mesh.count=i+1;
      }
      phase.needsUpdate=true;
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  let amount=0;
  for(const mesh of effectBatches)amount+=mesh.count;
  effectStats.active=amount;
  const label=$('fxcount');
  if(label)label.textContent=amount.toLocaleString('pt-BR');
}
let effectHold=false;
function effectAge(time, life, phase){
  const span=Math.max(life,0.05);
  const u=time/span+phase;
  return (u-Math.floor(u))*span;
}
// A velocidade vai na translação da instância. O atributo vec3 instanciado
// saía corrompido e jogava a fumaça para fora da tela; a matriz não.
function applyEffectMotion(mesh){
  const mot=mesh.userData.motion;
  if(!mot || !mesh.count)return;
  const life=mesh.material.uniforms.uLife.value;
  const time=mesh.material.uniforms.uTime.value;
  const m=mesh.instanceMatrix.array;
  const n=mesh.count;
  for(let i=0;i<n;i++){
    const age=effectAge(time, life, mot.phase[i]);
    const half=0.5*age*age;
    const o=i*3;
    m[i*16+12]=mot.x[o]+mot.v[o]*age+mot.a[o]*half;
    m[i*16+13]=mot.x[o+1]+mot.v[o+1]*age+mot.a[o+1]*half;
    m[i*16+14]=mot.x[o+2]+mot.v[o+2]*age+mot.a[o+2]*half;
  }
  mesh.instanceMatrix.needsUpdate=true;
}
function tickEffects(dt){
  for(const mesh of effectBatches){
    if(!effectHold)mesh.material.uniforms.uTime.value+=dt;
    applyEffectMotion(mesh);
  }
}
function selfTestEffects(){
  const out=[];
  const assert=(ok,msg)=>{out.push((ok?'ok ':'FAIL ')+msg); if(!ok)console.error(msg);};
  const m=new THREE.Matrix4(), p=new THREE.Vector3();
  setGroundMatrix(m,0,0,0,Math.PI/2,0);
  p.set(1,0,0).applyMatrix4(m);
  assert(p.distanceTo(new THREE.Vector3(0,-1,0))<1e-4, `plano yaw π/2 → (0,-1,0), saiu (${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`);
  assert(m.determinant()>0.5,'matriz do plano preserva a orientação');
  setGroundMatrix(m,0,0,0,Math.PI/2,Math.PI);
  p.set(1,0,0).applyMatrix4(m);
  assert(p.distanceTo(new THREE.Vector3(0,1,0))<1e-4, `plano com giro π → (0,1,0), saiu (${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`);
  setRectMatrix(m,10,2,4,Math.PI/2);
  p.set(0,1,0).applyMatrix4(m);
  assert(p.distanceTo(new THREE.Vector3(11,2,4))<1e-4, `feixe yaw π/2 deita o topo em +X (${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`);
  const off=offsetByEffectYaw(1,0,Math.PI/2);
  assert(Math.hypot(off[0],off[1]-1)<1e-4, `deslocamento yaw π/2 → (0,1), saiu (${off[0].toFixed(2)},${off[1].toFixed(2)})`);
  const age=effectAge(2.5,5,0.4);
  assert(Math.abs(age-4.5)<1e-4, `idade da partícula em 2,5 s (${age.toFixed(3)})`);
  assert(Math.abs(3*age+(-6)*0.5*age*age-(-47.25))<1e-3, 'queda do respingo com gravidade');
  const normal=effectPlaneGeo().getAttribute('normal');
  assert(normal && normal.getY(0)>0.5,'o quad do chão aponta para cima');
  return out;
}
window.__selfTestEffects=selfTestEffects;
window.__fx={
  stats(){
    const ids={};
    for(const mesh of effectBatches){
      if(!mesh.count)continue;
      ids[mesh.userData.id]=(ids[mesh.userData.id]||0)+mesh.count;
    }
    return {active:effectStats.active, ids};
  },
  time(t){for(const mesh of effectBatches){mesh.material.uniforms.uTime.value=t; applyEffectMotion(mesh);}},
  diag(){
    const cam=camera.position;
    const batches=[];
    for(const mesh of effectBatches){
      if(!mesh.count)continue;
      const a=mesh.instanceMatrix.array;
      let best=null;
      for(let i=0;i<mesh.count;i++){
        const x=a[i*16+12], y=a[i*16+13], z=a[i*16+14];
        const d=(x-playerPos.x)**2+(z-playerPos.z)**2;
        if(!best||d<best.d)best={i,x,y,z,d};
      }
      best.d=Math.sqrt(best.d);
      best.time=mesh.material.uniforms.uTime.value;
      best.mode=mesh.material.uniforms.uMode.value;
      batches.push({id:mesh.userData.id, shape:mesh.userData.part.shape, n:mesh.count, near:best});
    }
    batches.sort((p,q)=>p.near.d-q.near.d);
    const gl=renderer.getContext();
    return {
      player:[playerPos.x,playerPos.y,playerPos.z],
      cam:[cam.x,cam.y,cam.z], yaw:CAM.yaw, dist:CAM.dist,
      calls:renderer.info.render.calls, tris:renderer.info.render.triangles,
      gl:gl.getError(), group:effectGroup.visible,
      batches:batches.slice(0,8)
    };
  },
  hold(on){effectHold=!!on; return effectHold;},
  go(x,z,yaw,dist){
    if(Number.isFinite(yaw))CAM.yaw=yaw;
    if(Number.isFinite(dist)){CAM.dist=dist;clampCam();}
    if(Number.isFinite(x))return teleport(x,z);
    placeCamera();
    updateEffectInstances(true);
    return true;
  }
};

async function boot(){
  try{
    progress(9,'Carregando alturas e bloqueios de Garner...');
    world=await fetchMap();
    createArgentFountain(THREE, scene, sampleHeight(2232, 2773)).then(fx=>{fountain=fx;}).catch(err=>console.error('Fonte de Argent:',err));
    if(ORIGIN.x<world.ox || ORIGIN.x>=world.ox+world.w || ORIGIN.z<world.oz || ORIGIN.z>=world.oz+world.h){
      ORIGIN.x=world.ox+world.w/2; ORIGIN.z=world.oz+world.h/2;
    }
    progress(20,'Carregando atlas das texturas históricas de Garner...');
    try{
      terrainAtlas=await new THREE.TextureLoader().loadAsync('assets/terrain_atlas.jpg');
      terrainAtlas.colorSpace=THREE.SRGBColorSpace;
      terrainAtlas.flipY=true; // PNG/JPEG possui origem superior; UVs usam origem inferior.
      terrainAtlas.magFilter=THREE.LinearFilter;
      terrainAtlas.minFilter=THREE.LinearMipmapLinearFilter;
      terrainAtlas.anisotropy=Math.min(MOBILE_UI?2:8,renderer.capabilities.getMaxAnisotropy());
      landMat.map=terrainAtlas;landMat.needsUpdate=true;
    }catch(error){console.warn('Falha ao carregar texturas, usando cores provisórias:',error);colorMode='palette';$('colormode').value='palette';}
    progress(31,'Construindo minimapa e primeiro terreno...');
    try{objects=await (await fetch('assets/argent/objects.json?v=1')).json()}catch{objects=[]}
    indexEffects();
    try{objectCatalog=await (await fetch('assets/objects_catalog.json')).json()}catch{objectCatalog={}}
    generateMinimap();
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem('topweb_garner_position')||'null')}catch{}
    if(Array.isArray(saved)&&saved.length===2&&saved.every(Number.isFinite)&&
       saved[0]>=world.ox&&saved[0]<world.ox+world.w&&saved[1]>=world.oz&&saved[1]<world.oz+world.h){
      ORIGIN.x=saved[0];ORIGIN.z=saved[1];
    }
    try{
      const cam=JSON.parse(localStorage.getItem('topweb_garner_camera')||'null');
      if(cam){if(Number.isFinite(cam.dist))CAM.dist=cam.dist;if(Number.isFinite(cam.lift))CAM.lift=cam.lift;if(Number.isFinite(cam.yaw))CAM.yaw=cam.yaw;clampCam();mobileOrbitYaw=CAM.yaw;mobileOrbitLift=CAM.lift;}
    }catch{}
    const free=findFree(ORIGIN.x,ORIGIN.z);
    if(free)playerPos.set(free[0],sampleHeight(free[0],free[1]),free[1]);
    else playerPos.set(ORIGIN.x,sampleHeight(ORIGIN.x,ORIGIN.z),ORIGIN.z);
    mobileCameraFocus.copy(playerPos);
    placeCamera();
    updateChunks();updateHUD();drawMinimap();
    progress(62,'Importando personagem e animações…');
    const gearResponse=await fetch('assets/equipment/manifest.json?v=1');
    if(!gearResponse.ok)throw new Error('Catálogo de equipamentos indisponível.');
    equipmentManifest=await gearResponse.json();
    await loadCharacter(hero.character);
    updateEquipmentUi();
    progress(78,'Carregando biblioteca compartilhada de casas, árvores e objetos...');
    try {
      const sceneGltf=await new GLTFLoader().loadAsync('assets/argent/modelos_cenario.glb');
      createSceneLibrary(sceneGltf);
      updateSceneInstances(true);
    } catch (err) {
      console.error('Falha na biblioteca 3D:',err);
      $('scene3d').checked=false;
      $('scene3d').disabled=true;
      toast('Biblioteca de cenário ausente: use montar_mundo.py para gerar o GLB.');
    }
    // Carrega NPCs apenas quando manifest.json tiver GLBs convertidos e posições.
    // Sem NPCs, o módulo não cria nenhum mesh / draw call adicional.
    try{
      npcManager=await createNpcManager({THREE,scene,heightAt:sampleHeight});
      if(npcManager.count)console.info('TOP NPCs de Garner:',npcManager.count,'registros no manifesto.');
    }catch(error){console.warn('NPCs ainda não disponíveis:',error);}
    try{
      monsterManager=await createMonsterManager({scene,heightAt:sampleHeight,findSpawn:(x,z)=>{
        for(let radius=0;radius<=8;radius+=1)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){
          const px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
          if(occupied(px,pz)&&!solidAt(px,pz,sampleHeight(px,pz)))return [px,pz];
        }
        return null;
      }});
      combat=createCombat({hero,monsters:monsterManager.monsters,canReach:combatReachable,canSee:combatLineOfSight,onEvent:combatEvent});
    }catch(error){console.warn('Treino indisponível:',error);toast('Monstros indisponíveis. Confira os assets de treino.');}
    progress(90,'Carregando ondas, fumaça e brilhos do mapa...');
    try{await createEffects();}
    catch(err){console.error('Efeitos de cena:',err);toast('Efeitos de cena indisponíveis. Rode criar_efeitos.py.');}
    progress(100,'Pronto! Explore o mapa.');
    $('loading').remove();
    if(sceneObjs3D)toast('Biblioteca original 3D carregada. Botão direito gira a câmera.');
    testing=new URLSearchParams(location.search).has('selftest');
    clock.getDelta();
    animate();
    if(testing){
      const report=await window.__selfTestControls();
      testing=false;
      const el=document.createElement('pre');
      el.id='selftest';
      el.textContent=report.join('\n');
      el.style.cssText='position:absolute;z-index:200;left:12px;bottom:12px;max-width:46vw;max-height:46vh;overflow:auto;color:#e8fff8;background:#041018ee;padding:10px 12px;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap';
      document.body.appendChild(el);
      document.title=report.some(line=>line.startsWith('FAIL'))?'SELFTEST FAIL':'SELFTEST OK';
    }
  }catch(e){showLoadingError(e)}
}
let hudTime=0;
function update(dt){
  if(mixer&&!effectHold)mixer.update(dt);
  if(!effectHold)seaMat.uniforms.uTime.value+=dt;
  if(keys.has('ArrowLeft')||keys.has('KeyQ')){if(MOBILE_UI)mobileOrbitYaw-=dt*1.1;else CAM.yaw-=dt*1.6;manualCamera();}
  if(keys.has('ArrowRight')||keys.has('KeyE')){if(MOBILE_UI)mobileOrbitYaw+=dt*1.1;else CAM.yaw+=dt*1.6;manualCamera();}
  if(keys.has('ArrowDown')){if(MOBILE_UI)mobileOrbitLift=Math.max(1.35,mobileOrbitLift-dt*.55);else CAM.lift-=dt*.55;}
  if(keys.has('ArrowUp')){if(MOBILE_UI)mobileOrbitLift=Math.min(2.4,mobileOrbitLift+dt*.55);else CAM.lift+=dt*.55;}
  const keyFw=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
  const keySide=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
  const fw=keyFw+touchMove.forward;
  const sideways=keySide+touchMove.sideways;
  const walkingBackward=fw<-.12;
  if(MOBILE_UI){
    // Marcha a ré: apenas manter a posição da câmera junto ao avatar,
    // nunca girar 180° para apontar para trás.
    if(mobileCameraMode==='follow'&&walkingBackward){
      mobileOrbitYaw=CAM.yaw;
      mobileFollowAnchorYaw=null;
    }
    // Giro automático suave; o toque manual é aplicado diretamente no gesto.
    const manualOrbit=performance.now()<cameraManualUntil;
    CAM.yaw=gentleOrbit(CAM.yaw,mobileOrbitYaw,dt,
      mobileCameraMode==='follow'&&!manualOrbit?cameraRadians(mobileCameraSpeedDeg):1.1);
    CAM.lift=THREE.MathUtils.lerp(CAM.lift,mobileOrbitLift,1-Math.exp(-dt*7));
  }
  clampCam();
  const {fwd,right}=cameraBasis();
  // Congelar o referencial do joystick durante uma mesma pressão.
  // Sem isto, o giro da câmera muda o vetor de deslocamento a cada frame
  // e segurar 'esquerda' faria o personagem andar em círculos.
  const steering=MOBILE_UI&&mobileCameraMode==='follow'&&!skillAnimationLocked&&Math.hypot(fw,sideways)>.04;
  if(steering&&mobileSteeringReferenceYaw===null){
    mobileSteeringReferenceYaw=CAM.yaw;
    mobileFollowAnchorYaw=CAM.yaw;
  }
  if(steering&&!walkingBackward&&mobileFollowAnchorYaw===null)mobileFollowAnchorYaw=CAM.yaw;
  if(!steering){mobileSteeringReferenceYaw=null;mobileFollowAnchorYaw=null;}
  let dx=fwd.x*fw+right.x*sideways;
  let dz=fwd.z*fw+right.z*sideways;
  if(steering){
    const move=movementFromYaw(mobileSteeringReferenceYaw,fw,sideways);
    dx=move.dx;dz=move.dz;
  }
  if(!skillAnimationLocked&&combat?.auto&&npcManager?.nearest(playerPos.x,playerPos.z))stopCombat();
  // Durante skill, ignorar movimento; não cancelar combate e nem o clip GLB.
  const manualMove=!skillAnimationLocked&&!!(dx||dz||moverTarget);
  if(manualMove&&(combat?.auto||attackPlaying))stopCombat();
  if(skillAnimationLocked){dx=0;dz=0;}
  else if(dx||dz){moverTarget=null;pendingPose=null;waypoint.hide();}
  else if(moverTarget){
    dx=moverTarget.x-playerPos.x;dz=moverTarget.z-playerPos.z;
    if(Math.hypot(dx,dz)<.35){
      dx=0;dz=0;moverTarget=null;waypoint.hide();
      const mark=pendingPose;pendingPose=null;
      if(mark)sitDown(mark);
    }
  }
  const combatPaused=!!((MOBILE_UI&&innerHeight>innerWidth)||rpgHud?.isOpen()||document.body.classList.contains('mobile-settings-open')||seated||changingCharacter);
  combat?.update(dt,playerPos,{paused:combatPaused,moving:manualMove,busy:attackPlaying});
  let chasing=false;
  const target=combat?.target;
  const approach=combat?.approach;
  if(approach&&!skillAnimationLocked&&!attackPlaying&&!manualMove&&Math.hypot(approach.target.x-playerPos.x,approach.target.z-playerPos.z)>approach.range*.94){
    dx=approach.target.x-playerPos.x;dz=approach.target.z-playerPos.z;chasing=true;
  }
  if(hero.hp<=0||changingCharacter||combatPaused){dx=0;dz=0;}
  const wish=Math.hypot(dx,dz);
  if(seated && seated.role==='sit' && runningAction && !currentClip.toLowerCase().includes('sentado')){
    const sitClip=runningAction.getClip();
    if(sitClip && runningAction.time>=sitClip.duration-1/30)playClip('Sentado');
  }
  if(seated && (wish>.01 || moverTarget) && !standUp())return;
  if(!seated && wish>.01){
    dx/=wish;dz/=wish;
    const running=keys.has('ShiftLeft')||keys.has('ShiftRight')||touchRunning;
    const speed=calculateMovementSpeed({
      running,
      digital:!!(keyFw||keySide),
      destination:!!moverTarget||chasing,
      analogX:touchMove.sideways,
      analogY:touchMove.forward
    });
    const travel=speed*dt;
    const sub=Math.max(1,Math.ceil(travel/.2));
    const sx=dx*travel/sub,sz=dz*travel/sub;
    let moved=false;
    const beforeX=playerPos.x,beforeZ=playerPos.z;
    for(let i=0;i<sub;i++){
      const h0=playerPos.y;
      const step=(nx,nz)=>{
        if(!occupied(nx,nz))return false;
        const h1=footSurface(nx,nz,h0);
        if(!allowBlocked && h1-h0>STEP_UP)return false;
        if(!allowBlocked && solidAt(nx,nz,h1))return false;
        return true;
      };
      if(step(playerPos.x+sx,playerPos.z+sz)){playerPos.x+=sx;playerPos.z+=sz;moved=true;}
      else if(step(playerPos.x+sx,playerPos.z)){playerPos.x+=sx;moved=true;}
      else if(step(playerPos.x,playerPos.z+sz)){playerPos.z+=sz;moved=true;}
      else if(moverTarget){moverTarget=null;pendingPose=null;waypoint.hide();toast('Caminho bloqueado. Tente outra direção.');break;}
    }
    if(chasing&&!moved){stopCombat();toast('Caminho bloqueado. Aproxime-se pelo joystick.');}
    faceTravel(dx,dz,dt);
    cameraFollowTarget=Math.atan2(dx,dz);
    // Modo mobile "Seguir direção": a câmera gira atrás do rumo REAL percorrido.
    // Arrastar a câmera suspende o giro automático temporariamente.
    if(MOBILE_UI&&mobileCameraMode==='follow'&&moved&&!seated&&!walkingBackward&&
       mobileFollowAnchorYaw!==null&&performance.now()>cameraManualUntil){
      mobileOrbitYaw=subtleFollowTarget(mobileFollowAnchorYaw,
        Math.atan2(playerPos.x-beforeX,playerPos.z-beforeZ),
        cameraRadians(mobileCameraTurnDeg));
    }
    // O rumo do avatar guia a câmera quando caminha para a frente.
    // Não gira durante strafing lateral puro (A/D), para evitar órbitas.
    if(!MOBILE_UI && autoCameraEnabled && performance.now()>cameraManualUntil &&
       (fw>.15 || (moverTarget&&!(keyFw||keySide))) && !seated){
      CAM.yaw=followAngle(CAM.yaw,Math.atan2(dx,dz),dt,2.0);
    }
    if(!attackPlaying){
      if(moved){
        playClip('Correr');
        if(runningAction&&currentClip.toLowerCase().includes('correr'))runningAction.setEffectiveTimeScale(running?1.2:1);
      }else if(isRunningPose())playClip('Parado');
    }
  }else if(!seated && !attackPlaying&&isRunningPose())playClip('Parado');
  // No movimento puramente lateral, espera soltar o controle antes de girar
  // atrás do personagem: evita transformar A/D em uma órbita infinita.
  if(!MOBILE_UI && wish<=.01 && autoCameraEnabled && !seated && cameraFollowTarget!==null &&
     performance.now()>cameraManualUntil){
    CAM.yaw=followAngle(CAM.yaw,cameraFollowTarget,dt,2.0);
  }
  playerPos.y=THREE.MathUtils.lerp(playerPos.y,footSurface(playerPos.x,playerPos.z,playerPos.y),Math.min(1,dt*13));
  // Executar a cada frame, DEPOIS de mover o jogador e ANTES de posicionar a câmera.
  // O foco mobile segue as coordenadas reais do avatar, sem alterar a órbita por toque.
  if(MOBILE_UI)updateFollowTarget(mobileCameraFocus,playerPos,dt,{response:6.5,snapDistance:13});
  if(avatar)avatar.position.copy(playerPos);
  // Cidade / exploração: arma guardada no osso configurado. Combate/skill
  // mostram a arma original na mão, sem modificar o GLB histórico.
  // O clipe do corpo e a exibição de cada arma são independentes.
  // Salvos no Pose Studio por estado: auto / sem arma / mão / costas.
  const weaponAttackState=attackPlaying||skillAnimationLocked||combat?.casting;
  const weaponMovingState=isRunningPose();
  const weaponPoseState=weaponAttackState?'attack':
    combat?.auto?(weaponMovingState?'armedRun':'guard'):(weaponMovingState?'run':'idle');
  weaponHolster?.setStowed(!combat?.auto&&!weaponAttackState,weaponPoseState);
  shadow.position.set(playerPos.x,playerPos.y+.04,playerPos.z);
  placeCamera();
  if(forceChunks||performance.now()-nextDraw>350){updateChunks();forceChunks=false;nextDraw=performance.now()}
  if(sceneObjs3D && (playerPos.distanceToSquared(lastScenePosition)>20*20 || performance.now()-lastObjUpdate>1100)){
    updateSceneInstances(false);
  }
  if(effectGroup && (playerPos.distanceToSquared(lastEffectPos)>20*20 || performance.now()-lastObjUpdate>1100)){
    updateEffectInstances(false);
  }
  tickEffects(dt);
  skillVisuals.update(dt);updateStealth();
  waypoint.update(dt, performance.now()/1000);
  if(fountain)fountain.update(dt);
  if(npcManager)npcManager.update(dt,playerPos.x,playerPos.z);
  monsterManager?.update(dt,playerPos,combat?.target);
  if(showMarkers&&performance.now()-lastObjUpdate>700){updateObjectMarkers();lastObjUpdate=performance.now()}
  if(performance.now()-hudTime>250){updateCombatHud();updateHUD();drawMinimap();hudTime=performance.now();}
  if($('toast').classList.contains('show')&&performance.now()-lastToast>2200)$('toast').classList.remove('show');
}
let qualitySampleTime=0, qualityFrameCount=0, qualityFrameMs=0, lastFrameTime=0;
function adaptMobileResolution(time){
  if(!MOBILE_UI||testing)return;
  if(lastFrameTime){qualityFrameMs+=Math.min(100,time-lastFrameTime);qualityFrameCount++;}
  lastFrameTime=time;
  if(!qualitySampleTime)qualitySampleTime=time;
  if(time-qualitySampleTime<4000)return;
  if(qualityFrameCount>40){
    const avg=qualityFrameMs/qualityFrameCount;
    const next=avg>26?Math.max(0.65,renderPixelRatio-0.1):
      avg<18?Math.min(maxPixelRatio,renderPixelRatio+0.05):renderPixelRatio;
    if(Math.abs(next-renderPixelRatio)>0.02){renderPixelRatio=next;renderer.setPixelRatio(renderPixelRatio);resize();}
  }
  qualitySampleTime=time;qualityFrameCount=0;qualityFrameMs=0;
}
function animate(time=performance.now()){
  requestAnimationFrame(animate);
  const dt=Math.min(.045,clock.getDelta());
  if(document.hidden||(MOBILE_UI&&innerHeight>innerWidth)){stopCombat();lastFrameTime=0;qualitySampleTime=0;qualityFrameCount=0;qualityFrameMs=0;return;}
  if(!testing)update(dt);
  renderer.render(scene,camera);
  adaptMobileResolution(time);
}
window.__selfTestControls=async function(){
  const results=[];
  const assert=(ok,msg)=>{results.push((ok?'ok ':'FAIL ')+msg);if(!ok)console.error(msg);};
  const saved={yaw:CAM.yaw,dist:CAM.dist,lift:CAM.lift,blocked:allowBlocked,pos:playerPos.clone(),rot:avatar?avatar.rotation.y:0};
  allowBlocked=true;
  CAM.yaw=Math.PI;CAM.dist=15;CAM.lift=1.85;clampCam();
  const basisAtPi=cameraBasis();
  const fwdPi=basisAtPi.fwd.clone(),rightPi=basisAtPi.right.clone();
  assert(fwdPi.distanceTo(new THREE.Vector3(0,0,-1))<1e-4,'yaw π: frente é −Z');
  assert(rightPi.distanceTo(new THREE.Vector3(1,0,0))<1e-4,'yaw π: direita é +X');
  placeCamera();
  const view=new THREE.Vector3();
  camera.getWorldDirection(view);view.y=0;view.normalize();
  assert(view.dot(fwdPi)>0.99,'a câmera olha na mesma frente do movimento');
  assert(camera.position.z>playerPos.z+.5,'yaw π: o olho fica no +Z');
  const probe=new THREE.Object3D();
  probe.rotation.y=Math.PI;
  probe.updateMatrix();
  const spun=new THREE.Vector3(1,0,0).applyMatrix4(probe.matrix);
  assert(Math.abs(spun.x+1)<1e-4 && Math.abs(spun.z)<1e-4,'yaw π do objeto manda +X local para −X');
  const back=localOf(yawBasis(Math.PI),spun.x,spun.z);
  assert(Math.abs(back[0]-1)<1e-4 && Math.abs(back[1])<1e-4,'o piso local desfaz o giro do objeto');
  const seat=poseMarks.find(m=>m.role==='sit');
  const lean=poseMarks.find(m=>m.role==='lean');
  if(seat)assert(poseHere(seat.x,seat.z)?.role==='sit','ponto de sentar responde no centro');
  if(lean)assert(poseHere(lean.x,lean.z)?.role==='lean','ponto de encostar responde no centro');
  const floor=floorSlabs.find(s=>s.top>0.05||s.base>sampleHeight(s.x,s.z)+0.2);
  if(floor){
    const h=footSurface(floor.x,floor.z,floor.base+floor.top);
    assert(h+0.05>=floor.base+floor.top,'piso azul sustenta o pé');
  }
  const wall=solidSlabs[0];
  if(wall)assert(solidAt(wall.x,wall.z,wall.base),'volume vermelho bloqueia o corpo');
  const step=walkPlaces.find(p=>p.file==='nml-bd077.lmo');
  if(step){
    const ground=sampleHeight(step.x,step.z);
    const top=footSurface(step.x,step.z,ground+3);
    assert(top>ground+0.15,`degrau de 6 m eleva o pé (${(top-ground).toFixed(2)} m)`);
  }
  assert(walkByFile.size>20,'malhas de piso das escadas e das casas');
  const nrm=new Float32Array(3);
  writeNormal(nrm,0,Math.floor(playerPos.x),Math.floor(playerPos.z));
  assert(nrm[1]>0.2,'normal do terreno aponta para cima');
  for(const chunk of chunkMap.values()){
    if(!chunk.water)continue;
    const p=chunk.water.geometry.attributes.position.array;
    const ax=p[3]-p[0],ay=p[4]-p[1],az=p[5]-p[2],bx=p[6]-p[0],bz=p[8]-p[2];
    assert(az*bx-ax*bz>0,'água visível de cima');
    break;
  }
  const facing=()=>new THREE.Vector3(0,0,-1).applyQuaternion(avatar.quaternion);
  const modelFront=()=>{
    if(!headBone||!tailBone)return null;
    const a=new THREE.Vector3(),b=new THREE.Vector3();
    headBone.getWorldPosition(a);tailBone.getWorldPosition(b);
    const d=a.sub(b);d.y=0;
    return d.lengthSq()>1e-4?d.normalize():null;
  };
  for(let i=0;i<8;i++)update(1/30);
  const idleFront=modelFront();
  assert(!!idleFront,'pista independente da cara (cabeça − rabo de cavalo)');
  if(idleFront)assert(idleFront.dot(facing())>0.8,`modelo parado alinhado à frente do grupo (${idleFront.dot(facing()).toFixed(2)})`);
  const press=async(code,ms)=>{
    window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));
    const steps=Math.round(ms/1000*60);
    for(let i=0;i<steps;i++)update(1/60);
    window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
    keys.delete(code);
  };
  for(const [code,axis,sign] of [['KeyD','right',1],['KeyA','right',-1],['KeyW','forward',1],['KeyS','forward',-1]]){
    CAM.yaw=Math.PI;placeCamera();
    const b=cameraBasis();
    const ref=(axis==='right'?b.right:b.fwd).clone();
    const p0=playerPos.clone();
    await press(code,450);
    const d=playerPos.clone().sub(p0);d.y=0;
    if(d.length()<0.05){results.push('skip '+code);continue;}
    const along=d.clone().normalize().dot(ref)*sign;
    assert(along>0.9,`${code}: andou ${along<0?'no sentido oposto':'de lado'} (cos=${along.toFixed(2)})`);
    const travel=d.clone().normalize();
    assert(facing().dot(travel)>0.9,`${code}: o corpo olha para o passo (${facing().dot(travel).toFixed(2)})`);
    const front=modelFront();
    if(front)assert(front.dot(facing())>0.55,`${code}: o modelo olha com o corpo (${front.dot(facing()).toFixed(2)})`);
  }
  keys.clear();moverTarget=null;seated=null;allowBlocked=saved.blocked;
  playerPos.copy(saved.pos);playerPos.y=sampleHeight(playerPos.x,playerPos.z);
  mobileCameraFocus.copy(playerPos);
  if(avatar){avatar.position.copy(playerPos);avatar.rotation.y=saved.rot;}
  CAM.yaw=saved.yaw;CAM.dist=saved.dist;CAM.lift=saved.lift;
  attackPlaying=false;playClip('Parado');placeCamera();updateChunks();
  return results;
};
rpgHud=initRpgHud({
  onOpen:()=>{
    if(skillAnimationLocked){rpgHud?.dismiss();toast('Aguarde a skill terminar para abrir o menu.');return;}
    stopCombat();
    keys.clear();touchMove.forward=0;touchMove.sideways=0;
    moverTarget=null;pendingPose=null;waypoint.hide();
    document.dispatchEvent(new Event('topweb:menu-open'));
    if(!seated){attackPlaying=false;playClip('Parado');}
  },
  onPlayClip:clip=>{
    if(skillAnimationLocked){toast('Aguarde a skill terminar.');return false;}
    stopCombat();
    if(hero.hp<=0||changingCharacter)return false;
    if(seated){toast('Levante antes de executar uma skill.');return false;}
    if(attackPlaying)return false;
    const played=playClip(clip,true);
    if(played){attackPlaying=true;skillAnimationLocked=true;}
    else toast('A animação não está disponível no personagem atual.');
    return played;
  },
  onPlaySkill:skill=>{
    if(skillAnimationLocked){toast('Aguarde a animação da skill terminar.');return false;}
    if(!combat||hero.hp<=0||changingCharacter||changingLoadout||seated)return false;
    if(!resolveSkillClip(skill,hero.character,animations)){toast('Animação indisponível para este personagem.');return false;}
    const queued=combat.queueSkill(skill,playerPos);
    if(queued){keys.clear();touchMove.forward=0;touchMove.sideways=0;moverTarget=null;pendingPose=null;waypoint.hide();if(rpgHud.isOpen())rpgHud.dismiss();}
    return queued;
  },
  onMessage:toast
});
rpgHud.setStats(heroSnapshot(hero));
function updateEquipmentUi(){
  $('hero-class').value=hero.job;$('hero-character').value=hero.character;
  for(const option of $('hero-character').options)option.disabled=!CLASSES[hero.job].characters.includes(option.value);
  $('equipment-toggle').textContent=hero.equipped?'Remover conjunto':'Equipar Evanescence · nível 1';
  const items=equipmentManifest?.sets?.[hero.job]?.items||[];
  const labels={2:'Corpo',3:'Mãos',4:'Pés',6:'Mão esquerda',9:'Mão direita'};
  const list=$('equipment-list');list.replaceChildren();
  for(const item of items){
    const row=document.createElement('li');
    row.textContent=`${labels[item.slot]} · ${item.name}${hero.equipped?' · equipado':''}`;list.append(row);
  }
  $('equipment-note').textContent=hero.job==='champion'?'Tattoo e Roar são do tier 55. As luvas e botas Warrior de nível 50 não foram incluídas.':
    'Visuais do tier 55 original, liberados no nível 1. Bônus novos: +4 ataque e +4 defesa pelo conjunto.';
}
async function changeLoadout(change){
  if(skillAnimationLocked){toast('Aguarde a skill terminar para trocar personagem ou equipamento.');updateEquipmentUi();return;}
  if(changingLoadout||changingCharacter)return;
  if(seated&&!standUp())return;
  const previous={job:hero.job,character:hero.character,equipped:hero.equipped};
  changingLoadout=true;stopCombat();$('hero-class').disabled=true;
  try{
    change();refreshHero(hero);await loadCharacter(hero.character);saveHero();
  }catch(error){
    Object.assign(hero,previous);refreshHero(hero);console.error(error);toast('Não foi possível carregar o visual. O conjunto anterior foi mantido.');
  }finally{changingLoadout=false;$('hero-class').disabled=false;updateEquipmentUi();updateCombatHud();}
}
for(const [key,profile] of Object.entries(CLASSES)){
  const option=document.createElement('option');option.value=key;option.textContent=profile.name;$('hero-class').append(option);
}
updateEquipmentUi();
$('hero-character').addEventListener('change',e=>{const value=e.target.value;void changeLoadout(()=>{hero.character=value;});});
$('hero-class').addEventListener('change',e=>{const value=e.target.value;void changeLoadout(()=>{
  selectClass(hero,value);
});});
$('equipment-toggle').addEventListener('click',()=>void changeLoadout(()=>{hero.equipped=!hero.equipped;}));
$('mobile-target').addEventListener('click',()=>{if(!rpgHud?.isOpen())combat?.cycleTarget(playerPos);});
$('mobile-auto').addEventListener('click',selectMobileAutoMode);
$('combat-training').addEventListener('click',()=>{if(world&&hero.hp>0)teleport(2222.0,2775.5);});
window.addEventListener('blur',()=>{stopCombat();saveHero();});
window.addEventListener('pagehide',saveHero);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCombat();});

$('colormode').addEventListener('change',e=>{colorMode=e.target.value;landMat.map=colorMode==='textured'?terrainAtlas:null;landMat.needsUpdate=true;clearChunks();updateChunks();generateMinimap();drawMinimap();});
$('water').addEventListener('change',e=>{showWater=e.target.checked;for(const c of chunkMap.values())if(c.water)c.water.visible=showWater;});
$('wire').addEventListener('change',e=>{wireframe=e.target.checked;landMat.wireframe=wireframe;});
$('scene3d').addEventListener('change',e=>{if(sceneObjs3D)sceneObjs3D.visible=e.target.checked;});
$('visrange').addEventListener('input',e=>{
  sceneVisibilityRadius=Number(e.target.value);
  $('visvalue').textContent=sceneVisibilityRadius+' m';
  updateSceneInstances(true);
  updateEffectInstances(true);
});
if($('fx'))$('fx').addEventListener('change',e=>{if(effectGroup)effectGroup.visible=e.target.checked;});
$('markers').addEventListener('change',e=>{showMarkers=e.target.checked;updateObjectMarkers();});
$('noclip').addEventListener('change',e=>{allowBlocked=e.target.checked;toast(allowBlocked?'Bloqueios desativados.':'Bloqueios originais reativados.');});
$('reset').addEventListener('click',()=>{localStorage.removeItem('topweb_garner_position');CAM.yaw=Math.PI-.35;CAM.dist=15;CAM.lift=1.85;mobileOrbitYaw=CAM.yaw;mobileOrbitLift=CAM.lift;teleport(2218.5,2776.5);});
$('toggle').addEventListener('click',()=>document.body.classList.toggle('compact'));
$('show').addEventListener('click',()=>{document.body.classList.remove('compact');document.body.classList.toggle('nohud');});
$('idle').addEventListener('click',()=>{if(skillAnimationLocked)return;stopCombat();attackPlaying=false;playClip('Parado');});
$('run').addEventListener('click',()=>{if(skillAnimationLocked)return;stopCombat();attackPlaying=false;playClip('Correr');});
$('atk').addEventListener('click',toggleAutoAttack);
$('dance').addEventListener('click',()=>{if(skillAnimationLocked)return;stopCombat();attackPlaying=false;playClip('Acenar',true);});
if($('sit'))$('sit').addEventListener('click',()=>{if(skillAnimationLocked)return;attackPlaying=false;tryPose();});
function setVisualMode(mode){
  visualMode=mode==='cinematic'?'cinematic':'classic';
  renderer.toneMapping=visualMode==='cinematic'?THREE.ACESFilmicToneMapping:THREE.NoToneMapping;
  scene.fog.density=visualMode==='cinematic'?.0062:.0042;
  $('visualmode').value=visualMode;
  setPref('topweb_visual_mode',visualMode);
}
$('autocamera').checked=autoCameraEnabled;
$('autocamera').addEventListener('change',e=>{
  autoCameraEnabled=e.target.checked;
  setPref('topweb_auto_camera',autoCameraEnabled?'1':'0');
});
const mobileCameraModeSelect=$('mobile-camera-mode');
const mobileCameraTuning=$('mobile-camera-tuning');
function updateCameraTuningDisabled(){
  if(mobileCameraTuning){
    mobileCameraTuning.classList.toggle('inactive',mobileCameraMode==='free');
    for(const element of mobileCameraTuning.querySelectorAll('input'))
      element.disabled=mobileCameraMode==='free';
  }
}
function bindMobileCameraTuning(rangeId,numberId,key,value,setValue){
  const slider=$(rangeId),number=$(numberId);
  if(!slider||!number)return;
  const apply=raw=>{
    const degrees=cameraDegrees(raw,value);
    setValue(degrees);
    slider.value=String(degrees);
    number.value=String(degrees);
    setPref(key,degrees);
  };
  apply(value);
  // Barras respondem enquanto são arrastadas; digitação confirma ao sair.
  slider.addEventListener('input',e=>apply(e.target.value));
  number.addEventListener('change',e=>apply(e.target.value));
  return apply;
}
const setCameraSpeed=bindMobileCameraTuning('mobile-camera-speed','mobile-camera-speed-number',
  'topweb_mobile_camera_speed_deg',mobileCameraSpeedDeg,value=>{mobileCameraSpeedDeg=value;});
const setCameraTurn=bindMobileCameraTuning('mobile-camera-turn','mobile-camera-turn-number',
  'topweb_mobile_camera_turn_deg',mobileCameraTurnDeg,value=>{mobileCameraTurnDeg=value;});
// Sensibilidade do toque independente dos controles de giro automático:
// funciona também em "Livre" e altera a câmera enquanto o dedo arrasta.
function bindMobileTouchTuning(){
  const slider=$('mobile-touch-sensitivity'),number=$('mobile-touch-sensitivity-number');
  if(!slider||!number)return;
  const apply=raw=>{
    mobileTouchSensitivity=cameraTouchSensitivity(raw,mobileTouchSensitivity);
    slider.value=String(mobileTouchSensitivity);
    number.value=String(mobileTouchSensitivity);
    setPref('topweb_mobile_touch_sensitivity',mobileTouchSensitivity);
  };
  apply(mobileTouchSensitivity);
  slider.addEventListener('input',e=>apply(e.target.value));
  number.addEventListener('change',e=>apply(e.target.value));
  return apply;
}
const setTouchSensitivity=bindMobileTouchTuning();
function bindTouchInversion(id,key,initial,apply){
  const checkbox=$(id);
  if(!checkbox)return;
  checkbox.checked=initial;
  checkbox.addEventListener('change',()=>{
    apply(checkbox.checked);
    setPref(key,checkbox.checked?'1':'0');
  });
}
bindTouchInversion('mobile-touch-invert-x','topweb_mobile_touch_invert_x',
  invertTouchHorizontal,value=>{invertTouchHorizontal=value;});
bindTouchInversion('mobile-touch-invert-y','topweb_mobile_touch_invert_y',
  invertTouchVertical,value=>{invertTouchVertical=value;});
$('mobile-touch-reset')?.addEventListener('click',()=>{
  setTouchSensitivity?.(CAMERA_TOUCH_DEFAULT);
  toast('Sensibilidade manual restaurada para 2×.');
});
$('mobile-camera-reset')?.addEventListener('click',()=>{
  setCameraSpeed?.(CAMERA_SPEED_DEFAULT_DEG);
  setCameraTurn?.(CAMERA_TURN_DEFAULT_DEG);
  toast('Câmera mobile restaurada para 24°/s e 24° por movimento.');
});
if(mobileCameraModeSelect){
  mobileCameraModeSelect.value=mobileCameraMode;
  updateCameraTuningDisabled();
  mobileCameraModeSelect.addEventListener('change',e=>{
    mobileCameraMode=e.target.value==='free'?'free':'follow';
    mobileSteeringReferenceYaw=null;mobileFollowAnchorYaw=null;
    mobileOrbitYaw=CAM.yaw;
    setPref('topweb_mobile_camera_mode',mobileCameraMode);
    updateCameraTuningDisabled();
    toast(mobileCameraMode==='follow'?'Câmera acompanha a direção do personagem.':'Câmera livre ativada.');
  });
}
$('seatdirection').value=seatFacingReversed?'reverse':'original';
$('seatdirection').addEventListener('change',e=>{
  seatFacingReversed=e.target.value==='reverse';
  setPref('topweb_seat_reverse',seatFacingReversed?'1':'0');
  toast('Orientação de banco aplicada à próxima interação.');
});
setVisualMode(visualMode);
$('visualmode').addEventListener('change',e=>setVisualMode(e.target.value));
function syncBrightness(v){
  const n=brightness.apply(v);
  const input=$('brightness'); if(input) input.value=String(n);
  const label=$('brightvalue'); if(label) label.textContent=String(n);
  for(const b of document.querySelectorAll('[data-bright]')) b.classList.toggle('active', Number(b.dataset.bright)===n);
}
if($('brightness')){
  syncBrightness(brightness.value);
  $('brightness').addEventListener('input',e=>syncBrightness(Number(e.target.value)));
  for(const b of document.querySelectorAll('[data-bright]')) b.addEventListener('click',()=>syncBrightness(Number(b.dataset.bright)));
}
const _aim=new THREE.Vector2();
const _caster=new THREE.Raycaster();
function groundAt(clientX,clientY){
  if(!world)return null;
  _aim.set(clientX/innerWidth*2-1,-clientY/innerHeight*2+1);
  _caster.setFromCamera(_aim,camera);
  const hits=_caster.intersectObjects([...chunkMap.values()].map(c=>c.mesh),false);
  return hits.length?hits[0].point:null;
}
function aimMode(point){
  if(!point)return 'move';
  const mark=poseHere(point.x,point.z);
  if(mark?.role==='sit')return 'sit';
  if(mark?.role==='lean')return 'lean';
  if(!walkable(point.x,point.z))return 'block';
  return 'move';
}
function orderMove(x,z,pose){
  if(skillAnimationLocked){toast('Aguarde a animação da skill terminar.');return false;}
  stopCombat();
  if(hero.hp<=0||changingCharacter)return false;
  const free=walkable(x,z)?[x,z]:findFree(x,z);
  if(!free){toast('Destino bloqueado. Clique em área navegável.');return false;}
  moverTarget=new THREE.Vector3(free[0],sampleHeight(free[0],free[1]),free[1]);
  pendingPose=pose||null;
  waypoint.show(free[0],free[1],sampleHeight(free[0],free[1]));
  return true;
}
window.addEventListener('keydown',e=>{
  const typing=e.target&&['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName);
  if(typing||rpgHud?.isOpen())return;
  if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code)){
    e.preventDefault();
    if(!e.repeat)rpgHud?.triggerSkill(Number(e.code.slice(-1)));
    return;
  }
  if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.repeat&&(e.code==='Space'||e.code==='Insert'))return;
  if(e.code==='Insert'){e.preventDefault();tryPose();return;}
  if(e.code==='Space')primaryAction();else keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>keys.clear());
let mobileControlsInitialized=false;
function configureMobileControls(){
  if(!MOBILE_UI||mobileControlsInitialized)return;
  mobileControlsInitialized=true;
  const visibility=$('visrange');
  if(visibility){visibility.value=String(sceneVisibilityRadius);$('visvalue').textContent=sceneVisibilityRadius+' m';}
  initMobileControls({
    onMove:(sideways,forward)=>{touchMove.sideways=sideways;touchMove.forward=forward;},
    onRun:enabled=>{touchRunning=enabled;},
    onAttack:primaryAction,
    onZoom:delta=>{CAM.dist+=delta;clampCam();}
  });
}
configureMobileControls();
mobileQuery.addEventListener('change',()=>{
  MOBILE_UI=mobileQuery.matches;mobileOrbitYaw=CAM.yaw;mobileOrbitLift=CAM.lift;document.body.classList.toggle('mobile-ui',MOBILE_UI);
  mobileCameraFocus.copy(playerPos); // Sem transição deslocada ao entrar/sair do modo mobile.
  mobileSteeringReferenceYaw=null;mobileFollowAnchorYaw=null;
  maxPixelRatio=Math.min(window.devicePixelRatio||1,MOBILE_UI?1.15:1.65);
  renderPixelRatio=maxPixelRatio;renderer.setPixelRatio(renderPixelRatio);
  configureMobileControls();resize();stopCombat();
  document.dispatchEvent(new Event('topweb:menu-open'));
});
window.addEventListener('resize',()=>{
  if(MOBILE_UI&&innerHeight>innerWidth){keys.clear();stopCombat();document.dispatchEvent(new Event('topweb:menu-open'));}
});
for(const b of document.querySelectorAll('[data-key]')){
  const code=b.dataset.key;
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(code)});
  const clear=()=>keys.delete(code);b.addEventListener('pointerup',clear);b.addEventListener('pointercancel',clear);
}
$('minimap').addEventListener('click',e=>{
  if(!world)return;
  const rect=e.currentTarget.getBoundingClientRect();
  const nx=(e.clientX-rect.left)/rect.width,nz=(e.clientY-rect.top)/rect.height;
  if(teleport(world.ox+nx*world.w,world.oz+nz*world.h))toast('Teletransporte no minimapa.');
});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();CAM.dist+=Math.sign(e.deltaY)*1.4;clampCam();},{passive:false});
let mouseDown=null,drag=null;
renderer.domElement.addEventListener('pointerdown',e=>{
  if(e.button===2||e.pointerType==='touch'){
    mobileOrbitYaw=CAM.yaw;mobileOrbitLift=CAM.lift;
    drag={x:e.clientX,y:e.clientY,id:e.pointerId,touch:e.pointerType==='touch'};
    renderer.domElement.setPointerCapture(e.pointerId);
  }
  if(e.button===0)mouseDown={x:e.clientX,y:e.clientY};
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(drag&&e.pointerId===drag.id&&(drag.touch||(e.buttons&2)!==0)){
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    drag.x=e.clientX;drag.y=e.clientY;
    if(MOBILE_UI){
      const horizontalSign=invertTouchHorizontal?-1:1;
      const verticalSign=invertTouchVertical?-1:1;
      mobileOrbitYaw-=dragOrbitDelta(dx*mobileTouchSensitivity*horizontalSign,innerWidth);
      mobileOrbitLift=THREE.MathUtils.clamp(mobileOrbitLift+dy*.0018*mobileTouchSensitivity*verticalSign,1.35,2.4);
      // Seguir imediatamente o dedo, sem a antiga limitação de 1.1 rad/s
      // que deixava arrasto lento mesmo em sensibilidades elevadas.
      CAM.yaw=mobileOrbitYaw;CAM.lift=mobileOrbitLift;clampCam();
    }
    else{CAM.yaw-=dx*.008;CAM.lift+=dy*.0035;clampCam();}
    manualCamera();
    applyCursor(renderer.domElement,'look');
    return;
  }
  applyCursor(renderer.domElement,aimMode(groundAt(e.clientX,e.clientY)));
});
renderer.domElement.addEventListener('pointerup',e=>{
  if(drag&&e.pointerId===drag.id)drag=null;
  if(e.button!==0||!mouseDown||!world)return;
  const moved=Math.hypot(mouseDown.x-e.clientX,mouseDown.y-e.clientY);mouseDown=null;
  if(moved>7)return;
  _aim.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
  _caster.setFromCamera(_aim,camera);
  const monster=monsterManager?.pick(_caster);
  if(monster&&combat?.selectTarget(monster,playerPos)){moverTarget=null;pendingPose=null;waypoint.hide();return;}
  if(showMarkers){
    const hits=_caster.intersectObjects(objectMeshes,false);
    if(hits.length){const hit=hits[0],rec=hit.object.userData.records?.[hit.instanceId];
      if(rec){toast(`OBJ #${rec[2]} · ${objectCatalog[rec[2]]?.label||'Objeto'} · ${objectCatalog[rec[2]]?.file||'sem modelo'} · ${rec[0].toFixed(1)}, ${rec[1].toFixed(1)}`);return}
    }
  }
  const pt=groundAt(e.clientX,e.clientY);
  if(!pt)return;
  const mark=poseHere(pt.x,pt.z);
  if(mark&&poseHere(playerPos.x,playerPos.z)===mark){
    moverTarget=null;pendingPose=null;waypoint.hide();if(seated)standUp();else sitDown(mark);return;
  }
  if(mark){orderMove(pt.x,pt.z,mark);return;}
  if(walkable(pt.x,pt.z))orderMove(pt.x,pt.z,null);
  else toast('Destino bloqueado. Clique em área navegável.');
});
applyCursor(renderer.domElement,'move');
setInterval(()=>{
  if(world&&playerPos&&Number.isFinite(playerPos.x))try{
    localStorage.setItem('topweb_garner_position',JSON.stringify([+playerPos.x.toFixed(2),+playerPos.z.toFixed(2)]));
    localStorage.setItem('topweb_garner_camera',JSON.stringify({yaw:+CAM.yaw.toFixed(3),dist:+CAM.dist.toFixed(2),lift:+CAM.lift.toFixed(3)}));
  }catch{}
},5000);
boot();
