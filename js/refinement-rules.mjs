export const MAX_REFINEMENT=13;
export const refinementLevel=value=>Number.isInteger(value)?Math.max(0,Math.min(MAX_REFINEMENT,value)):0;
export function refinementVisual(value,mobile=false){
  const level=refinementLevel(value);
  return {level,width:level? .045+level*.015:0,intensity:level? .3+level*.085:0,
    particles:level<3?0:Math.min(mobile?24:48,Math.floor((level-1)*(mobile?2:4))),
    strands:level<5?0:Math.min(4,1+Math.floor((level-5)/3)),
    extension:level*.009};
}
