// Combat feedback is VISUAL ONLY: never changes HP, damage, cooldowns or target choice.
// Renders short lived DOM labels projected from the real 3D actor positions.
export const COMBAT_FEEDBACK_LIMITS=Object.freeze({
  mobile:Object.freeze({max:8,lifetime:950}),
  desktop:Object.freeze({max:14,lifetime:1150})
});
export function describeCombatFeedback(event){
  if(!event||typeof event!=='object')return null;
  const damage=Math.max(0,Math.round(Number(event.damage)||0));
  if(['hit','skillhit','dot'].includes(event.type)){
    if(!event.monster)return null;
    return {kind:damage>0?(event.type==='skillhit'?'skill':event.type==='dot'?'dot':'hit'):'miss',
      label:damage>0?'−'+damage:'ERROU',target:'monster',impact:damage>0};
  }
  if(event.type==='hurt'){
    return {kind:damage>0?'hurt':'block',label:damage>0?'−'+damage:'0',
      target:'hero',impact:damage>0};
  }
  if(event.type==='healed'){
    const heal=Math.max(0,Math.round(Number(event.amount)||0));
    return heal>0?{kind:'heal',label:'+'+heal,target:'hero',impact:false}:null;
  }
  // Swing is a short visual wind-up, NOT a damage indicator. The actual
  // damage number must wait for hit/skillhit events from combat-state.mjs.
  if(event.type==='swing'&&event.monster){
    return {kind:'swing',label:'',target:'monster',impact:true};
  }
  return null;
}
export function projectCombatFeedback(point,rect,{margin=14}={}){
  if(!point||!rect||![point.x,point.y,point.z].every(Number.isFinite))return null;
  if(point.x< -1||point.x>1||point.y< -1||point.y>1||point.z< -1||point.z>1)return null;
  const x=rect.left+(point.x+1)*rect.width/2;
  const y=rect.top+(1-point.y)*rect.height/2;
  if(x<rect.left+margin||x>rect.right-margin||
    y<rect.top+margin||y>rect.bottom-margin)return null;
  return {x,y};
}
export function createCombatFeedback({THREE,camera,canvas,root=document.body,mobile=()=>false,
  playerPosition=()=>null,now=()=>performance.now()}={}){
  if(!THREE||!camera||!canvas||!root)return {emit(){},update(){},dispose(){}};
  const layer=document.createElement('div');
  layer.className='combat-float-layer';
  layer.setAttribute('aria-hidden','true');
  const flash=document.createElement('div');
  flash.className='combat-hurt-flash';
  flash.setAttribute('aria-hidden','true');
  root.append(layer,flash);
  const scratch=new THREE.Vector3();
  const live=[];
  let nextId=0,disposed=false;
  function remove(entry){
    entry.el.remove();
    const i=live.indexOf(entry);
    if(i!==-1)live.splice(i,1);
  }
  function emit(event){
    if(disposed)return;
    const info=describeCombatFeedback(event);
    if(!info)return;
    if(event.type==='hurt'&&info.impact&&!document.hidden){
      // Short red edge vignette, not a full-screen opaque flash.
      flash.classList.remove('active');
      void flash.offsetWidth;
      flash.classList.add('active');
    }
    if(!info.label&&!info.impact)return;
    const limits=mobile()?COMBAT_FEEDBACK_LIMITS.mobile:COMBAT_FEEDBACK_LIMITS.desktop;
    while(live.length>=limits.max)remove(live[0]);
    const el=document.createElement('span');
    el.className='combat-float combat-float--'+info.kind;
    const offset=nextId++%3;
    el.style.setProperty('--combat-offset',String((offset-1)*18)+'px');
    if(info.label){
      const value=document.createElement('b');
      value.className='combat-float-value';
      value.textContent=info.label;
      el.append(value);
    }
    if(info.impact){
      const spark=document.createElement('i');
      spark.className='combat-impact';
      spark.setAttribute('aria-hidden','true');
      el.append(spark);
    }
    layer.append(el);
    live.push({el,monster:event.monster,target:info.target,
      expires:now()+(info.kind==='swing'?360:limits.lifetime)});
  }
  function update(){
    if(disposed||!live.length)return;
    const hidden=document.hidden||root.classList.contains('rpg-open')||
      root.classList.contains('map-open')||root.classList.contains('nohud')||
      root.classList.contains('mobile-settings-open');
    const time=now(),rect=canvas.getBoundingClientRect();
    for(let i=live.length-1;i>=0;i--){
      const entry=live[i];
      if(entry.expires<=time){remove(entry);continue}
      if(hidden||rect.width<=0||rect.height<=0){entry.el.hidden=true;continue}
      const source=entry.target==='hero'?playerPosition():entry.monster;
      if(!source){entry.el.hidden=true;continue}
      const x=source.x,z=source.z;
      // Monster model position carries the real terrain elevation.
      const y=entry.target==='hero'?(source.y??0)+1.75:
        (entry.monster?.object?.position?.y??source.y??0)+1.45;
      scratch.set(x,y,z).project(camera);
      const where=projectCombatFeedback(scratch,rect);
      entry.el.hidden=!where;
      if(where){
        entry.el.style.left=where.x.toFixed(1)+'px';
        entry.el.style.top=where.y.toFixed(1)+'px';
      }
    }
  }
  function dispose(){
    disposed=true;
    for(const entry of [...live])remove(entry);
    layer.remove();flash.remove();
  }
  return {emit,update,dispose,get count(){return live.length}};
}
