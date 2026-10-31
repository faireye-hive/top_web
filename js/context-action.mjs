// Prioridade de interação compartilhada pelo botão touch e pelo teclado.
export function resolvePrimaryAction({recovering=false,seated=false,npc=null,pose=null}={}){
  if(recovering)return {type:'recovering',label:'Recuperando',icon:'#ui-swords'};
  if(seated)return {type:'stand',label:'Levantar',icon:'#ui-talk'};
  if(npc)return {type:'npc',label:'Conversar',icon:'#ui-talk',npc};
  if(pose)return {type:'pose',label:pose.role==='sit'?'Sentar':'Encostar',icon:'#ui-talk',pose};
  return {type:'attack',label:'Atacar',icon:'#ui-swords'};
}
