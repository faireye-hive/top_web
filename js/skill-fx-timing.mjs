// Skill FX Studio v5 — cronologia de fontes históricas, sem dependência do Three.js.
// As durações EFF (d) e PAR (delay/play/life/step) são lidas de resources e
// sobrescritas pelas edições do próprio Studio. Campos SkillInfo 'keyframe'
// são índices/eventos legados SEM timestamp: jamais convertê-los em segundos.
const finite = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const positive = (value, fallback=0) => Math.max(0, finite(value,fallback));
const precision = value => Math.round(value*10000)/10000;

export function effSegments(eff) {
  if (!eff || !Array.isArray(eff.parts)) return [];
  return eff.parts.flatMap((part, pi) => {
    let at=0;
    return (part.keys || []).map((key, ki) => {
      const start=at; at+=positive(key.d);
      return {part:pi, index:ki, start:precision(start), end:precision(at), duration:positive(key.d),
        source:'EFF · duração original da chave'};
    });
  });
}

export function effDuration(eff) {
  return Math.max(0,...effSegments(eff).map(k=>k.end));
}

export function parLife(system) {
  return Math.max(.02, positive(system?.life, 1));
}

// Curvas PAR não gravam timestamps individuais: o cliente interpola pontos
// uniformemente ao longo da vida de UMA partícula (curve1/curveN no player).
export function parCurveKeys(system) {
  const life=parLife(system), delay=positive(system.delay);
  return ['sizes','colors','angles'].flatMap((field) => {
    const keys=Array.isArray(system[field])?system[field]:[];
    return keys.map((_,i)=>({field,index:i,start:precision(delay+life*i/keys.length),
      source:'PAR · índice de curva distribuído na vida (não tempo explícito)'}));
  });
}

export function parDuration(system) {
  const life=parLife(system), delay=positive(system.delay), play=positive(system.play);
  const single=[5,6,13].includes(Number(system.type));
  if (single) return {duration:precision(delay+Math.min(life,play||life)),open:false};
  if (Number(system.type)===3 && !play) return {duration:precision(delay+life),open:false};
  if (!play) return {duration:precision(delay+life),open:true};
  // Mesmo que as emissões terminem em play, partículas emitidas no fim
  // podem permanecer vivas por mais `life` segundos.
  return {duration:precision(delay+play+life),open:false};
}

export function stageTimes({layers=[],resources, historical, distance=3.8,
  flightSpeed=0, clipDuration=0, overrides=null}={}) {
  const actors=layers.filter(l=>l.channel==='actor'||l.channel==='item'||l.channel==='itemExtra');
  const flight=layers.filter(l=>l.channel==='flight');
  const speed=positive(flightSpeed)||positive(flight.find(l=>positive(l.vis?.speed))?.vis?.speed)||
    positive(flight.find(l=>positive(l.flightSpeed))?.flightSpeed);
  // SkillInfo keyframe não identifica timestamp; só o evento de GLB validado
  // e explicitamente marcado como tal poderá definir o instante de liberação.
  const event=overrides?.verifiedRelease;
  const release=event!=null && Number.isFinite(Number(event)) ? positive(event) : 0;
  const flightTime=flight.length&&speed>0 ? positive(distance)/speed : 0;
  const impact=release+flightTime;
  const starts={actor:0,item:0,itemExtra:0,flight:release,target:impact,ground:impact};
  const warnings=[];
  if (historical?.animation && !['','0','-1'].includes(String(historical.animation.keyframe)))
    warnings.push('SkillInfo keyframe='+historical.animation.keyframe+' é um índice legado sem timestamp verificável.');
  if (historical?.visual && !['','0','-1'].includes(String(historical.visual.flightKeyframe)))
    warnings.push('Keyframe de voo não possui timestamp verificável.');
  if (flight.length && speed<=0) warnings.push('Projétil sem velocidade verificável: o tempo de voo não pode ser calculado.');
  if (flight.length && speed>0) warnings.push('Momento do impacto calculado por distância / velocidade visual (estimativa).');
  if (event==null && flight.length) warnings.push('Instante exato de liberação não documentado; início em t=0 para prévia, sem afirmar paridade DX9.');
  if (!historical) warnings.push('SkillInfo histórico indisponível para esta skill.');
  return {release:precision(release),impact:precision(impact),flightTime:precision(flightTime),
    speed:precision(speed),starts,warnings,actors:actors.length,flight:flight.length,releaseVerified:event!=null};
}

// As informações de resources precisam ser os valores EFETIVOS, inclusive edições
// locais. O callback `resolve(layer)` entrega .par/.eff resolvido de cada camada.
export function buildTimeline({layers=[],resolve,resolveEff,historical=null,distance=3.8,
  flightSpeed=0,clipDuration=0,clip=null,overrides=null}={}){
  const stage=stageTimes({layers,historical,distance,flightSpeed,clipDuration,overrides});
  const tracks=[];let end=Math.max(0,positive(clipDuration)),continuous=0,visibleKeyCount=0;
  // Keyframes dos GLB têm timestamps explícitos (em segundos) nos AnimationTracks.
  // Mostramos a temporização real do movimento, mas NÃO afirmamos que um
  // desses tempos corresponde ao evento 'keyframe' do SkillInfo legado.
  if(clip?.tracks?.length){
    const raw=[...new Set(clip.tracks.flatMap(track=>Array.from(track.times||[]).map(n=>precision(n))
      .filter(n=>Number.isFinite(n)&&n>=0)))].sort((a,b)=>a-b);
    const indices=raw.length<=72?raw.map((_,i)=>i):Array.from({length:72},(_,i)=>Math.round(i*(raw.length-1)/71));
    const keys=indices.map(i=>({index:i,kind:'glb',time:raw[i],source:'GLB · keyframe com timestamp real'}));
    tracks.push({key:'__animation',label:clip.name,file:'Animação GLB · '+clip.name,
      channel:'animation',start:0,end:positive(clip.duration),open:false,keys,
      timing:'GLB · '+raw.length+' timestamps de movimento (eventos SkillInfo não mapeados)'});
    visibleKeyCount+=keys.length;
  }

  for(const layer of layers){
    const data=resolve(layer);if(!data)continue;
    const start=stage.starts[layer.channel]??0;
    let length=0,open=false,keys=[],timing='';
    const eff=layer.kind==='eff'?data:(Number(data.type)&&[4,5,6,15].includes(Number(data.type))?
      resolveEff(data.effect||data.model):null);
    if(layer.kind==='eff'){
      length=effDuration(data);timing='EFF · somatório dos tempos de keyframes por peça · '+length.toFixed(3)+'s';
      keys=effSegments(data).map(k=>({...k,time:precision(start+k.start),endTime:precision(start+k.end),kind:'eff'}));
    }else if(layer.kind==='strip'){
      const s=data.swing||{};
      length=positive(s.start)+positive(s.dur,.35)+positive(data.life,.5);
      timing='Trilha: arco de prévia (não extraído de keyframes DX9)';
    }else{
      const d=parDuration(data);length=d.duration;open=d.open;timing='PAR · delay '+positive(data.delay)+'s / play '+positive(data.play)+'s / life '+parLife(data)+'s / step '+positive(data.step)+'s';
      keys=parCurveKeys(data).map(k=>({...k,time:precision(start+k.start),kind:'par'}));
      if(eff){
        const add=effSegments(eff).map(k=>({...k,time:precision(start+positive(data.delay)+k.start),
          endTime:precision(start+positive(data.delay)+k.end),kind:'eff',embedded:true}));
        keys.push(...add);
        timing+=' + EFF aninhado';
        length=Math.max(length,positive(data.delay)+effDuration(eff));
      }
    }
    const stop=start+length;
    if(open)continuous++;
    if(!open)end=Math.max(end,stop);
    else end=Math.max(end,start+Math.max(0,positive(data?.delay))+parLife(data));
    visibleKeyCount+=keys.length;
    tracks.push({key:layer.key,label:layer.label,channel:layer.channel,start:precision(start),end:precision(stop),
      open,keys,timing,file:layer.file});
  }
  const minDuration=Math.max(.3,end);
  // Timeline sempre precisa de janela finita. Se não houver limites de emissão,
  // o fallback é uma JANELA DE OBSERVAÇÃO; não a duração original da skill.
  const duration=Math.min(180,precision(Math.ceil((minDuration+.15)*20)/20));
  if (end>180)stage.warnings.push('Efeitos superiores a 180 s: a janela de prévia está limitada, sem alterar dados originais.');
  if (continuous)stage.warnings.push(continuous+' sistema(s) PAR sem duração de emissão: são contínuos; janela exibida não é duração histórica total.');
  return {tracks,stage,duration,rawDuration:precision(end),continuous,visibleKeyCount,
    hasOriginalData:tracks.length>0};
}
