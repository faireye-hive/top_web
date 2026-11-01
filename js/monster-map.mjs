// Aggregate original spawn positions into small, fixed map cells. These are
// habitat hints, independent of streaming, deaths and respawn timers.
export function monsterMapDots(points,view,{width,height},spacing=12){
  if(!(view.w>0&&view.h>0&&width>0&&height>0))return [];
  const cells=new Map();
  for(const p of points){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;
    const x=(p.x-view.x)/view.w*width,y=(p.z-view.z)/view.h*height;
    if(x<0||y<0||x>width||y>height)continue;
    const key=`${Math.floor(x/spacing)}/${Math.floor(y/spacing)}`;
    const cell=cells.get(key);
    if(cell){cell.x+=x;cell.y+=y;cell.count++;}
    else cells.set(key,{x,y,count:1});
  }
  return [...cells.values()].map(p=>({x:p.x/p.count,y:p.y/p.count,count:p.count}));
}
