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
  const mobile=html.indexOf('mobile-compact.css?v=2');
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

test('Mobile status keeps all data bindings; only secondary cells collapse',()=>{
  const stats=[...html.matchAll(/<div class="rpg-stat-cell" data-mobile-stat="(core|extra|duplicate)"><span>(.*?)<\/span><strong data-rpg-stat="(.*?)">/g)];
  assert.equal(stats.length,16);
  assert.equal(stats.filter(m=>m[1]==='core').length,6);
  assert.equal(stats.filter(m=>m[1]==='extra').length,8);
  assert.equal(stats.filter(m=>m[1]==='duplicate').length,2);
  assert.deepEqual(stats.filter(m=>m[1]==='core').map(m=>m[3]),
    ['level','hp','mp','attack','magic','defense']);
  assert.ok(html.includes('class="rpg-mobile-max">/ <b data-rpg-stat="maxHp"'));
  assert.ok(html.includes('class="rpg-mobile-max">/ <b data-rpg-stat="maxMp"'));
  assert.ok(html.includes('id="rpg-mobile-details" aria-controls="rpg-view-stats" aria-expanded="false"'));
  assert.ok(js.includes("classList.toggle('mobile-details-expanded')"));
  assert.ok(js.includes("mobileDetails.setAttribute('aria-expanded',String(expanded))"));
  assert.ok(css.includes('.rpg-panel.mobile-details-expanded .rpg-stat-cell[data-mobile-stat="extra"]'));
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
