// Orientação e arco da trilha PAR no simulador Three.js.
// CharacterAction/DX9 definem o instante do golpe; a curva 3D abaixo é uma
// aproximação para edição visual e NÃO um campo histórico do arquivo .par.
export const STRIP_SWING_DEFAULTS = Object.freeze({
  a0:-70, a1:110, start:0, dur:.35, r0:.25, r1:1.35, h:1.1,
  rotation:Object.freeze([0,0,0])
});

export function stripSwing(value) {
  const sw={...STRIP_SWING_DEFAULTS,...(value&&typeof value==='object'?value:{})};
  const angles=Array.isArray(sw.rotation)?sw.rotation:[0,0,0];
  sw.rotation=[0,1,2].map(i=>{
    const n=Number(angles[i]);
    return Number.isFinite(n)?Math.max(-360,Math.min(360,n)):0;
  });
  return sw;
}

export function stripRotationRadians(value) {
  return stripSwing(value).rotation.map(n=>n*Math.PI/180);
}
