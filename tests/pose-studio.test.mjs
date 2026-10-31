import {LANCE_LAB_DUMMIES,historicalWeaponDummies} from '../js/historical-weapon-dummies.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  POSE_STORAGE_KEY,poseProfile,profileKey,POSE_STATES,
  parsePoseProfiles,readPoseProfiles,savePoseProfiles,
  selectPoseName,weaponDefaults,weaponMeshNodes,availableBones,WeaponHolster
} from '../js/pose-studio-runtime.mjs';
const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('configurações isoladas por personagem/classe e movimentos sem modificar GLB',()=>{
 const raw={version:1,profiles:{
   'lance:crusader':{
     clips:{idle:'Parado',guard:'220 · Combate',attack:'223 · Ataque 1'},
     stowOnIdle:true,weapons:{'weapon-0':{
       bone:'Osso 13 · Bip01 Spine1',position:[.2,0,.1],rotation:[0,0,40],scale:1.1}}},
   'ami:cleric':{clips:{run:'59 · Correr'},stowOnIdle:false,weapons:{}}
 }};
 const out=parsePoseProfiles(raw);
 assert.equal(profileKey('lance','crusader'),'lance:crusader');
 assert.equal(poseProfile(out,'lance','crusader').weapons['weapon-0'].position[0],.2);
 assert.equal(poseProfile(out,'ami','cleric').stowOnIdle,false);
 assert.equal(POSE_STATES.length,5);
});
test('clipes só podem apontar para ações realmente carregadas e têm fallback',()=>{
 const clips=[{name:'1 · Parado'},{name:'5 · Correr'},{name:'7 · Ataque 1'},{name:'220 · Combate'}];
 assert.equal(selectPoseName('idle',null,clips),'1 · Parado');
 assert.equal(selectPoseName('guard',null,clips),'220 · Combate');
 assert.equal(selectPoseName('armedRun',null,clips),'5 · Correr');
 assert.equal(selectPoseName('attack',null,clips),'7 · Ataque 1');
 const p={clips:{attack:'220 · Combate',run:'Não existe'}};
 assert.equal(selectPoseName('attack',p,clips),'220 · Combate');
 assert.equal(selectPoseName('run',p,clips),'5 · Correr');
});
test('seleciona IDs do banco Crusader sem confundir poses de mesmo nome',()=>{
 const clips=[{name:'001 · Parado'}, {name:'005 · Correr'},
   {name:'004 · Combate'}, {name:'007 · Ataque 1'},
   {name:'163 · Parado'}, {name:'166 · Combate'},
   {name:'167 · Correr'}, {name:'168 · Correr armado'},
   {name:'169 · Ataque 1'}];
 assert.equal(selectPoseName('idle',null,clips,3),'163 · Parado');
 assert.equal(selectPoseName('run',null,clips,3),'167 · Correr');
 assert.equal(selectPoseName('guard',null,clips,3),'166 · Combate');
 assert.equal(selectPoseName('armedRun',null,clips,3),'168 · Correr armado');
 assert.equal(selectPoseName('attack',null,clips,3),'169 · Ataque 1');
 assert.equal(selectPoseName('run',null,clips,0),'005 · Correr');
 assert.equal(selectPoseName('run',{clips:{run:'005 · Correr'}},clips,3),'005 · Correr');
 assert.equal(selectPoseName('armedRun',null,[{name:'005 · Correr'}],3),'005 · Correr');
});
test('reconhece armas LGO de GLBs antigos e não confunde malhas corporais',()=>{
 const mk=(name,role)=>({isSkinnedMesh:true,skeleton:{bones:[]},name,userData:role?{topRole:role}:{}});
 const body=mk('Parte 4 · 0000560004.lgo');
 const left=mk('Parte 5 · 01010021.lgo');
 const right=mk('Parte 6 · 01010021.lgo');
 const marked=mk('Parte 4 · 999999.lgo','weapon');
 const avatar={traverse(fn){[body,right,left,marked].forEach(fn)}};
 assert.deepEqual(weaponMeshNodes(avatar).map(x=>x.name),[
   'Parte 4 · 999999.lgo','Parte 5 · 01010021.lgo','Parte 6 · 01010021.lgo'
 ]);
});


test('GLTFLoader: reconhece dois grupos de equipamento, cada um com duas submalhas',()=>{
 const bone={isBone:true,name:'Osso 4 · Bip01 Spine',
   add(o){o.parent=this},remove(o){o.parent=null}};
 const geom=()=>({getAttribute(k){
   if(k==='skinIndex')return {count:1,getX:()=>0};
   if(k==='skinWeight')return {count:1,getX:()=>1};
   return null;
 },clone(){return {
   applyMatrix4(){},computeBoundingBox(){this.boundingBox={getCenter(v){return v}}},
   translate(){},dispose(){}
 }}});
 const mesh=name=>({
   name,isSkinnedMesh:true,isMesh:true,geometry:geom(),
   skeleton:{bones:[bone],boneInverses:[{}]},bindMatrix:{},material:{},
   visible:true,userData:{}
 });
 const makeGroup=(slot,index)=>({
   name:'Parte_'+index+'__01010021_lgo',userData:{topRole:'weapon',equipmentSlot:slot},
   children:[mesh('primitive_'+index+'_0'),mesh('primitive_'+index+'_1')],
   visible:true,
   traverse(fn){fn(this);this.children.forEach(fn)}
 });
 const left=makeGroup(6,5),right=makeGroup(9,6);
 const root={
   traverse(fn){fn(this);left.traverse(fn);right.traverse(fn);fn(bone)},
   getObjectByName(name){return name===bone.name?bone:null}
 };
 const matches=weaponMeshNodes(root);
 assert.deepEqual(matches,[left,right]);
 const THREE={
   Matrix4:class{multiplyMatrices(){return this}},
   Vector3:class{constructor(){this.x=0;this.y=0;this.z=0}},
   Mesh:class{constructor(g,m){this.geometry=g;this.material=m;this.visible=true}},
   Group:class{constructor(){
     this.position={set(){}};this.rotation={set(){},order:''};
     this.scale={setScalar(){}}}
     add(o){(this.children??=[]).push(o);o.parent=this}
     updateMatrixWorld(){}
   }
 };
 const holster=new WeaponHolster(THREE,root,'hunter',{stowOnIdle:true,weapons:{}},'lance');
 assert.equal(holster.parts.length,2);
 assert.deepEqual(holster.parts.map(p=>p.views.length),[2,2]);
 holster.setStowed(true,'idle');
 assert.equal(left.visible,false);
 assert.equal(right.visible,false);
 assert.equal(holster.parts[0].holder.visible,true);
 holster.setStowed(false,'guard');
 assert.equal(left.visible,true);
 assert.equal(right.visible,true);
 holster.dispose();
});

test('GLB publicado possui duas peças compostas e sockets completos',()=>{
 const data=readFileSync(new URL('../assets/equipment/models/lance-crusader.glb',import.meta.url));
 assert.equal(data.subarray(0,4).toString('utf8'),'glTF');
 const jsonSize=data.readUInt32LE(12);
 const gltf=JSON.parse(data.subarray(20,20+jsonSize).toString('utf8'));
 const weapons=gltf.nodes.filter(node=>node.extras?.topRole==='weapon');
 assert.equal(weapons.length,2);
 assert.deepEqual(weapons.map(node=>node.extras.equipmentSlot).sort(),[6,9]);
 assert.deepEqual(weapons.map(node=>gltf.meshes[node.mesh].primitives.length),[2,2]);
 for(const n of [6,9,21,22]){
   assert.ok(gltf.nodes.some(node=>node.extras?.topDummy===n),'Dummy '+n+' não exportado');
 }
});

test('salvar localmente preserva manifesto shipped e preferências por perfil',()=>{
 const db=new Map();
 const storage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v)};
 const shipped={version:1,profiles:{'lance:crusader':{clips:{idle:'Teste'},weapons:{}}}};
 assert.equal(poseProfile(readPoseProfiles(storage,shipped),'lance','crusader').clips.idle,'Teste');
 const newProfile={version:1,profiles:{'ami:cleric':{clips:{attack:'7 · Ataque 1'},weapons:{}}}};
 savePoseProfiles(newProfile,storage);
 const merged=readPoseProfiles(storage,shipped);
 assert.ok(db.has(POSE_STORAGE_KEY));
 assert.ok(poseProfile(merged,'ami','cleric'));
 assert.ok(poseProfile(merged,'lance','crusader'));
 assert.throws(()=>parsePoseProfiles({version:3,profiles:{}}));
});
test('valores incorretos de arma e clipe são normalizados no import',()=>{
 const data=parsePoseProfiles({version:1,profiles:{'lance:crusader':{
   clips:{idle:33,run:'Correr'},
   weapons:{'weapon-0':{bone:'Bip01 Spine',position:['9',-999,'nan'],rotation:[90,900,0],scale:70}}
 }}});
 const x=data.profiles['lance:crusader'];
 assert.deepEqual(x.weapons['weapon-0'].position,[9,-360,0]);
 assert.deepEqual(x.weapons['weapon-0'].rotation,[90,360,0]);
 assert.equal(x.weapons['weapon-0'].scale,5);
 assert.equal(x.clips.idle,undefined);
});
test('reconhece somente partes weapon de GLB e ossos da cena',()=>{
 const nodes=[
 {isSkinnedMesh:true,skeleton:{bones:[]},name:'Parte 6 · weapon'},
 {isSkinnedMesh:true,skeleton:{bones:[]},name:'Parte 5 · weapon'},
 {isSkinnedMesh:true,skeleton:{bones:[]},name:'Parte 4 · chest'},
 {isBone:true,name:'Osso 2 · Bip01 Spine'},
 {isBone:true,name:'Osso 3 · Bip01 Pelvis'}
 ];
 const avatar={traverse(fn){for(const node of nodes)fn(node)}};
 assert.deepEqual(weaponMeshNodes(avatar).map(n=>n.name),['Parte 5 · weapon','Parte 6 · weapon']);
 assert.equal(availableBones(avatar).length,2);
 assert.match(weaponDefaults('crusader',0,availableBones(avatar)).bone,/Spine/);
 assert.match(weaponDefaults('sharpshooter',0,availableBones(avatar)).bone,/Pelvis/);
});
test('arma original reaparece no combate e cópia guardada fica oculta',()=>{
 const root={children:[],add(o){this.children.push(o);o.parent=this},getObjectByName(n){return bone.name===n?bone:null},traverse(fn){fn(mesh);fn(bone)}};
 const bone={isBone:true,name:'Osso 2 · Bip01 Spine',add(o){o.parent=this},remove(o){o.parent=null}};
 const geom={getAttribute(k){return k==='skinIndex'?{count:1,getX:()=>0}:k==='skinWeight'?{count:1,getX:()=>1}:null},
   clone(){return {applyMatrix4(){},computeBoundingBox(){this.boundingBox={getCenter:v=>v}},translate(){},dispose(){}}}};
 const mesh={isSkinnedMesh:true,name:'Parte 5 · weapon',geometry:geom,
   skeleton:{bones:[bone],boneInverses:[{}]},bindMatrix:{},material:{},visible:true};
 const THREE={
   Matrix4:class{multiplyMatrices(){return this}},
   Vector3:class{constructor(){this.x=0;this.y=0;this.z=0}},
   Mesh:class{constructor(g,m){this.geometry=g;this.material=m}},
   Group:class{constructor(){this.position={set(){}},this.rotation={set(){},order:''},this.scale={setScalar(){}}}add(o){o.parent=this}updateMatrixWorld(){}}
 };
 const holster=new WeaponHolster(THREE,root,'crusader',{stowOnIdle:true,weapons:{}});
 assert.equal(holster.parts.length,1);
 holster.setStowed(true);
 assert.equal(mesh.visible,false);
 assert.equal(holster.parts[0].holder.visible,true);
 holster.setStowed(false);
 assert.equal(mesh.visible,true);
 assert.equal(holster.parts[0].holder.visible,false);
 holster.dispose();
 assert.equal(mesh.visible,true);
});
test('overrides de arma são independentes do clip e preservados no JSON',()=>{
 const raw={version:1,profiles:{'lance:crusader':{
   clips:{idle:'163 · Parado'},stowOnIdle:true,weapons:{},
   placements:{idle:{'weapon-0':'hidden','weapon-1':'back'},
     guard:{'weapon-0':'hand','weapon-1':'hidden'},run:{'weapon-0':'auto'},
     attack:{'weapon-0':'invalid','wrong':'back'}}
 }}};
 const profile=parsePoseProfiles(raw).profiles['lance:crusader'];
 assert.equal(profile.placements.idle['weapon-0'],'hidden');
 assert.equal(profile.placements.idle['weapon-1'],'back');
 assert.equal(profile.placements.attack?.['weapon-0'],undefined);
 assert.equal(profile.placements.attack?.wrong,undefined);
 assert.equal(profile.clips.idle,'163 · Parado');
 const db={setItem(k,v){this[k]=v}};
 savePoseProfiles(raw,db);
 assert.equal(JSON.parse(db[POSE_STORAGE_KEY]).profiles['lance:crusader'].placements.guard['weapon-1'],'hidden');
});
test('ocultar arma funciona sem rigid skin, inclusive se não houver cópia para costas',()=>{
 const mesh={isSkinnedMesh:true,name:'Parte 5 · weapon',
   geometry:{getAttribute(){return null}},skeleton:{bones:[],boneInverses:[]},
   visible:true,userData:{}};
 const avatar={traverse(fn){fn(mesh)}};
 const holster=new WeaponHolster({},avatar,'crusader',{
   stowOnIdle:true,placements:{idle:{'weapon-0':'hidden'},guard:{'weapon-0':'back'}},
   weapons:{}},'lance');
 assert.equal(holster.parts.length,1);
 assert.match(holster.parts[0].issue,/rigidamente/);
 holster.setStowed(false,'idle');
 assert.equal(mesh.visible,false);
 holster.setStowed(false,'guard');
 assert.equal(mesh.visible,false);
 assert.match(holster.parts[0].visualStatus,/Não foi possível/);
 holster.setStowed(false,'attack');
 assert.equal(mesh.visible,true);
 holster.dispose();
 assert.equal(mesh.visible,true);
});
test('encaixes históricos no Lance provêm do LAB e mantêm cada mão na espada certa',()=>{
 const left=historicalWeaponDummies('lance','crusader',6);
 const right=historicalWeaponDummies('lance','crusader',9);
 assert.equal(left.hand.parent,18);
 assert.equal(left.back.parent,4);
 assert.equal(left.back,LANCE_LAB_DUMMIES[22]);
 assert.equal(right.hand.parent,26);
 assert.equal(right.back,LANCE_LAB_DUMMIES[21]);
 assert.notDeepEqual(left.back.matrix,right.back.matrix);
 assert.equal(historicalWeaponDummies('phyllis','crusader',6),null);
 assert.equal(historicalWeaponDummies('lance','hunter',6),null);
 for(const dummy of Object.values(LANCE_LAB_DUMMIES)){
   assert.equal(dummy.matrix.length,16);
   assert.equal(dummy.matrix[15],1);
 }
});
test('arma guardada usa matriz do dummy das costas e não valores inventados na coluna',()=>{
 const back={name:'Osso 4 · Spine',isBone:true,add(o){o.parent=this},remove(o){o.parent=null}};
 const leftHand={name:'Osso 18 · LeftHand',isBone:true};
 const bones=Array.from({length:27},(_,i)=>({isBone:true,name:'Bone '+i}));
 bones[4]=back;bones[18]=leftHand;
 const matrices=Array.from({length:27},(_,i)=>({inverseIndex:i}));
 const ops=[];
 const geom={getAttribute:k=>k==='skinIndex'?{count:1,getX:()=>18}:
   k==='skinWeight'?{count:1,getX:()=>1}:null,
   clone(){return {applyMatrix4(m){ops.push(['geometry',m.from||''])},dispose(){}}}};
 const mesh={isSkinnedMesh:true,name:'Parte 5 · 01010021.lgo',geometry:geom,
   skeleton:{bones,boneInverses:matrices},material:{},visible:true,userData:{}};
 const root={traverse(fn){fn(mesh);for(const bone of bones)fn(bone)},
   getObjectByName(name){return bones.find(x=>x.name===name)}};
 const THREE={
  Matrix4:class{
    fromArray(values){this.from=values;return this}
    invert(){ops.push(['invert',this.from]);return this}
    multiplyMatrices(a,b){ops.push(['holder',a,b.from]);return this}
    decompose(){return this}
  },
  Mesh:class{constructor(g,m){this.geometry=g;this.material=m}},
  Group:class{constructor(){
    this.position={set(){}};
    this.quaternion={};
    this.rotation={set(){},order:'XYZ'};
    this.scale={setScalar(){}};
    this.matrix=new THREE.Matrix4();
   }
   add(o){o.parent=this}
   updateMatrixWorld(){}
  }
 };
 const oldProfile={stowOnIdle:true,weapons:{'weapon-0':{
   bone:'Osso 2 · Spine',position:[.19,.03,.11],rotation:[0,0,40],scale:1
 }}};
 const holster=new WeaponHolster(THREE,root,'crusader',oldProfile,'lance');
 assert.equal(oldProfile.weapons['weapon-0'].anchor,'historical');
 assert.deepEqual(oldProfile.weapons['weapon-0'].position,[0,0,0]);
 const encoded=parsePoseProfiles({version:1,profiles:{'lance:crusader':oldProfile}});
 assert.equal(encoded.profiles['lance:crusader'].weapons['weapon-0'].anchor,'historical');
 assert.equal(holster.parts.length,1);
 assert.equal(holster.parts[0].historical.slot,6);
 assert.equal(holster.parts[0].holder.parent,back);
 assert.deepEqual(holster.defaultSettings(holster.parts[0]).position,[0,0,0]);
 assert.equal(ops.find(x=>x[0]==='invert')[1],LANCE_LAB_DUMMIES[6].matrix);
 assert.equal(ops.find(x=>x[0]==='holder')[1],matrices[4]);
 assert.equal(ops.find(x=>x[0]==='holder')[2],LANCE_LAB_DUMMIES[22].matrix);
 holster.setStowed(true);
 assert.equal(mesh.visible,false);
 holster.setStowed(false);
 assert.equal(mesh.visible,true);
 holster.dispose();
});

test('GLB reconstruído usa diretamente o nó animado TOP Dummy 22, sem duplicar inverseBind',()=>{
 const bones=Array.from({length:27},(_,i)=>({isBone:true,name:'Bone '+i}));
 const socket={name:'TOP Dummy 22',children:[],add(o){o.parent=this;this.children.push(o)},remove(o){this.children=this.children.filter(child=>child!==o);o.parent=null}};
 const calls=[];
 const geom={getAttribute(k){return k==='skinIndex'?{count:1,getX:()=>18}:
   k==='skinWeight'?{count:1,getX:()=>1}:null},
   clone(){return {applyMatrix4(m){calls.push('inverseHand');return this},dispose(){}}}};
 const sword={isSkinnedMesh:true,name:'Parte 5 · 01010021.lgo',
   geometry:geom,skeleton:{bones,boneInverses:bones.map(()=>({}))},
   bindMatrix:{},material:{},userData:{equipmentSlot:6},visible:true};
 const root={
   traverse(fn){fn(sword);for(const bone of bones)fn(bone);fn(socket)},
   getObjectByName(name){return name===socket.name?socket:bones.find(b=>b.name===name)}
 };
 const THREE={
   Matrix4:class{fromArray(){return this}invert(){return this}
     multiplyMatrices(){calls.push('legacySocketMultiply');return this}},
   Mesh:class{constructor(geometry,material){this.geometry=geometry;this.material=material}},
   Group:class{constructor(){this.position={set(){}};
     this.rotation={set(){},order:''};this.scale={setScalar(){}};
     this.matrix={multiplyMatrices(){calls.push('oldHolderMatrix')},decompose(){}}}
     add(o){o.parent=this}updateMatrixWorld(){}}
 };
 const holster=new WeaponHolster(THREE,root,'crusader',{stowOnIdle:true,weapons:{}},'lance');
 assert.equal(holster.parts.length,1);
 assert.equal(holster.parts[0].socketNode,socket);
 assert.equal(holster.parts[0].holder.parent,socket);
 assert.equal(holster.defaultSettings(holster.parts[0]).bone,'TOP Dummy 22');
 assert.ok(calls.includes('inverseHand'));
 assert.ok(!calls.includes('oldHolderMatrix'));
 holster.setStowed(true);
 assert.equal(sword.visible,false);
 holster.setStowed(false);
 assert.equal(sword.visible,true);
 holster.dispose();
});

test('jogo/editor usam o mesmo módulo e editor permite exportação para arquivo versionado',()=>{
 const game=file('js/main.js'),page=file('tests/pose-editor.html'),editor=file('tests/pose-editor.mjs');
 assert.match(game,/new WeaponHolster\(THREE,avatar,hero\.job,activePoseProfile,id\)/);
 assert.match(game,/weaponHolster\?\.setStowed\(!combat\?\.auto/);
 assert.match(game,/poseResolvedName\(match\)/);
 assert.match(game,/function isRunningPose\(\)/);
 assert.match(game,/\['run','armedRun'\]\.some\(state=>selectPoseName/);
 assert.match(game,/combat\?\.stop\(\); \/\/ Trocar de guarda para descanso/);
 assert.match(page,/id="actor"/);
 assert.match(page,/id="clip"/);
 assert.match(page,/id="part"/);
 assert.match(page,/id="bone"/);
 assert.match(page,/id="timeline"/);
 assert.match(editor,/savePoseProfiles\(store\)/);
 assert.match(editor,/a\.download='overrides\.json'/);
 assert.match(page,/data-weapon-view="hidden"/);
 assert.match(page,/data-weapon-view="back"/);
 assert.match(page,/id="weapon-mode"/);
 assert.match(page,/id="weapon-diagnostics"/);
 assert.ok(editor.includes('setWeaponMode(part.key'));
 assert.ok(editor.includes('holster.setStowed(stowed,selectedState)'));
 assert.ok(game.includes('weaponHolster?.setStowed(!combat?.auto&&!weaponAttackState,weaponPoseState)'));
 assert.match(file('index.html'),/tests\/pose-editor\.html/);
});
