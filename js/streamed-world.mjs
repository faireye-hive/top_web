export function decodeTerrain(buffer){
  const dv=new DataView(buffer);
  if(buffer.byteLength<20||dv.getUint32(0,true)!==0x31524e47)throw Error('Terreno GNR1 inválido');
  const ox=dv.getUint32(4,true),oz=dv.getUint32(8,true),w=dv.getUint32(12,true),h=dv.getUint32(16,true);
  if(!w||!h||w>4096||h>4096||buffer.byteLength!==20+w*h*7)throw Error('Tamanho de terreno inválido');
  return {ox,oz,w,h,dv};
}
export function terrainTile(sector,x,z){
  const ix=Math.floor(x)-sector.ox,iz=Math.floor(z)-sector.oz;
  if(ix<0||iz<0||ix>=sector.w||iz>=sector.h)return null;
  const at=20+(iz*sector.w+ix)*7,v=sector.dv;
  return {tex:v.getUint8(at),height:v.getInt8(at+1)*.1,rgb:v.getUint16(at+2,true),region:v.getUint16(at+4,true),blocks:v.getUint8(at+6)};
}
export async function fetchTerrain(url,fetcher=fetch){
  const response=await fetcher(url);if(!response.ok)throw Error(`Terreno indisponível (${response.status})`);
  let buffer=await response.arrayBuffer();
  const bytes=new Uint8Array(buffer);
  if(bytes[0]===31&&bytes[1]===139){
    buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  return decodeTerrain(buffer);
}
export async function createStreamedWorld({fetcher=fetch,maxSectors=24,onLoad=()=>{}}={}){
  const response=await fetcher('assets/garner/manifest.json?v=1');
  if(!response.ok)throw Error('Garner original indisponível');
  const manifest=await response.json(),[ox,oz]=manifest.origin,[w,h]=manifest.size,size=manifest.sectorSize;
  if(size!==256||w!==4096||h!==4096)throw Error('Manifesto de Garner inválido');
  const cache=new Map(),pending=new Map(),failed=new Map();let pinned=new Set();
  const keyAt=(x,z)=>`${Math.floor((x-ox)/size)}-${Math.floor((z-oz)/size)}`;
  const inside=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>=ox&&z>=oz&&x<ox+w&&z<oz+h;
  function evict(){
    for(const key of cache.keys())if(cache.size>maxSectors&&!pinned.has(key))cache.delete(key);
  }
  async function load(key){
    if(cache.has(key))return cache.get(key);
    if(pending.has(key))return pending.get(key);
    const [x,z]=key.split('-');
    const task=fetchTerrain(manifest.terrain.replace('{x}',x).replace('{z}',z),fetcher).then(sector=>{
      if(sector.ox!==ox+Number(x)*size||sector.oz!==oz+Number(z)*size||sector.w!==size||sector.h!==size)throw Error('Setor fora da posição esperada');
      cache.set(key,sector);failed.delete(key);evict();onLoad(key);return sector;
    }).catch(error=>{failed.set(key,Date.now());throw error;}).finally(()=>pending.delete(key));
    pending.set(key,task);return task;
  }
  function keysAround(x,z,radius){
    const keys=[];
    for(let sz=Math.floor((Math.max(oz,z-radius)-oz)/size);sz<=Math.floor((Math.min(oz+h-1,z+radius)-oz)/size);sz++)
      for(let sx=Math.floor((Math.max(ox,x-radius)-ox)/size);sx<=Math.floor((Math.min(ox+w-1,x+radius)-ox)/size);sx++)keys.push(`${sx}-${sz}`);
    return keys;
  }
  async function ensureAround(x,z,radius=32){
    if(!inside(x,z))throw Error('Destino fora de Garner');
    const keys=keysAround(x,z,radius);
    await Promise.all(keys.map(key=>load(key)));return true;
  }
  return {ox,oz,w,h,manifest,
    tileAt(x,z){return inside(x,z)&&cache.has(keyAt(x,z))?terrainTile(cache.get(keyAt(x,z)),x,z):null;},
    hasArea(x,z,radius=1){return inside(x,z)&&keysAround(x,z,radius).every(key=>cache.has(key));},
    ensureAround,
    async focus(x,z,radius=256){
      if(!inside(x,z))return;
      const keys=keysAround(x,z,radius);pinned=new Set(keys);evict();
      await Promise.all(keys.filter(key=>!failed.has(key)||Date.now()-failed.get(key)>5000).map(load));
    },
    stats(){return {loaded:cache.size,pending:pending.size,bytes:[...cache.values()].reduce((n,s)=>n+s.dv.byteLength,0),limit:maxSectors};}
  };
}
