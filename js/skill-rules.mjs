// Somente comportamento/balanceamento novo; poses e texturas vêm do catálogo original.
const attack=(range,power,extra={})=>({kind:'damage',range,power,mana:10,cooldown:5,windup:.45,fx:'bolt',...extra});
const buff=(status,duration,extra={})=>({kind:'buff',status,duration,range:0,mana:12,cooldown:12,windup:.35,fx:'aura',...extra});
export const SKILL_RULES=Object.freeze({
  81:attack(12,1.6,{fx:'slash',cooldown:4,lineWidth:1.2}),
  84:buff('berserk',8),123:buff('stealth',8,{fx:'stealth'}),
  86:attack(4,1.5,{fx:'slash',stun:1.5,cooldown:6}),
  99:attack(16,1.35,{magic:true}),
  97:{kind:'heal',range:0,mana:14,cooldown:7,windup:.4,power:.35,fx:'heal'},
  106:buff('shield',8,{fx:'shield'}),255:buff('crystal',3,{fx:'crystal',cooldown:18,mana:20}),
  94:attack(18,1.1,{fx:'shot',status:'slow',duration:5}),
  95:attack(18,1.1,{fx:'shot',status:'weak',duration:6}),
  96:attack(18,2.1,{fx:'shot',cooldown:8,mana:16}),
  456:attack(18,2.8,{fx:'beam',radius:2.5,cooldown:12,mana:22,windup:.65}),
  90:attack(20,1.6,{fx:'arrows',cooldown:4}),
  93:attack(20,1.2,{fx:'ice',stun:1.3,cooldown:6}),
  224:attack(20,.8,{fx:'poison',status:'poison',duration:5,cooldown:6}),
  112:attack(18,1.9,{magic:true,radius:3.5,fx:'meteor',cooldown:10,mana:20,windup:.65}),
  216:attack(12,1.6,{magic:true,lineWidth:1.8,fx:'wave',cooldown:5}),
  214:attack(16,1.7,{magic:true,fx:'lightning',cooldown:6}),
  213:attack(14,1.3,{magic:true,radius:3,fx:'tornado',stun:1,cooldown:8}),
  454:buff('awareness',10,{fx:'aura'}),
  256:buff('magic',10,{fx:'aura'}),
  105:attack(16,.9,{magic:true,fx:'shadow',status:'silence',duration:6,cooldown:7}),
  107:attack(0,.8,{radius:6,center:'self',fx:'howl',status:'weak',duration:5,cooldown:7}),
  243:attack(0,1.2,{radius:6,center:'self',fx:'roar',stun:1.5,cooldown:8}),
  83:buff('primal',8,{fx:'rage'}),
  455:attack(0,2.1,{radius:6,center:'self',fx:'smash',stun:1.5,cooldown:10,mana:20,windup:.6})
});
export function skillWithRules(skill){const rules=SKILL_RULES[skill?.id];return rules?{...skill,...rules}:null;}
export function basicAttackRange(hero){
  if(!hero.equipped)return 2.2;
  return ({sharpshooter:18,hunter:20,cleric:14,'seal-master':14,champion:2.8})[hero.job]||2.2;
}
export function inSkillArea(monster,position,target,skill){
  const center=skill.center==='self'?position:target;
  if(skill.radius)return Math.hypot(monster.x-center.x,monster.z-center.z)<=skill.radius;
  if(skill.lineWidth){
    const dx=target.x-position.x,dz=target.z-position.z,length=Math.hypot(dx,dz)||1;
    const x=monster.x-position.x,z=monster.z-position.z,along=(x*dx+z*dz)/length;
    return along>=0&&along<=Math.min(skill.range,length)+1&&Math.abs(x*dz-z*dx)/length<=skill.lineWidth;
  }
  return monster===target;
}
