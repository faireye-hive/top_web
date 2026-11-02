import {CONTENT_PROJECT_KEY,validateContent} from './content-data.mjs';
const labels={quests:'Missões',items:'Itens',drops:'Drops por espécie',services:'Lojas, compras e trocas',npcs:'NPCs completos'};
export function createContentEditor({project:initial,published,species,canvas,pick,position,apply,onOpen,canOpen}){
  let project=structuredClone(initial),open=false,placing=false,dirty=false,section='quests',selected=initial.npcs[0]?.id;
  const drafts=new Map();
  const panel=document.createElement('aside');panel.id='content-editor';panel.hidden=true;panel.setAttribute('aria-label','Editor de NPCs e missões');
  panel.innerHTML=`<header><h2>NPCs e aventuras</h2><button type="button" data-field="close" aria-label="Fechar editor">×</button></header>
  <p>Edite, aplique a prévia e salve no navegador. Exporte o projeto para guardar ou publicar.</p>
  <details open><summary>Posicionar NPC</summary>
    <label>NPC<select data-field="npc"></select></label><small data-field="npc-id"></small>
    <label>Nome<input data-field="name" maxlength="120"></label>
    <label>Modelo<select data-field="model"></select></label>
    <div class="content-row"><label>X<input data-field="x" type="number" step="0.01" min="0" max="4095.99"></label><label>Z<input data-field="z" type="number" step="0.01" min="0" max="4095.99"></label></div>
    <label>Rotação (graus)<input data-field="yaw" type="number" step="1"></label>
    <button type="button" data-field="npc-apply">Aplicar posição e nome</button><button type="button" data-field="here">Usar posição do herói</button>
    <button type="button" data-field="place">Escolher ponto no chão</button><button type="button" data-field="duplicate">Duplicar com ID novo</button>
    <small>Para mover: selecione um NPC e clique em “Escolher ponto no chão”, depois toque no destino. Botão direito gira a câmera. Feche o editor para caminhar.</small>
  </details>
  <label>Conteúdo<select data-field="section"></select></label>
  <small>IDs de espécies (compartilhados por todos os monstros da espécie)</small><select data-field="species" aria-label="Catálogo de espécies"></select>
  <small>Copie o ID mostrado para speciesId. A missão liga NPCs por startNpcId e endNpcId. Chance de drop: 0 a 1. Os objetivos de coleta consomem os itens na entrega.</small>
  <label>JSON editável<textarea data-field="json" spellcheck="false" aria-label="Conteúdo JSON"></textarea></label>
  <button type="button" data-field="example">Adicionar exemplo editável</button><button type="button" data-field="apply">Validar e aplicar JSON</button>
  <details><summary>Criar missão com campos</summary>
    <label>Título<input data-field="quest-name" value="Minha missão"></label>
    <label>NPC que oferece<select data-field="quest-start"></select></label><label>NPC que recebe<select data-field="quest-end"></select></label>
    <label>Espécie a derrotar<select data-field="quest-species"></select></label><label>Quantidade de monstros<input data-field="quest-kills" type="number" min="1" value="3"></label>
    <label>Item a entregar<select data-field="quest-item"></select></label><label>Quantidade de itens<input data-field="quest-collect" type="number" min="1" value="2"></label>
    <div class="content-row"><label>Ouro<input data-field="quest-gold" type="number" min="0" value="40"></label><label>XP<input data-field="quest-xp" type="number" min="0" value="80"></label></div>
    <button type="button" data-field="quest-add">Criar missão e aplicar</button><small>Depois edite a descrição e outros objetivos no JSON. O ID é criado automaticamente.</small>
  </details>
  <button type="button" data-field="save">Salvar no navegador</button><button type="button" data-field="export">Exportar projeto JSON</button>
  <label>Importar projeto JSON<input data-field="import" type="file" accept="application/json,.json"></label>
  <button type="button" data-field="restore">Restaurar prévia publicada</button>
  <p role="status" data-field="status">Alterações locais. Para todos os jogadores, publique os arquivos exportados no repositório.</p>`;
  document.body.append(panel);
  const $=key=>panel.querySelector(`[data-field="${key}"]`),status=message=>{$('status').textContent=message;};
  const options=(select,rows,valueKey='id',label=row=>row.name)=>{
    const previous=select.value;select.replaceChildren();
    for(const row of rows){const option=document.createElement('option');option.value=row[valueKey];option.textContent=label(row);select.append(option);}
    if(rows.some(row=>row[valueKey]===previous))select.value=previous;
  };
  options($('section'),Object.entries(labels).map(([id,name])=>({id,name})));
  const types=Object.entries(species).map(([id,s])=>({id,name:`${s.name} · ${id}`})).sort((a,b)=>a.name.localeCompare(b.name));
  options($('species'),types);options($('quest-species'),types);$('quest-species').value='original-103';
  function showJson(){ $('section').value=section;$('json').value=drafts.get(section)??JSON.stringify(project[section],null,2); }
  function fields(){
    const npc=project.npcs.find(n=>n.id===selected);if(!npc)return;
    $('npc').value=npc.id;$('npc-id').textContent='ID permanente: '+npc.id;
    for(const key of ['name','model','x','z','yaw'])$(key).value=npc[key];
  }
  function sync(){
    options($('npc'),project.npcs,'id',n=>`${n.name} · ${n.id}`);
    for(const key of ['quest-start','quest-end'])options($(key),project.npcs,'id',n=>`${n.name} · ${n.id}`);
    options($('quest-item'),project.items);
    options($('model'),[...new Set([...published.npcs,...project.npcs].map(n=>n.model))].map(id=>({id,name:id})));
    if(!project.npcs.some(n=>n.id===selected))selected=project.npcs[0]?.id;
    fields();showJson();
  }
  function staged(){
    const next=structuredClone(project);
    for(const [key,value] of drafts)try{next[key]=JSON.parse(value);}catch(error){throw Error(`${labels[key]}: JSON inválido. ${error.message}`);}
    return next;
  }
  function adopt(next){
    const valid=validateContent(next,species);apply(valid);dirty=dirty||JSON.stringify(project)!==JSON.stringify(valid);project=valid;drafts.clear();sync();
    status('Prévia aplicada no jogo. Salve no navegador ou exporte para guardar.');
  }
  function action(fn){return ()=>{try{fn();}catch(error){status(error.message);}};}
  function updateNpc(coords=null){
    const next=staged(),npc=next.npcs.find(n=>n.id===selected);if(!npc)throw Error('Selecione um NPC.');
    Object.assign(npc,{name:$('name').value,model:$('model').value,x:Number($('x').value),z:Number($('z').value),yaw:Number($('yaw').value)},coords||{});
    adopt(next);
  }
  $('npc').onchange=()=>{selected=$('npc').value;placing=false;fields();};
  $('section').onchange=()=>{section=$('section').value;showJson();};
  $('json').oninput=()=>{drafts.set(section,$('json').value);dirty=true;status('JSON alterado. Valide e aplique para atualizar o jogo.');};
  $('npc-apply').onclick=action(()=>updateNpc());
  $('here').onclick=action(()=>{const p=position();updateNpc({x:+p.x.toFixed(2),z:+p.z.toFixed(2)});});
  $('place').onclick=()=>{placing=!placing;status(placing?'Clique em um ponto de terra firme para mover o NPC selecionado.':'Posicionamento cancelado.');};
  $('duplicate').onclick=action(()=>{
    const next=staged(),source=next.npcs.find(n=>n.id===selected);if(!source)throw Error('Selecione um NPC para duplicar.');
    const npc=structuredClone(source);npc.id='npc-'+crypto.randomUUID();delete npc.serial;
    npc.name+=' (cópia)';const p=position();npc.x=+p.x.toFixed(2);npc.z=+p.z.toFixed(2);next.npcs.push(npc);
    adopt(next);selected=npc.id;fields();status('NPC duplicado com ID próprio, na posição do herói. Configure suas missões e serviços pelo novo ID.');
  });
  $('quest-add').onclick=action(()=>{
    const next=staged();next.quests.push({id:'quest-'+crypto.randomUUID(),name:$('quest-name').value,
      description:'Derrote os monstros, recolha os itens e entregue ao NPC indicado.',startNpcId:$('quest-start').value,endNpcId:$('quest-end').value,minimumLevel:1,requires:[],
      objectives:[{id:'defeat',type:'kill',speciesId:$('quest-species').value,quantity:Number($('quest-kills').value)},
        {id:'collect',type:'collect',itemId:$('quest-item').value,quantity:Number($('quest-collect').value)}],
      rewards:{gold:Number($('quest-gold').value),xp:Number($('quest-xp').value),items:[]}});
    section='quests';adopt(next);
  });
  $('example').onclick=action(()=>{
    const next=staged(),suffix=crypto.randomUUID().slice(0,8),firstItem=next.items[0]?.id;
    if(section==='npcs'){ $('duplicate').click();return; }
    if(section==='items')next.items.push({id:'item-'+suffix,name:'Novo material',kind:'material',symbol:'◆',description:'Descreva seu item aqui.',sellPrice:1});
    if(section==='quests'){$('quest-add').click();return;}
    if(section==='drops'){
      const speciesId=$('species').value;
      if(next.drops.some(d=>d.speciesId===speciesId))throw Error('Esta espécie já tem drops. Edite o registro existente no JSON.');
      next.drops.push({speciesId,items:[{itemId:firstItem,chance:0.5,min:1,max:1}]});
    }
    if(section==='services'){
      if(next.services.some(s=>s.npcId===selected))throw Error('Este NPC já tem serviços. Edite seu registro no JSON.');
      next.services.push({npcId:selected,dialogue:'Bem-vindo à minha loja!',buysItems:true,shop:[{itemId:firstItem,quantity:1,price:5}],
        trades:[{id:'trade-'+suffix,name:'Minha troca',goldCost:0,cost:[{itemId:firstItem,quantity:3}],reward:[{itemId:next.items[1]?.id||firstItem,quantity:1}]}]});
    }
    drafts.set(section,JSON.stringify(next[section],null,2));dirty=true;showJson();status('Exemplo adicionado ao JSON. Edite os valores e clique em Validar e aplicar JSON.');
  });
  $('apply').onclick=action(()=>adopt(staged()));
  $('save').onclick=action(()=>{adopt(staged());localStorage.setItem(CONTENT_PROJECT_KEY,JSON.stringify(project));dirty=false;status('Salvo neste navegador. Para publicar para todos, exporte o projeto e atualize os arquivos do repositório.');});
  $('export').onclick=action(()=>{
    adopt(staged());const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='adventure-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Projeto exportado. Para republicar: consulte docs/CONTEUDO_E_MISSOES.md.');
  });
  $('import').onchange=async()=>{try{const file=$('import').files[0];if(!file)return;if(file.size>4*1024*1024)throw Error('Projeto deve ter até 4 MB.');adopt(JSON.parse(await file.text()));}catch(error){status(error.message);}finally{$('import').value='';}};
  $('restore').onclick=action(()=>adopt(published));
  const show=(value=true)=>{if(value&&!canOpen())return;open=value;placing=false;panel.hidden=!open;document.body.classList.toggle('content-editing',open);if(open)onOpen();};
  $('close').onclick=()=>show(false);
  canvas.addEventListener('pointerdown',event=>{
    if(!open||event.button!==0)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!placing)return;
    const point=pick(event.clientX,event.clientY);
    if(!point){status('Escolha um ponto de terra firme carregada.');return;}
    try{updateNpc({x:+point.x.toFixed(2),z:+point.z.toFixed(2)});placing=false;}catch(error){status(error.message);}
  },true);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  sync();return {show,isOpen:()=>open};
}
