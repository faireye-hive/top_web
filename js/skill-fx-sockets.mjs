// Pontos de conexão do cliente TOP extraídos do LAB (visuals.attachments).
// Os modelos equipados em assets/equipment/models/*.glb já contêm as peças
// históricas presas aos ossos pelo conversor build_evanescence.py.
// Esta implementação segue a transformação bone.matrixWorld * dummy.matrix:
// orientação e posição da mão são ATUALIZADAS conforme a pose 3D.
// A posição calculada é do dummy de conexão, não necessariamente da
// extremidade geométrica de uma arma (muzzle/tip exigiria helper adicional).
import * as THREE from 'three';

const _boneToDummy=new THREE.Matrix4();
const _point=new THREE.Vector3();
export function socketRecord(manifest,actor,job,layer,{equipped=true}={}){
  const group=manifest?.attachments?.[actor];if(!group||!layer)return null;
  const channel=layer.channel;
  const index=Number(layer.dummy);
  const itemIndex=Number(layer.itemDummy);
  let record,source;
  if(equipped && (channel==='item'||channel==='itemExtra')){
    record=group.items?.[job]?.[String(index)]||null;source='item';
  }else if(equipped && channel==='flight' && Number.isInteger(itemIndex)&&itemIndex>=0){
    record=group.items?.[job]?.[String(itemIndex)]||null;source='item';
  }
  if(!record && channel!=='target' && channel!=='ground' && channel!=='water'){
    record=group.actor?.[String(index)]||null;source='actor';
  }
  if(!record?.bone||!Array.isArray(record.matrix)||record.matrix.length!==16)return null;
  return {record,source,index:source==='item'&&channel==='flight'?itemIndex:index};
}
export function socketFromSkeleton({manifest,actor,job,layer,avatar,root,equipped=true}={}){
  if(!avatar||!root)return null;
  const ref=socketRecord(manifest,actor,job,layer,{equipped});
  if(!ref)return null;
  const bone=avatar.getObjectByName(ref.record.bone);
  if(!bone)return null;
  avatar.updateMatrixWorld(true);
  root.updateMatrixWorld(true);
  _boneToDummy.fromArray(ref.record.matrix);
  _boneToDummy.premultiply(bone.matrixWorld);
  _point.setFromMatrixPosition(_boneToDummy);
  root.worldToLocal(_point);
  if(![ _point.x,_point.y,_point.z ].every(Number.isFinite))return null;
  return [_point.x,_point.y,_point.z];
}
export function socketDescription(manifest,actor,job,layer,options){
  const src=socketRecord(manifest,actor,job,layer,options);
  return src?{
    source:src.source,id:src.index,bone:src.record.bone,
    description:(src.source==='item'?'Dummy do equipamento':'Dummy do personagem')+
      ' #'+src.index+' · '+src.record.bone
  }:null;
}
