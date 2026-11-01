import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameMeter,developmentMonitorDefault,heapSample,mebibytes,createGpuTimer} from '../js/performance-monitor.mjs';
test('development monitor defaults to local hosts with explicit debug overrides',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]','::1']){
    assert.equal(developmentMonitorDefault(host),true);
    assert.equal(developmentMonitorDefault(host,'?debug=0'),false);
  }
  assert.equal(developmentMonitorDefault('game.example'),false);
  assert.equal(developmentMonitorDefault('game.example','?debug=1'),true);
});
test('frame meter measures actual slow frame intervals independently of game delta clamp',()=>{
  const meter=createFrameMeter();let sample;
  for(let t=0;t<=1000;t+=100)sample=meter.sample(t,6);
  assert.equal(sample.fps,10);assert.equal(sample.frameMs,100);
  assert.equal(sample.workMs,6);assert.equal(sample.worstMs,100);
});
test('frame meter uses elapsed wall time and reports spikes without labeling work as CPU percent',()=>{
  const m=createFrameMeter();m.sample(0,3);m.sample(500,4);const sample=m.sample(1000,5);
  assert.equal(sample.fps,2);assert.equal(sample.workMs,4);assert.equal(sample.worstMs,500);
});
test('reset excludes hidden-tab time from the next measurement',()=>{
  const m=createFrameMeter();m.sample(0);m.sample(900);m.reset();
  assert.equal(m.sample(20000),null);assert.equal(m.sample(20500),null);
  assert.equal(m.sample(21000).fps,2);
  assert.equal(m.sample(NaN),null);
});
test('heap measurement distinguishes missing browser support from available approximate memory',()=>{
  assert.equal(heapSample({}),null);assert.equal(heapSample({memory:{usedJSHeapSize:NaN}}),null);
  assert.deepEqual(heapSample({memory:{usedJSHeapSize:1048576,totalJSHeapSize:2097152,jsHeapSizeLimit:4194304}}),{used:1048576,total:2097152,limit:4194304});
  assert.equal(mebibytes(1048576),'1.0 MiB');assert.equal(mebibytes(undefined),'N/D');
});
function fakeGpu(){
  const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2},state={ready:false,disjoint:false,lost:false,other:false,created:0,ended:0,deleted:0,reads:0};
  const gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,CURRENT_QUERY:5,
    getExtension:()=>ext,isContextLost:()=>state.lost,
    createQuery:()=>({id:++state.created}),beginQuery:()=>{},endQuery:()=>state.ended++,deleteQuery:()=>state.deleted++,
    getParameter:()=>state.disjoint,getQuery:()=>state.other?{}:null,
    getQueryParameter:(q,param)=>{if(param===3)return state.ready;state.reads++;return 2500000;}
  };return {state,gl};
}
test('GPU queries never read unavailable results or queue more than one pending measurement',()=>{
  const {state,gl}=fakeGpu(),timer=createGpuTimer(gl);timer.begin();timer.end();timer.begin();
  assert.equal(state.created,1);assert.equal(state.reads,0);assert.equal(timer.value,null);
  state.ready=true;timer.begin();timer.end();assert.equal(timer.value,2.5);
  assert.equal(state.created,2);assert.equal(state.deleted,1);assert.equal(state.reads,1);
  timer.dispose();assert.equal(state.deleted,2);assert.equal(timer.value,null);
});
test('GPU disjoint invalidates timing without publishing an unreliable measurement',()=>{
  const {state,gl}=fakeGpu(),timer=createGpuTimer(gl);timer.begin();timer.end();state.disjoint=true;state.ready=true;timer.begin();
  assert.equal(state.reads,0);assert.equal(state.deleted,1);assert.equal(timer.value,null);
});
test('unsupported GPU timer is safe and another active query is not interrupted',()=>{
  const unsupported=createGpuTimer({getExtension:()=>null});unsupported.begin();unsupported.end();unsupported.dispose();
  assert.equal(unsupported.supported,false);assert.equal(unsupported.value,null);
  const {state,gl}=fakeGpu();state.other=true;const timer=createGpuTimer(gl);timer.begin();timer.end();
  assert.equal(state.created,0);assert.equal(state.ended,0);
});
test('losing WebGL context during measurement does not end a query on the lost context',()=>{
  const {state,gl}=fakeGpu(),timer=createGpuTimer(gl);timer.begin();state.lost=true;timer.end();timer.dispose();
  assert.equal(state.ended,0);assert.equal(timer.value,null);
});
