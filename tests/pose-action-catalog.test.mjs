import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weaponBankForJob,actionNumber,actionClip,historicalAction,
  catalogForActor,filterHistoricalActions} from '../js/pose-action-catalog.mjs';
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const catalog=JSON.parse(text('assets/poses/historical-catalog.json'));
const gear=JSON.parse(text('assets/equipment/manifest.json'));

test('catálogo original tem 54 ações por cada uma das 7 categorias sem inventar IDs',()=>{
  assert.equal(catalog.version,1);
  assert.equal(catalog.actions.length,54);
  assert.equal(catalog.groups.length,7);
  const ids=catalog.actions.flatMap(x=>x.ids);
  assert.equal(ids.length,378);
  assert.equal(new Set(ids).size,378);
  assert.equal(ids[0],1);
  assert.deepEqual(catalog.actions[15].ids,[16,70,124,178,232,286,340]);
});
test('Lance Crusader inclui 016/030/031 compartilhados e 178/192/193 armados',()=>{
  assert.equal(weaponBankForJob('crusader',gear),3);
  const actions=catalogForActor(catalog,'lance',3,[],'both');
  assert.equal(actions.length,108);
  for(const [id,label] of [[16,'Sentado no chão'],[30,'Sentado no banco'],[31,'Encostado na parede'],
    [166,'Postura de guarda'],[168,'Corrida armada'],
    [169,'Ataque básico 1'],[170,'Ataque básico 2'],[171,'Ataque básico 3'],
    [178,'Sentado no chão'],[192,'Sentado no banco'],[193,'Encostado na parede']]){
    const row=actions.find(x=>x.id===id);
    assert.ok(row,'ID histórico '+id+' deve existir no catálogo');
    assert.equal(row.label,label);
    assert.ok(row.frames?.[1]>row.frames?.[0],id+' deve ter frames originais');
  }
  assert.equal(actions.filter(x=>x.group===3).length,54);
  assert.equal(actions.filter(x=>x.group===0).length,54);
});
test('arma de cada classe vem do manifesto sem confundir IDs',()=>{
  assert.equal(weaponBankForJob('sharpshooter',gear),4);
  assert.equal(weaponBankForJob('hunter',gear),5);
  assert.equal(weaponBankForJob('cleric',gear),1);
  assert.equal(weaponBankForJob('champion',gear),2);
  assert.equal(weaponBankForJob('voyager',gear),6);
  assert.equal(weaponBankForJob('seal-master',gear),1);
  assert.equal(catalogForActor(catalog,'lance',3,[],'armed').length,54);
  assert.equal(catalogForActor(catalog,'lance',3,[],'base').length,54);
});
test('ID carregado no GLB não deve ser confundido com histórico presente no TXT',()=>{
  const clips=[{name:'016 · Movimento',duration:1},{name:'166 · Combate',duration:1}];
  assert.equal(actionNumber('016 · Movimento'),16);
  assert.equal(actionNumber('166 - Combate'),166);
  assert.equal(actionNumber('Ataque 016'),null);
  assert.equal(actionClip(clips,16),clips[0]);
  const exported=historicalAction(catalog,'lance',16,clips);
  assert.equal(exported.status,'exported');
  assert.equal(exported.available,true);
  const missing=historicalAction(catalog,'lance',192,clips);
  assert.equal(missing.status,'not-exported');
  assert.equal(missing.available,false);
  const notDefined=historicalAction(catalog,'carsise',217,clips);
  assert.equal(notDefined.status,'no-source-frames');
});
test('busca sem acentos, por ID e categoria não exclui poses armadas ausentes do GLB',()=>{
 const rows=catalogForActor(catalog,'lance',3,[],'both');
 assert.equal(filterHistoricalActions(rows,{query:'016'}).length,1);
 const banco=filterHistoricalActions(rows,{query:'banco'});
 assert.deepEqual(banco.map(x=>x.id).sort((a,b)=>a-b),[30,192]);
 assert.ok(filterHistoricalActions(rows,{query:'POSICAO'}).length===0);
 assert.ok(filterHistoricalActions(rows,{category:'combat'}).some(x=>x.id===169));
 assert.ok(filterHistoricalActions(rows,{status:'not-exported'}).some(x=>x.id===166));
});
test('editor e exportador não restringem mais catálogo às cinco poses genéricas',()=>{
 const html=text('tests/pose-editor.html'),editor=text('tests/pose-editor.mjs');
 const build=text('scripts/build_evanescence.py'),converter=text('Lance/converter.py');
 for(const id of ['catalog-bank','catalog-category','catalog-status','catalog-search',
   'catalog-list','catalog-detail','catalog-use'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(editor,/catalogForActor\(historicalCatalog,actorEl\.value,bank,clips/);
 assert.match(editor,/fetch\('assets\/poses\/historical-catalog\.json\?v=1'\)/);
 assert.match(editor,/option\.textContent=record\?record\.code/);
 assert.match(build,/base_ids=range\(1,55\) if not args\.compact/);
 assert.match(converter,/"Sentado no chão"/);
 assert.match(converter,/"Sentado no banco"/);
 assert.match(converter,/"Encostado na parede"/);
 assert.match(html,/pose-editor\.mjs\?v=2/);
});
