import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileSkillLayers,readLocalPresets,writeLocalPresets,normalizePresetStore,
   skillPreset,mergePresetStores,newPresetStore} from '../js/skill-vfx-data.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../assets/skills/visuals.json',import.meta.url),'utf-8'));
const cat=JSON.parse(fs.readFileSync(new URL('../assets/skills/catalog.json',import.meta.url),'utf-8'));
test('todas as 28 posições de skills expõem recursos editáveis do formato channels/resources',()=>{
  let slots=0;
  for(const cl of Object.values(cat.classes)){
    assert.equal(cl.skills.length,4);
    for(const skill of cl.skills){
      slots++;
      const layers=compileSkillLayers(data,skill.id);
      assert.ok(layers.length>0,skill.name+' precisa de camadas');
      for(const l of layers)assert.ok(l.id&&l.stage&&l.texture);
      assert.equal(new Set(layers.map(l=>l.id)).size,layers.length);
    }
  }
  assert.equal(slots,28);
});
test('IDs estáveis e canais corretos em quatro habilidades distintas',()=>{
  for(const [id,source] of [[81,'01000014.par'],[93,'icearrow.eff'],[99,'hpushf.par'],[213,'wind.par']]){
    const layers=compileSkillLayers(data,id);
    assert.ok(layers.some(l=>l.source===source));
    assert.deepEqual(layers.map(l=>l.id),compileSkillLayers(data,id).map(l=>l.id));
  }
});
test('salvar e ler override com limites e sem afetar skills vizinhas',()=>{
 const fake={};
 const storage={getItem:k=>fake[k],setItem:(k,v)=>fake[k]=v};
 const sample={version:1,skills:{'81':{global:{scale:2,particles:100},
   layers:{'actor:01000014.par:particle:0':{scale:1.4,enabled:false,x:2,opacity:.7}}}}};
 writeLocalPresets(sample,storage);
 const restored=readLocalPresets(storage);
 assert.equal(skillPreset(restored,81).global.scale,2);
 assert.equal(skillPreset(restored,81).global.particles,64);
 assert.equal(skillPreset(restored,81).layers['actor:01000014.par:particle:0'].enabled,false);
 assert.equal(skillPreset(restored,93).global.scale,1);
 assert.deepEqual(mergePresetStores(newPresetStore(),restored).skills['81'].global,restored.skills['81'].global);
});
test('campos inválidos de presets não executam código ou contaminam parâmetros',()=>{
 const p=normalizePresetStore({version:1,skills:{'81':{global:{opacity:'not-a-number'},layers:{
  '<script>alert(1)</script>':{enabled:true},valid:{color:'not-a-color',spin:'Infinity'}
 }}}});
 assert.ok(!p.skills['81'].layers['<script>alert(1)</script>']);
 assert.equal(p.skills['81'].layers.valid.color,'#ffffff');
 assert.equal(skillPreset(p,81).global.opacity,1);
});
