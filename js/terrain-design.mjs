import {distanceToStroke,strokeBounds,intersectsBounds} from './terrain-strokes.mjs';
export const TERRAIN_DESIGN_KEY='topweb_terrain_design_v1';
export const NATURAL_TILES=new Set([5,6,7,8,9,10,11,12,14,15,16,17,18,19,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38,39,40,41,42,43,44,45,46]);
export const DEFAULT_TERRAIN_DESIGN={version:1,map:'garner',blend:.55,tiles:{},strokes:[]};
const validKey=key=>/^\d{1,4}\/\d{1,4}$/.test(key)&&key.split('/').every(n=>Number(n)<4096);
export function normalizeTerrainDesign(raw){
  if(raw?.version!==1||raw.map!=='garner'||!raw.tiles||typeof raw.tiles!=='object'||Array.isArray(raw.tiles))throw Error('Projeto de terreno inválido.');
  const blend=raw.blend??.32;
  if(typeof blend!=='number'||!Number.isFinite(blend)||blend<0||blend>1)throw Error('Transição deve estar entre 0 e 1 m.');
  const entries=Object.entries(raw.tiles);
  if(entries.length>20000)throw Error('Limite de 20.000 quadrados editados.');
  const tiles={};
  for(const [key,tile] of entries){
    if(!validKey(key)||!tile||typeof tile!=='object'||Array.isArray(tile))throw Error('Coordenada de terreno inválida.');
    const patch={};
    if(tile.softness!==undefined){if(!Number.isFinite(tile.softness)||tile.softness<0||tile.softness>1)throw Error('Suavidade local inválida.');patch.softness=tile.softness;}
    if(tile.tex!==undefined){if(!Number.isInteger(tile.tex)||tile.tex<1||tile.tex>49)throw Error('Textura inválida.');patch.tex=tile.tex;}
    if(tile.grass!==undefined){
      const g=tile.grass;
      if(g===null)patch.grass=null;
      else{
        if(!g||typeof g!=='object'||!Number.isFinite(g.height)||g.height<.1||g.height>1.2||!Number.isFinite(g.density)||g.density<.1||g.density>1||!/^#[\da-f]{6}$/i.test(g.color))throw Error('Grama inválida.');
        patch.grass={height:g.height,density:g.density,color:g.color};
      }
    }
    if(Object.keys(patch).length)tiles[key]=patch;
  }
  const strokes=raw.strokes??[];
  if(!Array.isArray(strokes)||strokes.length>2000)throw Error('Limite de 2.000 traços.');
  let pointCount=0;
  const validated=strokes.map(stroke=>{
    if(!stroke||!['texture','path','grass','erase-grass'].includes(stroke.tool)||!Number.isFinite(stroke.radius)||stroke.radius<.03||stroke.radius>8||!Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>4096)throw Error('Traço inválido.');
    pointCount+=stroke.points.length;
    const points=stroke.points.map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(n=>Number.isFinite(n)&&n>=0&&n<4096))throw Error('Ponto fora de Garner.');return [...p];});
    const result={tool:stroke.tool,radius:stroke.radius,points};
    if(['texture','path'].includes(stroke.tool)){
      if(!Number.isInteger(stroke.tex)||stroke.tex<1||stroke.tex>49||!['left','right','both','none','top','bottom'].includes(stroke.edge)||!Number.isFinite(stroke.feather)||stroke.feather<0||stroke.feather>1||!Number.isFinite(stroke.opacity)||stroke.opacity<.05||stroke.opacity>1)throw Error('Borda de traço inválida.');
      Object.assign(result,{tex:stroke.tex,edge:stroke.edge,feather:stroke.feather,opacity:stroke.opacity});
    }else if(stroke.tool==='grass'){
      const g=stroke.grass;
      if(!g||!Number.isFinite(g.height)||g.height<.1||g.height>1.2||!Number.isFinite(g.density)||g.density<.1||g.density>1||!/^#[\da-f]{6}$/i.test(g.color))throw Error('Grama inválida.');
      result.grass={height:g.height,density:g.density,color:g.color};
    }
    return result;
  });
  if(pointCount>100000)throw Error('Limite de 100.000 pontos por projeto.');
  return {version:1,map:'garner',blend,tiles,strokes:validated};
}
export function readTerrainDesign(fallback=DEFAULT_TERRAIN_DESIGN,storage=globalThis.localStorage){
  try{const raw=storage.getItem(TERRAIN_DESIGN_KEY);return raw?normalizeTerrainDesign(JSON.parse(raw)):structuredClone(fallback);}catch{return structuredClone(fallback);}
}
export function terrainVisualTile(base,x,z,design){
  const patch=design.tiles[`${Math.floor(x)}/${Math.floor(z)}`];
  return base&&patch?.tex!==undefined?{...base,tex:patch.tex}:base;
}
export function brushTiles(x,z,radius){
  if(![x,z,radius].every(Number.isFinite))return [];
  const r=Math.max(0,Math.min(8,Math.floor(radius))),cx=Math.floor(x),cz=Math.floor(z),tiles=[];
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    const px=cx+dx,pz=cz+dz;
    if(dx*dx+dz*dz<=r*r&&px>=0&&pz>=0&&px<4096&&pz<4096)tiles.push([px,pz]);
  }
  return tiles;
}
// One patch per square; visual editing never changes collision, height or region.
export function paintTerrainDesign(design,points,tool,{tex=9,height=.45,density=.6,color='#648940'}={},tileAt=()=>null){
  const before={};
  for(const [x,z] of points){
    const base=tileAt(x,z);if(!base)continue;
    const key=`${x}/${z}`,old=design.tiles[key];before[key]=old?structuredClone(old):null;
    const patch={...old};
    if(tool==='restore')delete design.tiles[key];
    else if(tool==='texture'){patch.tex=tex;design.tiles[key]=patch;}
    else if(tool==='grass'&&(base.region&1)&&base.height>=0){patch.grass={height,density,color};design.tiles[key]=patch;}
    else if(tool==='erase-grass'){patch.grass=null;design.tiles[key]=patch;}
  }
  return before;
}
export function restoreTerrainPatch(design,patch){for(const [key,value] of Object.entries(patch)){if(value===null)delete design.tiles[key];else design.tiles[key]=structuredClone(value);}}
export function packedTerrainNeighborhood(tileAt,x,z){
  const base=tileAt(x,z),id=base?.tex??0,result=[];
  for(let dz=-1;dz<=1;dz++){
    let packed=0;
    for(let dx=-1;dx<=1;dx++){
      const tile=tileAt(x+dx,z+dz);
      const next=NATURAL_TILES.has(id)&&tile&&(tile.region&1)&&NATURAL_TILES.has(tile.tex)?tile.tex:id;
      packed+=next*64**(dx+1);
    }
    result.push(packed);
  }
  return result;
}
export function grassInstances(design,tileAt,x0,z0,w,h,limit=512){
  const result=[];
  const random=(x,z,n)=>{let v=Math.imul(x+17,73856093)^Math.imul(z+31,19349663)^Math.imul(n+1,83492791);v=Math.imul(v^(v>>>16),2246822507);return (v>>>0)/4294967296;};
  // Coordinate order makes placement stable after save/reload and chunk rebuilds.
  for(let z=z0;z<z0+h;z++)for(let x=x0;x<x0+w;x++){
    const grass=design.tiles[`${x}/${z}`]?.grass,tile=tileAt(x,z);
    if(!grass||!tile||!(tile.region&1)||tile.height<0)continue;
    const count=Math.ceil(grass.density*6);
    for(let i=0;i<count;i++)result.push({x:x+.08+random(x,z,i*3)*.84,z:z+.08+random(x,z,i*3+1)*.84,yaw:random(x,z,i*3+2)*Math.PI*2,...grass,rank:random(x,z,100+i)});
  }
  const bounds={x0,z0,x1:x0+w,z1:z0+h};
  const strokes=(design.strokes||[]).filter(s=>['grass','erase-grass','path'].includes(s.tool)&&intersectsBounds(strokeBounds(s),bounds));
  function grassAt(x,z){let value;for(const s of strokes)if(distanceToStroke(x,z,s)<=s.radius)value=s.tool==='grass'?s.grass:null;return value;}
  for(let i=result.length-1;i>=0;i--)if(grassAt(result[i].x,result[i].z)===null)result.splice(i,1);
  if(strokes.some(s=>s.tool==='grass')){
    const planted=strokes.filter(s=>s.tool==='grass').map(strokeBounds),step=.2;
    const minX=Math.max(x0,Math.min(...planted.map(b=>b.x0))),maxX=Math.min(x0+w,Math.max(...planted.map(b=>b.x1)));
    const minZ=Math.max(z0,Math.min(...planted.map(b=>b.z0))),maxZ=Math.min(z0+h,Math.max(...planted.map(b=>b.z1)));
    for(let iz=Math.floor(minZ/step);iz<maxZ/step;iz++)for(let ix=Math.floor(minX/step);ix<maxX/step;ix++){
      const x=(ix+.15+random(ix,iz,1)*.7)*step,z=(iz+.15+random(ix,iz,2)*.7)*step;
      if(x<x0||x>=x0+w||z<z0||z>=z0+h)continue;
      const grass=grassAt(x,z),tile=grass&&tileAt(x,z);
      if(grass&&tile&&(tile.region&1)&&tile.height>=0&&random(ix,iz,3)<grass.density*.45)result.push({x,z,yaw:random(ix,iz,4)*Math.PI*2,...grass,rank:random(ix,iz,5)});
    }
    // A tiny brush still places a tuft exactly at the painted point.
    for(const s of strokes)if(s.tool==='grass'&&s.radius<.2)for(const [x,z] of s.points){const grass=grassAt(x,z),tile=grass&&tileAt(x,z);if(x>=x0&&x<x0+w&&z>=z0&&z<z0+h&&grass&&tile&&(tile.region&1)&&tile.height>=0)result.push({x,z,yaw:random(Math.round(x*100),Math.round(z*100),4)*Math.PI*2,...grass,rank:0});}
  }
  // Cap by a stable spatial sample rather than filling only one end of a chunk.
  if(result.length>limit){result.sort((a,b)=>a.rank-b.rank);result.length=limit;}
  return result;
}
