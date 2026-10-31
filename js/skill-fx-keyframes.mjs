// CMPModelEff::FrameMove / sources::legacy_eff::framePhase.
// Each d is the duration of that key. The last key interpolates back to key 0.
export function effFramePhase(keys, seconds) {
  const n=keys?.length||0;
  if(!n)return {from:0,to:0,fraction:0,finished:true};
  const at=Number.isFinite(seconds)?Math.max(0,seconds):0;
  let cursor=0;
  for(let i=0;i<n;i++){
    const duration=Number(keys[i].d);
    if(!Number.isFinite(duration)||duration<0)
      return {from:i,to:i,fraction:0,finished:true};
    const end=cursor+duration;
    if(duration>1e-7&&at<end-1e-7)
      return {from:i,to:(i+1)%n,fraction:Math.max(0,Math.min(1,(at-cursor)/duration)),finished:false};
    cursor=end;
  }
  return {from:n-1,to:n-1,fraction:0,finished:cursor>1e-7};
}
