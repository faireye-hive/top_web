import assert from 'node:assert/strict';
import {previewDuration,layerPreview,layerStart} from '../../js/skill-fx-preview.mjs';
import {buildTimeline} from '../../js/skill-fx-timing.mjs';

assert.equal(previewDuration('historical',1.36,11.05,5),1.36,'Automatic preview must use GLB duration, even with a longer EFF');
assert.equal(previewDuration('historical',0,11.05,5),11.05,'No GLB: retain effects as fallback');
assert.equal(previewDuration('manual',1.36,11.05,8.25),8.25,'Keep the chosen manual window');
assert.equal(layerPreview().start,null);
assert.deepEqual(layerPreview().scale,[1,1,1]);
assert.equal(layerStart(.6,layerPreview({delay:.2})),.8);
assert.equal(layerStart(.6,layerPreview({start:1,delay:.2})),1.2);
assert.equal(layerPreview(null).opacity,1);
const data={parts:[{keys:[{d:.2},{d:.4}]}],preview:{start:1,delay:.2,speed:2}};
const timeline=buildTimeline({layers:[{key:'one',kind:'eff',channel:'actor',file:'one.eff'}],
  resolve:()=>data,resolveEff:()=>data,historical:{animation:{keyframe:'-1'}}});
const track=timeline.tracks.find(t=>t.key==='one');
assert.equal(track.start,1.2);
assert.equal(track.end,1.5);
assert.deepEqual(track.keys.map(k=>k.time),[1.2,1.3]);
data.preview.duration=.1;
const cut=buildTimeline({layers:[{key:'one',kind:'eff',channel:'actor',file:'one.eff'}],
  resolve:()=>data,resolveEff:()=>data,historical:{animation:{keyframe:'-1'}}});
assert.equal(cut.tracks.find(t=>t.key==='one').end,1.3);
console.log('OK: GLB automatic window, manual duration, per-layer delay/start/speed and cutoff.');
