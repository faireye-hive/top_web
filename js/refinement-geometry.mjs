// Only straight swords use the grip-to-tip ribbon. Other weapon silhouettes
// (staffs, daggers, bows and rifles) must follow the animated mesh itself.
export const refinementFollowsSurface=job=>['cleric','seal-master','voyager','sharpshooter','hunter'].includes(job);

// Cross sections along the weapon's principal axis, rather than a diagonal
// between arbitrary farthest vertices. Each center stays attached to four
// real vertices and therefore follows the current skin/holster transform.
export function refinementSurfaceSpine(geometry,segments=16){
  const p=geometry?.attributes?.position;if(!p?.count)return [];
  const points=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);
  const mean=[0,0,0],cov=Array(9).fill(0),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const point of points)for(let i=0;i<3;i++){mean[i]+=point[i]/points.length;min[i]=Math.min(min[i],point[i]);max[i]=Math.max(max[i],point[i]);}
  for(const point of points)for(let i=0;i<3;i++)for(let j=0;j<3;j++)cov[i*3+j]+=(point[i]-mean[i])*(point[j]-mean[j]);
  const span=max.map((n,i)=>n-min[i]),longest=span.indexOf(Math.max(...span));
  let axis=[0,0,0];axis[longest]=1;
  for(let pass=0;pass<16;pass++){
    const next=[0,1,2].map(i=>cov[i*3]*axis[0]+cov[i*3+1]*axis[1]+cov[i*3+2]*axis[2]);
    const length=Math.hypot(...next);if(length<1e-12)return [];
    axis=next.map(n=>n/length);
  }
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  let u=cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0]);const norm=Math.hypot(...u);u=u.map(n=>n/norm);
  const v=cross(axis,u),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const projected=points.map((point,index)=>({index,t:dot(point,axis),u:dot(point,u),v:dot(point,v)}));
  let start=Infinity,end=-Infinity;for(const point of projected){start=Math.min(start,point.t);end=Math.max(end,point.t);}
  const step=(end-start)/segments;
  const sections=Array.from({length:segments+1},(_,n)=>{
    const at=start+step*n;
    let section=projected.filter(p=>Math.abs(p.t-at)<=step*.6);
    if(!section.length)return null;
    let minU=section[0],maxU=minU,minV=minU,maxV=minU;
    for(const p of section){if(p.u<minU.u)minU=p;if(p.u>maxU.u)maxU=p;if(p.v<minV.v)minV=p;if(p.v>maxV.v)maxV=p;}
    return {indices:[minU.index,maxU.index,minV.index,maxV.index],weights:[.25,.25,.25,.25],radius:Math.max(maxU.u-minU.u,maxV.v-minV.v)*.5};
  });
  // Low-poly shafts often have vertices only at their ends. Interpolate the
  // live anchors of adjacent occupied sections instead of snapping to a tip.
  const filled=sections.map((section,n)=>{
    if(section)return section;
    let before=n-1,after=n+1;while(!sections[before])before--;while(!sections[after])after++;
    const a=sections[before],b=sections[after],t=(n-before)/(after-before);
    return {indices:[...a.indices,...b.indices],weights:[...a.weights.map(w=>w*(1-t)),...b.weights.map(w=>w*t)],radius:a.radius*(1-t)+b.radius*t};
  });
  return filled.map((section,n)=>{
    if(n===0||n===segments)return section;
    const weights=new Map();let radius=0;
    for(const [offset,weight] of [[-3,1/64],[-2,6/64],[-1,15/64],[0,20/64],[1,15/64],[2,6/64],[3,1/64]]){
      const point=filled[Math.max(0,Math.min(segments,n+offset))];radius+=point.radius*weight;
      point.indices.forEach((index,k)=>weights.set(index,(weights.get(index)||0)+point.weights[k]*weight));
    }
    return {indices:[...weights.keys()],weights:[...weights.values()],radius};
  });
}

// Sample real triangle edges by length, including narrow shafts and bow limbs.
// Store vertex indices and interpolation, never bind-pose world positions: the
// caller evaluates these same anchors on the hand mesh or its holstered copy.
export function refinementSurfaceSamples(geometry,count=96){
  const position=geometry?.attributes?.position,index=geometry?.index;
  if(!position?.count)return [];
  const edges=[],seen=new Set();let length=0;
  const vertex=i=>index?index.getX(i):i;
  const total=index?.count??position.count;
  for(let i=0;i+2<total;i+=3){
    const triangle=[vertex(i),vertex(i+1),vertex(i+2)];
    for(let n=0;n<3;n++){
      const a=Math.min(triangle[n],triangle[(n+1)%3]),b=Math.max(triangle[n],triangle[(n+1)%3]);
      const key=a+':'+b;if(seen.has(key))continue;seen.add(key);
      const size=Math.hypot(position.getX(a)-position.getX(b),position.getY(a)-position.getY(b),position.getZ(a)-position.getZ(b));
      if(size<1e-8)continue;
      length+=size;edges.push({a,b,end:length,size});
    }
  }
  if(!edges.length)return [];
  return Array.from({length:count},(_,n)=>{
    // Every prefix covers the whole weapon, so the mobile cap stays aligned.
    const at=((n*.61803398875+.5)%1)*length;
    let low=0,high=edges.length-1;
    while(low<high){const mid=(low+high)>>1;if(edges[mid].end<at)low=mid+1;else high=mid;}
    const edge=edges[low];return {a:edge.a,b:edge.b,t:(at-(edge.end-edge.size))/edge.size};
  });
}
