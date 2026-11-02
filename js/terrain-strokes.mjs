export const MIN_BRUSH_RADIUS=.03;
export function strokeBounds(stroke){
  const r=stroke.radius;
  return {x0:Math.min(...stroke.points.map(p=>p[0]))-r,z0:Math.min(...stroke.points.map(p=>p[1]))-r,x1:Math.max(...stroke.points.map(p=>p[0]))+r,z1:Math.max(...stroke.points.map(p=>p[1]))+r};
}
export function intersectsBounds(a,b){return a.x0<=b.x1&&a.x1>=b.x0&&a.z0<=b.z1&&a.z1>=b.z0;}
export function distanceToStroke(x,z,stroke){
  let distance=Infinity;
  for(let i=0;i<stroke.points.length;i++){
    const a=stroke.points[i],b=stroke.points[i+1]||a,dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;
    const t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)):0;
    distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return distance;
}
export function appendStrokePoint(stroke,x,z){
  const last=stroke.points.at(-1);
  if(last&&Math.hypot(x-last[0],z-last[1])<Math.min(.12,stroke.radius*.3))return false;
  stroke.points.push([Math.max(0,Math.min(4095.999,Math.round(x*1000)/1000)),Math.max(0,Math.min(4095.999,Math.round(z*1000)/1000))]);return true;
}
// A continuous ribbon has one feathered edge per side; joined vertices avoid
// gaps and repeated circular stamps at small brush radii. Caps are semicircles.
export function strokeTriangles(stroke,emit){
  const source=stroke.points,points=[];
  for(let i=0;i<source.length;i++){
    const a=source[i],b=source[i+1];points.push(a);
    if(b){const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.35);for(let j=1;j<steps;j++)points.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);}
  }
  if(!points.length)return;
  const radius=stroke.radius,normals=points.map((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
    return points.length===1?[0,-1]:[dz/len,-dx/len];
  });
  const across=Math.max(2,Math.ceil(radius*2/.35));
  const vertex=(p,n,t)=>[p[0]+n[0]*radius*t,p[1]+n[1]*radius*t,t,0];
  for(let i=0;i<points.length-1;i++)for(let j=0;j<across;j++){
    const t0=-1+2*j/across,t1=-1+2*(j+1)/across;
    const a=vertex(points[i],normals[i],t0),b=vertex(points[i],normals[i],t1),c=vertex(points[i+1],normals[i+1],t0),d=vertex(points[i+1],normals[i+1],t1);
    emit(a,c,b);emit(b,c,d);
  }
  function cap(p,n,end){
    const forward=[-n[1]*end,n[0]*end],rings=Math.max(1,Math.ceil(radius/.35)),segments=24;
    const v=(r,a)=>[p[0]+radius*r*(n[0]*Math.cos(a)+forward[0]*Math.sin(a)),p[1]+radius*r*(n[1]*Math.cos(a)+forward[1]*Math.sin(a)),r*Math.cos(a),r*Math.sin(a)];
    for(let ring=0;ring<rings;ring++)for(let j=0;j<segments;j++){
      const a=j*Math.PI/segments,b=(j+1)*Math.PI/segments,r0=ring/rings,r1=(ring+1)/rings;
      emit(v(r0,a),v(r1,a),v(r1,b));if(ring)emit(v(r0,a),v(r1,b),v(r0,b));
    }
  }
  cap(points[0],normals[0],-1);cap(points.at(-1),normals.at(-1),1);
}
export function paintSoftEdge(design,x,z,side,value,radius=0){
  const r=Math.min(8,Math.floor(radius)),px=Math.floor(x),pz=Math.floor(z);
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    if(dx*dx+dz*dz>r*r)continue;
    const x=px+dx,z=pz+dz,corners=side==='north'?[[x,z],[x+1,z]]:side==='south'?[[x,z+1],[x+1,z+1]]:side==='east'?[[x+1,z],[x+1,z+1]]:side==='west'?[[x,z],[x,z+1]]:[[x,z],[x+1,z],[x,z+1],[x+1,z+1]];
    for(const [cx,cz] of corners)if(cx>=0&&cz>=0&&cx<4096&&cz<4096){const key=`${cx}/${cz}`;design.tiles[key]={...design.tiles[key],softness:value};}
  }
}

export function drawTerrainPaths(ctx,strokes,view,size,colorFor){
  let count=0;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const stroke of strokes||[]){
    if(stroke.tool!=='path'||!intersectsBounds(strokeBounds(stroke),{x0:view.x,z0:view.z,x1:view.x+view.w,z1:view.z+view.h}))continue;
    ctx.globalAlpha=stroke.opacity;ctx.strokeStyle=colorFor(stroke.tex);ctx.lineWidth=Math.max(.75,stroke.radius*2*size.width/view.w);
    ctx.beginPath();stroke.points.forEach(([x,z],i)=>{const px=(x-view.x)/view.w*size.width,pz=(z-view.z)/view.h*size.height;if(i===0)ctx.moveTo(px,pz);else ctx.lineTo(px,pz);});
    if(stroke.points.length===1){const [x,z]=stroke.points[0];ctx.lineTo((x-view.x)/view.w*size.width+.01,(z-view.z)/view.h*size.height);}
    ctx.stroke();count++;
  }
  ctx.restore();return count;
}
