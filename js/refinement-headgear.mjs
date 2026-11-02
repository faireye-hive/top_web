// Optional original headgear, skinned to the active avatar's existing bones.
export function createRefinementHeadgear({THREE,loader,onBeforeChange=()=>{},onChange=()=>{},onError=()=>{}}){
  let avatar=null,actor=null,root=null,hair=[],revision=0,pending=null,loaded='none';
  function dispose(value){
    if(!value)return;
    const resources=new Set();value.traverse(o=>{
      if(o.geometry)resources.add(o.geometry);if(o.skeleton)resources.add(o.skeleton);
      for(const material of (Array.isArray(o.material)?o.material:[o.material]))if(material){
        resources.add(material);for(const v of Object.values(material))if(v?.isTexture)resources.add(v);
      }
    });for(const resource of resources)resource.dispose();
  }
  function remove(){
    if(root){onBeforeChange();root.parent?.remove(root);dispose(root);root=null;}
    for(const [node,visible] of hair)node.visible=visible;
    hair=[];loaded='none';
  }
  function clear(){revision++;pending=null;remove();avatar=null;actor=null;}
  function bind(value,name){clear();avatar=value;actor=name;}
  async function setStyle(style){
    const choice=style?.hatModel==='royal-major'?'royal-major':'none';
    if(!avatar||choice===pending||choice===loaded&&!pending)return;
    const version=++revision,target=avatar,name=actor;pending=choice;
    remove();onChange();
    if(choice==='none'){pending=null;return;}
    let gltf=null,attached=null;
    try{
      if(!['lance','phyllis','carsise','ami'].includes(name))throw Error('Personagem sem chapéu disponível');
      gltf=await loader.loadAsync(new URL(`../assets/equipment/headgear/${name}-royal-major.glb?v=1`,import.meta.url).href);
      if(version!==revision||target!==avatar){dispose(gltf.scene);return;}
      let reference=null;target.traverse(o=>{if(!reference&&o.isSkinnedMesh)reference=o;});
      if(!reference)throw Error('Esqueleto do personagem indisponível');
      const bones=new Map(reference.skeleton.bones.map(bone=>[bone.name,bone]));
      const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
      if(!meshes.length)throw Error('Chapéu sem malha animada');
      for(const mesh of meshes)if(mesh.skeleton.bones.some(bone=>!bones.has(bone.name)))throw Error('Chapéu incompatível com este esqueleto');
      onBeforeChange();attached=new THREE.Group();attached.name='Royal Major Hat · original';
      const previousSkeletons=new Set();
      for(const mesh of meshes){
        const previous=mesh.skeleton;previousSkeletons.add(previous);
        const skeleton=new THREE.Skeleton(previous.bones.map(bone=>bones.get(bone.name)),previous.boneInverses);
        mesh.parent.remove(mesh);attached.add(mesh);mesh.bind(skeleton,mesh.bindMatrix);mesh.frustumCulled=false;
        mesh.userData.topRole='hat';mesh.userData.equipmentSlot=1;
      }
      for(const skeleton of previousSkeletons)skeleton.dispose();
      // Parent to the same Z-up conversion node as the original mesh. Adding
      // an entire GLB scene would apply that coordinate conversion twice.
      target.traverse(node=>{
        if(/^Parte[\s_]+0(?:[\s_·.-]|$)/i.test(node.name||'')&&node.userData?.topRole!=='hat')hair.push([node,node.visible]);
      });
      for(const [node] of hair)node.visible=false;
      reference.parent.add(attached);root=attached;loaded=choice;pending=null;onChange();
    }catch(error){
      if(attached){attached.parent?.remove(attached);dispose(attached);}else if(gltf)dispose(gltf.scene);
      if(version===revision){pending=null;remove();onChange();onError(error);}
    }
  }
  return {bind,clear,setStyle};
}
