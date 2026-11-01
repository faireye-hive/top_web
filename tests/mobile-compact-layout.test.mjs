import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const css=read('mobile-compact.css');
const js=read('js/rpg-hud.mjs');
const game=read('js/main.js');
const desktop=read('desktop-hud.css');
const inventory=read('js/inventory-view.mjs');

test('Mobile Compact stylesheet is loaded last and desktop stylesheet remains intact',()=>{
  const mobile=html.indexOf('mobile-compact.css?v=4');
  assert.ok(mobile>html.indexOf('desktop-hud.css?v=1'),'compact stylesheet must load after desktop');
  assert.ok(mobile>html.indexOf('mobile-landscape.css'),'compact stylesheet must override old mobile');
  assert.ok(css.includes('@media (orientation:landscape)'));
  // Global selectors only hide newly introduced mobile-only elements.
  const beforeMobile=css.slice(0,css.indexOf('@media (orientation:landscape)'));
  const globalRules=beforeMobile.replace(/\/\*[\s\S]*?\*\//g,'').trim();
  assert.equal(globalRules,'.rpg-mobile-max,.rpg-mobile-details-toggle{display:none}');
  assert.ok(css.includes('body.mobile-ui .rpg-panel'));
  assert.ok(css.includes('body.mobile-ui .bag-hero{display:none}'));
  assert.ok(css.includes('body.mobile-ui .combat-panel[data-mobile-active="false"]'));
  assert.ok(desktop.includes('.desktop-menu'),'desktop styles are untouched');
});

test('Mobile Status has three visible pages with all 16 original bindings preserved',()=>{
  const stats=[...html.matchAll(/<div class="rpg-stat-cell" data-mobile-stat="(core|extra|duplicate)" data-mobile-group="(general|attributes|combat|duplicate)"><span>(.*?)<\/span><strong data-rpg-stat="(.*?)">/g)];
  assert.equal(stats.length,16,'nenhum atributo histórico pode desaparecer');
  const grouped=(key)=>stats.filter(m=>m[2]===key).map(m=>m[4]);
  assert.deepEqual(grouped('general'),['level','hp','mp']);
  assert.deepEqual(grouped('attributes'),['strength','intelligence','constitution','dexterity','agility']);
  assert.deepEqual(grouped('combat'),['attack','magic','defense','accuracy','evasion','attackSpeed']);
  assert.deepEqual(grouped('duplicate'),['maxHp','maxMp']);
  assert.ok(html.includes('class="rpg-mobile-max">/ <b data-rpg-stat="maxHp"'));
  assert.ok(html.includes('class="rpg-mobile-max">/ <b data-rpg-stat="maxMp"'));
  assert.ok(html.includes('rpg-mobile-xp" data-mobile-group="general"'));
  assert.equal((html.match(/data-rpg-stat="xp"/g)||[]).length,2,
    'XP original do desktop e cópia responsiva do mobile recebem o mesmo valor');
  for(const page of ['general','attributes','combat']){
    assert.match(html,new RegExp('data-mobile-stat-tab="'+page+'"'));
    assert.ok(css.includes('data-mobile-stat-page="'+page+'"'));
  }
  assert.ok(js.includes('function setMobileStatPage(page)'));
  assert.ok(js.includes("setMobileStatPage('general')"));
  assert.ok(js.includes("button.setAttribute('aria-pressed',String(active))"));
  assert.ok(js.includes("button.addEventListener('click',()=>setMobileStatPage(button.dataset.mobileStatTab))"));
  assert.ok(!html.includes('id="rpg-mobile-details"'),'não usar antigo expansor');
});

test('Mobile selectors appear on one line while desktop retains original card and class row',()=>{
  assert.ok(html.includes('class="rpg-identity-row"'));
  assert.ok(html.includes('id="hero-character"'));
  assert.ok(html.includes('id="hero-class"'));
  assert.ok(css.includes('.rpg-identity-row{display:contents}'));
  assert.ok(css.includes('body.mobile-ui #rpg-view-stats .rpg-identity-row{'));
  assert.ok(css.includes('grid-template-columns:minmax(0,1.9fr) minmax(125px,1fr)'));
  assert.ok(css.includes('body.mobile-ui #rpg-view-stats .hero-class-row{'));
  assert.ok(css.includes('body.mobile-ui #rpg-view-stats #hero-class{'));
  assert.ok(css.includes('body.mobile-ui #rpg-view-stats #hero-character{'));
  assert.ok(css.includes('body.mobile-ui #rpg-view-stats .hero-stat-heading{'));
  assert.ok(css.includes('body.mobile-ui #rpg-view-stats .practice-summary{'));
  assert.ok(html.includes('id="rpg-panel-title"'));
  assert.ok(desktop.includes('.desktop-menu'));
});

test('Bag compact layout does not override saved desktop bag preferences',()=>{
  assert.ok(css.includes('body.mobile-ui .rpg-panel[data-active-tab="inventory"] .bag-workspace'));
  assert.ok(css.includes('body.mobile-ui .rpg-panel[data-active-tab="inventory"] .rpg-inventory-grid'));
  assert.ok(css.includes('body.mobile-ui .rpg-panel[data-active-tab="inventory"] .rpg-item-slot'));
  assert.ok(css.includes('body.mobile-ui .bag-toolbar>label{display:none}'));
  assert.ok(css.includes('body.mobile-ui .bag-content #equipment-toggle'));
  assert.ok(js.includes('setBagLayout(initialLayout);'));
  assert.ok(inventory.includes("BAG_LAYOUT_KEY='topweb_bag_layout_v1'"));
  assert.ok(html.includes('id="bag-layout-panel"'));
  assert.ok(html.includes('id="bag-search"'));
  assert.ok(html.includes('id="bag-filter"'));
});

test('Empty mobile combat panel hides; desktop combat remains untouched',()=>{
  assert.ok(game.includes("combatPanel.dataset.mobileActive=String("));
  assert.ok(game.includes("!!target||!!combat?.auto||!!combat?.manualActive"));
  assert.ok(html.includes('id="combat-target"'));
  assert.ok(html.includes('id="combat-mode"'));
  assert.ok(html.includes('id="combat-target-fill"'));
  assert.ok(css.includes('body.mobile-ui .combat-panel[data-mobile-active="false"]{display:none!important}'));
});

test('Mobile: retrato/HP/MP abre Status, com teclado e estado acessível',()=>{
  assert.match(html,/id="mobile-player-open" role="button" tabindex="0"/);
  assert.match(html,/id="mobile-player-open"[^>]+aria-controls="rpg-panel"[^>]+aria-expanded="false"/);
  assert.match(html,/id="rpg-open"[^>]+aria-controls="rpg-panel"/);
  assert.ok(js.includes("mobilePlayer?.addEventListener('click',openFromMobileCard)"));
  assert.ok(js.includes("mobilePlayer?.addEventListener('keydown',event=>"));
  assert.ok(js.includes("['Enter',' ','Spacebar'].includes(event.key)"));
  assert.ok(js.includes("event.stopPropagation(); // não ativar atalhos de ataque do jogo"));
  assert.ok(js.includes("document.body.classList.contains('mobile-ui'))open('stats')"));
  assert.ok(js.includes("mobilePlayer?.setAttribute('aria-expanded','true')"));
  assert.ok(js.includes("mobilePlayer?.setAttribute('aria-expanded','false')"));
  assert.match(css,/body\.mobile-ui #rpg-open\s*\{\s*display:none!important/);
  assert.match(css,/body\.mobile-ui #mobile-player-open\s*\{\s*pointer-events:auto/);
  assert.match(css,/body\.mobile-ui #mobile-player-open:focus-visible/);
});
test('Mobile: dica de navegação e zoom no HUD ocultos; mapa abre só com ícone na borda',()=>{
  assert.ok(html.includes('id="navigation-hint"'));
  assert.match(css,/body\.mobile-ui #navigation-hint\s*\{\s*display:none!important/);
  assert.match(css,/body\.mobile-ui \.mobile-zoom\s*\{\s*display:none!important/);
  assert.match(html, /id="map-expand"[^>]+aria-label="Expandir mapa"/);
  assert.ok(html.includes('class="map-expand-symbol"'));
  assert.ok(html.includes('class="map-expand-word">Mapa</span>'));
  assert.match(css,/body\.mobile-ui #map-expand\s*\{[\s\S]*?right:-8px;bottom:-8px;/);
  assert.match(css,/body\.mobile-ui #map-expand \.map-expand-word\s*\{\s*display:none!important/);
  assert.match(css,/body\.mobile-ui #map-expand\s*\{[\s\S]*?width:40px;height:40px/);
  assert.match(game,/\$\('minimap-open'\)\.addEventListener\('click',openWorldMap\)/);
  assert.match(game,/\$\('map-expand'\)\.addEventListener\('click',openWorldMap\)/);
  // Travel hint and camera zoom remain in the DOM for desktop and other UI flows.
  assert.ok(html.includes('id="mobile-zoom-in"'));
  assert.ok(html.includes('id="mobile-zoom-out"'));
});

test('Bolsa mobile usa as tabs na barra do título em vez de duas linhas',()=>{
  const header=html.indexOf('<header class="rpg-panel-header">');
  const nav=html.indexOf('<nav class="rpg-tabs" role="tablist"');
  assert.ok(header>0&&nav>header);
  assert.ok(html.includes('id="rpg-panel-title">☷ Aventureiro'));
  const compact=css.slice(css.indexOf('/* Mobile-exclusive set preview'));
  assert.ok(compact.includes('body.mobile-ui .rpg-panel-header>div'));
  assert.ok(compact.includes('clip-path:inset(50%)'));
  assert.ok(compact.includes('body.mobile-ui .rpg-tabs{'));
  assert.ok(compact.includes('position:absolute;'));
  assert.ok(compact.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert.ok(compact.includes('body.mobile-ui .rpg-panel-header #rpg-close'));
  for(const tab of ['stats','inventory','skills']){
    assert.ok(html.includes('data-rpg-tab="'+tab+'"'));
    assert.ok(html.includes('data-rpg-panel="'+tab+'"'));
  }
  assert.ok(desktop.includes('.rpg-panel')===false||desktop.includes('.desktop-menu'));
});

test('Bolsa mobile mostra slots na metade esquerda e peças de Set na direita',()=>{
  const compact=css.slice(css.indexOf('/* Mobile-exclusive set preview'));
  assert.ok(compact.includes('body.mobile-ui .rpg-panel[data-active-tab="inventory"] .bag-content{'));
  assert.ok(compact.includes('grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)'));
  assert.ok(compact.includes('#rpg-inventory-grid{'));
  assert.ok(compact.includes('grid-column:1;'));
  assert.ok(compact.includes('grid-template-columns:repeat(6,minmax(0,1fr))!important'));
  assert.ok(compact.includes('#equipment-toggle{'));
  assert.ok(compact.includes('grid-column:2;'));
  assert.ok(compact.includes('.bag-mobile-set-summary{'));
  assert.ok(compact.includes('.bag-equipment-info{'));
  assert.ok(html.includes('id="bag-mobile-set-summary" role="list"'));
  assert.ok(html.includes('id="equipment-toggle"'));
  assert.ok(js.includes('function drawMobileSet()'));
  assert.ok(js.includes('item.slotName||item.name'));
  assert.ok(js.includes("item.equipped?'✓':'○'"));
  assert.ok(js.includes('drawMobileSet();'));
  assert.ok(game.includes("hero.equipped?'Remover conjunto':'Equipar Evanescence · nível 1'"));
  assert.ok(game.includes("hero.equipped=!hero.equipped"));
  assert.ok(game.includes('rpgHud?.setItems(heroInventory(hero,equipmentManifest))'));
  assert.ok(inventory.includes('hero.equipped'));
});

test('Busca e título redundante desaparecem somente no mobile, sem perder itens',()=>{
  const compact=css.slice(css.indexOf('/* Mobile-exclusive set preview'));
  assert.ok(compact.includes('.bag-toolbar,'));
  assert.ok(compact.includes('.bag-filters{'));
  assert.ok(compact.includes('display:none!important'));
  assert.ok(html.includes('<h3>Minha Bolsa</h3>')); // desktop permanece
  assert.ok(html.includes('id="bag-search"')); // desktop permanece funcional
  assert.ok(html.includes('id="bag-filter"'));
  assert.ok(js.includes("if(tab==='inventory'&&document.body.classList.contains('mobile-ui'))"));
  assert.ok(js.includes("if(search)search.value=''"));
  assert.ok(js.includes("if(filter)filter.value='all'"));
  assert.ok(js.includes('drawInventory();'));
  assert.ok(js.includes('const count=filtered?valid.length:24'));
  assert.ok(js.includes("setBagLayout(initialLayout);"));
  assert.ok(!game.includes('mobile-bag-layout-saved')); // Nenhuma preferência nova no desktop
});
