// Camera follow for the mobile Garner client, frame-rate independent.
// Pure functions to keep camera movement testable without WebGL or Three.js.
export function followFactor(deltaSeconds, response=6){
  const dt=Math.max(0,Math.min(0.1,Number(deltaSeconds)||0));
  return 1-Math.exp(-Math.max(0,response)*dt);
}
export function shouldSnapFollow(current,target,snapDistance=14){
  if(!current||!target)return true;
  const dx=target.x-current.x,dy=target.y-current.y,dz=target.z-current.z;
  return dx*dx+dy*dy+dz*dz>=snapDistance*snapDistance;
}
export function updateFollowTarget(current,target,deltaSeconds,{response=6,snapDistance=14}={}){
  if(!current||!target)return current;
  if(shouldSnapFollow(current,target,snapDistance))return current.copy(target);
  // For avatars strolling at roughly 3-5 m/s, response=6 creates a soft
  // trailing movement without letting the focus drift far behind.
  const a=followFactor(deltaSeconds,response);
  return current.lerp(target,a);
}
