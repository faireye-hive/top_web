// Dados de CharacterAction.tx (DirectX 9), grupos Action ID 1..4 de characterinfo.txt.
// Apenas ações equipadas pelo catálogo visual do Studio. Cada vetor:
// [frameInicial, frameFinalExclusivo, chave0, chave1, ...].
// Gerado a partir do arquivo original enviado; não confundir índices de evento
// do SkillInfo com timestamps das animações GLB.
export const ACTION_FRAMES = {
  lance: {
    65:[2530,2579,2556],66:[757,801,771],67:[2500,2527,2512],
    120:[1274,1344,1294],174:[2658,2704,2685],
    176:[3063,3097,3078],203:[2851,2911,2861,2867,2883],
    223:[1587,1619,1598],224:[2247,2284,2260],225:[2286,2320,2299],
    277:[1747,1771,1758],283:[2585,2612,2604]
  },
  carsise: {
    65:[319,370,348],66:[388,445,419],67:[2326,2352,2338],
    120:[1772,1826,1784],174:[1568,1624,1587],
    176:[1568,1611,1582],203:[2467,2538,2478,2486,2502]
  },
  phyllis: {
    65:[5977,6017,5995],66:[5267,5308,5280],120:[1274,1344,1294],
    174:[2658,2704,2685],176:[3063,3097,3078],
    203:[2851,2911,2861],223:[4193,4223,4203],
    224:[5827,5851,5836],225:[5852,5877,5861],
    277:[5357,5386,5371],283:[6108,6142,6127]
  },
  ami: {65:[1415,1449,1439],66:[977,1010,986]}
};
const seconds = n => Math.round(n*10000)/10000;
const matchingClip = (clip, action) =>
  !!clip && new RegExp('(^|\\D)'+action.id+'(\\D|$)').test(clip.name||'');

// characterposeinfo.txt traduz a ação base conforme a arma; o catálogo
// de cada skill já lista as ações equipadas e o intervalo de frames.
// Usamos o clip real quando presente para mapear os frames DX9 ao tempo GLB.
// Sem clipe, 30 FPS é a referência da reprodução DX9 (PlayPose).
export function poseForSkill(skill, actor, clip=null){
  const available=ACTION_FRAMES[actor]||{};
  const candidates=(skill?.actions?.[actor]||[]).filter(a=>available[a.id]);
  if(!candidates.length)return null;
  const action=candidates.find(a=>matchingClip(clip,a))||candidates[0];
  const frames=available[action.id];
  const [startFrame,endFrame,...keys]=frames;
  if(endFrame<=startFrame || !keys.length)return null;
  // A tabela editada/copiada não deve ser tomada por válida se divergir
  // dos intervalos de CharacterAction original que o catálogo anuncia.
  if(action.frames?.length>=2 &&
    (action.frames[0]!==startFrame || action.frames[1]!==endFrame))return null;
  const originalDuration=(endFrame-startFrame)/30;
  // Somente o clipe da ação escolhida pode determinar a duração GLB.
  const clipMatches=matchingClip(clip,action);
  const clipDuration=clipMatches && Number.isFinite(clip.duration) && clip.duration>0
    ?clip.duration:null;
  const duration=clipDuration??originalDuration;
  const keyframes=keys.filter(f=>f>=startFrame&&f<=endFrame)
    .map((frame,index)=>({index,frame,
      time:seconds((frame-startFrame)/(endFrame-startFrame)*duration),
      originalTime:seconds((frame-startFrame)/30),
      source:clipDuration!=null?'CharacterAction.tx · frame DX9 convertido à duração GLB':'CharacterAction.tx · frames a 30 FPS'}));
  return {actor,action:action.id,startFrame,endFrame,
    duration:seconds(duration),originalDuration:seconds(originalDuration),
    source:clipDuration!=null?'CharacterAction.tx + duração GLB':'CharacterAction.tx, 30 FPS',
    keyframes};
}
