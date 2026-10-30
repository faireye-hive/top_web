import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripSwing,stripRotationRadians} from '../../js/skill-fx-strip.mjs';

const untouched=stripSwing();
assert.deepEqual(untouched.rotation,[0,0,0],'o aspecto original permanece vertical por padrão');
assert.equal(untouched.h,1.1);
const tilted=stripSwing({rotation:[-90,25,10],h:1.7,a0:-30,a1:60});
assert.deepEqual(tilted.rotation,[-90,25,10]);
assert.equal(tilted.h,1.7);
assert.equal(tilted.a0,-30);
assert.equal(tilted.dur,.35,'campos omitidos herdam os padrões do simulador');
const rad=stripRotationRadians({rotation:[-90,0,90]});
assert.ok(Math.abs(rad[0]+Math.PI/2)<1e-10);
assert.ok(Math.abs(rad[1])<1e-10);
assert.ok(Math.abs(rad[2]-Math.PI/2)<1e-10);
assert.deepEqual(stripSwing({rotation:[NaN,Infinity,'erro']}).rotation,[0,0,0],
  'valores inválidos não quebram o simulador');
assert.deepEqual(stripSwing({rotation:[400,-400,45]}).rotation,[360,-360,45],
  'limitar valores extremos para a interface');
const input={rotation:[-45,0,0]};const cleaned=stripSwing(input);
cleaned.rotation[0]=30;
assert.equal(input.rotation[0],-45,'não alterar dados de origem por referência');

// O catálogo histórico não deve ser reescrito só pela edição da prévia.
const visual=JSON.parse(readFileSync(new URL('../../assets/skills/visuals.json',import.meta.url),'utf8'));
const strip=visual.resources['swordlight02.par'].strips[0];
assert.equal(strip.texture,'b68c73c1418b.png');
assert.equal(strip.swing,undefined,'arco editor-only não existe no .par histórico');

// Smoke tests da integração: geometria local, pivô na altura da arma e
// exportação dos metadados do editor para o visuals.json.
const renderer=readFileSync(new URL('../../js/skill-fx-core.mjs',import.meta.url),'utf8');
const editor=readFileSync(new URL('../../tests/skill-editor.mjs',import.meta.url),'utf8');
const exporter=readFileSync(new URL('../../js/skill-fx-edit.mjs',import.meta.url),'utf8');
assert.match(renderer,/this\.mesh\.rotation\.set\(rot\[0\],rot\[1\],rot\[2\]\)/);
assert.match(renderer,/this\.mesh\.position\.set\(0,swing\.h\*g\.scale\+g\.height,0\)/);
assert.match(renderer,/pos\.setXYZ\(n,cos\*swing\.r0\*g\.scale,sin\*swing\.r0\*g\.scale,0\)/);
assert.match(editor,/Orientação da trilha · 3D \(prévia\)/);
assert.match(editor,/Deitada \(−90° X\)/);
assert.match(exporter,/Object\.assign\(r\.strips\[i\],clone\(patch\)\)/);

console.log('OK: orientação de trilha, presets, eixos, pivô e persistência na exportação.');
