// skill-fx-edit.mjs — operações de edição + exportação do Skill FX Studio.
import {clone,layerData,buildLayers,skillRec,NEW_SYSTEM,normalizeStore} from './skill-fx-core.mjs';

const resPatch=(store,file)=>store.res[file]||={};

/** Grava um campo do sistema/trilha/peça. Camadas "novas" guardam os dados inteiros. */
export function setLayerField(store,layer,field,value){
  value=clone(value);
  if(layer.custom){
    const e=(store.skills[layer.skillId]?.extra||[]).find(x=>x.key===layer.key);if(e)e.data[field]=value;return;}
  const p=resPatch(store,layer.file);
  if(layer.kind==='system')((p.systems||={})[layer.idx]||={})[field]=value;
  else if(layer.kind==='strip')((p.strips||={})[layer.idx]||={})[field]=value;
}
export const setEffPart=(store,file,i,field,value)=>{((resPatch(store,file).parts||={})[i]||={})[field]=clone(value);};
export const setEffTop=(store,file,field,value)=>{(resPatch(store,file).top||={})[field]=clone(value);};

export function resetLayer(store,layer){
  if(layer.custom)return;const p=store.res[layer.file];if(!p)return;
  if(layer.kind==='system')delete p.systems?.[layer.idx];
  if(layer.kind==='strip')delete p.strips?.[layer.idx];}

/** Quantas skills usam cada arquivo (para avisar que a edição é compartilhada). */
export function usageMap(m){
  const use={};
  const add=(f,id)=>{(use[f]||=new Set()).add(id);};
  for(const [id,sk] of Object.entries(m.skills))for(const ch of sk.channels)for(const v of ch.visual||[]){
    for(const f of v.files||[])add(f,id);if(v.result)add(v.result,id);
    for(const mv of v.models||[]){for(const f of mv.files||[])add(f,id);if(mv.result)add(mv.result,id);}}
  for(const r of Object.values(m.resources))for(const s of r.systems||[]){if(s.effect)add(s.effect,'*');}
  return use;}

export function makeExclusive(m,store,skillId,file){
  const rec=skillRec(store,skillId);
  if(Object.values(rec.rebind).includes(file))return file;
  const name=file.replace(/(\.[^.]+)$/,`__s${skillId}$1`);
  store.clones[name]=store.clones[file]||file;
  store.res[name]=JSON.parse(JSON.stringify(store.res[file]||{}));
  rec.rebind[file]=name;return name;}

export function makeEffExclusive(m,store,skillId,layer){
  const s=layerData(m,store,layer);if(!s)return null;
  const cur=s.effect||s.model;if(!cur||!/\.eff$/i.test(cur))return null;
  const name=cur.replace(/(\.[^.]+)$/,`__s${skillId}_${layer.idx}$1`);
  if(!store.clones[name]){store.clones[name]=store.clones[cur]||cur;store.res[name]=JSON.parse(JSON.stringify(store.res[cur]||{}));}
  setLayerField(store,layer,'effect',name);setLayerField(store,layer,'model',name);return name;}

let seq=1;
export function addExtra(store,skillId,channel='actor',data=null){
  const rec=skillRec(store,skillId);
  const key=`x${Date.now().toString(36)}${seq++}`;
  rec.extra.push({key,channel,data:data?clone(data):NEW_SYSTEM()});return key;}
export function removeExtra(store,skillId,key){const rec=skillRec(store,skillId);rec.extra=rec.extra.filter(e=>e.key!==key);}

export function duplicateLayer(m,store,skillId,layer){
  if(layer.kind!=='system')return null;
  const data=layerData(m,store,layer);if(!data)return null;
  const copy=clone(data);copy.name=(copy.name||'sistema')+' cópia';
  return addExtra(store,skillId,layer.channel,copy);}

export function editedCount(store){
  let n=0;for(const p of Object.values(store.res)){
    n+=Object.keys(p.systems||{}).length+Object.keys(p.strips||{}).length+Object.keys(p.parts||{}).length+(p.top?1:0);}
  for(const s of Object.values(store.skills))n+=(s.extra||[]).length+Object.keys(s.off||{}).filter(k=>s.off[k]).length;
  return n;}

/** visuals.json final: aplica edições, clones por skill, camadas novas e desligadas. */
export function bakeMerged(m,store){
  const out=clone(m);
  for(const [name,base] of Object.entries(store.clones))if(m.resources[base])out.resources[name]=clone(m.resources[base]);
  for(const [file,p] of Object.entries(store.res)){
    const r=out.resources[file];if(!r)continue;
    for(const [i,patch] of Object.entries(p.systems||{}))if(r.systems?.[i])Object.assign(r.systems[i],clone(patch));
    // swing/rotation são metadados da prévia Three.js no visuals.json, não campos nativos do .par.
    // Preservar na exportação para que os ajustes não desapareçam ao recarregar o catálogo.
    for(const [i,patch] of Object.entries(p.strips||{}))if(r.strips?.[i])Object.assign(r.strips[i],clone(patch));
    for(const [i,patch] of Object.entries(p.parts||{}))if(r.parts?.[i])Object.assign(r.parts[i],clone(patch));
    if(p.top&&r.kind==='eff')Object.assign(r,clone(p.top));}
  const remap=(sk,map)=>{
    if(!Object.keys(map).length)return;
    const fix=v=>{if(v.files)v.files=v.files.map(f=>map[f]||f);if(v.result&&map[v.result])v.result=map[v.result];
      for(const mv of v.models||[])fix(mv);};
    for(const ch of sk.channels)for(const v of ch.visual||[])fix(v);};
  for(const [id,rec] of Object.entries(store.skills)){
    const sk=out.skills[id];if(!sk)continue;
    remap(sk,rec.rebind||{});
    const off=Object.keys(rec.off||{}).filter(k=>rec.off[k]);
    if(off.length){
      const layers=buildLayers(m,store,id).filter(l=>off.includes(l.key));const extraMap={},drop={};
      for(const l of layers){
        if(l.custom)continue;
        if(l.kind==='eff'){for(const ch of sk.channels)for(const v of ch.visual||[]){
          const strip=x=>{if(x.files)x.files=x.files.filter(f=>f!==l.file);for(const mv of x.models||[])strip(mv);};strip(v);}continue;}
        let f=l.file;
        if(!(f in store.clones)){
          const name=f.replace(/(\.[^.]+)$/,`__s${id}$1`);
          if(!out.resources[name]){out.resources[name]=clone(out.resources[f]);}
          extraMap[f]=name;f=name;}
        (drop[f]||=[]).push([l.kind,l.idx]);}
      remap(sk,extraMap);
      for(const [f,list] of Object.entries(drop)){const r=out.resources[f];
        for(const [kind,idx] of list.sort((a,b)=>b[1]-a[1])){if(kind==='system')r.systems.splice(idx,1);else r.strips.splice(idx,1);}}}
    const byCh={};for(const e of rec.extra||[])(byCh[e.channel||'actor']||=[]).push(e);
    for(const [chKind,list] of Object.entries(byCh)){
      const name=`fx_custom_${id}_${chKind}.par`;
      out.resources[name]={kind:'par',version:13,name,length:0,systems:list.map(e=>clone(e.data)),strips:[],extra:'',at:0,size:0};
      sk.channels.push({kind:chKind,effect:-1,key:0,dummy:-1,itemDummy:-1,visual:[{kind:'scene',files:[name]}]});}
  }
  out.source=(out.source||'')+' + editado no Skill FX Studio';return out;}

export function exportEdits(store){return{...store,exportedAt:new Date().toISOString()};}
export{normalizeStore};
