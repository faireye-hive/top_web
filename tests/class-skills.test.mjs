import test from 'node:test';
import assert from 'node:assert/strict';
import {getActionId,resolveSkillClip,classSkillEntries} from '../js/class-skills.mjs';
test('IDs da ação são extraídos do prefixo, não do nome Skill 1',()=>{
  assert.equal(getActionId({name:'223 · Skill action 223'}),223);
  assert.equal(getActionId({name:'065 · Skill 1'}),65);
  assert.equal(getActionId({name:'Skill 1'}),null);
});
test('skills com pistola jamais usam clipe genérico 007 (arco/arma errada)',()=>{
  const skill={actions:{lance:[{id:223}]}};
  assert.equal(resolveSkillClip(skill,'lance',[{name:'007 · Ataque 1'}]),null);
  assert.equal(resolveSkillClip(skill,'lance',[{name:'223 · Skill action 223'}]).name,'223 · Skill action 223');
});
test('preset retém quatro slots mesmo quando animações faltam',()=>{
 const catalog={classes:{hunter:{skills:Array.from({length:4},(_,i)=>({id:i,actions:{lance:[{id:277+i}]}}))}}};
 const skills=classSkillEntries(catalog,'hunter','lance',[{name:'277 · Skill action 277'}]);
 assert.equal(skills.length,4);
 assert.deepEqual(skills.map(s=>s.available),[true,false,false,false]);
});
