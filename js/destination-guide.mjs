import {guidanceDirection} from './navigation-map.mjs';
// A small world-space floor arrow, not a misleading straight "road" through walls.
// It points to the destination while the existing terrain collision prevents crossing obstacles.
export function createDestinationGuide(THREE,scene){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([
     0,.02,1.26, -.45,.02,.48, -.16,.02,.48,
    -.16,.02,.48, -.16,.02,-.28, .16,.02,-.28,
     .16,.02,-.28, .16,.02,.48, -.16,.02,.48,
     .16,.02,.48, .45,.02,.48, 0,.02,1.26
  ],3));
  geometry.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({color:0xffdb71,transparent:true,
    opacity:.82,side:THREE.DoubleSide,depthWrite:false,depthTest:true,toneMapped:false});
  const arrow=new THREE.Mesh(geometry,material);
  arrow.name='Seta do destino marcado';
  arrow.visible=false;arrow.renderOrder=9;scene.add(arrow);
  return {
    update(player,goal,heightAt,time){
      const direction=guidanceDirection(player,goal);
      arrow.visible=!!direction;
      if(!direction)return;
      const ahead=1.65;
      const x=player.x+direction.dx*ahead,z=player.z+direction.dz*ahead;
      arrow.position.set(x,heightAt(x,z)+.09,z);
      arrow.rotation.y=direction.bearing;
      material.opacity=.63+.2*(.5+.5*Math.sin(time*4));
    },
    dispose(){scene.remove(arrow);geometry.dispose();material.dispose();},
    get visible(){return arrow.visible}
  };
}
