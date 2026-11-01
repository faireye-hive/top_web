export const BAG_LAYOUTS=Object.freeze({classic:'Grade clássica',split:'Painel do aventureiro',list:'Lista detalhada'});
export const BAG_LAYOUT_KEY='topweb_bag_layout_v1';
export const bagLayout=value=>Object.hasOwn(BAG_LAYOUTS,value)?value:'classic';
export const EQUIPMENT_SLOTS={2:'Corpo',3:'Mãos',4:'Pés',6:'Mão esquerda',9:'Mão direita'};
export function heroInventory(hero,manifest){
  return (manifest?.sets?.[hero.job]?.items||[]).map(item=>({
    ...item,key:`${hero.job}:${item.slot}:${item.id}`,equipped:hero.equipped,
    kind:[6,9].includes(item.slot)?'weapon':'armor',slotName:EQUIPMENT_SLOTS[item.slot]||'Equipamento',
    symbol:[6,9].includes(item.slot)?'⚔':item.slot===2?'♜':item.slot===3?'✋':'♟',
    description:`${EQUIPMENT_SLOTS[item.slot]||'Equipamento'} · nível mínimo ${item.minimumLevel||1}`
  }));
}
export function inventorySelection(items,key){return items.find(item=>item.key===key)||items[0]||null;}
export function filterInventory(items,{query='',kind='all'}={}){
  const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const text=normalize(query.trim());
  return items.filter(item=>(kind==='all'||item.kind===kind)&&
    (!text||normalize(`${item.name} ${item.slotName||''}`).includes(text)));
}
