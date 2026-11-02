export const TEXTURE_SIGNAL='topweb_texture_library_v1';
export const TEXTURE_DB='topweb_textures_v1';
export const MAX_TEXTURE_CHARS=24*1024*1024;
export const validTextureId=id=>typeof id==='string'&&!id.includes('..')&&
  (/^terrain:(?:[0-5]?\d|6[0-3])$/.test(id)||/^(?:image:assets\/[\w./ -]+\.(?:png|jpe?g|webp)|glb:assets\/[\w./ -]+\.glb#\d{1,4})$/i.test(id));
export function textureQuality(value={}){
  return {cellSize:value.cellSize===512?512:256,atlas:value.atlas==='light'?'light':'lossless',filter:value.filter==='pixel'?'pixel':'smooth',
    anisotropy:[1,2,4,8,16].includes(value.anisotropy)?value.anisotropy:4};
}
export function parseTextureEntry(value){
  if(!value||!validTextureId(value.id)||typeof value.data!=='string'||value.data.length>MAX_TEXTURE_CHARS||
     !/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value.data))throw Error('Textura inválida. Use PNG, JPEG ou WebP.');
  const width=Number(value.width),height=Number(value.height);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048)throw Error('A textura deve ter até 2048 × 2048 pixels.');
  return {id:value.id,data:value.data,width,height};
}
export function parseTexturePack(raw){
  const value=typeof raw==='string'?JSON.parse(raw):raw;
  if(value?.version!==1||!Array.isArray(value.entries)||value.entries.length>256)throw Error('Pacote de texturas inválido.');
  const entries=value.entries.map(parseTextureEntry);
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('Pacote contém texturas repetidas.');
  if(entries.reduce((size,e)=>size+e.data.length,0)>96*1024*1024)throw Error('Pacote grande demais. Exporte em partes.');
  return {version:1,entries,quality:textureQuality(value.quality)};
}
export function textureAssetPath(url,root=new URL('../',import.meta.url)){
  const value=new URL(url,root);
  return value.origin===root.origin&&value.pathname.startsWith(root.pathname)?decodeURIComponent(value.pathname.slice(root.pathname.length)):null;
}
export function readGlbImage(buffer,index){
  const view=new DataView(buffer);
  if(view.byteLength<28||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw Error('Modelo GLB inválido.');
  const size=view.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,size)));
  const image=json.images?.[index],part=json.bufferViews?.[image?.bufferView];
  if(!part||!['image/png','image/jpeg','image/webp'].includes(image.mimeType))throw Error('Imagem incorporada indisponível.');
  const start=28+size+(part.byteOffset||0),end=start+part.byteLength;
  if(end>buffer.byteLength)throw Error('Imagem GLB truncada.');
  return new Blob([buffer.slice(start,end)],{type:image.mimeType});
}
export function createTextureRepository(indexedDB=globalThis.indexedDB){
  let opening;
  function database(){
    if(!indexedDB)return Promise.reject(Error('Armazenamento indisponível. Exporte o PNG ou JSON para guardar seus ajustes.'));
    return opening??=new Promise((resolve,reject)=>{
      const request=indexedDB.open(TEXTURE_DB,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('entries',{keyPath:'id'});
      request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);
    });
  }
  async function transaction(mode,operation){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('entries',mode),request=operation(tx.objectStore('entries'));
      let result;request.onsuccess=()=>{result=request.result;};
      tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Não foi possível salvar as texturas.'));
    });
  }
  const signal=()=>{try{globalThis.localStorage?.setItem(TEXTURE_SIGNAL,Date.now()+':'+Math.random());}catch{};globalThis.dispatchEvent?.(new Event('topweb-textures-changed'));};
  return {
    list:()=>transaction('readonly',store=>store.getAll()),
    async put(value){const entry=parseTextureEntry(value);await transaction('readwrite',store=>store.put(entry));signal();return entry;},
    async remove(id){if(!validTextureId(id))throw Error('Textura inválida.');await transaction('readwrite',store=>store.delete(id));signal();},
    async quality(value){await transaction('readwrite',store=>store.put({id:'@quality',quality:textureQuality(value)}));signal();},
    async import(raw){const pack=parseTexturePack(raw),db=await database();
      await new Promise((resolve,reject)=>{const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');
        for(const entry of pack.entries)store.put(entry);store.put({id:'@quality',quality:pack.quality});
        tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);
      });signal();return pack;
    }
  };
}
