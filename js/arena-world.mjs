import {fetchTerrain,terrainTile} from './streamed-world.mjs';
export async function createArenaWorld({fetcher=fetch}={}){
  const response=await fetcher('assets/arena/manifest.json');
  if(!response.ok)throw Error('Mapa da Arena indisponível');
  const manifest=await response.json(),sector=await fetchTerrain(manifest.terrain,fetcher);
  const {ox,oz,w,h}=sector;
  if(w!==96||h!==96||manifest.size[0]!==w||manifest.size[1]!==h)throw Error('Mapa original teampk inválido');
  const inside=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>=ox&&z>=oz&&x<ox+w&&z<oz+h;
  return {ox,oz,w,h,manifest,tileAt:(x,z)=>terrainTile(sector,x,z),hasArea:inside,
    async ensureAround(x,z){if(!inside(x,z))throw Error('Destino fora da Arena');},async focus(){},
    stats:()=>({loaded:1,pending:0,bytes:sector.dv.byteLength,limit:1})};
}
