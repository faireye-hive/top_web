// Manual preview controls are saved with their resource and survive JSON export.
const finite=(n,fallback)=>Number.isFinite(Number(n))?Number(n):fallback;
export function layerPreview(value={}){
  value=value&&typeof value==='object'?value:{};
  const vec=(field,fallback)=>[0,1,2].map(i=>finite(value?.[field]?.[i],fallback));
  return {position:vec('position',0),rotation:vec('rotation',0),scale:vec('scale',1),
    opacity:Math.max(0,finite(value.opacity,1)),speed:Math.max(.01,finite(value.speed,1)),
    delay:finite(value.delay,0),start:value.start==null?null:Math.max(0,finite(value.start,0)),
    duration:Math.max(0,finite(value.duration,0)),anchor:value.anchor||'auto',
    useSocket:value.useSocket!==false};
}
export const layerStart=(base,preview)=>Math.max(0,(preview.start??base)+preview.delay);
export function previewDuration(mode,clipDuration,timelineDuration,manualDuration){
  const duration=mode==='historical'
    ?(clipDuration>0?clipDuration:timelineDuration):manualDuration;
  return Math.max(.001,finite(duration,5));
}
