export function sceneAssetFromHit(hit,catalog={}){
  const data=hit?.object?.userData,record=data?.sceneRecords?.[hit.instanceId];
  if(!record||!data.sourceFile)return null;
  const source=catalog[record[2]]||{},materialIndex=hit.face?.materialIndex??0;
  return {id:record[2],label:source.label||data.sourceFile,file:data.sourceFile,x:record[0],z:record[1],textureId:data.textureIds?.[materialIndex]??null};
}
