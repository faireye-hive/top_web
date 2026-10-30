// Revisão visual usa os mesmos assets, resolução de ações e VFX do jogo.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {getActionId,resolveSkillClip} from '../js/class-skills.mjs?v=3';
import {skillWithRules} from '../js/skill-rules.mjs';
import {createSkillVisuals} from '../js/skill-visuals.mjs?v=2';
const $=id=>document.getElementById(id),loader=new GLTFLoader();
const [catalog,equipment]=await Promise.all(['assets/skills/catalog.json','assets/equipment/manifest.json'].map(p=>fetch(p).then(r=>r.json())));
const renderer=new THREE.WebGLRenderer({canvas:$('gallery'),antialias:true});
renderer.setPixelRatio(Math.min(1.5,devicePixelRatio));renderer.outputColorSpace=THREE.SRGBColorSpace;
const camera=new THREE.PerspectiveCamera(43,1,.1,100);
camera.position.set(5,6,8);camera.lookAt(1,1,0);
let panels=[],playing=false,phase=1,loading=false;
for(const [id,preset] of Object.entries(catalog.classes))$('job').add(new Option(preset.name,id));
function actors(){const current=$('actor').value;$('actor').replaceChildren();for(const actor of Object.keys(equipment.sets[$('job').value].models))$('actor').add(new Option(actor,actor));if([...$('actor').options].some(x=>x.value===current))$('actor').value=current;}
function seek(effects=true){
 for(const p of panels){
  if(!p.chain.length)continue;
  p.mixer.stopAllAction();let remaining=phase,chosen=p.chain[0];
  for(const clip of p.chain){chosen=clip;if(remaining<=clip.duration)break;remaining-=clip.duration;}
  const action=p.mixer.clipAction(chosen);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();p.mixer.update(Math.min(remaining,chosen.duration));
  if(effects){p.fx.clear();p.fx.play(p.skill,p.origin,p.skill.kind==='damage'&&p.skill.center!=='self'?p.target:null,.18);p.fx.update(phase);}
 }
 $('time').value=phase.toFixed(2)+'s';$('phase').value=String(Math.round(phase*1000));
}
async function load(){
 loading=true;$('job').disabled=true;$('actor').disabled=true;playing=false;$('play').textContent='Reproduzir';$('status').textContent='Carregando…';
 const geometries=new Set(),materials=new Set(),maps=new Set();
 for(const p of panels){p.fx.dispose();p.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);if(m.map)maps.add(m.map);}});}
 for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of maps)x.dispose();
 panels=[];$('labels').replaceChildren();
 const job=$('job').value,actor=$('actor').value;
 const [base,extras]=await Promise.all([loader.loadAsync('assets/equipment/'+equipment.sets[job].models[actor]+'?v=4'),loader.loadAsync('assets/skills/animations/'+actor+'.glb?v=2')]);
 const clips=[...base.animations,...extras.animations];
 for(const entry of catalog.classes[job].skills){
  const skill=skillWithRules(entry),scene=new THREE.Scene();scene.background=new THREE.Color('#132b38');
  scene.add(new THREE.HemisphereLight(0xe6f4ff,0x76715c,2));const light=new THREE.DirectionalLight(0xffefd2,2.2);light.position.set(3,6,4);scene.add(light);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshLambertMaterial({color:0x3e6263}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const grid=new THREE.GridHelper(24,24,0x557b7c,0x476c6e);grid.position.y=.01;scene.add(grid);
  const avatar=clone(base.scene);avatar.rotation.y=-Math.PI/2;scene.add(avatar);avatar.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
  const target={x:3.8,z:0},origin={x:0,z:0};
  const dummy=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.7,4,8),new THREE.MeshLambertMaterial({color:0x975d4c}));dummy.position.set(target.x,.6,target.z);scene.add(dummy);
  const mixer=new THREE.AnimationMixer(avatar),first=resolveSkillClip(skill,actor,clips);
  const chain=(skill.actions[actor]||[]).map(a=>clips.find(c=>getActionId(c)===a.id)).filter(Boolean);
  if(!chain.length&&first)chain.push(first);
  const fx=createSkillVisuals({scene,heightAt:()=>0});await fx.warm([skill]);
  const label=document.createElement('article');const name=document.createElement('strong');name.textContent=skill.name;const detail=document.createElement('small');detail.textContent=chain.length?`Ações ${chain.map(getActionId).join(' → ')} · ${skill.range||0} m`:'ANIMAÇÃO AUSENTE';label.append(name,detail);$('labels').append(label);
  panels.push({scene,mixer,chain,skill,fx,origin,target});
 }
 $('status').textContent=`${actor} · ${panels.filter(p=>p.chain.length).length}/4 poses reais · FX leves aproximados`;
 loading=false;$('job').disabled=false;$('actor').disabled=false;seek();
}
$('job').onchange=()=>{actors();void load().catch(fail);};$('actor').onchange=()=>void load().catch(fail);
$('phase').oninput=()=>{phase=Number($('phase').value)/1000;seek();};
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pausar':'Reproduzir';};
function fail(e){$('status').textContent='ERRO: '+e.message;console.error(e);loading=false;$('job').disabled=false;$('actor').disabled=false;}
let previous=performance.now();
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.05,(now-previous)/1000);previous=now;
 const width=innerWidth,height=innerHeight-96;renderer.setSize(width,height,false);renderer.setScissorTest(true);
 if(playing&&!loading){const before=phase;phase=(phase+dt)%3;seek(phase<before);if(phase>=before)for(const p of panels)p.fx.update(dt);}
 for(let i=0;i<panels.length;i++){
  const x=(i%2)*width/2,y=i<2?height/2:0,w=width/2,h=height/2;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);panels[i].fx.update(0);renderer.render(panels[i].scene,camera);
 }
}
actors();await load().catch(fail);requestAnimationFrame(frame);
