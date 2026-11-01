import {arenaChoices} from './arena-state.mjs';
export function initArenaUi({onEnter,onChoose,onLeave,onPause}={}){
  const $=id=>document.getElementById(id),entry=$('arena-entry-dialog'),choice=$('arena-choice-dialog');
  const pause=()=>onPause?.();
  $('arena-enter').addEventListener('click',()=>{entry.close();onEnter?.();});
  $('arena-entry-close').addEventListener('click',()=>entry.close());
  $('arena-choice-leave').addEventListener('click',()=>onLeave?.());
  $('arena-leave').addEventListener('click',()=>onLeave?.());
  choice.addEventListener('cancel',event=>event.preventDefault());
  function openEntry(){if(entry.open)return;pause();entry.showModal();}
  function showChoice(run,hero){
    $('arena-choice-floor').textContent=String(run.floor);
    $('arena-choice-next').textContent=String(run.floor+1);
    const list=$('arena-choices');list.replaceChildren();
    for(const item of arenaChoices(run.floor,hero.job)){
      const button=document.createElement('button');button.type='button';button.dataset.arenaAttribute=item.attribute;
      const amount=document.createElement('strong');amount.textContent=`+${item.amount}`;
      const label=document.createElement('span');label.textContent=item.label;
      const detail=document.createElement('small');detail.textContent=item.detail;
      button.append(amount,label,detail);button.addEventListener('click',()=>{
        for(const card of list.children)card.disabled=true;
        onChoose?.(item.attribute);
      });list.append(button);
    }
    if(!choice.open){pause();choice.showModal();}
  }
  function update(run,monsters){
    const remaining=monsters.filter(m=>m.hp>0).length;
    const text=`Andar ${run.floor} · ${remaining} / ${monsters.length} inimigos`;
    if($('arena-tower-status').textContent!==text)$('arena-tower-status').textContent=text;
  }
  return {openEntry,showChoice,update,blocked:()=>entry.open||choice.open,
    closeChoice:()=>{if(choice.open)choice.close();}};
}
