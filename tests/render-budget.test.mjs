import test from 'node:test';import assert from 'node:assert/strict';
import {renderBudget,instanceCapacity,resolutionStep} from '../js/render-budget.mjs';
import {createStreamedWorld} from '../js/streamed-world.mjs';
import {readFileSync} from 'node:fs';
test('mobile reduz área de geometria a um quarto sem reduzir Garner',()=>{
  const mobile=renderBudget(true),desktop=renderBudget(false);
  const tiles=b=>(2*b.radius+1)**2*b.chunk**2;
  assert.equal(tiles(mobile)/tiles(desktop),.25);assert.ok(mobile.sectors<desktop.sectors);
  assert.ok(mobile.objects>=40&&mobile.effects<mobile.objects);assert.ok(mobile.particles<desktop.particles);
});
test('buffers de instâncias crescem conforme demanda e encolhem sem truncar objetos',()=>{
  assert.equal(instanceCapacity(1),16);assert.equal(instanceCapacity(33,16),64);
  assert.equal(instanceCapacity(70,64),128);assert.equal(instanceCapacity(100,128),128);
  assert.equal(instanceCapacity(10,512),16);
  for(let n=1;n<1000;n++)assert.ok(instanceCapacity(n,16)>=n);
});
test('qualidade reage a FPS muito baixo e não excede limites',()=>{
  assert.ok(resolutionStep(1,200,1)<1,'5 FPS ainda reduz a resolução');
  assert.equal(resolutionStep(.65,500,1),.65);assert.equal(resolutionStep(1,16,1),1);
  assert.ok(resolutionStep(.7,16,1)>.7);assert.equal(resolutionStep(.8,22,1),.8);
});
test('cache mobile suporta nove setores ativos e um destino distante com quatro setores',async()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/garner/manifest.json',import.meta.url)));
  const world=await createStreamedWorld({maxSectors:renderBudget(true).sectors,fetcher:async url=>{
    if(url.includes('manifest'))return {ok:true,json:async()=>manifest};
    const [,x,z]=url.match(/(\d+)-(\d+)\.gmap/),b=new ArrayBuffer(20+256*256*7),v=new DataView(b);
    [0x31524e47,x*256,z*256,256,256].forEach((n,i)=>v.setUint32(i*4,n,true));return {ok:true,arrayBuffer:async()=>b};
  }});
  await world.focus(640,640,132);await world.ensureAround(3072,3072,36);
  assert.ok(world.hasArea(640,640,132));assert.ok(world.hasArea(3072,3072,20));
  assert.ok(world.stats().loaded<=16);
});
