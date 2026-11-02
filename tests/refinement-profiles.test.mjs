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
test('perfis antigos recebem comprimento, ponta e filamentos compatíveis sem perder as cores',()=>{
 const old={version:1,profiles:{'lance:crusader':{color:'#ff0000',strandColor:'#123456',width:1.5,radius:2}}};
 const style=parseRefinementProfiles(JSON.stringify(old)).profiles['lance:crusader'];
 assert.equal(style.color,'#ff0000');assert.equal(style.strandColor,'#123456');assert.equal(style.radius,2);
 assert.equal(style.length,1);assert.equal(style.tipWidth,1);assert.equal(style.strandWidth,1);
 assert.equal(style.strandColorMode,'solid');assert.equal(style.strandAura,'none');
});
test('comprimento e formato da ponta são independentes e conservam o encaixe no cabo',async()=>{
 const {refinementBladeRange,refinementTipWidth}=await import('../js/refinement-profiles.mjs');
 const regular=normalizeRefinementStyle(),long=normalizeRefinementStyle({length:2,tipWidth:0,tipLength:.4});
 const base=refinementBladeRange(2,.1,regular),extended=refinementBladeRange(2,.1,long);
 assert.equal(base.start,extended.start);assert.ok(Math.abs((extended.end-extended.start)-2*(base.end-base.start))<1e-9);
 assert.ok(Math.abs(base.end-2.1)<1e-9);
 assert.equal(refinementTipWidth(0,long),1);assert.equal(refinementTipWidth(.6,long),1);assert.equal(refinementTipWidth(1,long),0);
 assert.ok(refinementTipWidth(.8,long)>0&&refinementTipWidth(.8,long)<1);
 const thick=normalizeRefinementStyle({tipWidth:2,tipLength:.2});
 assert.equal(refinementTipWidth(.8,thick),1);assert.equal(refinementTipWidth(1,thick),2);
 for(let t=0;t<=1;t+=.05)assert.equal(refinementTipWidth(t,regular),1,'ponta antiga mantém largura uniforme');
});
test('espessura, auras e cores múltiplas sobrevivem ao JSON sem ultrapassar os limites mobile',()=>{
 const style=normalizeRefinementStyle({strandWidth:4,strandAura:'electric',strandGlow:2,strandColorMode:'gradient',strandColor2:'#00CAFF',length:1.4,tipWidth:.1});
 const store=parseRefinementProfiles(JSON.stringify({version:1,profiles:{'ami:cleric':style}}));
 assert.deepEqual(store.profiles['ami:cleric'],style);
 assert.equal(style.strandColor2,'#00caff');assert.equal(style.strandColorMode,'gradient');assert.equal(style.strandAura,'electric');
 assert.equal(styledRefinementVisual(13,true,style).particles,24);
 for(const strandColorMode of ['solid','gradient','alternate','rainbow'])assert.equal(normalizeRefinementStyle({strandColorMode}).strandColorMode,strandColorMode);
 for(const strandAura of ['none','soft','flame','electric'])assert.equal(normalizeRefinementStyle({strandAura}).strandAura,strandAura);
 const invalid=normalizeRefinementStyle({length:-20,tipWidth:99,tipLength:0,strandWidth:Infinity,strandGlow:1e9,strandAura:'<script>',strandColorMode:'invalid',strandColor2:'url(script)'});
 assert.equal(invalid.length,.35);assert.equal(invalid.tipWidth,2);assert.equal(invalid.tipLength,.1);
 assert.equal(invalid.strandWidth,1);assert.equal(invalid.strandGlow,3);assert.equal(invalid.strandAura,'none');assert.equal(invalid.strandColorMode,'solid');
 assert.equal(invalid.strandColor2,DEFAULT_REFINEMENT_STYLE.strandColor2);
});
