import {historicalWeaponDummies} from './historical-weapon-dummies.mjs';
// Pose Studio runtime — shared by the game and tests/pose-editor.html.
// Stores user refinements separately from historical CharacterAction.tx and GLB assets.
export const POSE_STORAGE_KEY='topweb_pose_profiles_v1';
export const POSE_STATES=['idle','guard','run','armedRun','attack'];
export const POSE_DEFAULTS={idle:'Parado',guard:'Combate',run:'Correr',
  armedRun:'Correr armado',attack:'Ataque 1'};
export const WEAPON_STATES=['city','run','guard','armedRun','attack'];
export const WEAPON_PLACEMENTS=['auto','hidden','hand','back'];
export function weaponPlacementForState(profile,state,key,fallback='hand'){
  const stored=profile?.placements?.[state]?.[key];
  return WEAPON_PLACEMENTS.includes(stored)&&stored!=='auto'?stored:fallback;
}

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
        scale:bound(number(settings.scale,1),.1,5),
        ...(settings.anchor==='historical'?{anchor:'historical'}:{})
      };
    }
    // Posição/visibilidade independentes do clipe GLB e por arma/estado.
    // "auto" mantém o comportamento do jogo; não exigir migração dos JSONs v1.
    const placements={};
    for(const state of POSE_STATES){
      const entries=value.placements?.[state];
      if(!entries||typeof entries!=='object'||Array.isArray(entries))continue;
      for(const [part,mode] of Object.entries(entries)){
        if(!/^weapon-\d+$/.test(part)||!WEAPON_PLACEMENTS.includes(mode))continue;
        (placements[state]??={})[part]=mode;
      }
    }
    out.profiles[key]={clips,stowOnIdle:value.stowOnIdle!==false,weapons,placements};
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
function weaponSubmeshes(object){
  if(!object)return [];
  if(object.isMesh||object.isSkinnedMesh)return [object];
  const result=[];
  object.traverse?.(node=>{if(node!==object&&(node.isMesh||node.isSkinnedMesh))result.push(node)});
  return result;
}

function weaponPartNumber(name){
  // GLTFLoader may sanitize "Parte 5 · weapon" to "Parte_5__weapon".
  // Metadata from glTF extras is authoritative; names are legacy fallback.
  const match=/^Parte[\s_]*(\d+)(?:[\s_.·-]|$)/i.exec(String(name||''));
  return match?Number(match[1]):null;
}

export function weaponMeshNodes(avatar){
  const found=[];
  avatar?.traverse(o=>{
    // Multi-primitive GLBs use a Group parent (metadata lives here).
    // The editor must detect the complete logical item, not only a child Mesh.
    // Preserve plain Mesh support so "Ocultar" works without rigid skin.
    const children=weaponSubmeshes(o);
    if(!children.length)return;
    const role=String(o.userData?.topRole||'').toLowerCase();
    const slot=Number(o.userData?.equipmentSlot);
    const part=weaponPartNumber(o.name);
    const legacyName=String(o.name||'');
    const labeled=part!==null&&/(?:^|[\s_·-])weapon(?:$|[\s_.·-])/i.test(legacyName);
    const legacy=part!==null&&part>=5&&/(?:\.?lgo)(?:$|[\s_.-])/i.test(legacyName);
    const tagged=(role==='weapon'||(slot===6||slot===9)&&part!==null);
    if(!tagged&&!labeled&&!legacy)return;
    found.push(o);
  });
  // Preserve weapon-0/weapon-1 across reexports and saved presets.
  return found.sort((a,b)=>{
    const slotA=Number(a.userData?.equipmentSlot),slotB=Number(b.userData?.equipmentSlot);
    const orderA=slotA===6?0:slotA===9?1:(weaponPartNumber(a.name)??99);
    const orderB=slotB===6?0:slotB===9?1:(weaponPartNumber(b.name)??99);
    return orderA-orderB;
  });
}

export function findHistoricalDummy(avatar,number){
  let found=null;
  avatar?.traverse(o=>{
    if(found)return;
    const tagged=Number(o.userData?.topDummy)===number;
    // Old GLBs without extras and GLTFLoader-sanitized node names.
    const name=String(o.name||'');
    const named=new RegExp('^TOP[ _]Dummy[ _]'+number+'$','i').test(name);
    if(tagged||named)found=o;
  });
  return found;
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
  if(!mesh?.skeleton?.bones?.length)return null;
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
// Para o Lance Crusader, a geometria original da arma já está convertida
// na posição do dummy de mão. Removemos apenas essa matriz e anexamos a
// geometria ao dummy histórico das costas, animado pelo osso pai.
// Não é necessário mudar um único keyframe ou inventar uma pose "Cidade".
export class WeaponHolster {
  constructor(THREE,avatar,job,profile,actor=null){
    this.THREE=THREE;this.avatar=avatar;this.job=job;this.actor=actor;this.parts=[];
    this.bones=availableBones(avatar);
    const weapons=weaponMeshNodes(avatar);
    this.detected=weapons.length;
    this.issues=[];
    weapons.forEach((source,index)=>{
      const slot=Number(source.userData?.equipmentSlot)||(index===0?6:index===1?9:0);
      const key='weapon-'+index;
      const meshes=weaponSubmeshes(source);
      const part={index,key,slot,source,meshes,holder:null,adjust:null,
        view:null,views:[],skinMesh:meshes[0]||null,
        historical:null,socketNode:null,issue:''};
      this.parts.push(part);
      const skinMeshes=meshes.map(mesh=>({mesh,skinBone:fixedBoneSkin(mesh)}));
      if(skinMeshes.some(row=>row.skinBone===null)){
        part.issue='Pelo menos uma submalha não está rigidamente presa a um único osso.';
        this.issues.push(source.name+': '+part.issue);
        return;
      }
      if(skinMeshes.some(row=>!row.mesh.skeleton.boneInverses[row.skinBone])){
        part.issue='Matriz inverseBind ausente em uma das submalhas.';
        this.issues.push(source.name+': '+part.issue);
        return;
      }
      const sockets=historicalWeaponDummies(actor,job,slot);
      const historical=!!sockets&&skinMeshes.every(({mesh,skinBone})=>
        sockets.hand.parent===skinBone&&
        !!mesh.skeleton.bones[sockets.back.parent]&&
        !!mesh.skeleton.boneInverses[sockets.back.parent]);
      const socketNode=historical
        ?findHistoricalDummy(avatar,slot===6?22:21):null;
      const holder=new THREE.Group();holder.name='Pose Studio · encaixe '+index;
      const adjust=new THREE.Group();adjust.name='Pose Studio · ajuste '+index;
      holder.add(adjust);
      const views=[];
      try{
        for(const {mesh,skinBone} of skinMeshes){
          const inverse=mesh.skeleton.boneInverses[skinBone];
          const transformed=mesh.geometry.clone();
          try{
            if(historical){
              transformed.applyMatrix4(new THREE.Matrix4().fromArray(sockets.hand.matrix).invert());
            }else{
              transformed.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.bindMatrix));
              transformed.computeBoundingBox();
              // Match old fallback behaviour, but use a consistent center
              // for all primitives so they stay assembled.
            }
            const view=new THREE.Mesh(transformed,mesh.material);
            view.name='Pose Studio · arma '+index+' · parte '+views.length;
            view.frustumCulled=false;
            // Manter a camada aditiva opcional 1.BMP oculta também quando
            // a espada é guardada (cópia da malha do WeaponHolster).
            view.visible=mesh.visible;
            // GLTFLoader primitive children are normally identity transforms,
            // but retain any local transforms from older converted assets.
            if(mesh!==source&&mesh.matrix&&typeof view.applyMatrix4==='function')
              view.applyMatrix4(mesh.matrix);
            adjust.add(view);
            views.push(view);
          }catch(error){
            transformed.dispose();
            throw error;
          }
        }
        if(!historical&&views.length){
          // Preserve the old centered fallback for other characters.
          // For multi-primitive weapons, use ONE common center so each
          // primitive keeps its original alignment with the others.
          const bounds=views[0].geometry.boundingBox;
          if(bounds?.getCenter&&typeof THREE.Vector3==='function'){
            const center=bounds.getCenter(new THREE.Vector3());
            for(const view of views){
              view.geometry.translate(-center.x,-center.y,-center.z);
            }
          }
        }
      }catch(error){
        for(const view of views)view.geometry.dispose();
        part.issue='Falha ao criar cópia para costas: '+error.message;
        this.issues.push(source.name+': '+part.issue);
        return;
      }
      Object.assign(part,{holder,adjust,view:views[0],views,
        historical:historical?sockets:null,socketNode});
    });
    this.setProfile(profile);
  }
  defaultSettings(part){
    if(part?.historical){
      const bone=part.skinMesh.skeleton.bones[part.historical.back.parent];
      return {bone:(part.socketNode||bone).name,
        position:[0,0,0],rotation:[0,0,0],scale:1,anchor:'historical'};
    }
    return weaponDefaults(this.job,part?.index||0,this.bones);
  }
  setProfile(profile){
    this.profile=profile||null;
    for(const part of this.parts){
      const {source,holder,adjust,index,key,historical,socketNode,skinMesh}=part;
      if(!holder)continue;
      const defaults=this.defaultSettings(part);
      // As versões anteriores salvavam offsets aproximados de coluna. Não
      // aplicá-los por engano sobre o novo dummy histórico (deslocaria a arma).
      if(historical&&profile?.weapons?.[key]&&profile.weapons[key].anchor!=='historical')
        profile.weapons[key]=defaults;
      const setting=profile?.weapons?.[key]||defaults;
      // Respeitar o osso escolhido manualmente. O botão "Padrão"
      // volta a selecionar TOP Dummy 21/22 quando eles existem.
      const bone=this.avatar.getObjectByName(setting.bone)||
        this.avatar.getObjectByName(defaults.bone);
      if(!bone)continue;
      if(holder.parent!==bone)bone.add(holder);
      if(historical){
        if(socketNode&&bone===socketNode){
          // GLB reconstruído: o TOP Dummy é filho do osso e já contém a
          // matriz histórica. Não aplicar inverseBind ou dummy duas vezes.
          holder.matrixAutoUpdate=true;
          holder.position.set(0,0,0);
          holder.rotation.set(0,0,0);
          holder.scale.setScalar(1);
        }else{
          // Compatibilidade com GLBs anteriores ao exportador dos sockets.
          const boneIndex=skinMesh.skeleton.bones.indexOf(bone);
          const boneInverse=skinMesh.skeleton.boneInverses[boneIndex];
          if(!boneInverse){
            part.issue='Osso selecionado não pertence ao esqueleto da arma.';
            this.issues.push(source.name+': '+part.issue);
            continue;
          }
          const backMatrix=new this.THREE.Matrix4().fromArray(historical.back.matrix);
          holder.matrixAutoUpdate=false;
          holder.matrix.multiplyMatrices(boneInverse,backMatrix);
          holder.matrix.decompose(holder.position,holder.quaternion,holder.scale);
        }
        holder.updateMatrixWorld(true);
        adjust.position.set(...setting.position);
        adjust.rotation.order='XYZ';
        adjust.rotation.set(...setting.rotation.map(v=>v*Math.PI/180));
        adjust.scale.setScalar(setting.scale);
      }else{
        holder.matrixAutoUpdate=true;
        holder.position.set(...setting.position);
        holder.rotation.order='XYZ';
        holder.rotation.set(...setting.rotation.map(v=>v*Math.PI/180));
        holder.scale.setScalar(setting.scale);
        adjust.position.set(0,0,0);
        adjust.rotation.set(0,0,0);
        adjust.scale.setScalar(1);
      }
      holder.updateMatrixWorld(true);
      source.visible=true;
    }
    this.setStowed(this.stowed??false);
  }
  setStowed(value,state=null){
    this.stowed=!!value&&this.profile?.stowOnIdle!==false;
    for(const part of this.parts){
      const {source,holder,key}=part;
      const fallback=this.stowed?'back':'hand';
      const mode=state?weaponPlacementForState(this.profile,state,key,fallback):fallback;
      part.mode=mode;
      // Nunca revelar a espada na mão quando o usuário selecionou
      // "Ocultar" ou "Nas costas". Sem cópia disponível, ocultar e avisar.
      source.visible=mode==='hand';
      if(holder)holder.visible=mode==='back'&&!!holder.parent;
      part.visualStatus=mode==='back'&&(!holder||!holder.parent)
        ?'Não foi possível criar/encaixar a arma nas costas':mode;
    }
  }
  dispose(){
    for(const {source,holder,views=[]}of this.parts){
      source.visible=true;holder?.parent?.remove(holder);
      for(const view of views)view.geometry.dispose();
    }
    this.parts=[];
  }
}
