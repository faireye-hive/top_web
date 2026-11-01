import {refinementVisual} from './refinement-rules.mjs';
export const REFINEMENT_STORAGE_KEY='topweb_refinement_effects_v1';
export const DEFAULT_REFINEMENT_STYLE=Object.freeze({
  color:'#ff1505',coreColor:'#ffcf80',strandColor:'#ff6e21',
  width:1,intensity:1,aura:1,pulse:.2,speed:1,particles:1,particleSize:1,strands:1,radius:1
});
const ranges={width:[.25,3],intensity:[.1,3],aura:[0,3],pulse:[0,1],speed:[.1,3],
  particles:[0,2],particleSize:[.25,2],strands:[0,1.4],radius:[.2,3]};
export function normalizeRefinementStyle(value={}){
  const out={...DEFAULT_REFINEMENT_STYLE};
  for(const key of ['color','coreColor','strandColor'])
    if(typeof value?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))out[key]=value[key].toLowerCase();
  for(const [key,[min,max]] of Object.entries(ranges))
    if(typeof value?.[key]==='number'&&Number.isFinite(value[key]))out[key]=Math.max(min,Math.min(max,value[key]));
  return out;
}
export function parseRefinementProfiles(raw){
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(data?.version!==1||!data.profiles||typeof data.profiles!=='object'||Array.isArray(data.profiles))throw Error('Formato de perfis inválido');
  const entries=Object.entries(data.profiles);
  if(entries.length>28)throw Error('Quantidade de perfis inválida');
  const profiles={};
  for(const [key,value] of entries){
    if(!/^(lance|phyllis|carsise|ami):(crusader|champion|sharpshooter|hunter|cleric|seal-master|voyager)$/.test(key)||
      !value||typeof value!=='object'||Array.isArray(value))throw Error('Perfil inválido: '+key);
    profiles[key]=normalizeRefinementStyle(value);
  }
  return {version:1,profiles};
}
export function readRefinementProfiles(storage=globalThis.localStorage,shipped={version:1,profiles:{}}){
  let base={version:1,profiles:{}};
  try{base=parseRefinementProfiles(shipped);}catch{}
  try{
    const raw=storage.getItem(REFINEMENT_STORAGE_KEY);
    if(raw)return {version:1,profiles:{...base.profiles,...parseRefinementProfiles(raw).profiles}};
  }catch{}
  return base;
}
export function refinementStyle(store,actor,job){return store?.profiles?.[`${actor}:${job}`]||DEFAULT_REFINEMENT_STYLE;}
export function saveRefinementProfiles(store,storage=globalThis.localStorage){
  storage.setItem(REFINEMENT_STORAGE_KEY,JSON.stringify(parseRefinementProfiles(store)));
}

export function styledRefinementVisual(level,mobile,style=DEFAULT_REFINEMENT_STYLE){
  const config=refinementVisual(level,mobile);
  return {...config,width:config.width*style.width,
    particles:Math.min(mobile?24:48,Math.round(config.particles*style.particles)),
    strands:Math.min(4,Math.round(config.strands*style.strands))};
}
