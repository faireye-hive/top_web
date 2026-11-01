export function developmentMonitorDefault(hostname,search=''){
  const query=new URLSearchParams(search);
  if(query.has('debug'))return query.get('debug')!=='0';
  return ['localhost','127.0.0.1','[::1]','::1'].includes(hostname);
}
export function createFrameMeter(){
  let previous=null,elapsed=0,intervals=0,frames=0,work=0,worst=0;
  return {
    reset(){previous=null;elapsed=0;intervals=0;frames=0;work=0;worst=0;},
    sample(timestamp,workMs=0){
      if(!Number.isFinite(timestamp))return null;
      if(previous!==null&&timestamp>previous){const interval=timestamp-previous;elapsed+=interval;intervals++;worst=Math.max(worst,interval);}
      previous=timestamp;frames++;work+=Math.max(0,Number.isFinite(workMs)?workMs:0);
      if(elapsed<1000)return null;
      const result={fps:intervals*1000/elapsed,frameMs:elapsed/intervals,workMs:work/frames,worstMs:worst};
      elapsed=0;intervals=0;frames=0;work=0;worst=0;return result;
    }
  };
}
export function heapSample(perf=globalThis.performance){
  const m=perf?.memory;
  if(!m||!Number.isFinite(m.usedJSHeapSize)||m.usedJSHeapSize<=0)return null;
  return {used:m.usedJSHeapSize,total:m.totalJSHeapSize,limit:m.jsHeapSizeLimit};
}
export function mebibytes(bytes){return Number.isFinite(bytes)?`${(bytes/1048576).toFixed(1)} MiB`:'N/D';}

// Uma consulta assíncrona por vez; nunca espera a GPU nem usa gl.finish().
export function createGpuTimer(gl){
  const ext=gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');
  let query=null,active=false,value=null;
  const supported=!!ext&&typeof gl.createQuery==='function';
  function dispose(){
    if(active&&!gl.isContextLost())gl.endQuery(ext.TIME_ELAPSED_EXT);
    active=false;
    if(query)gl.deleteQuery(query);query=null;value=null;
  }
  return {supported,
    begin(){
      if(!supported||gl.isContextLost())return;
      if(query){
        if(gl.getParameter(ext.GPU_DISJOINT_EXT)){dispose();return;}
        if(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))return;
        const nanos=gl.getQueryParameter(query,gl.QUERY_RESULT);
        value=Number.isFinite(nanos)?nanos/1e6:null;gl.deleteQuery(query);query=null;
      }
      if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return;
      query=gl.createQuery();if(!query)return;
      gl.beginQuery(ext.TIME_ELAPSED_EXT,query);active=true;
    },
    end(){if(active&&!gl.isContextLost())gl.endQuery(ext.TIME_ELAPSED_EXT);active=false;},
    get value(){return value;},dispose
  };
}

export function initPerformanceMonitor({renderer,getResources,enabled=false,onToggle=()=>{}}){
  const $=id=>document.getElementById(id),panel=$('performance-monitor'),meter=createFrameMeter();
  let visible=false,timer=null,last=null;
  const set=(key,text)=>{$('perf-'+key).textContent=text;};
  function setEnabled(next,persist=true){
    visible=!!next;panel.hidden=!visible;$('development-monitor').checked=visible;meter.reset();
    timer?.dispose();timer=visible?createGpuTimer(renderer.getContext()):null;
    if(persist)onToggle(visible);
  }
  setEnabled(enabled,false);
  $('development-monitor').addEventListener('change',e=>setEnabled(e.target.checked));
  $('performance-hide').addEventListener('click',()=>setEnabled(false));
  document.addEventListener('visibilitychange',()=>{meter.reset();timer?.dispose();});
  renderer.domElement.addEventListener('webglcontextlost',()=>{timer=null;meter.reset();});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{if(visible)timer=createGpuTimer(renderer.getContext());});
  // O painel pode ser arrastado sem consumir gestos do joystick ou da câmera.
  const handle=panel.querySelector('summary');let drag=null,moved=false;
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=panel.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};moved=false;handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{
    if(!drag||Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5)return;moved=true;
    panel.style.left=`${Math.max(4,Math.min(innerWidth-panel.offsetWidth-4,drag.left+e.clientX-drag.x))}px`;
    panel.style.top=`${Math.max(4,Math.min(innerHeight-36,drag.top+e.clientY-drag.y))}px`;panel.style.transform='none';
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(event,()=>{drag=null;});
  handle.addEventListener('click',e=>{if(moved){e.preventDefault();moved=false;}});
  return {
    get enabled(){return visible;},setEnabled,
    beginFrame(){if(visible)timer?.begin();},
    endFrame(timestamp,workMs){
      if(!visible)return;timer?.end();const sample=meter.sample(timestamp,workMs);if(!sample)return;
      const resources=getResources(),heap=heapSample(),info=renderer.info;
      last={...sample,heap,gpuMs:timer?.value??null,...resources};
      set('summary',`${sample.fps.toFixed(0)} FPS · ${mebibytes(resources.terrain?.bytes)}`);
      set('fps',`${sample.fps.toFixed(1)} FPS`);
      set('frame',`${sample.frameMs.toFixed(1)} ms · pico ${sample.worstMs.toFixed(1)} ms`);
      set('work',`${sample.workMs.toFixed(1)} ms/quadro`);
      set('gpu',timer?.value!==null&&timer?.value!==undefined?`${timer.value.toFixed(2)} ms`:'N/D neste navegador');
      set('heap',heap?`${mebibytes(heap.used)} / ${mebibytes(heap.total)}`:'N/D neste navegador');
      set('terrain',`${mebibytes(resources.terrain?.bytes)} · ${resources.terrain?.loaded??0}/${resources.terrain?.limit??24} setores`);
      set('render',`${info.render.calls} chamadas · ${info.render.triangles.toLocaleString('pt-BR')} triângulos`);
      set('assets',`${info.memory.geometries} geometrias · ${info.memory.textures} texturas`);
      set('scene',`${resources.objects??0} objetos · ${resources.effects??0} efeitos · ${resources.wake??0} espumas`);
      const canvas=renderer.domElement;
      set('resolution',`${canvas.width} × ${canvas.height} · escala ${renderer.getPixelRatio().toFixed(2)}×`);
    },snapshot(){return last;}
  };
}
