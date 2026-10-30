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

test('Ami usa 65/66 do GLB original e Conch Ray 13 como ação base',()=>{
  const clips=['011 · Skill 1','012 · Skill 2','013 · Skill 3','065 · Skill 1','066 · Skill 2'].map(name=>({name}));
  const bolt={id:99,actions:{ami:[{id:65}]}};
  const heal={id:97,actions:{ami:[{id:66}]}};
  const conch={id:216,actions:{ami:[]},baseActions:[13]};
  assert.equal(getActionId(resolveSkillClip(bolt,'ami',clips)),65);
  assert.equal(getActionId(resolveSkillClip(heal,'ami',clips)),66);
  assert.equal(getActionId(resolveSkillClip(conch,'ami',clips)),13);
});
test('fallback da ação 13 não deve ser usado em arco ou pistola',()=>{
  const clips=[{name:'013 · Skill 3'},{name:'007 · Ataque 1'}];
  assert.equal(resolveSkillClip({id:94,actions:{ami:[]},baseActions:[7]},'ami',clips),null);
  assert.equal(resolveSkillClip({id:216,actions:{lance:[]},baseActions:[13]},'lance',clips),null);
  assert.equal(resolveSkillClip({id:216,actions:{ami:[{id:67}]},baseActions:[13]},'ami',clips),null);
});
