import {rollDamage} from './combat-state.mjs?v=9';
import {gainBoatExperience} from './boat-state.mjs?v=2';
import {initMonsterMotion,returnMonsterHome,updateMonsterMotion} from './monster-motion.mjs?v=2';

export const NAVAL=Object.freeze({range:24,targetRadius:50,monsterRange:6,leash:65,regenDelay:6,regenRate:.04,recovery:5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const isSeaMonster=m=>m?.habitat==='sea';
export function createNavalCombat({ship,monsters,canReach=()=>true,canSee=canReach,onEvent=()=>{},random=Math.random}){
  let target=null,auto=false,manualActive=false,pending=null,cooldown=0,quiet=NAVAL.regenDelay,recovery=0,inCombat=false;
  const ready=m=>isSeaMonster(m)&&m.ready!==false&&m.hp>0&&m.motion!=='return';
  const valid=(m,p)=>ready(m)&&distance(m,p)<=NAVAL.targetRadius&&canSee(p,m);
  const choices=p=>monsters.filter(m=>valid(m,p)).sort((a,b)=>distance(a,p)-distance(b,p)||a.id-b.id);
  function stop(preserveTarget=false){auto=false;manualActive=false;pending=null;if(!preserveTarget||!ready(target))target=null;}
  function notice(message){onEvent({type:'notice',message});return false;}
  function selectTarget(m,p){
    if(ship.hp<=0||!valid(m,p))return false;
    target=m;manualActive=false;pending=null;onEvent({type:'selected',monster:m});return true;
  }
  function cycleTarget(p){
    const list=choices(p);return list.length?selectTarget(list[(list.indexOf(target)+1)%list.length],p):notice('Nenhum monstro marinho visível a até 50 m.');
  }
  function fire(p){
    const flight=distance(p,target)/22;
    cooldown=1/ship.stats.attackSpeed;pending={monster:target,time:.18+flight};quiet=0;inCombat=true;
    onEvent({type:'swing',monster:target,flight:.18+flight,period:cooldown});
  }
  function manualAttack(p){
    if(ship.hp<=0||auto)return false;
    if(!valid(target,p))target=choices(p)[0]||null;
    if(!target)return notice('Selecione um monstro do mar ou use Alvo.');
    manualActive=true;
    if(!pending&&cooldown===0&&distance(p,target)<=NAVAL.range)fire(p);
    return true;
  }
  function toggle(){if(ship.hp<=0)return false;if(auto){stop(true);return false;}auto=true;manualActive=false;return true;}
  function resetEnemies(){
    for(const m of monsters)if(isSeaMonster(m)){
      if(m.hp>0)m.hp=m.maxHp;m.status={};returnMonsterHome(m);
    }
  }
  function update(dt,p,{active=true,paused=false,moving=false}={}){
    if(paused){stop();return;}
    quiet+=dt;cooldown=Math.max(0,cooldown-dt);
    if(!active){stop();if(ship.hp<=0){ship.hp=ship.stats.maxHp;onEvent({type:'repaired'});}recovery=0;}
    if(moving)stop(!auto);
    for(const m of monsters){
      if(!isSeaMonster(m))continue;
      initMonsterMotion(m);m.cooldown=Math.max(0,(m.cooldown||0)-dt);m.status??={};
      if(m.hp<=0){
        if(m.respawn===false)continue;
        m.respawnIn-=dt;if(m.respawnIn<=0){m.hp=m.maxHp;m.status={};returnMonsterHome(m,{teleport:true});onEvent({type:'respawn',monster:m});}
        continue;
      }
      if(!active&&m.engaged){m.hp=m.maxHp;returnMonsterHome(m);}
      if(active&&ship.hp>0&&m.aggressive&&m.ready!==false&&m.motion!=='return'&&distance(m,p)<=(m.aggroRange||20)&&canSee(m,p))m.engaged=true;
      if(m.engaged&&(ship.hp<=0||distance(p,m.home)>(m.leash??NAVAL.leash)||distance(m,m.home)>(m.leash??NAVAL.leash))){
        m.hp=m.maxHp;returnMonsterHome(m);onEvent({type:'reset',monster:m});
      }
      updateMonsterMotion(m,dt,p,{canReach,range:NAVAL.monsterRange-.2});
    }
    if(ship.hp<=0){
      stop();recovery+=dt;inCombat=false;
      if(recovery>=NAVAL.recovery){ship.hp=ship.stats.maxHp;recovery=0;resetEnemies();onEvent({type:'revive'});}
      return;
    }
    recovery=0;
    if(active){
      if(target&&!valid(target,p)){target=null;manualActive=false;pending=null;}
      if(auto&&!valid(target,p)&&!pending)target=choices(p)[0]||null;
      if(pending){
        pending.time-=dt;
        if(pending.time<=0){
          const victim=pending.monster;pending=null;
          if(valid(victim,p)&&distance(victim,p)<=NAVAL.range){
            const damage=rollDamage(ship.stats,victim,random);
            victim.hp=Math.max(0,victim.hp-damage);victim.engaged=true;quiet=0;
            onEvent({type:'hit',monster:victim,damage});
            if(victim.hp===0){
              victim.respawnIn=victim.respawnSeconds??12;victim.engaged=false;victim.attackPending=null;victim.moving=false;victim.status={};
              const levels=gainBoatExperience(ship,victim.xp);onEvent({type:'kill',monster:victim,levels});
              if(victim===target){target=null;manualActive=false;}
            }
          }
        }
      }
      if((auto||manualActive)&&valid(target,p)&&!pending&&cooldown===0&&distance(target,p)<=NAVAL.range)fire(p);
      for(const m of monsters){
        if(!ready(m)||!m.engaged||m.attack<=0)continue;
        if(!m.attackPending){
          if(m.cooldown>0||distance(m,p)>NAVAL.monsterRange||!canSee(m,p))continue;
          const period=1/m.attackSpeed;m.cooldown=period;m.attackPending={time:period*.35};m.moving=false;
          onEvent({type:'monster-swing',monster:m,period});continue;
        }
        m.attackPending.time-=dt;if(m.attackPending.time>0)continue;m.attackPending=null;
        if(distance(m,p)>NAVAL.monsterRange||!canSee(m,p))continue;
        const damage=rollDamage(m,ship.stats,random);quiet=0;ship.hp=Math.max(0,ship.hp-damage);
        onEvent({type:'hurt',monster:m,damage});
        if(ship.hp===0){stop();onEvent({type:'defeat'});break;}
      }
    }
    inCombat=active&&(quiet<NAVAL.regenDelay||!!pending||monsters.some(m=>isSeaMonster(m)&&m.ready!==false&&m.hp>0&&m.engaged));
    if(!inCombat&&quiet>=NAVAL.regenDelay)ship.hp=Math.min(ship.stats.maxHp,ship.hp+ship.stats.maxHp*NAVAL.regenRate*dt);
  }
  return {update,stop,toggle,manualAttack,selectTarget,cycleTarget,cooldowns:{},buffs:{},queueSkill:()=>false,
    get target(){return target;},get auto(){return auto;},get manualActive(){return manualActive;},get inCombat(){return inCombat;},
    get approach(){return (auto||manualActive)&&target&&!pending?{target,range:NAVAL.range}:null;}};
}
