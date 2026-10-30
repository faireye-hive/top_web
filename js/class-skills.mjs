// TOP Web: referências reais de skills da seleção mobile.
// O catálogo é gerado do skillinfo.txt e fica em assets/skills/catalog.json.
// Regras novas ficam em skill-rules; visuais convertidos em skill-visuals.
let catalogPromise;
export function loadMobileSkillCatalog(){
  if(!catalogPromise)catalogPromise=fetch('assets/skills/catalog.json?v=1').then(r=>{
    if(!r.ok)throw Error('Pacote de skills ainda não instalado (HTTP '+r.status+')');
    return r.json();
  }).then(data=>{
    if(!data||!data.classes)throw Error('Catálogo de skills inválido');
    return data;
  }).catch(err=>{console.info('Skills originais opcionais:',err.message);return null;});
  return catalogPromise;
}
export const SKILL_ANIMATION_ACTORS=['lance','carsise','phyllis','ami'];
export function getActionId(clip){
  const m=/^\s*(\d{1,3})\s*[·\-]/.exec(clip?.name||'');
  return m?Number(m[1]):null;
}
export function resolveSkillClip(skill,character,clips){
  if(!skill||!Array.isArray(clips))return null;
  const variants=skill.actions?.[character]||[];
  // Somente ações compatíveis com o modo de arma da classe, sem fallback
  // para animação genérica de outra arma.
  for(const item of variants){
    if(!Number.isInteger(item.id))continue;
    const clip=clips.find(a=>getActionId(a)===item.id);
    if(clip)return clip;
  }
  // Conch Ray (216) prevê a ação 67 com adaga, mas CharacterAction.tx não
  // fornece essa ação para Ami/Phyllis. O próprio skillinfo prevê 13 como
  // animação BASE: se equipada não existe para o ator, usar a base real.
  // Não aplicar este fallback a skills de pistola/arco/espada: trocar a
  // animação armada por um golpe desarmado seria visualmente incorreto.
  if(skill.id===216 && (character==='ami'||character==='phyllis') &&
     variants.length===0 && Array.isArray(skill.baseActions)){
    for(const id of skill.baseActions){
      const clip=clips.find(a=>getActionId(a)===id);
      if(clip)return clip;
    }
  }
  return null;
}
export function classSkillEntries(catalog,job,character,clips){
  const preset=catalog?.classes?.[job];
  return preset?.skills?.map(skill=>({...skill,available:!!resolveSkillClip(skill,character,clips)}))||[];
}
