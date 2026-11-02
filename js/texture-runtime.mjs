import {createTextureRepository,parseTexturePack,textureQuality,textureAssetPath,TEXTURE_SIGNAL} from './texture-library.mjs?v=1';
import {paintAtlasCell} from './terrain-textures.mjs?v=1';

const root=new URL('../',import.meta.url);
export function createTextureRuntime({THREE,renderer,mobile=false,repository=createTextureRepository(),loadImage=browserImage,fetcher=globalThis.fetch,onError=console.warn}){
  let records=new Map(),quality=textureQuality(),published={version:1,entries:[],quality:{}},version=0;
  const states=new WeakMap(),references=new Set(),images=new Map();
  const image=data=>{if(!images.has(data))images.set(data,loadImage(data).catch(error=>{images.delete(data);throw error;}));return images.get(data);};
  function remember(texture,id,extra={}){
    if(!states.has(texture)){
      states.set(texture,{image:texture.image,source:texture.source,magFilter:texture.magFilter,anisotropy:texture.anisotropy,id,...extra});
      references.add(new WeakRef(texture));
    }
  }
  async function updateTexture(texture,revision=version){
    const state=states.get(texture);if(!state)return;
    let next=state.image;
    if(state.id==='@terrain'){
      const source=quality.atlas==='light'?'assets/terrain_atlas.jpg':'assets/textures/terrain-atlas.webp';
      const tiles=[...records.values()].filter(row=>row.id.startsWith('terrain:'));
      const snapshot=tiles.map(row=>[row.id,row.data]),previous=state.terrainSnapshot;
      const same=previous&&state.terrainSource===source&&state.terrainCell===quality.cellSize&&previous.length===snapshot.length&&previous.every((row,i)=>row[0]===snapshot[i][0]&&row[1]===snapshot[i][1]);
      const base=same?null:source===state.asset?state.image:await image(new URL(source,root).href);
      if(same)next=texture.image;
      else if(tiles.length||quality.cellSize!==256){
        const cell=Math.min(quality.cellSize,Math.floor(renderer.capabilities.maxTextureSize/8));
        next=document.createElement('canvas');next.width=next.height=cell*8;
        const ctx=next.getContext('2d');ctx.drawImage(base,0,0,next.width,next.height);
        for(const row of tiles){const replacement=await image(row.data);paintAtlasCell(ctx,replacement,Number(row.id.slice(8)),cell);}
      }else next=base;
      if(revision!==version)return;
      state.terrainSnapshot=snapshot;state.terrainSource=source;state.terrainCell=quality.cellSize;
    }else if(records.has(state.id))next=await image(records.get(state.id).data);
    if(revision!==version)return;
    // Keep UVs, sampler transforms, color space, alpha, flipY and all material
    // settings. A new Source avoids mutating unrelated glTF sampler instances.
    const magFilter=quality.filter==='pixel'?THREE.NearestFilter:state.magFilter;
    const anisotropy=Math.min(quality.anisotropy,mobile?4:16,renderer.capabilities.getMaxAnisotropy());
    const changed=texture.image!==next||texture.magFilter!==magFilter||texture.anisotropy!==anisotropy;
    if(texture.image!==next){
      // Release the previous Source/GPU association before replacing it. This
      // also reallocates immutable WebGL storage when dimensions change.
      texture.dispose();texture.source=next===state.image?state.source:new THREE.Source(next);
    }
    texture.magFilter=magFilter;texture.anisotropy=anisotropy;
    if(changed)texture.needsUpdate=true;
  }
  async function refresh(){
    const revision=++version,local=await repository.list().catch(()=>[]);
    if(revision!==version)return;
    records=new Map(published.entries.map(row=>[row.id,row]));
    for(const row of local)if(row.id!=='@quality')records.set(row.id,row);
    quality=textureQuality(local.find(row=>row.id==='@quality')?.quality??published.quality);
    const needed=new Set([...records.values()].map(row=>row.data));
    for(const key of images.keys())if(key.startsWith('data:')&&!needed.has(key))images.delete(key);
    const work=[];
    for(const weak of references){const texture=weak.deref();if(texture)work.push(updateTexture(texture,revision));else references.delete(weak);}
    const results=await Promise.allSettled(work);for(const result of results)if(result.status==='rejected')onError('Textura editada indisponível:',result.reason);
  }
  const ready=fetcher(new URL('assets/textures/overrides.json',root)).then(r=>r.ok?r.json():published)
    .then(raw=>{published=parseTexturePack(raw);}).catch(error=>onError('Pacote de texturas indisponível:',error)).then(refresh);
  async function applyGltf(gltf,url){
    await ready;const asset=textureAssetPath(url,root);if(!asset)return gltf;
    const textures=new Set();
    gltf.scene.traverse(node=>{for(const material of (Array.isArray(node.material)?node.material:[node.material]))if(material)
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    });
    await Promise.all([...textures].map(async texture=>{
      const index=gltf.parser?.associations.get(texture)?.textures;
      const source=gltf.parser?.json.textures?.[index]?.source;
      if(Number.isInteger(source)){remember(texture,`glb:${asset}#${source}`);await updateTexture(texture);}
    }));return gltf;
  }
  function wrapLoader(loader){const load=loader.loadAsync.bind(loader);loader.loadAsync=async(url,...args)=>applyGltf(await load(url,...args),url);return loader;}
  async function applyImage(texture,url){await ready;const asset=textureAssetPath(url,root);if(asset){remember(texture,'image:'+asset);await updateTexture(texture);}return texture;}
  async function bindTerrain(texture,asset){await ready;remember(texture,'@terrain',{asset});await updateTexture(texture);return texture;}
  const changed=event=>{if(event.type!=='storage'||event.key===TEXTURE_SIGNAL||event.key===null)void ready.then(refresh).catch(error=>onError('Atualização de texturas:',error));};
  globalThis.addEventListener?.('storage',changed);globalThis.addEventListener?.('topweb-textures-changed',changed);
  return {ready,wrapLoader,applyGltf,applyImage,bindTerrain,refresh,get quality(){return quality;},
    get atlasUrl(){return quality.atlas==='light'?'assets/terrain_atlas.jpg':'assets/textures/terrain-atlas.webp';}};
}
export function browserImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Não foi possível abrir a imagem.'));image.src=url;});}
