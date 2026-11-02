function el(tag,text,parent){const node=document.createElement(tag);if(text!=null)node.textContent=text;parent?.append(node);return node;}
export function createAdventureUi({getContent,adventure,getLevel,onPause,onReward,onArena,canOpen=()=>true,onMessage=()=>{}}){
  const dialog=el('dialog');dialog.className='adventure-dialog';dialog.setAttribute('aria-label','Missões e comércio');document.body.append(dialog);
  let npcId=null;
  const button=(parent,label,action,disabled=false)=>{
    const b=el('button',label,parent);b.type='button';b.disabled=disabled;b.onclick=()=>{try{action();render();}catch(error){onMessage(error.message);}};return b;
  };
  function npcName(id){const n=getContent().npcs.find(n=>n.id===id);return n?`${n.name} · ${n.x.toFixed(1)}, ${n.z.toFixed(1)}`:id;}
  const stacks=rows=>rows.map(s=>`${s.quantity} × ${adventure.item(s.itemId)?.name||s.itemId}`).join(', ');
  function questCard(q,parent){
    const data=getContent(),card=el('section',null,parent);card.className='adventure-card';
    const status=adventure.status(q.id),active=status==='active';
    const label=status==='completed'?'Concluída':active?(adventure.ready(q)?'Pronta para entregar':'Em andamento'):'Disponível';
    el('h3',q.name+' · '+label,card);el('p',q.description,card);
    for(const o of adventure.progress(q)){
      const name=o.type==='kill'?data.species?.[o.speciesId]?.name||o.speciesId:adventure.item(o.itemId)?.name;
      el('p',`${o.type==='kill'?'Derrotar':'Entregar'} ${name}: ${status==='completed'?o.quantity:o.current} / ${o.quantity}`,card);
    }
    el('small',`Início: ${npcName(q.startNpcId)}\nEntrega: ${npcName(q.endNpcId)}\nRecompensa: ${q.rewards.gold} ouro · ${q.rewards.xp} XP${q.rewards.items.length?' · '+stacks(q.rewards.items):''}`,card);
    if(npcId===q.startNpcId&&status==='available'){
      button(card,'Aceitar missão',()=>adventure.accept(q.id,npcId,getLevel()),!adventure.canAccept(q,getLevel()));
      if(!adventure.canAccept(q,getLevel()))el('p',`Requer nível ${q.minimumLevel} e as missões anteriores concluídas.`,card);
    }
    if(npcId===q.endNpcId&&active)button(card,'Entregar missão',()=>{
      const reward=adventure.complete(q.id,npcId);onReward(reward);onMessage('Missão concluída! Recompensas recebidas.');
    },!adventure.ready(q));
  }
  function render(){
    dialog.replaceChildren();const content=getContent(),npc=content.npcs.find(n=>n.id===npcId);
    const header=el('header',null,dialog);el('h2',npc?.name||'Diário de missões',header);button(header,'Fechar',()=>dialog.close());
    el('p',`Ouro: ${adventure.state.gold}`,dialog);
    const quests=content.quests.filter(q=>!npcId||q.startNpcId===npcId||q.endNpcId===npcId);
    if(npc)el('small',`ID: ${npc.id}`,dialog);
    const service=content.services.find(s=>s.npcId===npcId);
    if(service?.dialogue)el('p',service.dialogue,dialog);
    for(const q of quests)questCard(q,dialog);
    if(!quests.length&&!npc)el('p','Nenhuma missão publicada.',dialog);
    if(npc&&onArena?.isAdministrator(npc))button(dialog,'Entrar na Torre da Provação',()=>{dialog.close();onArena.open();});
    if(service){
      if(service.shop.length){el('h3','Comprar do NPC',dialog);service.shop.forEach((sale,index)=>button(dialog,
        `${stacks([sale])} · ${sale.price} ouro`,()=>adventure.buy(npcId,index),adventure.state.gold<sale.price));}
      if(service.buysItems){
        el('h3','Vender ao NPC · uma unidade',dialog);
        el('small','Materiais vendidos ou trocados deixam de contar para a entrega das missões.',dialog);
        const sellable=content.items.filter(i=>i.sellPrice>0&&adventure.quantity(i.id)>0);
        if(!sellable.length)el('p','Você ainda não possui itens que este NPC compre.',dialog);
        for(const i of sellable)button(dialog,`${i.name} (${adventure.quantity(i.id)}) · receber ${i.sellPrice} ouro`,()=>adventure.sell(npcId,i.id));
      }
      if(service.trades.length)el('h3','Trocas',dialog);
      for(const trade of service.trades){
        const card=el('section',null,dialog);card.className='adventure-card';el('h4',trade.name,card);
        el('p',`Entregar: ${stacks(trade.cost)}${trade.goldCost?' + '+trade.goldCost+' ouro':''}\nReceber: ${stacks(trade.reward)}`,card);
        button(card,'Fazer troca',()=>adventure.trade(npcId,trade.id),adventure.state.gold<trade.goldCost||trade.cost.some(s=>adventure.quantity(s.itemId)<s.quantity));
      }
    }
    if(npc&&!service&&!quests.length)el('p','Olá, aventureiro!',dialog);
  }
  return {isOpen:()=>dialog.open,refresh(){if(dialog.open)render();},show(npc=null){
    if(!canOpen()||dialog.open)return;onPause();npcId=npc?.id||null;render();dialog.showModal();
  }};
}
