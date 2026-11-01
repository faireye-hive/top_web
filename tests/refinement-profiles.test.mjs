import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_REFINEMENT_STYLE,normalizeRefinementStyle,parseRefinementProfiles,readRefinementProfiles,refinementStyle,saveRefinementProfiles,REFINEMENT_STORAGE_KEY,styledRefinementVisual} from '../js/refinement-profiles.mjs';

test('estilos recusam cores e números perigosos e limitam custo de partículas no mobile',()=>{
 const style=normalizeRefinementStyle({width:999,particles:999,strands:999,aura:-5,color:'url(script)',coreColor:'#AABBCC',speed:Infinity});
 assert.equal(style.width,3);assert.equal(style.aura,0);assert.equal(style.color,DEFAULT_REFINEMENT_STYLE.color);
 assert.equal(style.coreColor,'#aabbcc');assert.equal(style.speed,1);
 const mobile=styledRefinementVisual(13,true,style),desktop=styledRefinementVisual(13,false,style);
 assert.equal(mobile.particles,24);assert.equal(desktop.particles,48);assert.equal(desktop.strands,4);
 assert.equal(styledRefinementVisual(0,false,style).width,0);assert.equal(styledRefinementVisual(0,false,style).particles,0);
 assert.equal(styledRefinementVisual(2,false,style).strands,0);
});
test('export/import e armazenamento preservam estilos independentes por personagem e classe',()=>{
 let raw=null;const storage={getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,REFINEMENT_STORAGE_KEY);raw=value;}};
 const shipped={version:1,profiles:{'phyllis:crusader':{color:'#ff0000'}}};
 const store=readRefinementProfiles(storage,shipped);store.profiles['lance:crusader']=normalizeRefinementStyle({color:'#00ff00',aura:2});
 saveRefinementProfiles(store,storage);
 const restored=readRefinementProfiles(storage,shipped);
 assert.equal(refinementStyle(restored,'lance','crusader').aura,2);
 assert.equal(refinementStyle(restored,'phyllis','crusader').color,'#ff0000');
 assert.deepEqual(refinementStyle(restored,'lance','hunter'),DEFAULT_REFINEMENT_STYLE);
 assert.deepEqual(parseRefinementProfiles(JSON.stringify(restored)),restored);
 raw='bad JSON';assert.equal(refinementStyle(readRefinementProfiles(storage,shipped),'phyllis','crusader').color,'#ff0000');
});
test('importação inválida é recusada sem modificar o perfil anterior',()=>{
 for(const value of ['null','[]','{}','oops',JSON.stringify({version:2,profiles:{}}),JSON.stringify({version:1,profiles:[]}),JSON.stringify({version:1,profiles:{'__proto__':null,'x:y':{}}})])
   assert.throws(()=>parseRefinementProfiles(value));
});
