const MAX=1e9;
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=MAX?v:0;
export function createAdventure({content,raw=null,random=Math.random,onChange=()=>{}}){
  let data=content,saved;try{saved=typeof raw==='string'?JSON.parse(raw):raw;}catch{}
  const state={version:1,gold:saved?.version===1?count(saved.gold):0,inventory:Object.create(null),quests:Object.create(null)};
  if(saved?.version===1){
    for(const [key,value] of Object.entries(saved.inventory||{}))if(count(value))state.inventory[key]=count(value);
    for(const [key,value] of Object.entries(saved.quests||{}))if(value&&['active','completed'].includes(value.status))
      state.quests[key]={status:value.status,kills:Object.assign(Object.create(null),Object.fromEntries(Object.entries(value.kills||{}).map(([k,v])=>[k,count(v)])))};
  }
  const item=id=>data.items.find(i=>i.id===id),quest=id=>data.quests.find(q=>q.id===id);
  const quantity=id=>state.inventory[id]||0;
  const changed=()=>onChange(api);
  function exchange(cost,reward,goldCost=0,goldReward=0){
    if(state.gold<goldCost||cost.some(s=>quantity(s.itemId)<s.quantity))throw Error('Ouro ou itens insuficientes.');
    const next=Object.assign(Object.create(null),state.inventory);
    for(const s of cost)next[s.itemId]=(next[s.itemId]||0)-s.quantity;
    for(const s of reward){if(!item(s.itemId))throw Error('Item indisponível.');next[s.itemId]=(next[s.itemId]||0)+s.quantity;}
    if(state.gold-goldCost+goldReward>MAX||Object.values(next).some(v=>v>MAX))throw Error('Limite de ouro ou itens alcançado.');
    state.inventory=next;state.gold=state.gold-goldCost+goldReward;
  }
  function progress(q){
    const saved=state.quests[q.id];
    return q.objectives.map(o=>({...o,current:Math.min(o.quantity,o.type==='kill'?saved?.kills[o.id]||0:quantity(o.itemId))}));
  }
  const api={state,quantity,progress,item,
    setContent(next){data=next;},
    status(id){return state.quests[id]?.status||'available';},
    canAccept(q,level){return !state.quests[q.id]&&level>=q.minimumLevel&&q.requires.every(id=>state.quests[id]?.status==='completed');},
    accept(id,npcId,level){
      const q=quest(id);if(!q||q.startNpcId!==npcId||!api.canAccept(q,level))throw Error('Missão indisponível neste NPC ou nível.');
      state.quests[id]={status:'active',kills:Object.create(null)};changed();
    },
    ready(q){return state.quests[q.id]?.status==='active'&&progress(q).every(o=>o.current>=o.quantity);},
    complete(id,npcId){
      const q=quest(id);if(!q||q.endNpcId!==npcId||!api.ready(q))throw Error('Cumpra os objetivos e fale com o NPC de entrega.');
      exchange(q.objectives.filter(o=>o.type==='collect').map(o=>({itemId:o.itemId,quantity:o.quantity})),q.rewards.items,0,q.rewards.gold);
      state.quests[id].status='completed';changed();return q.rewards;
    },
    kill(speciesId){
      for(const q of data.quests)if(state.quests[q.id]?.status==='active')for(const o of q.objectives)
        if(o.type==='kill'&&o.speciesId===speciesId){const kills=state.quests[q.id].kills;kills[o.id]=Math.min(o.quantity,(kills[o.id]||0)+1);}
      const loot=[];
      for(const row of data.drops.find(d=>d.speciesId===speciesId)?.items||[])if(random()<row.chance){
        const amount=row.min+Math.floor(random()*(row.max-row.min+1)),added=Math.min(amount,MAX-quantity(row.itemId));
        if(added){state.inventory[row.itemId]=quantity(row.itemId)+added;loot.push({itemId:row.itemId,quantity:added});}
      }
      changed();return loot;
    },
    buy(npcId,index){
      const sale=data.services.find(s=>s.npcId===npcId)?.shop[index];if(!sale)throw Error('Oferta indisponível.');
      exchange([],[{itemId:sale.itemId,quantity:sale.quantity}],sale.price);changed();
    },
    sell(npcId,itemId){
      const service=data.services.find(s=>s.npcId===npcId),i=item(itemId);
      if(!service?.buysItems||!i||i.sellPrice<=0)throw Error('Este NPC não compra este item.');
      exchange([{itemId,quantity:1}],[],0,i.sellPrice);changed();
    },
    trade(npcId,tradeId){
      const t=data.services.find(s=>s.npcId===npcId)?.trades.find(t=>t.id===tradeId);if(!t)throw Error('Troca indisponível.');
      exchange(t.cost,t.reward,t.goldCost);changed();
    },
    bagItems(){return data.items.filter(i=>quantity(i.id)>0).map(i=>({...i,key:'content:'+i.id,quantity:quantity(i.id),slotName:'Item · '+i.id}));},
    serialize(){return JSON.stringify(state);}
  };
  return api;
}
