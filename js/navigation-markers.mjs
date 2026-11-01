// Dois marcadores leves: cais permanente e destino de transferência válido.
export function createNavigationMarkers(THREE,scene){
  function marker(color){
    const group=new THREE.Group();
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.88,
      side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
    const ring=new THREE.Mesh(new THREE.RingGeometry(.65,.83,40),material);
    ring.rotation.x=-Math.PI/2;ring.position.y=.13;
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=112;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false,sizeAttenuation:false}));
    sprite.scale.set(.4,.0875,1);sprite.position.y=2.5;sprite.renderOrder=12;
    group.add(ring,sprite);group.visible=false;scene.add(group);
    let previous='';
    return {group,ring,sprite,set(point,height,text){
      group.visible=!!point;if(!point)return;
      group.position.set(point.x,height,point.z);
      if(previous===text)return;
      previous=text;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,112);
      ctx.fillStyle='#082b3e';ctx.strokeStyle=color;ctx.lineWidth=5;
      ctx.beginPath();ctx.roundRect(5,5,502,84,20);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(242,88);ctx.lineTo(256,108);ctx.lineTo(270,88);ctx.fill();
      ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;
      ctx.fillText(text,256,47);texture.needsUpdate=true;
    }};
  }
  const port=marker('#ffd37d'),transfer=marker('#6dffcf');
  return {
    update({harbor,harborHeight,player,context,heightAt,time}){
      const distance=Math.hypot(player.x-harbor.x,player.z-harbor.z);
      const destination=context?.destination;
      port.set(distance<110&&!(destination&&distance<14)?harbor:null,harborHeight,'⚓ PORTO DE ARGENT');
      transfer.set(destination,destination?heightAt(destination):0,context?.type==='disembark'?'↓ DESEMBARCAR':'↑ EMBARCAR');
      for(const m of [port,transfer]){
        m.ring.scale.setScalar(1+Math.sin(time*2)*.08);
        m.sprite.position.y=2.5+Math.sin(time*2)*.12;
      }
    }
  };
}
