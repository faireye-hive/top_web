// Dados de gameplay são opcionais. Aqui só selecionamos animações reais do GLB.
export function availableSkillClips(clips) {
  const values=Array.isArray(clips)?clips:[];
  const seen=new Set();
  return values.map(c=>typeof c==='string'?c:c?.name).filter(name=>{
    if(typeof name!=='string'||!/\b(skill|habilidade|magia|ataque)\s*\d*\b/i.test(name))return false;
    if(seen.has(name))return false;
    seen.add(name);return true;
  }).sort((a,b)=>{
    const ap=/\bskill\b/i.test(a)?0:/\bhabilidade\b|\bmagia\b/i.test(a)?1:2;
    const bp=/\bskill\b/i.test(b)?0:/\bhabilidade\b|\bmagia\b/i.test(b)?1:2;
    return ap-bp || a.localeCompare(b,'pt-BR',{numeric:true});
  });
}
export function resolveSlots(saved,available,count=3){
  const pool=Array.isArray(available)?available:[];
  const selected=new Array(count).fill(null);
  if(Array.isArray(saved)){
    for(let i=0;i<count;i++){
      const name=saved[i];
      if(typeof name==='string'&&pool.includes(name)&&!selected.includes(name))selected[i]=name;
    }
  }
  for(let i=0;i<count;i++)if(!selected[i]){
    selected[i]=pool.find(name=>!selected.includes(name))||null;
  }
  return selected;
}
export function statText(value) {
  if(value==null||value==='')return '—';
  if(typeof value==='number'&&Number.isFinite(value))return value.toLocaleString('pt-BR');
  return String(value);
}
