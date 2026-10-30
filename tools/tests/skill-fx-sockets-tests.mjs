import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../js/skill-fx-sockets.mjs',import.meta.url),'utf8')
  .replace(/^import[^\n]+\n/m,'').replace(/export /g,'');
const script=source+'\n({socketRecord,socketFromSkeleton,socketDescription})';
const THREE={
  Matrix4:class{fromArray(a){this.p=a.slice();return this}
    premultiply(b){this.p[12]+=b.p[12];this.p[13]+=b.p[13];this.p[14]+=b.p[14];return this}},
  Vector3:class{x=0;y=0;z=0;
    setFromMatrixPosition(m){this.x=m.p[12];this.y=m.p[13];this.z=m.p[14];return this}}
};
const {socketRecord,socketFromSkeleton,socketDescription}=vm.runInNewContext(script,{THREE,Number,Array});
const matrix=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const manifest={attachments:{lance:{
  actor:{'9':{bone:'R Hand',matrix:matrix(0,0,0)},'2':{bone:'Spine',matrix:matrix(0,.1,.2)}},
  items:{sharpshooter:{'0':{bone:'R Hand',matrix:matrix(.2,.3,.4)},'1':{bone:'R Hand',matrix:matrix(1,2,3)}},
    crusader:{'0':{bone:'R Hand',matrix:matrix(.3,.5,.4)}}}
}}};
assert.equal(socketRecord(manifest,'lance','sharpshooter',
  {channel:'item',dummy:1},{equipped:true}).index,1);
assert.equal(socketRecord(manifest,'lance','sharpshooter',
  {channel:'flight',dummy:9,itemDummy:1},{equipped:true}).source,'item');
assert.equal(socketRecord(manifest,'lance','sharpshooter',
  {channel:'flight',dummy:9,itemDummy:-1},{equipped:true}).source,'actor');
assert.equal(socketRecord(manifest,'lance','sharpshooter',
  {channel:'item',dummy:1},{equipped:false}),null);
assert.equal(socketRecord(manifest,'lance','sharpshooter',
  {channel:'item',dummy:9},{equipped:true}),null,
  'não trocar dummy item ausente por outro osso do personagem');
assert.equal(socketRecord(manifest,'lance','sharpshooter',
  {channel:'target',dummy:2},{equipped:true}),null);
assert.equal(socketDescription(manifest,'lance','sharpshooter',
  {channel:'item',dummy:1},{equipped:true}).bone,'R Hand');
const avatar={getObjectByName(name){return name==='R Hand'?{matrixWorld:{p:matrix(4,0,0)}}:null;},
  updateMatrixWorld(){}};
const root={updateMatrixWorld(){},worldToLocal(p){p.x-=2;return p;}};
const p=socketFromSkeleton({manifest,actor:'lance',job:'sharpshooter',
  layer:{channel:'item',dummy:1},avatar,root,equipped:true});
assert.deepEqual(Array.from(p),[3,2,3]);
assert.equal(socketFromSkeleton({manifest,actor:'lance',job:'sharpshooter',
  layer:{channel:'item',dummy:1},avatar:null,root,equipped:true}),null);

const core=fs.readFileSync(new URL('../../js/skill-fx-core.mjs',import.meta.url),'utf8');
const editor=fs.readFileSync(new URL('../../tests/skill-editor.mjs',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../../js/skill-visuals-runtime.mjs',import.meta.url),'utf8');
assert.match(core,/setSocketResolver\(resolver\)/);
assert.match(core,/socketAt:\(L,tt\)=>/);
assert.match(editor,/assets\/equipment\//);
assert.match(editor,/equip-actor/);
assert.match(runtime,/socketFromSkeleton\(/);
console.log('OK: mapeamento de dummies LAB, rig animado, fallback e integração jogo/editor.');
