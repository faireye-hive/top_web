import {gainExperience,trainAttack} from './hero-state.mjs?v=2';

export const COMBAT = Object.freeze({targetRadius:12,range:2.2,leash:16,respawn:12,recovery:5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function nearestMonster(monsters,position,radius=COMBAT.targetRadius,canReach=()=>true) {
  let best=null,closest=radius;
  for(const monster of monsters) {
    if(monster.hp<=0||monster.ready===false)continue;
    const d=distance(monster,position);
    if(d<=closest&&canReach(position,monster)){best=monster;closest=d;}
  }
  return best;
}
export function rollDamage(attacker,defender,random=Math.random) {
  const chance=Math.max(.2,Math.min(.98,.85+(attacker.accuracy-defender.evasion)/200));
  if(random()>=chance)return 0;
  return Math.max(1,Math.round(attacker.attack*(.9+random()*.2)-defender.defense*.55));
}

// Estado puro: o renderizador só informa posição, colisão e eventos visuais.
export function createCombat({hero,monsters,canReach=()=>true,onEvent=()=>{},random=Math.random}) {
  let auto=false,target=null,pending=null,cooldown=0,scan=0,recovery=0,quiet=0;
  function stop(){auto=false;pending=null;target=null;scan=0;}
  function toggle(){if(hero.hp<=0)return false;auto=!auto;if(!auto)stop();return auto;}
  function update(dt,position,{paused=false,moving=false}={}) {
    if(paused){stop();return;}
    if(moving)stop();
    cooldown=Math.max(0,cooldown-dt);quiet+=dt;
    for(const m of monsters) {
      m.cooldown=Math.max(0,(m.cooldown||0)-dt);
      if(m.hp<=0) {
        m.respawnIn-=dt;
        if(m.respawnIn<=0){m.hp=m.maxHp;m.engaged=false;onEvent({type:'respawn',monster:m});}
      } else if(m.engaged&&distance(position,m)>COMBAT.leash) {
        m.hp=m.maxHp;m.engaged=false;onEvent({type:'reset',monster:m});
      }
    }
    if(hero.hp<=0) {
      stop();recovery+=dt;
      if(recovery>=COMBAT.recovery) {
        hero.hp=hero.stats.maxHp;hero.mp=hero.stats.maxMp;recovery=0;
        for(const m of monsters){m.engaged=false;if(m.hp>0)m.hp=m.maxHp;}
        onEvent({type:'revive'});
      }
      return;
    }
    scan-=dt;
    if(auto&&scan<=0&&!pending) {
      target=nearestMonster(monsters,position,COMBAT.targetRadius,canReach);scan=.2;
    }
    if(target&&(target.hp<=0||distance(position,target)>COMBAT.targetRadius||!canReach(position,target))) {
      target=null;pending=null;scan=0;
    }
    if(pending) {
      pending.time-=dt;
      if(pending.time<=0) {
        const victim=pending.monster;pending=null;
        if(victim.hp>0&&distance(position,victim)<=COMBAT.range&&canReach(position,victim)) {
          const damage=rollDamage(hero.stats,victim,random);
          const improved=trainAttack(hero);
          victim.hp=Math.max(0,victim.hp-damage);victim.engaged=true;quiet=0;
          onEvent({type:'hit',monster:victim,damage,improved});
          if(victim.hp===0) {
            victim.respawnIn=COMBAT.respawn;victim.engaged=false;
            const levels=gainExperience(hero,victim.xp);
            onEvent({type:'kill',monster:victim,levels});target=null;scan=0;
          }
        }
      }
    }
    if(auto&&target&&cooldown===0&&distance(position,target)<=COMBAT.range) {
      const period=1/hero.stats.attackSpeed;
      cooldown=period;pending={monster:target,time:period*.35};
      onEvent({type:'swing',monster:target,period});
    }
    for(const m of monsters) {
      if(!m.engaged||m.hp<=0||m.cooldown>0||m.ready===false)continue;
      if(distance(position,m)>COMBAT.range+.4||!canReach(position,m))continue;
      m.cooldown=1/m.attackSpeed;quiet=0;
      const damage=rollDamage(m,hero.stats,random);
      hero.hp=Math.max(0,hero.hp-damage);onEvent({type:'hurt',monster:m,damage});
      if(hero.hp===0){stop();onEvent({type:'defeat'});break;}
    }
    if(quiet>4) {
      hero.hp=Math.min(hero.stats.maxHp,hero.hp+hero.stats.maxHp*.025*dt);
      hero.mp=Math.min(hero.stats.maxMp,hero.mp+hero.stats.maxMp*.04*dt);
    }
  }
  return {update,stop,toggle,get auto(){return auto;},get target(){return target;},get recovering(){return hero.hp<=0;}};
}
