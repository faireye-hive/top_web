// Prioridade de interação compartilhada pelo botão touch e pelo teclado.
export function resolvePrimaryAction({recovering=false,seated=false,sailing=false,boarding=null,landing=null,npc=null,pose=null}={}){
  if(recovering)return {type:'recovering',label:'Recuperando',icon:'#ui-swords'};
  if(sailing)return landing?{type:'disembark',label:'Desembarcar',icon:'#ui-boat',destination:landing}
    :{type:'sailing',label:'Navegando',icon:'#ui-boat'};
  if(seated)return {type:'stand',label:'Levantar',icon:'#ui-talk'};
  if(boarding)return {type:'embark',label:'Embarcar',icon:'#ui-boat',destination:boarding};
  if(npc)return {type:'npc',label:'Conversar',icon:'#ui-talk',npc};
  if(pose)return {type:'pose',label:pose.role==='sit'?'Sentar':'Encostar',icon:'#ui-talk',pose};
  return {type:'attack',label:'Atacar',icon:'#ui-swords'};
}
