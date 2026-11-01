// Leve gerenciador de etiquetas de NPC. Sem novas draw calls WebGL.
// As etiquetas exibem o nome exato que veio do manifesto de NPCs.
export const NPC_NAMEPLATE_LIMITS=Object.freeze({
  mobile:Object.freeze({distance:19,count:6,intervalMs:130}),
  desktop:Object.freeze({distance:35,count:14,intervalMs:95})
});

export function visibleNpcNameCandidates(records,px,pz,mobile=false){
  const limits=mobile?NPC_NAMEPLATE_LIMITS.mobile:NPC_NAMEPLATE_LIMITS.desktop;
  if(!Number.isFinite(px)||!Number.isFinite(pz))return [];
  return records
    .filter(n=>n?.object?.visible&&n?.label&&n?.anchor&&typeof n.name==='string'&&n.name.trim())
    .map(n=>({npc:n,d2:(n.x-px)**2+(n.z-pz)**2}))
    .filter(({d2})=>d2<=limits.distance**2)
    .sort((a,b)=>a.d2-b.d2)
    .slice(0,limits.count);
}

// Projection already accounts for active orbit, zoom, perspective and camera.
// Ignore characters behind the camera or outside the visible canvas.
export function npcLabelScreenPosition(projected,rect,{mobile=false}={}){
  if(!projected||!rect||![projected.x,projected.y,projected.z].every(Number.isFinite))return null;
  if(projected.z< -1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1)return null;
  const x=rect.left+(projected.x+1)*rect.width*.5;
  const y=rect.top+(1-projected.y)*rect.height*.5;
  if(x<rect.left+4||x>rect.right-4||y<rect.top+16||y>rect.bottom-5)return null;
  // Keep tiny mobile HUD panels unobstructed. Names reappear as player moves.
  if(mobile&&y<rect.top+62)return null;
  return {x,y};
}

export function overlapsNpcLabel(a,b,mobile=false){
  const width=mobile?138:188;
  return Math.abs(a.x-b.x)<width&&Math.abs(a.y-b.y)<(mobile?24:28);
}
