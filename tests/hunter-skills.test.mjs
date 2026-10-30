import test from 'node:test';
import assert from 'node:assert/strict';
import {createHero,restoreHero,serializeHero,selectClass,CLASSES} from '../js/hero-state.mjs';
test('seleção Hunter de arco não quebra as classes atuais',()=>{
 assert.ok(CLASSES.hunter);
 const hero=createHero('lance');
 assert.equal(selectClass(hero,'hunter'),true);
 assert.equal(hero.job,'hunter');
 assert.ok(hero.practice.bow);
});
test('save legado com 6 práticas é preservado e recebe prática de arco',()=>{
 const original=createHero('lance');original.level=3;original.xp=15;
 const data=JSON.parse(serializeHero(original));delete data.practice.bow;
 const loaded=restoreHero(JSON.stringify(data),'lance');
 assert.equal(loaded.level,3);
 assert.equal(loaded.xp,15);
 assert.deepEqual(loaded.practice.bow,{level:10,uses:0});
});
