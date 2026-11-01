export const ARENA_RETURN=Object.freeze({x:2207,z:2891});
export const ARENA_SPAWN=Object.freeze({x:44.5,z:35.5});
export const ARENA_RUN_KEY='topweb_arena_run_v1',ARENA_HERO_KEY='topweb_arena_hero_v1';
const attributes=['strength','intelligence','constitution','dexterity','agility'];
const primary={crusader:'strength',champion:'strength',sharpshooter:'dexterity',hunter:'dexterity',cleric:'intelligence','seal-master':'intelligence',voyager:'intelligence'};
const labels={strength:'Força',intelligence:'Inteligência',constitution:'Constituição',dexterity:'Destreza',agility:'Agilidade'};
const details={strength:'+6 ataque com espada ou espadão',intelligence:'+24 mana e +6 poder mágico',constitution:'+36 HP máximo e +3 defesa',dexterity:'+9 acerto; +6 ataque com arco ou tiro',agility:'+6 esquiva e velocidade de ataque'};
export function isArenaAdministrator(npc){return npc?.serial===52||npc?.name==='Arena Administrator';}
export function arenaChoices(floor,job){
  const main=primary[job]||'strength',utilities=['agility','intelligence','dexterity'].filter(key=>key!==main);
  return [main,'constitution',utilities[(floor-1)%utilities.length]].map(attribute=>({attribute,label:labels[attribute],amount:3,detail:details[attribute]}));
}
export function createArenaRun(raw=null){
  let saved;try{saved=typeof raw==='string'?JSON.parse(raw):raw}catch{}
  const valid=saved?.version===1&&Number.isInteger(saved.floor)&&saved.floor>=1&&saved.floor<=10000&&
    ['fighting','choice','ended'].includes(saved.phase)&&attributes.every(key=>Number.isInteger(saved.bonuses?.[key])&&saved.bonuses[key]>=0&&saved.bonuses[key]<=30000)&&
    attributes.reduce((sum,key)=>sum+saved.bonuses[key],0)===(saved.floor-1)*3;
  const run=valid?{version:1,floor:saved.floor,phase:saved.phase,bonuses:{...saved.bonuses}}:
    {version:1,floor:1,phase:'fighting',bonuses:Object.fromEntries(attributes.map(key=>[key,0]))};
  return {get floor(){return run.floor;},get phase(){return run.phase;},get bonuses(){return run.bonuses;},
    complete(monsters){
      if(run.phase!=='fighting'||!monsters.length||!monsters.every(m=>m.hp<=0))return false;
      run.phase='choice';return true;
    },
    choose(attribute,job){
      if(run.phase!=='choice'||!arenaChoices(run.floor,job).some(c=>c.attribute===attribute))return false;
      run.bonuses[attribute]+=3;run.floor++;run.phase='fighting';return true;
    },
    finish(){run.phase='ended';},serialize(){return JSON.stringify(run);}};
}
export function arenaWave(floor,spawn=ARENA_SPAWN){
  const level=Math.max(1,Math.min(10000,Math.floor(floor)||1)),n=level-1;
  const count=Math.min(8,2+Math.floor(n/2));
  const species={'forest-spirit':{name:'Forest Spirit',sourceCharacterId:103,model:'models/forest-spirit.glb',
    maxHp:Math.min(1e7,Math.round(42*(1+.22*n+.015*n*n))),attack:Math.min(1e6,Math.round(7*(1+.16*n+.01*n*n))),
    defense:Math.round(1+n*.55),accuracy:65+Math.min(100,n*2),evasion:4,attackSpeed:Math.min(1.4,.65+n*.015),
    xp:0,moveSpeed:3.2,aggressive:true,aggroRange:80,leash:200,respawn:false}};
  const spawns=Array.from({length:count},(_,id)=>{
    const angle=id/count*Math.PI*2+Math.PI/2;
    return {species:'forest-spirit',x:spawn.x+Math.cos(angle)*8,z:spawn.z+Math.sin(angle)*8};
  });
  return {species,spawns};
}
export function arenaDestination(current,{enter=false,defeated=false,floor=0}={}){
  const url=new URL(current);url.searchParams.delete('spawn');url.searchParams.delete('boat');url.searchParams.delete('arenaResult');url.searchParams.delete('arenaFloor');
  if(enter)url.searchParams.set('map','teampk');
  else{url.searchParams.delete('map');url.searchParams.set('spawn',`${ARENA_RETURN.x},${ARENA_RETURN.z}`);
    url.searchParams.set('arenaResult',defeated?'defeat':'exit');url.searchParams.set('arenaFloor',String(floor));}
  return url.href;
}
