export const BOAT_LEVEL_LIMIT=100;
export const boatExperienceRequired=level=>100+40*level;
export function boatStats(level){
  return {maxHp:1800+(level-1)*140,attack:135+(level-1)*14,
    defense:40+(level-1)*3,accuracy:100+level,evasion:15+level*.5,attackSpeed:.8};
}
export function refreshBoat(ship,{heal=false}={}){
  const before=ship.stats?.maxHp??0;ship.stats=boatStats(ship.level);
  ship.hp=heal?ship.stats.maxHp:Math.max(0,Math.min(ship.stats.maxHp,(ship.hp??ship.stats.maxHp)+Math.max(0,ship.stats.maxHp-before)));
}
export function createBoatState(hull='guppy'){
  const ship={hull,level:1,xp:0};refreshBoat(ship,{heal:true});return ship;
}
export function gainBoatExperience(ship,amount){
  if(!Number.isFinite(amount)||amount<0)return 0;
  const previous=ship.level;ship.xp+=amount;
  while(ship.level<BOAT_LEVEL_LIMIT&&ship.xp>=boatExperienceRequired(ship.level)){
    ship.xp-=boatExperienceRequired(ship.level);ship.level++;
  }
  if(ship.level===BOAT_LEVEL_LIMIT)ship.xp=Math.min(ship.xp,boatExperienceRequired(ship.level)-1);
  if(ship.level!==previous)refreshBoat(ship,{heal:true});
  return ship.level-previous;
}
export function raiseBoatLevel(ship,amount){
  if(!Number.isInteger(amount)||amount<=0)return 0;
  const previous=ship.level;ship.level=Math.min(BOAT_LEVEL_LIMIT,ship.level+amount);
  if(ship.level!==previous)refreshBoat(ship,{heal:true});return ship.level-previous;
}
export function serializeBoat(ship){
  return JSON.stringify({version:1,hull:ship.hull,level:ship.level,xp:ship.xp,hp:ship.hp});
}
export function restoreBoat(raw,hull='guppy'){
  const ship=createBoatState(hull);
  try{
    const data=JSON.parse(raw);
    if(data?.version!==1||data.hull!==hull||!Number.isInteger(data.level)||data.level<1||data.level>BOAT_LEVEL_LIMIT||
      !Number.isFinite(data.xp)||data.xp<0||data.xp>=boatExperienceRequired(data.level)||
      !Number.isFinite(data.hp)||data.hp<0||data.hp>boatStats(data.level).maxHp)return ship;
    ship.level=data.level;ship.xp=data.xp;refreshBoat(ship,{heal:true});ship.hp=data.hp;
  }catch{}
  return ship;
}
export function boatSnapshot(ship,name='Guppy'){
  return {name,className:'Barco',level:ship.level,hp:Math.ceil(ship.hp),...ship.stats,
    maxMp:0,mp:0,xp:`${ship.xp} / ${boatExperienceRequired(ship.level)}`};
}
