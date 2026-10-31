import assert from 'node:assert/strict';
import {effFramePhase} from '../../js/skill-fx-keyframes.mjs';
import {sourceTimedClip,poseForSkill} from '../../js/skill-fx-pose.mjs';

const keys=[{d:.1},{d:.2},{d:.3}];
assert.deepEqual(effFramePhase(keys,0),{from:0,to:1,fraction:0,finished:false});
assert.equal(effFramePhase(keys,.1).from,1,'Exact boundary advances to the next source key');
const last=effFramePhase(keys,.45);
assert.equal(last.from,2);
assert.equal(last.to,0,'DX9 and sources interpolate the last key to key zero');
assert.ok(Math.abs(last.fraction-.5)<1e-6);
assert.equal(effFramePhase(keys,.6).finished,true);
assert.equal(effFramePhase([{d:0},{d:.2}],0).from,1,'Zero duration is preserved and skipped');
assert.equal(effFramePhase([{d:-1}],0).finished,true);

const clip={name:'176 · Skill 4',duration:34/25,
  tracks:[{times:new Float32Array([0,15/25,34/25])}],
  clone(){return {...this,tracks:this.tracks.map(t=>({...t,times:t.times.slice()}))};}};
const retimed=sourceTimedClip(clip,'lance');
assert.ok(Math.abs(retimed.duration-34/30)<1e-6);
assert.ok(Math.abs(retimed.tracks[0].times[1]-.5)<1e-6);
assert.equal(clip.duration,34/25,'Retiming must not mutate the loaded GLB');
assert.equal(clip.tracks[0].times[1],Math.fround(15/25));
const pose=poseForSkill({actions:{lance:[{id:176,frames:[3063,3097]}]}},'lance',retimed);
assert.equal(pose.keyframes[0].time,.5,'Original CharacterAction event is 15 / 30 seconds');
console.log('OK: authored EFF boundaries, last-to-first interpolation and source 30 FPS action timing.');
