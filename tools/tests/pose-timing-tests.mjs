import assert from 'node:assert/strict';
import {poseForSkill,ACTION_FRAMES} from '../../js/skill-fx-pose.mjs';
import {stageTimes,buildTimeline} from '../../js/skill-fx-timing.mjs';

const skill={id:81,actions:{lance:[{id:176,frames:[3063,3097]}],
  carsise:[{id:176,frames:[1568,1611]}],ami:[]}};
const lance=poseForSkill(skill,'lance');
assert.equal(lance.action,176);
assert.equal(lance.startFrame,3063);
assert.equal(lance.endFrame,3097);
assert.equal(lance.keyframes[0].frame,3078);
assert.equal(lance.keyframes[0].time,.5);
assert.equal(lance.originalDuration,1.1333);
assert.equal(poseForSkill(skill,'ami'),null,'Sem ação DX9 válida: não inventar evento');
assert.ok(!poseForSkill({actions:{lance:[{id:176,frames:[200,220]}]}},'lance'),
  'Não usar frames DX9 caso catálogo não corresponda');
const clip={name:'action_176',duration:1.7};
const scaled=poseForSkill(skill,'lance',clip);
assert.equal(scaled.duration,1.7);
assert.equal(scaled.keyframes[0].time,.75,'Frame DX9 deve acompanhar duração GLB correta');
assert.ok(scaled.keyframes[0].source.includes('GLB'));

const layers=[{channel:'actor',kind:'eff',key:'a',file:'test.eff'},
  {channel:'flight',kind:'eff',key:'f',file:'test.eff',flightSpeed:15},
  {channel:'target',kind:'eff',key:'t',file:'test.eff'}];
const historical={animation:{keyframe:'0'},visual:{flightKeyframe:'0',
  itemEffect:'0,0',itemEffect2:'0,0',durationPoint:'0'}};
const stage=stageTimes({layers,historical,pose:lance,distance:3.8,flightSpeed:15});
assert.equal(stage.starts.actor,.5);
assert.equal(stage.starts.flight,.5);
assert.equal(stage.release,.5);
assert.equal(stage.impact,.7533);
assert.equal(stage.releaseVerified,true);
assert.ok(stage.events.some(e=>e.source.includes('frame 3078')));
const manual=stageTimes({layers,historical,pose:lance,distance:3.8,flightSpeed:15,
  overrides:{manualKeyframes:{0:.8}}});
assert.equal(manual.release,.8);
assert.equal(manual.starts.actor,.8);
assert.equal(manual.impact,1.0533);
assert.ok(manual.events.some(e=>e.kind==='edited'));
const defaultStage=stageTimes({layers,historical,flightSpeed:15,distance:3.8});
assert.equal(defaultStage.release,0,'Sem pose, manter fallback sinalizado');
assert.ok(defaultStage.warnings.some(w=>w.includes('frame impact')));
const eff={parts:[{keys:[{d:.4},{d:.3}]}]};
const timeline=buildTimeline({layers,historical,pose:lance,
  resolve:()=>eff,resolveEff:()=>eff,flightSpeed:15,distance:3.8,
  overrides:{manualKeyframes:{0:.8}}});
assert.equal(timeline.tracks.find(t=>t.key==='__pose').keys[0].time,.8);
assert.equal(timeline.tracks.find(t=>t.key==='__pose').keys[0].kind,'edited');
assert.ok(timeline.duration>1);
const dual={actions:{lance:[{id:203,frames:[2851,2911]}]}};
const multi=poseForSkill(dual,'lance');
assert.equal(multi.keyframes.length,3);
assert.deepEqual(multi.keyframes.map(k=>k.frame),ACTION_FRAMES.lance[203].slice(2));
assert.ok(multi.keyframes[2].time>multi.keyframes[1].time);
console.log('OK: keyframes DX9, sincronização GLB, callbacks, edições manuais, ausência de pose.');
