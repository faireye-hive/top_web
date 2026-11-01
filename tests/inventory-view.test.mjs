import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bagLayout,heroInventory,inventorySelection,filterInventory} from '../js/inventory-view.mjs';
const manifest=JSON.parse(readFileSync(new URL('../assets/equipment/manifest.json',import.meta.url)));
test('tipos de Bolsa são validados e preferência antiga desconhecida volta à grade',()=>{
  for(const layout of ['classic','split','list'])assert.equal(bagLayout(layout),layout);
  for(const layout of [null,undefined,'toString','mobile','__proto__'])assert.equal(bagLayout(layout),'classic');
});
test('inventário mostra equipamentos reais, preserva mãos duplicadas e atualiza estado equipado',()=>{
  const hero={job:'crusader',equipped:false},items=heroInventory(hero,manifest);
  assert.equal(items.length,5);assert.equal(new Set(items.map(i=>i.key)).size,5);
  assert.equal(items.filter(i=>i.id===775).length,2);
  assert.ok(items.every(i=>!i.equipped));hero.equipped=true;assert.ok(heroInventory(hero,manifest).every(i=>i.equipped));
  assert.equal(heroInventory({job:'champion'},manifest).length,2);assert.deepEqual(heroInventory(hero,null),[]);
});
test('busca ignora acentos, filtros não alteram itens, e seleção sobrevive à mudança de visual',()=>{
  const items=heroInventory({job:'crusader'},manifest),key=items[4].key;
  assert.equal(filterInventory(items,{kind:'weapon'}).length,2);
  assert.equal(filterInventory(items,{query:'mao esquerda'}).length,1);
  assert.equal(filterInventory(items,{query:'inexistente'}).length,0);
  assert.equal(inventorySelection(items,key),items[4]);assert.equal(inventorySelection([],key),null);
  assert.equal(inventorySelection(items,'outra classe'),items[0]);assert.equal(items.length,5);
});
