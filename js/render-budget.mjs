// Limites locais: o continente continua inteiro, apenas a vizinhança fica na GPU.
export function renderBudget(mobile){return mobile?
  {chunk:32,radius:3,sectors:16,objects:70,effects:42,particles:96,pixelRatio:1}:
  {chunk:64,radius:3,sectors:24,objects:180,effects:180,particles:1200,pixelRatio:1.65};}
export function instanceCapacity(required,current=0){
  required=Math.max(1,Math.ceil(required));
  if(current>=required&&(current<=32||required>current/4))return current;
  let capacity=16;while(capacity<required)capacity*=2;return capacity;
}
export function resolutionStep(ratio,averageMs,maxRatio){
  return averageMs>26?Math.max(.65,ratio-.1):averageMs<18?Math.min(maxRatio,ratio+.05):ratio;
}
