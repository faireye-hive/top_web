// 378 historical CharacterPoseInfo action IDs: 54 per weapon type.
// The JSON was derived from referencias/characterposeinfo.txt and
// referencias/CharacterAction.tx. These records are NOT a claim that the GLB
// currently includes those animations; availability is checked per loaded clip.
export const ACTION_GROUPS={unarmed:0,sword:1,greatsword:2,dual:3,firearm:4,bow:5,dagger:6};
export const ACTION_CATEGORIES={
  postures:'Posturas',movement:'Movimento',combat:'Combate',
  skills:'Skills e ações de skill',social:'Sociais',emotes:'Emotes',
  interaction:'Interações'
};
export function weaponBankForJob(job,manifest){
  const pose=Number(manifest?.sets?.[job]?.pose);
  return Number.isInteger(pose)&&pose>=0&&pose<=6?pose:0;
}
export function actionNumber(clipName){
  const match=/^\s*(\d{1,3})\s*[·\-]/.exec(String(clipName||''));
  return match?Number(match[1]):null;
}
export function actionClip(clips,id){
  return (clips||[]).find(clip=>actionNumber(clip?.name)===id)||null;
}
export function actionName(catalog,id){
  if(!Number.isInteger(id)||id<1||id>378)return null;
  const group=Math.floor((id-1)/54),relative=(id-1)%54;
  const base=catalog?.actions?.[relative];
  return base?.ids?.[group]===id?base:null;
}
export function historicalAction(catalog,actor,id,clips=[]){
  const data=actionName(catalog,id);
  if(!data)return null;
  const group=Math.floor((id-1)/54);
  const clip=actionClip(clips,id);
  const frames=catalog?.frames?.[actor]?.[String(id)]||null;
  return {
    id,code:String(id).padStart(3,'0'),group,
    groupKey:catalog.groups[group].key,
    groupName:catalog.groups[group].label,
    label:data.label,original:data.original,category:data.category,
    frames,clip,available:!!clip,
    status:clip?'exported':frames?'not-exported':'no-source-frames'
  };
}
// Armed bank first and shared/unarmed bank afterwards; all 54 movements in
// each bank, not just the five configurable high-level states.
export function catalogForActor(catalog,actor,bank,clips=[],mode='both'){
  if(!catalog?.actions||!catalog?.groups)return [];
  const selected=Number.isInteger(Number(bank))?Math.max(0,Math.min(6,Number(bank))):0;
  const banks=mode==='base'?[0]:mode==='armed'?[selected]:
    selected===0?[0]:[selected,0];
  return banks.flatMap(b=>catalog.actions.map(row=>
    historicalAction(catalog,actor,row.ids[b],clips))).filter(Boolean);
}
const plain=str=>String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterHistoricalActions(records,{query='',category='all',status='all'}={}){
  const search=plain(query).trim();
  return (records||[]).filter(r=>{
    if(category!=='all'&&r.category!==category)return false;
    if(status!=='all'&&r.status!==status)return false;
    if(!search)return true;
    return [r.code,String(r.id),r.label,r.original,r.groupName].some(text=>plain(text).includes(search));
  });
}
