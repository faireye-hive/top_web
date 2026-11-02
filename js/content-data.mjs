// Conteúdo publicado e projetos do editor usam o mesmo formato e validação.
export const CONTENT_PROJECT_KEY='topweb_content_project_v1';
export const ADVENTURE_SAVE_KEY='topweb_adventure_v1';
const fail=message=>{throw Error(message);};
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value);
const integer=(value,min=0,max=1e9)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const text=(value,max=2000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const array=(value,name)=>Array.isArray(value)&&value.length<=2000?value:fail(`${name}: use uma lista com até 2.000 registros.`);
function unique(list,name){
  const seen=new Set();
  for(const row of array(list,name)){
    if(!row||!id(row.id)||seen.has(row.id))fail(`${name}: ID inválido ou repetido (${row?.id}).`);
    seen.add(row.id);
  }
  return seen;
}
export function validateContent(input,species){
  const data=structuredClone(input);
  if(data?.version!==1)fail('Projeto: version deve ser 1.');
  const items=unique(data.items,'Itens'),npcs=unique(data.npcs,'NPCs'),quests=unique(data.quests,'Missões');
  const models=/^models\/[\w-]+\.glb$/;
  for(const n of data.npcs)if(!text(n.name,120)||!models.test(n.model)||
    ![n.x,n.z].every(v=>Number.isFinite(v)&&v>=0&&v<4096)||!Number.isFinite(n.yaw)||Math.abs(n.yaw)>36000)
    fail(`NPC ${n.id}: confira nome, modelo, X/Z (0–4095) e rotação em graus.`);
  for(const i of data.items)if(!text(i.name,120)||!['material','quest','consumable'].includes(i.kind)||
    typeof i.description!=='string'||i.description.length>2000||!text(i.symbol,8)||!integer(i.sellPrice))
    fail(`Item ${i.id}: confira nome, kind, description, symbol e sellPrice.`);
  const stack=(s,label)=>{
    if(!s||!items.has(s.itemId)||!integer(s.quantity,1,1000000))fail(`${label}: item ou quantidade inválidos.`);
  };
  const stacks=(rows,label)=>{
    array(rows,label);const seen=new Set();
    for(const s of rows){stack(s,label);if(seen.has(s.itemId))fail(`${label}: agrupe quantidades do item ${s.itemId}.`);seen.add(s.itemId);}
  };
  const speciesExists=value=>typeof value==='string'&&Object.hasOwn(species,value);
  for(const q of data.quests){
    if(!text(q.name,120)||!text(q.description)||!npcs.has(q.startNpcId)||!npcs.has(q.endNpcId)||
      !integer(q.minimumLevel,1,1000)||!Array.isArray(q.requires)||q.requires.some(v=>!quests.has(v)||v===q.id))
      fail(`Missão ${q.id}: confira NPCs, nível, texto e pré-requisitos.`);
    if(!array(q.objectives,'Objetivos').length)fail(`Missão ${q.id}: adicione objetivos.`);
    const objectiveIds=unique(q.objectives,`Objetivos de ${q.id}`);void objectiveIds;
    const collected=new Set();
    for(const o of q.objectives){
      if(!integer(o.quantity,1,1000000)||!['kill','collect'].includes(o.type))fail(`Missão ${q.id}: objetivo inválido.`);
      if(o.type==='kill'&&!speciesExists(o.speciesId))fail(`Missão ${q.id}: espécie ${o.speciesId} inexistente.`);
      if(o.type==='collect'){
        if(!items.has(o.itemId)||collected.has(o.itemId))fail(`Missão ${q.id}: item inexistente ou coleta repetida.`);
        collected.add(o.itemId);
      }
    }
    if(!q.rewards||!integer(q.rewards.gold)||!integer(q.rewards.xp))fail(`Missão ${q.id}: recompensa inválida.`);
    stacks(q.rewards.items,`Recompensas de ${q.id}`);
  }
  const visiting=new Set(),visited=new Set();
  function visit(q){
    if(visiting.has(q.id))fail(`Missões: ciclo de pré-requisitos em ${q.id}.`);
    if(visited.has(q.id))return;visiting.add(q.id);
    for(const ref of q.requires)visit(data.quests.find(v=>v.id===ref));
    visiting.delete(q.id);visited.add(q.id);
  }
  data.quests.forEach(visit);
  const dropSpecies=new Set();
  for(const d of array(data.drops,'Drops')){
    if(!d||!speciesExists(d.speciesId)||dropSpecies.has(d.speciesId))fail(`Drops: espécie inválida ou repetida (${d?.speciesId}).`);
    dropSpecies.add(d.speciesId);
    for(const entry of array(d.items,'Itens de drop')){
      if(!entry||!items.has(entry.itemId)||!Number.isFinite(entry.chance)||entry.chance<0||entry.chance>1||
        !integer(entry.min,1,1000000)||!integer(entry.max,entry.min,1000000))fail(`Drop de ${d.speciesId}: confira item, chance (0–1), min e max.`);
    }
  }
  const serviceNpcs=new Set();
  for(const s of array(data.services,'Serviços')){
    if(!s||!npcs.has(s.npcId)||serviceNpcs.has(s.npcId)||typeof s.buysItems!=='boolean'||
      typeof s.dialogue!=='string'||s.dialogue.length>2000)fail(`Serviços: NPC inválido ou repetido (${s?.npcId}).`);
    serviceNpcs.add(s.npcId);
    for(const sale of array(s.shop,'Loja')){stack(sale,'Loja');if(!integer(sale.price))fail('Loja: preço inválido.');}
    unique(s.trades,'Trocas');
    for(const t of s.trades){
      if(!text(t.name,120)||!integer(t.goldCost)||!t.cost?.length||!t.reward?.length)fail(`Troca ${t.id}: confira nome, custo e recompensa.`);
      stacks(t.cost,'Custo de troca');stacks(t.reward,'Recompensa de troca');
    }
  }
  return data;
}
export async function loadContent(){
  const read=async path=>{const r=await fetch(path,{cache:'no-cache'});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();};
  const [items,quests,drops,services,npcManifest,monsterManifest]=await Promise.all([
    ...['items','quests','drops','npc-services'].map(name=>read(`assets/content/${name}.json`)),
    read('assets/npcs/manifest.json'),read('assets/monsters/manifest.json?v=3')]);
  const published=validateContent({version:1,items,quests,drops,services,npcs:npcManifest.npcs},monsterManifest.species);
  let project=published,warning='';
  try{const saved=localStorage.getItem(CONTENT_PROJECT_KEY);if(saved)project=validateContent(JSON.parse(saved),monsterManifest.species);}
  catch(error){warning='Projeto local ignorado: '+error.message;}
  return {project,published,species:monsterManifest.species,monsterManifest,warning};
}
