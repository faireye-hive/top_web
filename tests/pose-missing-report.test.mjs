import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogForActor,missingHistoricalActions,missingActionReportText,
  HISTORICAL_LAB_BY_ACTOR} from '../js/pose-action-catalog.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const catalog=JSON.parse(read('assets/poses/historical-catalog.json'));

test('lista de ausentes contém nomes, números e frames do Lance Crusader',()=>{
 const all=catalogForActor(catalog,'lance',3,[],'both');
 const missing=missingHistoricalActions(all);
 assert.ok(missing.length>0);
 for(const id of [16,30,31,166,168,169,170,171,178,192,193]){
   const row=missing.find(x=>x.id===id);
   assert.ok(row,'ID '+id+' deve aparecer entre as ações com frames não exportadas');
   assert.ok(row.label.length>3);
   assert.ok(row.frames[1]>row.frames[0]);
 }
 const text=missingActionReportText({actor:'lance',job:'crusader',
   modelPath:'assets/equipment/models/lance-crusader.glb',records:all});
 assert.match(text,/Lance/);
 assert.match(text,/crusader/);
 assert.match(text,/assets\/equipment\/models\/lance-crusader\.glb/);
 assert.match(text,/Client\/animation\/0000\.lab/);
 assert.match(text,/CharacterAction\.tx/);
 for(const name of ['Postura de guarda','Sentado no banco','Encostado na parede','Ataque básico 2']){
   assert.ok(text.includes(name),'deve descrever '+name);
 }
 assert.match(text,/166 — Postura de guarda \| Duas espadas \| frames 1347–1379/);
 assert.match(text,/192 — Sentado no banco \| Duas espadas \| frames 804–852/);
});
test('ação já convertida não aparece no relatório e ações sem frames não são falsas faltantes',()=>{
 const clips=[{name:'016 · Movimento'},{name:'166 · Combate'}];
 const all=catalogForActor(catalog,'lance',3,clips,'both');
 const missing=missingHistoricalActions(all);
 assert.ok(!missing.some(x=>x.id===16||x.id===166));
 assert.ok(missing.some(x=>x.id===169));
 assert.ok(!missing.some(x=>x.status==='no-source-frames'));
 assert.ok(all.some(x=>x.status==='no-source-frames'));
 const text=missingActionReportText({actor:'lance',job:'crusader',records:all});
 assert.doesNotMatch(text,/^016 — /m);
 assert.doesNotMatch(text,/^166 — /m);
 assert.match(text,/^169 — Ataque básico 1/m);
});
test('relatório troca o LAB de referência por personagem e respeita banco selecionado',()=>{
 for(const [actor,filename] of Object.entries(HISTORICAL_LAB_BY_ACTOR)){
   const all=catalogForActor(catalog,actor,1,[],'armed');
   assert.equal(all.length,54);
   const report=missingActionReportText({actor,job:'cleric',records:all});
   assert.match(report,new RegExp('Client/animation/'+filename.replace('.','\\.') ));
 }
});
test('editor mostra os nomes faltantes antes do catálogo e oferece copiar e TXT',()=>{
 const html=read('tests/pose-editor.html'),source=read('tests/pose-editor.mjs');
 const first=html.indexOf('id="missing-section"'),catalogAt=html.indexOf('id="catalog-list"');
 assert.ok(first>0&&first<catalogAt,'relatório deve ser fácil de ver, antes da lista enorme');
 for(const id of ['missing-title','missing-source','missing-filter','missing-copy',
  'missing-download','missing-details','missing-list'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(source,/function renderMissingReport\(\)/);
 assert.match(source,/renderMissingReport\(\)/);
 assert.match(source,/missingHistoricalActions\(catalogRows\(\)\)/);
 assert.match(source,/row\.code\+' · '\+row\.label\+' — '\+row\.groupName/);
 assert.match(source,/downloadMissingList\(\)/);
 assert.match(source,/navigator\.clipboard\.writeText\(report\)/);
 assert.match(html,/pose-editor\.mjs\?v=5/);
});
