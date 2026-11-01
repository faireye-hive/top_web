// Trajetória PAR original, percorrida pela distância de cada segmento.
const paths=new WeakMap();
export function petPathPose(path,time){
  const points=path?.points;
  if(!points?.length)return {position:[0,0,0],yaw:0};
  if(!paths.has(path)){
    const lengths=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,c)=>v-points[i][c])));
    paths.set(path,{lengths,total:lengths.reduce((a,b)=>a+b,0)});
  }
  const {lengths,total}=paths.get(path);
  if(total<1e-6)return {position:[...points[0]],yaw:0};
  let distance=((time*Math.max(0,path.speed||0))%total+total)%total;
  for(let i=0;i<lengths.length;i++){
    const length=lengths[i];
    if(distance<=length&&length>1e-6){
      const a=points[i],b=points[i+1],t=distance/length;
      return {position:a.map((v,c)=>v+(b[c]-v)*t),yaw:Math.atan2(a[0]-b[0],b[1]-a[1])};
    }
    distance-=length;
  }
  return {position:[...points[0]],yaw:0};
}
export function followPetPosition(current,owner,dt){
  if(!current||Math.hypot(current.x-owner.x,current.z-owner.z)>12)return {...owner};
  const t=1-Math.exp(-Math.max(0,dt)*10);
  return {x:current.x+(owner.x-current.x)*t,y:current.y+(owner.y-current.y)*t,z:current.z+(owner.z-current.z)*t};
}
