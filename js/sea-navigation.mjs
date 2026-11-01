// MapFile::sailableAt: ausência de LAND e subtile de 50 cm livre.
// A altura não define a área marítima (pontes podem cobrir água navegável).
export const SEA_LEVEL=-.1;
export const BOAT_RADIUS=2.9;
export const BOARDING_REACH=7;

export function sailableTile(tile,x,z){
  if(!tile||!Number.isFinite(x)||!Number.isFinite(z)||(tile.region&1))return false;
  const sub=Math.floor((z-Math.floor(z))*2)*2+Math.floor((x-Math.floor(x))*2);
  return (tile.blocks&(1<<sub))===0;
}

export function sailableAt(tileAt,x,z,radius=BOAT_RADIUS){
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  if(!sailableTile(tileAt(x,z),x,z))return false;
  // Verificar todo o disco evita atravessar uma faixa estreita de terra ou
  // bloqueio entre o centro e a borda do casco.
  for(let dz=-radius;dz<=radius;dz+=.4)for(let dx=-radius;dx<=radius;dx+=.4){
    if(dx*dx+dz*dz>radius*radius)continue;
    if(!sailableTile(tileAt(x+dx,z+dz),x+dx,z+dz))return false;
  }
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;
    if(!sailableTile(tileAt(px,pz),px,pz))return false;
  }
  return true;
}

export function landableAt(tileAt,x,z,radius=.22){
  for(const [dx,dz] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){
    const px=x+dx,pz=z+dz,tile=tileAt(px,pz);
    if(!tile||(tile.region&9)===0)return false;
    const sub=Math.floor((pz-Math.floor(pz))*2)*2+Math.floor((px-Math.floor(px))*2);
    if(tile.blocks&(1<<sub))return false;
  }
  return true;
}

export function nearestPosition(origin,allowed,reach=BOARDING_REACH,connected=()=>true){
  const candidates=[];
  for(let dz=-reach;dz<=reach;dz+=.5)for(let dx=-reach;dx<=reach;dx+=.5){
    const distance=dx*dx+dz*dz;
    if(distance<=reach*reach)candidates.push({x:origin.x+dx,z:origin.z+dz,distance});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  return candidates.find(p=>allowed(p.x,p.z)&&connected(origin,p))||null;
}

export function clearTransfer(origin,destination,tileAt,solidAt=()=>false){
  const distance=Math.hypot(destination.x-origin.x,destination.z-origin.z);
  const steps=Math.max(1,Math.ceil(distance/.2));
  for(let i=0;i<=steps;i++){
    const x=origin.x+(destination.x-origin.x)*i/steps;
    const z=origin.z+(destination.z-origin.z)*i/steps;
    const tile=tileAt(x,z);
    if(!tile||solidAt(x,z))return false;
    const sub=Math.floor((z-Math.floor(z))*2)*2+Math.floor((x-Math.floor(x))*2);
    if(tile.blocks&(1<<sub))return false;
  }
  return true;
}

export function restoreSeaPosition(raw,canSail){
  try{
    const value=JSON.parse(raw);
    if(value?.version===1&&value.sailing===true&&Number.isFinite(value.x)&&Number.isFinite(value.z)&&canSail(value.x,value.z))return value;
  }catch{}
  return null;
}
