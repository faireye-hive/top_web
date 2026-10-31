import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePrimaryAction} from '../js/context-action.mjs';
test('mesmo botão prioriza NPC próximo sobre combate e poses',()=>{
  const npc={name:'Trader'},pose={role:'sit'};
  assert.equal(resolvePrimaryAction({npc,pose}).type,'npc');
  assert.equal(resolvePrimaryAction({npc,pose}).label,'Conversar');
  assert.equal(resolvePrimaryAction({}).type,'attack');
  assert.equal(resolvePrimaryAction({}).label,'Atacar');
});
test('botão permite levantar e não ataca durante recuperação',()=>{
  assert.equal(resolvePrimaryAction({seated:true,npc:{}}).type,'stand');
  assert.equal(resolvePrimaryAction({recovering:true,seated:true,npc:{}}).type,'recovering');
  assert.equal(resolvePrimaryAction({pose:{role:'sit'}}).label,'Sentar');
});
