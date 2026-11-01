import {boatSnapshot,boatStats,boatMovementSpeed,BOAT_LEVEL_LIMIT} from './boat-state.mjs?v=2';
export function initBoatStatsUi({ship,profile,onPause,canOpen}){
  const $=id=>document.getElementById(id),dialog=$('boat-stats-dialog');
  const number=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2});
  function update(){
    if(!dialog.open)return;
    const {name,baseSpeed}=profile(),stats=boatSnapshot(ship,name);
    $('boat-stats-title').textContent=`${stats.name} · Nível ${ship.level}`;
    const values={hp:`${stats.hp} / ${stats.maxHp}`,xp:stats.xp,attack:stats.attack,defense:stats.defense,
      speed:`${number(boatMovementSpeed(ship,baseSpeed))} m/s`,bonus:`+${number((stats.movementMultiplier-1)*100)}%`,
      accuracy:number(stats.accuracy),evasion:number(stats.evasion),cadence:`${number(stats.attackSpeed)} / s`};
    for(const [key,value] of Object.entries(values))$(`boat-stat-${key}`).textContent=value;
    const next=boatStats(Math.min(BOAT_LEVEL_LIMIT,ship.level+1));
    $('boat-stats-growth').textContent=ship.level===BOAT_LEVEL_LIMIT?'Nível máximo do barco atingido.':
      `Próximo nível: +140 HP · +14 ataque · +3 defesa · velocidade ${number(baseSpeed*next.movementMultiplier)} m/s. A velocidade ganha 1% da base por nível.`;
  }
  function open(){
    if(dialog.open||!canOpen())return;
    onPause();dialog.showModal();update();
  }
  $('boat-stats-open').addEventListener('click',open);
  $('naval-stats-open').addEventListener('click',open);
  $('boat-stats-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',onPause);
  return {update,isOpen:()=>dialog.open};
}
