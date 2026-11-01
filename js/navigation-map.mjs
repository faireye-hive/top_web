export const LOCAL_MAP_SPAN=96;

export function mapView(world,position,span=LOCAL_MAP_SPAN){
  const w=Math.min(span,world.w),h=Math.min(span,world.h);
  return {x:Math.max(world.ox,Math.min(world.ox+world.w-w,position.x-w/2)),
    z:Math.max(world.oz,Math.min(world.oz+world.h-h,position.z-h/2)),w,h};
}
const dimensions=size=>typeof size==='number'?{width:size,height:size}:size;
export function projectMap(point,view,size){
  const {width,height}=dimensions(size);
  return {x:(point.x-view.x)/view.w*width,y:(point.z-view.z)/view.h*height};
}
export function unprojectMap(x,y,view,size){
  const {width,height}=dimensions(size);
  return {x:view.x+x/width*view.w,z:view.z+y/height*view.h};
}
// The expanded map is rectangular in landscape. Keep world-space zoom
// independent from screen pixels, and clamp its pan to actual map bounds.
export function mapViewRect(world,center,verticalSpan,aspect=1){
  const ratio=Math.max(.5,Math.min(4,Number(aspect)||1));
  // At whole-world zoom, letterbox instead of stretching a square landmass
  // into a wide landscape canvas. Off-world margins are drawn as ocean.
  const maxH=Math.max(world.h,world.w/ratio);
  const h=Math.max(Math.min(32,world.h),Math.min(maxH,Number(verticalSpan)||world.h));
  const w=h*ratio;
  const x=w>=world.w?world.ox+(world.w-w)/2:
    Math.max(world.ox,Math.min(world.ox+world.w-w,center.x-w/2));
  const z=h>=world.h?world.oz+(world.h-h)/2:
    Math.max(world.oz,Math.min(world.oz+world.h-h,center.z-h/2));
  return {x,z,w,h};
}
export function zoomMapAt(world,view,focus,factor,aspect=1){
  if(!Number.isFinite(factor)||factor<=0)return view;
  // Keep the touched coordinate underneath the cursor during zoom.
  const rx=Math.max(0,Math.min(1,(focus.x-view.x)/view.w));
  const rz=Math.max(0,Math.min(1,(focus.z-view.z)/view.h));
  const ratio=Math.max(.5,Math.min(4,aspect));
  const nextH=Math.max(32,Math.min(Math.max(world.h,world.w/ratio),view.h*factor));
  const nextW=nextH*ratio;
  return mapViewRect(world,{x:focus.x+(0.5-rx)*nextW,
    z:focus.z+(0.5-rz)*nextH},nextH,aspect);
}
export function guidanceDirection(player,destination){
  if(!player||!destination)return null;
  const dx=destination.x-player.x,dz=destination.z-player.z;
  if(!Number.isFinite(dx)||!Number.isFinite(dz))return null;
  const distance=Math.hypot(dx,dz);
  return distance<.5?null:{dx:dx/distance,dz:dz/distance,distance,bearing:Math.atan2(dx,dz)};
}
export function mapTileColor(tile){
  if(!tile)return [12,49,73];
  // O mapa usa cores de terreno, sem o tint branco das texturas 3D.
  if((tile.region&9)===0)return tile.height<-.8?[15,84,133]:[23,121,166];
  if(tile.region&8)return [181,142,90];
  const paved=[2,3,4,13,20,21,22,37,47,48,49].includes(tile.tex);
  const sand=[14,15,16,34,35,36,44,45,46].includes(tile.tex);
  const snow=[11,26,27,28,29,32,38,40,41].includes(tile.tex);
  const base=snow?[178,203,209]:paved?[190,179,144]:sand?[208,187,123]:[76,124,78];
  const shade=tile.blocks===15?.82:1;
  return base.map(v=>Math.round(v*shade));
}

export function mapEdgePoint(point,view,size,padding=22){
  const p=projectMap(point,view,size),center=size/2;
  const dx=p.x-center,dy=p.y-center,distance=Math.hypot(dx,dy);
  const limit=center-padding;
  return distance>limit?{x:center+dx/distance*limit,y:center+dy/distance*limit,edge:true}:p;
}
