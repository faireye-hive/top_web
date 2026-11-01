export const MARINE_DESIGN_KEY='topweb_marine_design_v1';
export const DEFAULT_MARINE_DESIGN={version:1,
  boat:{hull:'phantom-galley',scale:3.5,speed:5.3,color:'#ffffff',sailColor:'#f3e4b5',sails:true,wake:1,bob:.6},
  water:{waves:.65,sparkle:.55},tiles:{}};
const number=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const color=(value,fallback)=>/^#[\da-f]{6}$/i.test(value)?value:fallback;
export function normalizeMarineDesign(value){
  if(!value||value.version!==1)throw Error('Projeto da marina inválido');
  const b=value.boat||{},d=DEFAULT_MARINE_DESIGN.boat,w=value.water||{};
  const result={version:1,boat:{
    hull:['guppy','phantom-galley'].includes(b.hull)?b.hull:d.hull,
    scale:number(b.scale,d.scale,.75,5),speed:number(b.speed,d.speed,1,12),
    color:color(b.color,d.color),sailColor:color(b.sailColor,d.sailColor),
    sails:typeof b.sails==='boolean'?b.sails:d.sails,wake:number(b.wake,d.wake,0,2),bob:number(b.bob,d.bob,0,1.5)},
    water:{waves:number(w.waves,.65,0,1.5),sparkle:number(w.sparkle,.55,0,1.5)},tiles:{}};
  const entries=Object.entries(value.tiles||{});
  if(entries.length>50000)throw Error('O projeto aceita até 50.000 tiles editados');
  for(const [key,tile] of entries){
    if(!/^\d{1,4}\/\d{1,4}$/.test(key)||key.split('/').some(n=>Number(n)>4095)||!tile||typeof tile!=='object')throw Error('Coordenada de terreno inválida');
    const patch={};
    for(const [field,min,max] of [['tex',0,63],['height',-12.8,12.7],['region',0,65535],['blocks',0,15]]){
      if(tile[field]!==undefined){
        const v=Number(tile[field]);if(!Number.isFinite(v)||v<min||v>max)throw Error('Valor de terreno inválido');
        patch[field]=field==='height'?Math.round(v*10)/10:Math.round(v);
      }
    }
    result.tiles[key]=patch;
  }
  return result;
}
export function readMarineDesign(storage=globalThis.localStorage){
  try{return normalizeMarineDesign(JSON.parse(storage.getItem(MARINE_DESIGN_KEY)||'null'));}
  catch{return structuredClone(DEFAULT_MARINE_DESIGN);}
}
export function saveMarineDesign(design,storage=globalThis.localStorage){
  const validated=normalizeMarineDesign(design);storage.setItem(MARINE_DESIGN_KEY,JSON.stringify(validated));return validated;
}
export function editedTile(base,x,z,design){
  if(!base)return null;
  const patch=design.tiles[`${Math.floor(x)}/${Math.floor(z)}`];
  return patch?{...base,...patch}:base;
}
export function paintTerrain(design,x,z,radius,tool,height=1){
  x=Math.floor(x);z=Math.floor(z);radius=Math.max(0,Math.min(20,Math.floor(radius)));
  const before={};
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
    const px=x+dx,pz=z+dz;if(dx*dx+dz*dz>radius*radius||px<0||pz<0||px>4095||pz>4095)continue;
    const key=`${px}/${pz}`;before[key]=design.tiles[key]?{...design.tiles[key]}:null;
    const existing=design.tiles[key]||{};
    if(tool==='restore')delete design.tiles[key];
    else if(tool==='water')design.tiles[key]={tex:22,height:-2,region:0,blocks:0};
    else if(tool==='land')design.tiles[key]={tex:8,height:number(height,1,-12.8,12.7),region:1,blocks:0};
    else if(tool==='height')design.tiles[key]={...existing,height:number(height,1,-12.8,12.7)};
    else if(tool==='block')design.tiles[key]={...existing,blocks:15};
    else if(tool==='unblock')design.tiles[key]={...existing,blocks:0};
  }
  return before;
}
