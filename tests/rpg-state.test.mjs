import test from 'node:test';
import assert from 'node:assert/strict';
import {availableSkillClips,resolveSlots,statText} from '../js/rpg-state.mjs';
test('somente clipes reais de skill e ataque, sem duplicar',()=>{
 const clips=[{name:'Lance · Parado'}, {name:'Skill 2'}, {name:'Skill 1'}, {name:'Skill 2'}, {name:'Ataque 3'}];
 assert.deepEqual(availableSkillClips(clips),['Skill 1','Skill 2','Ataque 3']);
});
test('slots persistidos inválidos são ignorados e preenchidos com clipes existentes',()=>{
 const skills=['Skill 1','Skill 2','Ataque 3'];
 assert.deepEqual(resolveSlots(['Skill 2','Falsa','Skill 2'],skills),['Skill 2','Skill 1','Ataque 3']);
 assert.deepEqual(resolveSlots(null,[],3),[null,null,null]);
});
test('stats desconhecidos nunca se tornam valores inventados',()=>{
 assert.equal(statText(null),'—');
 assert.equal(statText(undefined),'—');
 assert.equal(statText(1200),(1200).toLocaleString('pt-BR'));
});
