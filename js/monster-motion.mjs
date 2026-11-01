// Navegação local compartilhada por patrulha, perseguição e retorno.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function findMonsterRoute(start,goal,canReach=()=>true){
  if(canReach(start,goal))return [{x:goal.x,z:goal.z}];
  const step=.75,key=(x,z)=>`${x},${z}`,point=n=>({x:start.x+n.x*step,z:start.z+n.z*step});
  const first={x:0,z:0,g:0},open=[first],seen=new Map([[key(0,0),first]]);
  const limit=Math.ceil(distance(start,goal)/step)+8;
  for(let visits=0;open.length&&visits<1600;visits++){
    open.sort((a,b)=>(b.g+distance(point(b),goal))-(a.g+distance(point(a),goal)));
    const node=open.pop(),from=point(node);node.closed=true;
    if(distance(from,goal)<step*1.5&&canReach(from,goal)){
      const route=[{x:goal.x,z:goal.z}];
      for(let n=node;n.parent;n=n.parent)route.push(point(n));
      return route.reverse();
    }
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
      if(!x&&!z)continue;
      const nx=node.x+x,nz=node.z+z;
      if(Math.abs(nx)>limit||Math.abs(nz)>limit)continue;
      const id=key(nx,nz),old=seen.get(id),next={x:nx,z:nz,g:node.g+Math.hypot(x,z)*step,parent:node};
      if(old&&(old.closed||old.g<=next.g)||!canReach(from,point(next)))continue;
      if(old)open.splice(open.indexOf(old),1);
      seen.set(id,next);open.push(next);
    }
  }
  return [];
}
export function initMonsterMotion(m){
  m.home??={x:m.x,z:m.z};m.motion??='patrol';m.routeIndex??=0;
}
export function returnMonsterHome(m,{teleport=false}={}){
  initMonsterMotion(m);m.engaged=false;m.attackPending=null;m.cooldown=0;m.poisonTick=0;
  m.path=[];m.pathGoal=null;m.pathTimer=0;m.moving=false;
  if(teleport){m.x=m.home.x;m.z=m.home.z;m.motion='patrol';m.routeIndex=0;}
  else m.motion='return';
}
export function updateMonsterMotion(m,dt,hero,{canReach=()=>true,range=2.4}={}){
  initMonsterMotion(m);m.moving=false;
  if(m.hp<=0||m.ready===false||m.status?.stun>0||m.attackPending)return;
  const mode=m.engaged?'chase':m.motion==='return'?'return':'patrol';
  if(mode!==m.motion){m.path=[];m.pathGoal=null;m.motion=mode;}
  let goal=mode==='chase'?hero:mode==='return'?m.home:m.patrol?.[m.routeIndex];
  if(!goal)return;
  const gap=distance(m,goal),stop=mode==='chase'?range:.12;
  if(gap<=stop+1e-5){
    m.path=[];m.pathGoal=null;
    if(mode==='return'){m.motion='patrol';m.routeIndex=0;}
    if(mode==='patrol')m.routeIndex=(m.routeIndex+1)%m.patrol.length;
    return;
  }
  m.pathTimer=Math.max(0,(m.pathTimer||0)-dt);
  if(!m.pathGoal||distance(m.pathGoal,goal)>1||!m.path?.length&&m.pathTimer===0){
    m.path=findMonsterRoute(m,goal,canReach);m.pathGoal={...goal};m.pathTimer=.8;
  }
  const speed=(mode==='patrol'?(m.patrolSpeed||1):(m.moveSpeed||3.2))*(m.status?.slow>0?.55:1);
  let remaining=Math.min(speed*dt,Math.max(0,gap-stop));
  while(remaining>1e-5&&m.path?.length){
    const waypoint=m.path[0],d=distance(m,waypoint),step=Math.min(.2,remaining,d);
    if(d<.01){m.path.shift();continue;}
    const next={x:m.x+(waypoint.x-m.x)*step/d,z:m.z+(waypoint.z-m.z)*step/d};
    if(!canReach(m,next)){m.path=[];m.pathGoal=null;break;}
    m.facing=Math.atan2(m.x-next.x,m.z-next.z);m.x=next.x;m.z=next.z;m.moving=true;remaining-=step;
    if(step>=d-1e-5)m.path.shift();
  }
}
