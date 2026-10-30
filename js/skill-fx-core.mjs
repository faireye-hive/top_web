// skill-fx-core.mjs — núcleo de efeitos PAR/EFF do TOP Web.
// Lê o visuals.json (sistemas de partículas e peças EFF originais), aplica as
// edições do Skill FX Studio e simula tudo de forma DETERMINÍSTICA (dá para
// arrastar a linha do tempo para frente e para trás).
//
// Convenções (iguais ao sources/HistoricalParticleMotion.h):
//  - os dados .par/.eff estão em coordenadas D3D (X,Y horizontais, Z para cima);
//  - na tela convertemos para GL: (x, y, z) -> (x, z, -y);
//  - o curso das curvas segue LegacyParticleCurves.h (o último intervalo segura a última chave).
import * as THREE from 'three';

/* ------------------------------------------------------------------ tabelas */
export const BLEND_NAMES = {1:'ZERO',2:'ONE',3:'SRCCOLOR',4:'INVSRCCOLOR',5:'SRCALPHA',6:'INVSRCALPHA',
  7:'DESTALPHA',8:'INVDESTALPHA',9:'DESTCOLOR',10:'INVDESTCOLOR',11:'SRCALPHASAT'};
export const BLEND_PRESETS = [
  ['Aditivo (SRCALPHA, ONE)',5,2],['Normal (SRCALPHA, INVSRCALPHA)',5,6],['Aditivo puro (ONE, ONE)',2,2],
  ['Cor aditiva (SRCCOLOR, ONE)',3,2],['Multiplica (DESTCOLOR, ZERO)',9,1],['Suave (ONE, INVSRCALPHA)',2,6],
  ['Original 5/7 (SRCALPHA, DESTALPHA)',5,7]];
export const TYPE_NAMES = {1:'1 · Neve (SNOW)',2:'2 · Fogo (FIRE)',3:'3 · Explosão (BLAST)',4:'4 · Ondulação (RIPPLE)',
  5:'5 · Modelo único',6:'6 · Modelo EFF animado',9:'9 · Órbita (ROUND)',12:'12 · Convergir (SHRINK)',
  13:'13 · Sombra no chão (SHADE)',15:'15 · Queda (RANGE2)'};
const MESH_TYPES = new Set([4,5,6,15]);
const BF = {1:THREE.ZeroFactor,2:THREE.OneFactor,3:THREE.SrcColorFactor,4:THREE.OneMinusSrcColorFactor,
  5:THREE.SrcAlphaFactor,6:THREE.OneMinusSrcAlphaFactor,7:THREE.DstAlphaFactor,8:THREE.OneMinusDstAlphaFactor,
  9:THREE.DstColorFactor,10:THREE.OneMinusDstColorFactor,11:THREE.SrcAlphaSaturateFactor};

export const GLOBAL_DEFAULTS = {scale:1,opacity:1,speed:1,particles:400,height:0,distance:3.8,
  castDelay:.35,flightSpeed:0,centerRange:0,duration:5};

/* ----------------------------------------------------------------- utilidades */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=o=>JSON.parse(JSON.stringify(o));
export {clone};
function h32(n){n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return(n^(n>>>16))>>>0;}
export function rnd(seed,ch){return h32((Math.imul(seed|0,0x9e3779b1)+Math.imul(ch|0,0x85ebca6b)+0x27d4eb2f)>>>0)/4294967296;}
export const d3d2gl=(x,y,z)=>[x,z,-y];

export function curve1(arr,t,fb=1){
  if(!arr||!arr.length)return fb;const n=arr.length;t=clamp(t,0,1);const c=t*n;
  const i=Math.min(n-1,Math.floor(c)),j=Math.min(n-1,i+1);return arr[i]+(arr[j]-arr[i])*(c-i);}
export function curveN(arr,t,n,fb=[1,1,1,1]){
  if(!arr||!arr.length)return fb;const m=arr.length;t=clamp(t,0,1);const c=t*m;
  const i=Math.min(m-1,Math.floor(c)),j=Math.min(m-1,i+1),f=c-i,out=[];
  for(let k=0;k<n;k++)out.push(arr[i][k]+(arr[j][k]-arr[i][k])*f);return out;}

/* ----------------------------------------------------- dados + edições (store) */
export const newStore=()=>({version:2,res:{},skills:{},clones:{}});
export function normalizeStore(o){
  const s=newStore();if(!o||typeof o!=='object')return s;
  if(o.res&&typeof o.res==='object')s.res=o.res;
  if(o.skills&&typeof o.skills==='object')s.skills=o.skills;
  if(o.clones&&typeof o.clones==='object')s.clones=o.clones;return s;}
export const skillRec=(store,id)=>store.skills[id]||={global:{},off:{},extra:[],rebind:{}};
export const globals=(store,id)=>({...GLOBAL_DEFAULTS,...(store.skills[id]?.global||{})});
const baseRes=(m,store,file)=>m.resources[store.clones[file]||file];

export function resolveSystem(m,store,file,idx){
  const base=baseRes(m,store,file)?.systems?.[idx];if(!base)return null;
  return {...clone(base),...(store.res[file]?.systems?.[idx]||{})};}
export function resolveStrip(m,store,file,idx){
  const base=baseRes(m,store,file)?.strips?.[idx];if(!base)return null;
  return {...clone(base),...(store.res[file]?.strips?.[idx]||{})};}
export function resolveEff(m,store,file){
  const base=m.resources[store.clones[file]||file];if(!base||base.kind!=='eff')return null;
  const e=clone(base),p=store.res[file]||{};
  Object.assign(e,p.top||{});
  e.parts=e.parts.map((part,i)=>({...part,...(p.parts?.[i]||{})}));return e;}

/** Normaliza os "visuals" de um canal (inclui o tipo "magic" -> voo). */
function visualsOf(ch){
  const out=[];
  for(const v of ch.visual||[]){
    if(v.kind==='magic'){for(const mv of v.models||[])out.push({...mv,magic:true});}
    else out.push(v);
  }return out;}

/** Lista de camadas de uma skill (sistemas PAR, trilhas, EFF, extras do usuário). */
export function buildLayers(m,store,skillId){
  const sk=m.skills[skillId];if(!sk)return[];
  const rec=store.skills[skillId]||{rebind:{},extra:[]};const out=[];
  const flightSpeed=sk.channels.flatMap(visualsOf).find(v=>v.kind==='flight'&&v.speed)?.speed||sk.speed||10;
  sk.channels.forEach((ch,ci)=>{
    for(const vis of visualsOf(ch)){
      const files=[...(vis.files||[])];
      const add=(file,asKind,extra={})=>{
        const f=rec.rebind?.[file]||file,res=baseRes(m,store,f);if(!res)return;
        if(res.kind==='par'){
          res.systems.forEach((s,i)=>out.push({key:`${ci}:${f}:s${i}`,file:f,idx:i,kind:'system',channel:ch.kind,
            dummy:ch.dummy,vis,flightSpeed,type:resolveSystem(m,store,f,i).type,label:`${f} · ${s.name||'sistema'} #${i+1}`,...extra}));
          (res.strips||[]).forEach((s,i)=>out.push({key:`${ci}:${f}:t${i}`,file:f,idx:i,kind:'strip',channel:ch.kind,
            dummy:ch.dummy,vis,flightSpeed,label:`${f} · trilha #${i+1}`,...extra}));
        }else if(res.kind==='eff'){
          out.push({key:`${ci}:${f}:e`,file:f,idx:0,kind:'eff',channel:ch.kind,dummy:ch.dummy,vis,flightSpeed,
            label:`${f} · modelo EFF`,...extra});
        }};
      for(const f of files)add(f);
      if(vis.result)add(vis.result,'',{channel:'target',resultOf:true});
    }
  });
  (rec.extra||[]).forEach(e=>out.push({key:e.key,file:'(novo)',idx:0,kind:'system',channel:e.channel||'actor',
    dummy:-1,vis:{kind:'scene'},flightSpeed,type:e.data.type,extraData:e.data,label:`${e.data.name||'novo'} · adicionado`,custom:true}));
  return out;}

/** Dados efetivos de uma camada. */
export function layerData(m,store,layer){
  if(layer.custom)return(store.skills[layer.skillId]?.extra||[]).find(e=>e.key===layer.key)?.data||layer.extraData;
  if(layer.kind==='system')return resolveSystem(m,store,layer.file,layer.idx);
  if(layer.kind==='strip')return resolveStrip(m,store,layer.file,layer.idx);
  return resolveEff(m,store,layer.file);}

export const NEW_SYSTEM=()=>({type:2,name:'novo',count:16,texture:'',model:'RectPlane',range:[.4,.4,0],sizes:[.3,.5,.1],
  angles:[[0,0,0],[0,0,0]],colors:[[1,.8,.4,0],[1,.6,.2,1],[1,.3,.1,0]],billboard:true,src:5,dst:2,minFilter:1,magFilter:1,
  life:1.2,vel:2,dir:[0,0,1],accel:[0,0,0],step:.1,offset:[0,0,0],delay:0,play:0,roadom:2,path:null,hitEffect:''});

/* -------------------------------------------------------------- texturas/modelos */
export class TextureBank{
  constructor(base,provider){this.base=base;this.map=new Map();
    this.provider=provider||(f=>{const l=new THREE.TextureLoader();return l.load(this.base+f);});}
  get(file){if(!file)return null;let t=this.map.get(file);
    if(!t){t=this.provider(file);if(t){t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;}this.map.set(file,t);}return t;}}

const FULL_UV=[[0,1],[0,0],[1,0],[1,1]];
function quadGeometry(uv=FULL_UV,vertical=false){
  const g=new THREE.BufferGeometry();
  const pos=vertical?[-.5,0,-.5,-.5,0,.5,.5,0,.5,.5,0,-.5]:[-.5,-.5,0,-.5,.5,0,.5,.5,0,.5,-.5,0];
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv.flat(),2));
  g.setIndex([0,1,2,0,2,3]);return g;}
function partGeometry(model,models){
  if(model==='Rect')return quadGeometry(FULL_UV,true);
  if(model==='Cylinder'||model==='Cone'){
    const g=model==='Cone'?new THREE.ConeGeometry(.5,1,20,1,true):new THREE.CylinderGeometry(.5,.5,1,20,1,true);
    g.rotateX(Math.PI/2);return g;}
  if(/\.lgo$/i.test(model)){
    const name=model.replace(/\.lgo$/i,'');const node=models?.get(name);
    if(node?.geometry)return node.geometry;
    const g=new THREE.CylinderGeometry(.5,.5,1,20,1,true);g.rotateX(Math.PI/2);return g;}
  return quadGeometry();}

function makeMaterial(tex,src,dst){
  return new THREE.MeshBasicMaterial({map:tex||null,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:BF[src]??THREE.SrcAlphaFactor,
    blendDst:BF[dst]??THREE.OneMinusSrcAlphaFactor,fog:false});}
function tintMaterial(mat,rgb,a,src){
  const useAlpha=src===5||src===11||src===6;
  if(useAlpha){mat.color.setRGB(rgb[0],rgb[1],rgb[2]);mat.opacity=clamp(a,0,1);}
  else{const k=clamp(a,0,1);mat.color.setRGB(rgb[0]*k,rgb[1]*k,rgb[2]*k);mat.opacity=1;}}
function syncMaterial(mat,tex,src,dst){
  if(mat.map!==tex){mat.map=tex||null;mat.needsUpdate=true;}
  const s=BF[src]??THREE.SrcAlphaFactor,d=BF[dst]??THREE.OneMinusSrcAlphaFactor;
  if(mat.blendSrc!==s||mat.blendDst!==d){mat.blendSrc=s;mat.blendDst=d;mat.needsUpdate=true;}}

/* ----------------------------------------------------- movimento das partículas */
const unit3=v=>{const n=Math.hypot(v[0],v[1],v[2]);return n>1e-8?[v[0]/n,v[1]/n,v[2]/n]:[0,0,0];};
/** Posição (D3D) de uma partícula de tipo 1/2/3/9/12/15 com idade `age`. */
export function particlePose(s,seed,age,g){
  const R=s.range||[0,0,0],O=s.offset||[0,0,0],dir=s.dir||[0,0,0],acc=s.accel||[0,0,0],vel=s.vel||0;
  const centered=g.centerRange>=.5,p=[0,0,0],v=[0,0,0];
  for(let c=0;c<3;c++){const r=rnd(seed,c);p[c]=O[c]+(centered?(r-.5)*R[c]:R[c]*r);}
  const type=s.type;
  if(type===2){const u=unit3(dir);for(let c=0;c<3;c++)v[c]=u[c]*vel;}
  else if(type===1){const lo=1/Math.max(1,s.roadom||2);
    for(let c=0;c<3;c++){const mag=vel*(lo+(1-lo)*rnd(seed,3+c));const sg=c===2?1:(rnd(seed,6+c)<.5?-1:1);v[c]=mag*dir[c]*sg;}}
  else if(type===3){for(let c=0;c<3;c++){const mag=vel*rnd(seed,3+c);const sg=rnd(seed,6+c)<.5?-1:1;
    v[c]=mag*dir[c]*(c===2?1:(c===1?-1:1)*sg);}}
  else if(type===9){const th=rnd(seed,9)*Math.PI*2+age*Math.max(.2,vel)*.9;const rad=Math.max(.05,R[0]||1);
    return{pos:[O[0]+Math.cos(th)*rad,O[1]+Math.sin(th)*rad,O[2]+(centered?(rnd(seed,2)-.5)*R[2]:R[2]*rnd(seed,2))],vel:[0,0,0]};}
  else if(type===12){const u=unit3([rnd(seed,0)-.5,rnd(seed,1)-.5,rnd(seed,2)-.5]);const rad=Math.max(R[0],R[1],R[2],.1)*(.5+.5*rnd(seed,4));
    const k=1-clamp(age/Math.max(.01,s.life),0,1);
    return{pos:[O[0]+u[0]*rad*k,O[1]+u[1]*rad*k,O[2]+u[2]*rad*k],vel:[0,0,0]};}
  else if(type===15){const u=unit3(dir);for(let c=0;c<3;c++)v[c]=u[c]*vel;}
  const out=[p[0]+v[0]*age,p[1]+v[1]*age,p[2]+v[2]*age];
  if(type===3)for(let c=0;c<3;c++)out[c]+=.5*acc[c]*age*age;
  return{pos:out,vel:v};}

/** Instâncias vivas de um sistema no instante local `t` (já descontado o atraso do canal). */
export function enumerateParticles(s,t,cap=400){
  const life=Math.max(.02,s.life||1),local=t-(s.delay||0);if(local<0)return[];
  const type=s.type,play=s.play>0?s.play:Infinity,count=Math.max(1,s.count|0||1),items=[];
  if(type===5||type===6||type===13){
    const lim=s.play>0?Math.min(life,s.play):life;
    if(local<lim)items.push({seed:1,age:local,life});return items;}
  if(type===3){const iv=s.step>0?s.step:life;const bursts=s.play>0?Math.max(1,Math.ceil(s.play/iv)):1;
    for(let b=0;b<bursts;b++){const st=b*iv;if(st>=play&&b>0)break;const age=local-st;
      if(age<0||age>=life)continue;
      for(let i=0;i<count&&items.length<cap;i++)items.push({seed:b*1009+i*7+13,age,life});}
    return items;}
  const iv=s.step>0?s.step:life/count;
  const kMax=Math.floor(local/iv),eff=Math.min(life,count*iv);
  const kMin=Math.max(0,Math.ceil((local-eff)/iv));
  for(let k=kMin;k<=kMax&&items.length<cap;k++){if(k*iv>=play)break;items.push({seed:k*31+5,age:local-k*iv,life});}
  return items;}

/* ------------------------------------------------------------------ camadas */
const Q_FLAT=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_e=new THREE.Euler(0,0,0,'YXZ'),_v=new THREE.Vector3();

class ParticleLayer{
  constructor(player,layer){this.p=player;this.layer=layer;this.group=new THREE.Group();player.root.add(this.group);
    this.pool=[];this.geo=quadGeometry();}
  mesh(i,s){
    let m=this.pool[i];
    if(!m){m=new THREE.Mesh(this.geo,makeMaterial(null,5,2));m.frustumCulled=false;this.group.add(m);this.pool[i]=m;}
    return m;}
  update(t,ctx){
    const L=this.layer,s=layerData(ctx.m,ctx.store,L),g=ctx.g;
    const start=ctx.startFor(L);let used=0;
    if(s&&ctx.enabled(L)&&t>=start){
      const tex=this.p.tex.get(s.texture);
      const items=enumerateParticles(s,(t-start)*1,Math.min(g.particles,400));
      for(const it of items){
        const k=clamp(it.age/Math.max(.02,it.life),0,1);
        const m=this.mesh(used++,s);syncMaterial(m.material,tex,s.src,s.dst);
        const pose=particlePose(s,it.seed,it.age,g);let pos=pose.pos;
        const anchor=ctx.anchorAt(L,t);
        const gl=d3d2gl(pos[0]*g.scale,pos[1]*g.scale,pos[2]*g.scale);
        m.position.set(anchor[0]+gl[0],anchor[1]+gl[1]+g.height,anchor[2]+gl[2]);
        const sz=curve1(s.sizes,k,1)*g.scale*(s.type===13&&s.billboard===false?1:1);
        const col=curveN(s.colors,k,4);const rot=curveN(s.angles,k,3,[0,0,0])[2];
        if(s.billboard){m.quaternion.copy(this.p.camera.quaternion);m.rotateZ(rot);}
        else{m.quaternion.copy(Q_FLAT);m.rotateZ(rot);}
        m.scale.set(sz,sz,sz);tintMaterial(m.material,col,col[3]*g.opacity,s.src);m.visible=sz>1e-4;
      }}
    for(let i=used;i<this.pool.length;i++)this.pool[i].visible=false;
    return used;}
  dispose(){this.p.root.remove(this.group);for(const m of this.pool)m?.material.dispose();this.geo.dispose();}
}

class EffInstance{
  constructor(player,eff){
    this.p=player;this.group=new THREE.Group();this.wrap=new THREE.Group();this.wrap.rotation.x=-Math.PI/2;
    this.group.add(this.wrap);player.root.add(this.group);this.parts=[];this.eff=eff;
    eff.parts.forEach(part=>{
      const g=partGeometry(part.model,player.models);const owned=g.userData?.owned!==false;
      const mesh=new THREE.Mesh(g,makeMaterial(null,part.src,part.dst));mesh.frustumCulled=false;mesh.rotation.order='YXZ';
      this.wrap.add(mesh);this.parts.push({part,mesh,uvGeo:part.model==='Rect'||part.model==='RectPlane'});});}
  setVisible(v){this.group.visible=v;}
  update(age,{pos,sizeMul,colorMul,alphaMul,scale,quat,loopLen,eff,stopAtKeysEnd=false}){
    this.eff=eff||this.eff;this.group.position.set(pos[0],pos[1],pos[2]);
    if(quat)this.group.quaternion.copy(quat);else this.group.quaternion.identity();
    this.group.scale.setScalar(scale);
    this.group.updateMatrixWorld(true);
    const E=this.eff;
    if(E.rotating&&E.rotation){const ax=new THREE.Vector3(E.rotation[0],E.rotation[1],E.rotation[2]);
      if(ax.lengthSq()>1e-9){ax.normalize();this.wrap.quaternion.setFromAxisAngle(ax,(E.rotationSpeed||1)*age);
        this.wrap.quaternion.premultiply(_q.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));}}
    else this.wrap.rotation.set(-Math.PI/2,0,0);
    this.parts.forEach((pm,i)=>{
      const part=E.parts[i]||pm.part,mesh=pm.mesh,keys=part.keys||[];
      const tex=this.p.tex.get(part.texture);syncMaterial(mesh.material,tex,part.src,part.dst);
      if(!keys.length){mesh.visible=false;return;}
      const total=keys.reduce((a,k)=>a+Math.max(0,k.d),0)||1;
      if(stopAtKeysEnd && age>=total && part.loop!==true){mesh.visible=false;return;}
      let ph=age;if(part.loop!==false&&loopLen!==0)ph=age%total;else ph=Math.min(age,total-1e-4);
      let acc=0,ki=0;for(;ki<keys.length-1;ki++){if(ph<acc+keys[ki].d)break;acc+=keys[ki].d;}
      const A=keys[ki],B=keys[Math.min(ki+1,keys.length-1)],f=A.d>1e-6&&ki<keys.length-1?clamp((ph-acc)/A.d,0,1):0;
      const mix=(a,b)=>a.map((x,j)=>x+(b[j]-x)*f);
      const sc=mix(A.s,B.s),an=mix(A.a,B.a),po=mix(A.p,B.p),co=mix(A.c,B.c);
      const sm=sizeMul;
      mesh.position.set(po[0]*sm,po[1]*sm,po[2]*sm);
      mesh.scale.set(sc[0]*sm,sc[1]*sm,sc[2]*sm);
      if(part.billboard){
        this.wrap.updateWorldMatrix(true,false);this.wrap.getWorldQuaternion(_q);_q.invert();
        mesh.quaternion.copy(_q).multiply(this.p.camera.quaternion);mesh.rotateZ(an[2]);}
      else{mesh.rotation.order='YXZ';mesh.rotation.set(an[0],an[1],an[2]);}
      const rgb=[co[0]*colorMul[0],co[1]*colorMul[1],co[2]*colorMul[2]];
      tintMaterial(mesh.material,rgb,co[3]*colorMul[3]*alphaMul,part.src);
      mesh.visible=true;
      if(pm.uvGeo&&part.regions&&part.regions.length>1&&mesh.geometry.getAttribute('uv')){
        const fi=Math.floor(age/Math.max(.01,part.regionFrameTime||.1))%part.regions.length;
        mesh.geometry.getAttribute('uv').copyArray(part.regions[fi].flat());mesh.geometry.getAttribute('uv').needsUpdate=true;}
    });}
  dispose(){this.p.root.remove(this.group);for(const pm of this.parts){pm.mesh.material.dispose();
      if(pm.uvGeo||pm.mesh.geometry.type==='CylinderGeometry'||pm.mesh.geometry.type==='ConeGeometry')pm.mesh.geometry.dispose();}}
}

class EffLayer{
  constructor(player,layer,ctx){this.p=player;this.layer=layer;this.insts=[];this.ctx=ctx;}
  inst(i,eff){
    let it=this.insts[i];if(!it){it=new EffInstance(this.p,eff);this.insts[i]=it;}return it;}
  update(t,ctx){
    const L=this.layer,g=ctx.g;let used=0;const start=ctx.startFor(L);
    const hide=()=>{for(let i=used;i<this.insts.length;i++)this.insts[i].setVisible(false);return used;};
    if(!ctx.enabled(L)||t<start)return hide();
    if(L.kind==='eff'){// voo (.eff solto): sai do personagem e vai até o alvo
      const eff=resolveEff(ctx.m,ctx.store,L.file);if(!eff)return hide();
      const age=t-start,dist=g.distance;
      const spd=(g.flightSpeed||L.vis?.speed||L.flightSpeed||10);
      if(g.timelineMode==='historical'&&age>dist/spd)return hide();
      const travel=Math.min(1,age*spd/Math.max(.1,dist));
      const mode=L.vis?.mode,copies=L.vis?.mode===3?Math.min(16,1+Math.floor(Math.max(0,Math.min(age,9)-1e-6)/.6)):1;
      for(let c=0;c<copies;c++){
        const it=this.inst(used++,eff);it.setVisible(true);
        const back=c===0?0:.5*c;const alpha=c===0?1:Math.max(0,1-c/copies);
        const x=dist*travel-back;
        it.update(age,{pos:[Math.max(0,x),1+g.height,0],sizeMul:1,colorMul:[1,1,1,1],alphaMul:alpha*g.opacity,
          scale:(mode===3&&age>0?1.5:1)*g.scale,quat:null,eff,stopAtKeysEnd:g.timelineMode==='historical'});}
      return hide();}
    const s=layerData(ctx.m,ctx.store,L);if(!s)return hide();
    const eff=resolveEff(ctx.m,ctx.store,s.effect||s.model);if(!eff)return hide();
    const items=enumerateParticles(s,t-start,Math.min(g.particles,200));
    for(const itm of items){
      const k=clamp(itm.age/Math.max(.02,itm.life),0,1);
      const it=this.inst(used++,eff);it.setVisible(true);
      const anchor=ctx.anchorAt(L,t);
      const pose=s.type===15?particlePose(s,itm.seed,itm.age,g):particlePose({...s,type:s.type===4?2:s.type,vel:0,dir:[0,0,0]},itm.seed,itm.age,g);
      const pos=pose.pos;
      let groundZ=pos[2];if(s.type===15&&groundZ<0){groundZ=0;pos[2]=0;}
      const gl=d3d2gl(pos[0]*g.scale,pos[1]*g.scale,pos[2]*g.scale);
      const kk=s.type===6?0:k,sizeMul=curve1(s.sizes,kk,1),col=curveN(s.colors,kk,4);
      it.update(itm.age,{pos:[anchor[0]+gl[0],anchor[1]+gl[1]+g.height,anchor[2]+gl[2]],sizeMul,
        colorMul:[col[0],col[1],col[2],col[3]],alphaMul:g.opacity,scale:g.scale,quat:null,eff,stopAtKeysEnd:g.timelineMode==='historical'});}
    return hide();}
  dispose(){for(const i of this.insts)i.dispose();}
}

/** Trilha da lâmina (strips do .par): fita que acompanha um arco de espada. */
class StripLayer{
  constructor(player,layer){this.p=player;this.layer=layer;
    this.geo=new THREE.BufferGeometry();this.N=160;
    this.geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.N*2*3),3));
    this.geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(this.N*2*2),2));
    this.geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(this.N*2*3),3));
    const idx=[];for(let i=0;i<this.N-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}this.geo.setIndex(idx);
    this.mat=makeMaterial(null,5,2);this.mat.vertexColors=true;
    this.mesh=new THREE.Mesh(this.geo,this.mat);this.mesh.frustumCulled=false;player.root.add(this.mesh);}
  update(t,ctx){
    const L=this.layer,s=layerData(ctx.m,ctx.store,L),g=ctx.g;
    if(!s||!ctx.enabled(L)){this.mesh.visible=false;return 0;}
    const swing=s.swing||{a0:-70,a1:110,start:0,dur:.35,r0:.25,r1:1.35,h:1.1};
    const start=ctx.startFor(L)+(swing.start||0);
    this.mesh.visible=true;syncMaterial(this.mat,this.p.tex.get(s.texture),s.src,s.dst);
    const life=Math.max(.05,s.life||.5),pos=this.geo.getAttribute('position'),uv=this.geo.getAttribute('uv'),col=this.geo.getAttribute('color');
    let n=0;const steps=Math.min(this.N,Math.max(2,Math.floor(life/Math.max(.005,s.step||.03))+1));
    const c=s.color||[1,1,1,1];
    for(let i=0;i<steps;i++){
      const ts=t-life*(1-i/(steps-1));const u=clamp((ts-start)/Math.max(.02,swing.dur),0,1);
      const age=(t-ts)/life,a=((swing.a0+(swing.a1-swing.a0)*u)*Math.PI)/180;
      const fade=ts<start||ts>start+swing.dur+life?0:(1-age);
      const cos=Math.cos(a),sin=Math.sin(a);
      pos.setXYZ(n,cos*swing.r0*g.scale,swing.h*g.scale+sin*swing.r0*g.scale+g.height,0);
      pos.setXYZ(n+1,cos*swing.r1*g.scale,swing.h*g.scale+sin*swing.r1*g.scale+g.height,0);
      uv.setXY(n,i/(steps-1),1);uv.setXY(n+1,i/(steps-1),0);
      const k=clamp(fade*(c[3]??1)*g.opacity,0,1)*(s.src===5?1:1);
      col.setXYZ(n,c[0]*k,c[1]*k,c[2]*k);col.setXYZ(n+1,c[0]*k,c[1]*k,c[2]*k);n+=2;}
    for(;n<this.N*2;n++){pos.setXYZ(n,0,0,0);col.setXYZ(n,0,0,0);}
    pos.needsUpdate=uv.needsUpdate=col.needsUpdate=true;this.mat.opacity=1;return steps;}
  dispose(){this.p.root.remove(this.mesh);this.geo.dispose();this.mat.dispose();}
}

/* ------------------------------------------------------------------- player */
export class FxPlayer{
  constructor({scene,camera,textureBase='assets/skills/textures/',textureProvider,models}){
    this.scene=scene;this.camera=camera;this.root=new THREE.Group();scene.add(this.root);
    this.tex=new TextureBank(textureBase,textureProvider);this.models=models||new Map();
    this.layers=[];this.render=[];this.m=null;this.store=null;this.skillId=null;this.hidden=new Set();this.solo=null;this.actorDummies=null;}
  setSkill(manifest,store,skillId,actor){
    this.clear();this.m=manifest;this.store=store;this.skillId=skillId;this.actor=actor;
    this.layers=buildLayers(manifest,store,skillId);
    this.layers.forEach(l=>{l.skillId=skillId;});
    this.render=this.layers.map(l=>l.kind==='strip'?new StripLayer(this,l):(l.kind==='eff'||MESH_TYPES.has(l.type))?new EffLayer(this,l):new ParticleLayer(this,l));
    return this.layers;}
  /** reconstrói só os objetos 3D (depois de mudar o tipo de uma camada) */
  rebuild(){if(this.m)return this.setSkill(this.m,this.store,this.skillId,this.actor);}
  clear(){for(const r of this.render)r.dispose();this.render=[];this.layers=[];}
  anchorFor(L,t,ctx){
    const g=ctx.g,dist=g.distance;let x=0,y=0,z=0;
    const dummyH=(()=>{const d=L.dummy;const a=this.m?.attachments?.[this.actor]?.actor?.[String(d)];
      if(a&&d>=0){const mt=a.matrix;return mt?mt[14]:1;}return d>=0?1:0;})();
    const ch=L.channel;
    if(ch==='target'||ch==='ground'){x=dist;y=ch==='ground'?0:dummyH;}
    else if(ch==='flight'){const start=ctx.startFor(L);const spd=g.flightSpeed||L.vis?.speed||L.flightSpeed||10;
      x=Math.min(dist,Math.max(0,(t-start)*spd));y=Math.max(.6,dummyH);}
    else if(ch==='item'||ch==='itemExtra'){x=.35;y=1;z=.2;}
    else y=dummyH;
    return[x,y,z];}
  update(t,g,enabledMap){
    if(!this.m)return 0;g={...GLOBAL_DEFAULTS,...g};
    const hasFlight=this.layers.some(l=>l.channel==='flight'),dist=g.distance;
    const spd=g.flightSpeed||this.layers.find(l=>l.flightSpeed)?.flightSpeed||10;
    const ctx={m:this.m,store:this.store,g,
      enabled:L=>{if(this.solo&&this.solo!==L.key)return false;return!(enabledMap?.[L.key]===false)&&!this.hidden.has(L.key);},
      startFor:L=>{const c=L.channel;if(g.timelineMode==='historical' && g.timelineStarts)
        return Math.max(0,Number(g.timelineStarts[c])||0);
        const base=g.castDelay;
        const late=(c==='target'||c==='ground')?(hasFlight?dist/spd:0):0;
        const own=c==='actor'||c==='item'||c==='itemExtra'?0:base;
        return(c==='actor'||c==='item'||c==='itemExtra'?0:own+late);},
      anchorAt:(L,tt)=>{const a=this.anchorFor(L,tt,ctx);return a;}};
    let n=0;this.render.forEach(r=>{n+=r.update(t*(g.speed||1),ctx)||0;});return n;}
}
