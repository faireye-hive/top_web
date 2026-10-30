// Descritores leves derivados do visuals.json real (channels/resources).
// Sem dependências Three.js: o editor e o runtime usam o mesmo mapeamento.
export const EDIT_KEY='topweb_skill_vfx_overrides_v1';
export const GLOBAL_DEFAULTS=Object.freeze({
  scale:1, opacity:1, speed:1, particles:32, duration:1, height:0, distance:3.8
});
export const LAYER_DEFAULTS=Object.freeze({
  enabled:true, scale:1, opacity:1, x:0, y:0, z:0, delay:0,
  duration:1, spin:0, count:1, color:'#ffffff'
});
const clamp=(v,lo,hi,fallback)=>{
  const n=Number(v);return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):fallback;
};
const tex=x=>typeof x==='string'&&x.endsWith('.png')?x:null;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const vec=(a,n=3)=>Array.from({length:n},(_,i)=>num(a?.[i]));
const baseRgb=arr=>{
  const rgb=Array.isArray(arr)?arr:[1,1,1,1];
  return [0,1,2,3].map((i)=>clamp(rgb[i],0,1,1));
};
const first=(array,fallback)=>Array.isArray(array)&&array.length?array[0]:fallback;
export function newPresetStore(){return {version:1,skills:{}};}
export function normalizePresetStore(input){
  const out=newPresetStore();
  if(!input||typeof input!=='object'||!input.skills||typeof input.skills!=='object')return out;
  for(const [id,preset] of Object.entries(input.skills)){
    if(!/^\d{1,5}$/.test(id)||!preset||typeof preset!=='object')continue;
    const global={};for(const field of Object.keys(GLOBAL_DEFAULTS)){
      if(preset.global?.[field]!==undefined)global[field]=clamp(
        preset.global[field],
        field==='particles'?1:field==='height'?-5:field==='distance'?1:field==='opacity'?0:.1,
        field==='particles'?64:field==='height'?6:field==='distance'?20:field==='opacity'?2:field==='speed'?4:field==='duration'?4:5,
        GLOBAL_DEFAULTS[field]);
    }
    const layers={};
    for(const [key,values] of Object.entries(preset.layers||{})){
      if(!/^[a-zA-Z0-9_.:#()\-]{1,140}$/.test(key)||!values||typeof values!=='object')continue;
      const result={};
      for(const field of Object.keys(LAYER_DEFAULTS)){
        if(values[field]===undefined)continue;
        if(field==='enabled')result[field]=values.enabled!==false;
        else if(field==='color')result.color=/^#[0-9a-fA-F]{6}$/.test(values.color)?values.color:'#ffffff';
        else result[field]=clamp(values[field],field==='opacity'?0:field==='x'||field==='y'||field==='z'?-8:field==='delay'?-3:field==='spin'?-10:.05,
          field==='opacity'?2:field==='x'||field==='y'||field==='z'?8:field==='delay'?3:field==='duration'?5:field==='spin'?10:field==='count'?6:6,
          LAYER_DEFAULTS[field]);
      }
      if(Object.keys(result).length)layers[key]=result;
    }
    out.skills[id]={global,layers};
  }
  return out;
}
export function readLocalPresets(storage=globalThis.localStorage){
  try{return normalizePresetStore(JSON.parse(storage?.getItem(EDIT_KEY)||'null'));}catch{return newPresetStore();}
}
export function writeLocalPresets(data,storage=globalThis.localStorage){
  const normalized=normalizePresetStore(data);
  try{storage?.setItem(EDIT_KEY,JSON.stringify(normalized));}catch{}
  return normalized;
}
export function skillPreset(data,id){
  const record=data?.skills?.[String(id)]||{};
  return {
    global:{...GLOBAL_DEFAULTS,...record.global},
    layers:record.layers||{}
  };
}
export function mergePresetStores(base,local){
  const output=normalizePresetStore(base),extra=normalizePresetStore(local);
  for(const [id,record] of Object.entries(extra.skills)){
    const previous=output.skills[id]||{global:{},layers:{}};
    output.skills[id]={
      global:{...previous.global,...record.global},
      layers:{...previous.layers}
    };
    for(const [key,override] of Object.entries(record.layers||{})){
      output.skills[id].layers[key]={...previous.layers?.[key],...override};
    }
  }
  return output;
}
function describeResource(source, stage, path, output, resources, seen, depth=0){
  if(depth>4||output.length>=80||seen.has(path))return;
  const resource=resources[path]||resources[path?.toLowerCase()];
  if(!resource)return;
  const next=new Set(seen);next.add(path);
  const add=(kind,record,index)=>{
    const rawSize=kind==='part'?first(record.keys,{}).s:record.sizes;
    const size=Array.isArray(rawSize)?rawSize:[1,1,1];
    const color=kind==='part'?first(record.keys,{}).c:first(record.colors,[1,1,1,1]);
    output.push({
      id:stage+':'+path+':'+kind+':'+index,
      stage,source:path,
      model:String(record.model||'RectPlane'),
      texture:tex(record.texture),
      kind,
      label:path+' · '+(kind==='strip'?'Faixa':kind==='part'?'Modelo':'Partícula')+' '+(index+1),
      size:[Math.abs(num(size[0]||1)),Math.abs(num(size[1]||size[0]||1))],
      rgb:baseRgb(color),offset:vec(record.offset||first(record.keys,{}).p),
      delay:num(record.delay),life:clamp(record.life||first(record.keys,{}).d,0.1,6,1),
      count:kind==='strip'?1:Math.max(1,Math.floor(num(record.count)||1)),
      billboard:record.billboard!==false,
      blend:Number(record.dst??2),
      strip:kind==='strip',
      spin:0
    });
  };
  if(resource.kind==='par'){
    for(const [i,item] of (resource.systems||[]).entries()){
      if(output.length>=80)break;
      const nested=String(item.model||'');
      // Um PAR pode carregar outro EFF; preservar ambos apenas se há textura real.
      if(nested.toLowerCase().endsWith('.eff')&&resources[nested]){
        describeResource(nested,stage,nested,output,resources,next,depth+1);
      } else if(tex(item.texture))add('particle',item,i);
    }
    for(const [i,item] of (resource.strips||[]).entries()){
      if(tex(item.texture))add('strip',{...item,sizes:[1,1],colors:[item.color],count:1},i);
    }
  }else if(resource.kind==='eff'){
    for(const [i,item] of (resource.parts||[]).entries()){
      if(tex(item.texture))add('part',item,i);
    }
  }
}
export function compileSkillLayers(manifest,skillId,{maxLayers=48}={}){
  const record=manifest?.skills?.[String(skillId)],resources=manifest?.resources||{};
  if(!record)return [];
  if(Array.isArray(record.layers))return record.layers.slice(0,maxLayers).map((x,i)=>({
    ...x,id:x.id||('legacy:'+skillId+':'+i),stage:x.stage||'target',
    label:x.label||('Camada '+(i+1)),source:x.source||'legacy',
    size:x.size?.[0]&&Array.isArray(x.size[0])?x.size[0]:x.size||[1,1],
    rgb:x.rgb||x.color?.[0]||[1,1,1,1],life:x.life||1,
    offset:x.offset||[0,0,0],model:x.model||'RectPlane',count:x.count||1
  }));
  const layers=[];
  for(const channel of record.channels||[]){
    for(const visual of channel.visual||[]){
      const models=visual.kind==='magic'?visual.models||[]:[visual];
      for(const node of models){
        for(const name of node.files||[]){
          describeResource(name,channel.kind,name,layers,resources,new Set());
          if(layers.length>=maxLayers)return layers.slice(0,maxLayers);
        }
        if(typeof node.result==='string'){
          describeResource(node.result,'target',node.result,layers,resources,new Set());
        }
      }
    }
  }
  const counter=new Map();
  for(const layer of layers){
    const n=counter.get(layer.id)||0;counter.set(layer.id,n+1);
    if(n)layer.id+=':'+n;
  }
  return layers.slice(0,maxLayers);
}
export function layerSettings(preset,layer){
  return {...LAYER_DEFAULTS,...preset?.layers?.[layer.id]};
}
