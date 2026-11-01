export const LOCAL_MAP_SPAN=96;

export function mapView(world,position,span=LOCAL_MAP_SPAN){
  const w=Math.min(span,world.w),h=Math.min(span,world.h);
  return {x:Math.max(world.ox,Math.min(world.ox+world.w-w,position.x-w/2)),
    z:Math.max(world.oz,Math.min(world.oz+world.h-h,position.z-h/2)),w,h};
}
export function projectMap(point,view,size){
  return {x:(point.x-view.x)/view.w*size,y:(point.z-view.z)/view.h*size};
}
export function unprojectMap(x,y,view,size){
  return {x:view.x+x/size*view.w,z:view.z+y/size*view.h};
}
export function mapTileColor(tile){
  if(!tile)return [12,49,73];
  // O mapa usa cores de terreno, sem o tint branco das texturas 3D.
  if((tile.region&9)===0)return tile.height<-.8?[15,84,133]:[23,121,166];
  if(tile.region&8)return [181,142,90];
  const paved=[2,3,4,13,20,21,22,37,47,48,49].includes(tile.tex);
  const sand=[14,15,16,34,35,36,44,45,46].includes(tile.tex);
  const base=paved?[190,179,144]:sand?[208,187,123]:[76,124,78];
  const shade=tile.blocks===15?.82:1;
  return base.map(v=>Math.round(v*shade));
}

export function mapEdgePoint(point,view,size,padding=22){
  const p=projectMap(point,view,size),center=size/2;
  const dx=p.x-center,dy=p.y-center,distance=Math.hypot(dx,dy);
  const limit=center-padding;
  return distance>limit?{x:center+dx/distance*limit,y:center+dy/distance*limit,edge:true}:p;
}
