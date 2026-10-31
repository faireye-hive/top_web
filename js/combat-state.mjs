import {gainExperience,trainAttack} from './hero-state.mjs?v=4';
import {basicAttackRange,skillWithRules,inSkillArea} from './skill-rules.mjs';
export const COMBAT=Object.freeze({targetRadius:30,range:2.2,leash:34,respawn:12,recovery:5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function nearestMonster(monsters,position,radius=COMBAT.targetRadius,canReach=()=>true){
  let best=null,closest=radius;
  for(const monster of monsters){
    if(monster.hp<=0||monster.ready===false)continue;
    const d=distance(monster,position);
    if(d<=closest&&canReach(position,monster)){best=monster;closest=d;}
  }
  return best;
}
export function rollDamage(attacker,defender,random=Math.random){
  const chance=Math.max(.2,Math.min(.98,.85+(attacker.accuracy-defender.evasion)/200));
  if(random()>=chance)return 0;
  return Math.max(1,Math.round(attacker.attack*(.9+random()*.2)-defender.defense*.55));
}
const CLASS_SKILLS={crusader:[81,84,123,86],cleric:[99,97,106,255],sharpshooter:[94,95,96,456],hunter:[90,93,224,112],voyager:[216,214,213,454],'seal-master':[99,97,256,105],champion:[107,243,83,455]};
export function createCombat({hero,monsters,canReach=()=>true,canSee=canReach,onEvent=()=>{},random=Math.random}){
  let auto=false,target=null,manual=false,pending=null,intent=null,casting=null,cooldown=0,scan=0,recovery=0,quiet=0;
  const cooldowns={},buffs={};
  const visible=m=>m&&m.hp>0&&m.ready!==false;
  const valid=(m,p)=>visible(m)&&distance(m,p)<=COMBAT.targetRadius&&canSee(p,m);
  function notice(message){onEvent({type:'notice',message});return false;}
  function stop(preserveTarget=false){
    const selected=preserveTarget&&visible(target)?target:null;
    auto=false;pending=null;intent=null;casting=null;target=selected;manual=!!selected;scan=0;
  }
  function toggle(){
    if(hero.hp<=0)return false;
    if(auto){
      // Desligar auto não apaga o alvo: o jogador pode atacar manualmente.
      stop(true);return false;
    }
    auto=true;return true;
  }
  function selectTarget(monster,position){
    if(hero.hp<=0||!valid(monster,position))return false;
    // Selecionar um alvo NÃO liga o automático.
    target=monster;manual=true;pending=null;intent=null;
    onEvent({type:'selected',monster});return true;
  }
  function cycleTarget(position){
    const choices=monsters.filter(m=>valid(m,position)).sort((a,b)=>distance(a,position)-distance(b,position)||a.id-b.id);
    if(!choices.length)return notice('Nenhum monstro visível a até 30 m.');
    return selectTarget(choices[(choices.indexOf(target)+1)%choices.length],position);
  }
  function startSwing(monster,position){
    const period=1/stats().attackSpeed;
    const flight=basicAttackRange(hero)>3?distance(position,monster)/30:0;
    cooldown=period;pending={monster,time:period*.35+flight};
    onEvent({type:'swing',monster,period,flight});
  }
  function manualAttack(position){
    if(hero.hp<=0||auto||pending||casting||intent||cooldown>0)return false;
    if(!valid(target,position)){
      target=nearestMonster(monsters,position,COMBAT.targetRadius,canSee);
      manual=!!target;
      if(target)onEvent({type:'selected',monster:target});
    }
    if(!target)return notice('Nenhum monstro próximo. Selecione um alvo.');
    if(distance(position,target)>basicAttackRange(hero))
      return notice('Aproxime-se do alvo para atacar manualmente.');
    startSwing(target,position);
    return true;
  }
  function queueSkill(entry,position){
    const skill=skillWithRules(entry);
    if(!skill||!CLASS_SKILLS[hero.job]?.includes(skill.id)||hero.hp<=0)return false;
    if(casting)return notice('Aguarde a habilidade atual.');
    if((cooldowns[skill.id]||0)>0)return notice(`${skill.name}: recarregando.`);
    if(hero.mp<skill.mana)return notice('Mana insuficiente.');
    const needsTarget=skill.kind==='damage'&&skill.center!=='self';
    if(needsTarget){
      if(!valid(target,position))target=nearestMonster(monsters,position,COMBAT.targetRadius,canSee);
      if(!target)return notice('Toque em um monstro ou use Alvo.');
    }
    pending=null;intent={skill,target:needsTarget?target:null};
    onEvent({type:'interrupt'});return true;
  }
  function stats(){
    return {...hero.stats,attack:hero.stats.attack*(buffs.berserk?1.25:buffs.primal?1.15:1),
      magic:hero.stats.magic*(buffs.magic||buffs.awareness?1.3:1),
      attackSpeed:hero.stats.attackSpeed*(buffs.berserk?1.2:1),accuracy:hero.stats.accuracy*(buffs.awareness?1.15:1)};
  }
  function damageMonster(m,damage,type,skill){
    if(m.hp<=0)return;
    m.hp=Math.max(0,m.hp-damage);m.engaged=true;quiet=0;
    onEvent({type,monster:m,damage,skill});
    if(m.hp===0){
      m.respawnIn=COMBAT.respawn;m.engaged=false;m.status={};
      const levels=gainExperience(hero,m.xp);onEvent({type:'kill',monster:m,levels});
      if(m===target){target=null;manual=false;scan=0;}
    }
  }
  function resolveSkill(cast,position){
    const {skill,victim}=cast;
    if(skill.kind==='heal'){
      const before=hero.hp;hero.hp=Math.min(hero.stats.maxHp,hero.hp+Math.round(hero.stats.maxHp*skill.power));
      onEvent({type:'healed',skill,amount:hero.hp-before});return;
    }
    if(skill.kind==='buff'){buffs[skill.status]=skill.duration;onEvent({type:'buff',skill});return;}
    if(victim&&(!valid(victim,position)||distance(position,victim)>skill.range))return;
    const center=victim||position,values=stats();
    for(const m of monsters){
      if(!visible(m)||!inSkillArea(m,position,center,skill)||!canSee(position,m))continue;
      const damage=Math.max(1,Math.round((skill.magic?values.magic:values.attack)*skill.power-m.defense*.35));
      m.status??={};
      if(skill.stun)m.status.stun=skill.stun;
      if(skill.status)m.status[skill.status]=skill.duration;
      damageMonster(m,damage,'skillhit',skill);
    }
  }
  function update(dt,position,{paused=false,moving=false,busy=false}={}){
    if(paused){stop();return;}
    if(moving)stop(!auto); // Movimento cancela auto; mantém alvo selecionado no manual.
    cooldown=Math.max(0,cooldown-dt);quiet+=dt;
    for(const id of Object.keys(cooldowns))cooldowns[id]=Math.max(0,cooldowns[id]-dt);
    for(const name of Object.keys(buffs))buffs[name]=Math.max(0,buffs[name]-dt);
    for(const m of monsters){
      m.cooldown=Math.max(0,(m.cooldown||0)-dt);
      if(m.hp<=0){
        m.respawnIn-=dt;
        if(m.respawnIn<=0){m.hp=m.maxHp;m.engaged=false;m.status={};onEvent({type:'respawn',monster:m});}
        continue;
      }
      m.status??={};
      if(m.status.poison>0){
        m.poisonTick=(m.poisonTick||0)+dt;
        if(m.poisonTick>=1){m.poisonTick-=1;damageMonster(m,Math.max(1,Math.round(hero.stats.magic*.25)),'dot');}
      }else m.poisonTick=0;
      for(const status of Object.keys(m.status))m.status[status]=Math.max(0,m.status[status]-dt);
      if(m.engaged&&distance(position,m)>COMBAT.leash){m.hp=m.maxHp;m.engaged=false;m.status={};onEvent({type:'reset',monster:m});}
    }
    if(hero.hp<=0){
      stop();recovery+=dt;
      if(recovery>=COMBAT.recovery){
        hero.hp=hero.stats.maxHp;hero.mp=hero.stats.maxMp;recovery=0;
        for(const m of monsters){m.engaged=false;m.status={};if(m.hp>0)m.hp=m.maxHp;}
        for(const name of Object.keys(buffs))delete buffs[name];
        onEvent({type:'revive'});
      }
      return;
    }
    if(target&&!valid(target,position)){target=null;manual=false;pending=null;if(intent?.target)intent=null;}
    scan-=dt;
    if(auto&&scan<=0&&!pending&&!casting&&!intent){
      if(!manual&&!valid(target,position))target=nearestMonster(monsters,position,COMBAT.targetRadius,canSee);
      scan=.2;
    }
    if(casting){
      casting.time-=dt;
      if(casting.time<=0){const completed=casting;casting=null;resolveSkill(completed,position);}
    }
    if(intent&&!casting&&!busy){
      const {skill,target:victim}=intent;
      if(!victim||valid(victim,position)&&distance(position,victim)<=skill.range){
        if(hero.mp>=skill.mana){
          hero.mp-=skill.mana;cooldowns[skill.id]=skill.cooldown;quiet=0;
          const flight=victim?distance(position,victim)/30:0;
          casting={skill,victim,time:skill.windup+flight};
          onEvent({type:'cast',skill,monster:victim,flight});
        }
        intent=null;
      }
    }
    if(pending){
      pending.time-=dt;
      if(pending.time<=0){
        const victim=pending.monster;pending=null;
        if(valid(victim,position)&&distance(position,victim)<=basicAttackRange(hero)){
          const damage=rollDamage(stats(),victim,random),improved=trainAttack(hero);
          damageMonster(victim,damage,'hit');
          onEvent({type:'practice',improved});
        }
      }
    }
    if(auto&&target&&!pending&&!intent&&!casting&&!busy&&cooldown===0&&distance(position,target)<=basicAttackRange(hero))
      startSwing(target,position);
    for(const m of monsters){
      if(!m.engaged||m.hp<=0||m.cooldown>0||m.ready===false||m.status.stun>0||buffs.stealth>0)continue;
      if(distance(position,m)>COMBAT.range+.4||!canSee(position,m))continue;
      m.cooldown=1/m.attackSpeed*(m.status.slow>0?1.6:1);
      const attack=m.attack*(m.status.weak>0?.65:1);
      let damage=rollDamage({...m,attack},hero.stats,random);
      if(buffs.crystal)damage=0;else if(buffs.shield)damage=Math.round(damage*.55);
      quiet=0;hero.hp=Math.max(0,hero.hp-damage);onEvent({type:'hurt',monster:m,damage});
      if(hero.hp===0){stop();onEvent({type:'defeat'});break;}
    }
    if(quiet>4||buffs.primal){
      hero.hp=Math.min(hero.stats.maxHp,hero.hp+hero.stats.maxHp*.025*dt);
      hero.mp=Math.min(hero.stats.maxMp,hero.mp+hero.stats.maxMp*.04*dt);
    }
  }
  return {update,stop,toggle,manualAttack,queueSkill,selectTarget,cycleTarget,cooldowns,buffs,
    get auto(){return auto;},get target(){return target;},get recovering(){return hero.hp<=0;},
    get approach(){
      if(casting||pending)return null;
      if(intent?.target)return {target:intent.target,range:intent.skill.range};
      return auto&&target?{target,range:basicAttackRange(hero)}:null;
    }};
}
