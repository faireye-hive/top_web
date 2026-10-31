// Pose Studio runtime — shared by the game and tests/pose-editor.html.
// Stores user refinements separately from historical CharacterAction.tx and GLB assets.
export const POSE_STORAGE_KEY='topweb_pose_profiles_v1';
export const POSE_STATES=['idle','guard','run','armedRun','attack'];
export const POSE_DEFAULTS={idle:'Parado',guard:'Combate',run:'Correr',
  armedRun:'Correr armado',attack:'Ataque 1'};
export const WEAPON_STATES=['city','run','guard','armedRun','attack'];

const number=(n,or=0)=>Number.isFinite(+n)?+n:or;
const bound=(n,min,max)=>Math.max(min,Math.min(max,n));
export function profileKey(actor,job){return String(actor)+':'+String(job)}
export function parsePoseProfiles(input){
  const obj=typeof input==='string'?JSON.parse(input):input;
  if(!obj||typeof obj!=='object'||obj.version!==1||!obj.profiles||typeof obj.profiles!=='object'||Array.isArray(obj.profiles))
    throw new Error('JSON inválido: esperado {version:1,profiles:{...}}');
  const out={version:1,profiles:{}};
  for(const [key,value] of Object.entries(obj.profiles)){
    if(!/^[a-z-]+:[a-z-]+$/.test(key)||!value||typeof value!=='object')continue;
    const clips={};
    for(const state of POSE_STATES){
      if(typeof value.clips?.[state]==='string'&&value.clips[state].length<120)clips[state]=value.clips[state];
    }
    const weapons={};
    for(const [part,settings] of Object.entries(value.weapons||{})){
      if(!/^weapon-\d+$/.test(part)||!settings||typeof settings!=='object')continue;
      const vec=(v)=>[0,1,2].map(i=>bound(number(v?.[i]),-360,360));
      weapons[part]={
        bone:typeof settings.bone==='string'?settings.bone.slice(0,160):'',
        position:vec(settings.position),
        rotation:vec(settings.rotation),
        scale:bound(number(settings.scale,1),.1,5)
      };
    }
    out.profiles[key]={clips,stowOnIdle:value.stowOnIdle!==false,weapons};
  }
  return out;
}
export function readPoseProfiles(storage=globalThis.localStorage,shipped={version:1,profiles:{}}){
  let base;try{base=parsePoseProfiles(shipped)}catch{base={version:1,profiles:{}}}
  try{
    const saved=storage?.getItem(POSE_STORAGE_KEY);
    if(!saved)return base;
    const local=parsePoseProfiles(saved);
    return {version:1,profiles:{...base.profiles,...local.profiles}};
  }catch{return base}
}
export function savePoseProfiles(data,storage=globalThis.localStorage){
  const clean=parsePoseProfiles(data);
  storage?.setItem(POSE_STORAGE_KEY,JSON.stringify(clean));
  return clean;
}
export function poseProfile(data,actor,job){return data?.profiles?.[profileKey(actor,job)]||null}
export function selectPoseName(state,profile,clips,bank=null){
  const configured=profile?.clips?.[state];
  if(configured&&clips.some(c=>c.name===configured))return configured;
  // Ações dos sete bancos possuem nomes repetidos: preferir o ID histórico
  // do equipamento. Configurações explícitas do usuário continuam prioritárias.
  const base={idle:1,guard:4,run:5,armedRun:6,attack:7}[state];
  if(base&&Number.isInteger(bank)&&bank>=0&&bank<=6){
    const chosen=clips.find(c=>Number(/^\s*(\d{1,3})\s*[·-]/.exec(c.name)?.[1])===base+bank*54);
    if(chosen)return chosen.name;
    if(bank!==0){
      const common=clips.find(c=>Number(/^\s*(\d{1,3})\s*[·-]/.exec(c.name)?.[1])===base);
      if(common)return common.name;
    }
  }
  const standard=POSE_DEFAULTS[state]||POSE_DEFAULTS.idle;
  const direct=clips.find(c=>c.name.toLowerCase().split('·').pop().trim()===standard.toLowerCase());
  if(direct)return direct.name;
  const partial=clips.find(c=>c.name.toLowerCase().includes(standard.toLowerCase()));
  if(partial)return partial.name;
  if(state==='guard'||state==='armedRun')
    return selectPoseName(state==='guard'?'idle':'run',profile,clips,bank);
  return clips[0]?.name||'';
}
export function weaponMeshNodes(avatar){
  const result=[];
  avatar?.traverse(o=>{
    if(!o.isSkinnedMesh||!o.skeleton)return;
    const part=/^Parte\s*(\d+)\s*·\s*(.+)$/i.exec(o.name);
    if(!part)return;
    const role=o.userData?.topRole;
    const labeled=/^weapon(?:\b|$)/i.test(part[2]);
    // GLBs anteriores nomeiam as armas pelo arquivo LGO, por exemplo
    // "Parte 5 · 01010021.lgo". Equipamentos gerados têm 5 partes de
    // corpo seguidas dos slots 6/9 (armas). Esta detecção é compatível
    // com os modelos binários já publicados, sem precisar reconvertê-los.
    const legacy=Number(part[1])>=5 && /\.lgo$/i.test(part[2]);
    if(role!=='weapon'&&!labeled&&!legacy)return;
    result.push(o);
  });
  return result.sort((a,b)=>Number(/Parte\s*(\d+)/.exec(a.name)?.[1]||0)-Number(/Parte\s*(\d+)/.exec(b.name)?.[1]||0));
}

export function availableBones(avatar){
  const found=[];avatar?.traverse(o=>{if(o.isBone)found.push(o.name)});
  return found;
}
function chooseBone(bones,job){
  const pattern=job==='sharpshooter'||job==='champion'?/pelvis|hips|spine0/i:/spine2|spine1|spine|chest/i;
  return bones.find(n=>pattern.test(n))||bones[0]||'';
}
export function weaponDefaults(job,index,bones=[]){
  const hip=job==='sharpshooter'||job==='champion';
  const dual=job==='crusader';
  // Editable first approximation; not claimed to be the historical dummy.
  return {
    bone:chooseBone(bones,job),
    position:hip?[index?-.20:.20,-.15,.05]:
      dual?[index?.19:-.19,.03,.11]:[.15,.07,.12],
    rotation:hip?[0,0,index?85:-85]:
      dual?[0,0,index?-40:40]:[0,0,35],
    scale:1
  };
}
function fixedBoneSkin(mesh){
  const geom=mesh.geometry,index=geom?.getAttribute('skinIndex'),weight=geom?.getAttribute('skinWeight');
  if(!index||!weight||!index.count)return null;
  const boneIndex=index.getX(0);
  for(let i=0;i<index.count;i++)
    if(index.getX(i)!==boneIndex||weight.getX(i)<.985)return null;
  return boneIndex<mesh.skeleton.bones.length?boneIndex:null;
}
// Converted Evanescence weapons are fully weighted to one hand bone.
// Move a static copy into editable local chest/hip space; original skinned
// geometry remains untouched and reappears for guards and attacks.
export class WeaponHolster {
  constructor(THREE,avatar,job,profile){
    this.THREE=THREE;this.avatar=avatar;this.job=job;this.parts=[];
    const bones=availableBones(avatar);
    this.bones=bones;
    const weapons=weaponMeshNodes(avatar);
    weapons.forEach((source,index)=>{
      const skinBone=fixedBoneSkin(source);
      if(skinBone===null)return;
      const inverse=source.skeleton.boneInverses[skinBone];
      if(!inverse)return;
      const transformed=source.geometry.clone();
      transformed.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,source.bindMatrix));
      transformed.computeBoundingBox();
      const center=transformed.boundingBox.getCenter(new THREE.Vector3());
      transformed.translate(-center.x,-center.y,-center.z);
      const view=new THREE.Mesh(transformed,source.material);
      view.name='Pose Studio · arma guardada '+index;
      view.frustumCulled=false;
      const holder=new THREE.Group();holder.name='Pose Studio · encaixe '+index;
      holder.add(view);
      this.parts.push({index,key:'weapon-'+index,source,holder,view});
    });
    this.setProfile(profile);
  }
  setProfile(profile){
    this.profile=profile||null;
    for(const part of this.parts){
      const {source,holder,index,key}=part;
      const setting=profile?.weapons?.[key]||weaponDefaults(this.job,index,this.bones);
      const bone=this.avatar.getObjectByName(setting.bone)||this.avatar.getObjectByName(weaponDefaults(this.job,index,this.bones).bone);
      if(!bone)continue;
      if(holder.parent!==bone)bone.add(holder);
      holder.position.set(...setting.position);
      holder.rotation.order='XYZ';
      holder.rotation.set(...setting.rotation.map(v=>v*Math.PI/180));
      holder.scale.setScalar(setting.scale);
      holder.updateMatrixWorld(true);
      source.visible=true;
    }
    this.setStowed(this.stowed??false);
  }
  setStowed(value){
    this.stowed=!!value&&this.profile?.stowOnIdle!==false;
    for(const {source,holder} of this.parts){
      const fitted=!!holder.parent;
      source.visible=!this.stowed||!fitted;
      holder.visible=this.stowed&&fitted;
    }
  }
  dispose(){
    for(const {source,holder,view}of this.parts){
      source.visible=true;holder.parent?.remove(holder);
      view.geometry.dispose();
    }
    this.parts=[];
  }
}
