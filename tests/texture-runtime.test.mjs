import test from 'node:test';import assert from 'node:assert/strict';
import {createTextureRuntime} from '../js/texture-runtime.mjs';
class Source{constructor(data){this.data=data;}}
function texture(source){return {isTexture:true,source,flipY:false,colorSpace:'srgb',offset:{x:.2,y:.4},wrapS:'repeat',magFilter:'linear',minFilter:'mipmap',anisotropy:1,disposals:0,
 get image(){return this.source.data;},dispose(){this.disposals++;}};}
test('substituir imagem mantém UV, alfa, cor e orientação; restauração e alterações ao vivo liberam armazenamento anterior',async()=>{
  const original={width:256,height:256},shared=new Source(original),a=texture(shared),b=texture(shared),replacement={width:512,height:512};
  const id='glb:assets/monsters/models/test.glb#0';let rows=[{id,data:'data:image/png;base64,AAAA',width:512,height:512}];
  const runtime=createTextureRuntime({THREE:{Source,NearestFilter:'nearest'},renderer:{capabilities:{maxTextureSize:4096,getMaxAnisotropy:()=>16}},mobile:true,
    repository:{list:async()=>rows},fetcher:async()=>({ok:true,json:async()=>({version:1,entries:[],quality:{}})}),loadImage:async()=>replacement});
  const associations=new Map([[a,{textures:0}],[b,{textures:1}]]);
  const gltf={parser:{associations,json:{textures:[{source:0},{source:1}]}},scene:{traverse(fn){fn({material:{map:a,alphaMap:b}});}}};
  const loader=runtime.wrapLoader({loadAsync:async()=>gltf});
  await loader.loadAsync('assets/monsters/models/test.glb?v=99');
  assert.equal(a.image,replacement);assert.equal(b.image,original);assert.equal(a.disposals,1);assert.equal(b.disposals,0);
  assert.equal(a.flipY,false);assert.equal(a.colorSpace,'srgb');assert.deepEqual(a.offset,{x:.2,y:.4});assert.equal(a.minFilter,'mipmap');assert.equal(a.anisotropy,4);
  a.needsUpdate=false;await runtime.refresh();assert.equal(a.disposals,1);assert.equal(a.needsUpdate,false,'edição de outro material não reenvia imagens intactas à GPU');
  rows=[];await runtime.refresh();assert.equal(a.image,original);assert.equal(a.source,shared);assert.equal(a.disposals,2);
});
