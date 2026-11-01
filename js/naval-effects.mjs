// Projéteis visuais; dano e tempo de impacto pertencem a naval-combat.
export function createNavalEffects({THREE,scene,mobile=()=>false}){
  const geometry=new THREE.SphereGeometry(.12,8,6),material=new THREE.MeshBasicMaterial({color:0xffd477});
  const trailMaterial=new THREE.MeshBasicMaterial({color:0xff6424,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending});
  const live=[],pool=[];
  function remove(index){const entry=live.splice(index,1)[0];entry.ball.visible=false;entry.trail.visible=false;pool.push(entry);}
  function fire(event,position){
    if(!event.monster)return;
    const incoming=event.type==='monster-swing';
    const from=incoming?event.monster:position,to=incoming?position:event.monster;
    while(live.length>=(mobile()?8:16))remove(0);
    let entry=pool.pop();
    if(!entry){
      entry={ball:new THREE.Mesh(geometry,material),trail:new THREE.Mesh(geometry,trailMaterial)};
      scene.add(entry.ball,entry.trail);
    }
    Object.assign(entry,{from:{x:from.x,z:from.z},to,time:0,life:Math.max(.2,event.flight??event.period*.35)});
    entry.ball.visible=true;entry.trail.visible=true;live.push(entry);
  }
  function update(dt,{paused=false,active=true}={}){
    for(let i=live.length-1;i>=0;i--){
      const p=live[i];if(!paused)p.time+=dt;
      if(p.time>=p.life||!active){remove(i);continue;}
      const t=p.time/p.life,x=p.from.x+(p.to.x-p.from.x)*t,z=p.from.z+(p.to.z-p.from.z)*t;
      p.ball.position.set(x,.9+Math.sin(t*Math.PI)*1.2,z);
      p.trail.position.copy(p.ball.position);p.trail.scale.setScalar(2+Math.sin(t*Math.PI));
    }
  }
  return {fire,update};
}
