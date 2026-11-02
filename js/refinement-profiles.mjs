import {refinementVisual} from './refinement-rules.mjs';
export const REFINEMENT_STORAGE_KEY='topweb_refinement_effects_v1';
export const DEFAULT_REFINEMENT_STYLE=Object.freeze({
  color:'#ff1505',coreColor:'#ffcf80',strandColor:'#ff6e21',strandColor2:'#ffe4a3',
  strandColorMode:'solid',strandAura:'none',strandWidth:1,strandGlow:1,
  width:1,length:1,tipWidth:1,tipLength:.25,
  weaponSurface:true,surfaceTint:.45,surfaceGlow:.8,surfacePattern:'flow',
  armorGlow:0,glovesGlow:0,bootsGlow:0,hatGlow:0,armorAura:0,glovesAura:0,bootsAura:0,hatAura:0,equipmentAuraWidth:1,hatModel:'none',armorTint:.25,armorFollow:true,armorColor:'#ffe4a3',
  intensity:1,aura:1,pulse:.2,speed:1,particles:1,particleSize:1,strands:1,radius:1
});
export const REFINEMENT_COLOR_MODES=Object.freeze(['solid','gradient','alternate','rainbow']);
export const REFINEMENT_STRAND_AURAS=Object.freeze(['none','soft','flame','electric']);
export const REFINEMENT_SURFACE_PATTERNS=Object.freeze(['steady','pulse','flow']);
const ranges={width:[.25,3],length:[.35,2],tipWidth:[0,2],tipLength:[.1,.6],
  armorAura:[0,3],glovesAura:[0,3],bootsAura:[0,3],hatAura:[0,3],equipmentAuraWidth:[.25,3],
  surfaceTint:[0,1],surfaceGlow:[0,3],armorGlow:[0,3],glovesGlow:[0,3],bootsGlow:[0,3],hatGlow:[0,3],armorTint:[0,1],
  strandWidth:[.25,30],strandGlow:[0,3],intensity:[.1,3],aura:[0,3],pulse:[0,1],speed:[.1,3],
  particles:[0,2],particleSize:[.25,2],strands:[0,1.4],radius:[.2,3]};
export function normalizeRefinementStyle(value={}){
  const out={...DEFAULT_REFINEMENT_STYLE};
  for(const key of ['color','coreColor','strandColor','strandColor2','armorColor'])
    if(typeof value?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))out[key]=value[key].toLowerCase();
  for(const [key,[min,max]] of Object.entries(ranges))
    if(typeof value?.[key]==='number'&&Number.isFinite(value[key]))out[key]=Math.max(min,Math.min(max,value[key]));
  if(REFINEMENT_COLOR_MODES.includes(value?.strandColorMode))out.strandColorMode=value.strandColorMode;
  if(REFINEMENT_STRAND_AURAS.includes(value?.strandAura))out.strandAura=value.strandAura;
  if(['none','royal-major'].includes(value?.hatModel))out.hatModel=value.hatModel;
  if(REFINEMENT_SURFACE_PATTERNS.includes(value?.surfacePattern))out.surfacePattern=value.surfacePattern;
  for(const key of ['weaponSurface','armorFollow'])if(typeof value?.[key]==='boolean')out[key]=value[key];
  return out;
}

// Shape only the refinement envelope; keep the blade's original grip anchor.
export function refinementBladeRange(bladeLength,extension,style=DEFAULT_REFINEMENT_STYLE){
  const start=bladeLength*.14-extension;
  return {start,end:start+(bladeLength*.86+2*extension)*style.length};
}
export function refinementTipWidth(t,style=DEFAULT_REFINEMENT_STYLE){
  const progress=Math.max(0,Math.min(1,(t-(1-style.tipLength))/style.tipLength));
  const smooth=progress*progress*(3-2*progress);
  return 1+(style.tipWidth-1)*smooth;
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
