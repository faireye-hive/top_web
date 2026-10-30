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

// Semântica de callback: PlayCombat.cpp / SkillVisual.h do porte OpenGL.
// -1 = início, -2 = fim, >=0 = evento no impacto da pose. O timestamp de
// impacto NÃO vem do SkillInfo: ActorSkin calcula (impact-start)/30 da pose.
function callbackIndex(raw) {
  const n=Number(String(raw??'').trim());
  return String(raw??'').trim()!=='' && Number.isInteger(n) ? n : -3;
}
function itemCallback(raw, fallback) {
  const parts=String(raw??'').split(',');
  return Number(parts[0])>0 ? callbackIndex(parts[1]) : fallback;
}
function resolveCallback(raw, label, clipDuration, impactTime, warnings, pose=null, manualKeyframes=null) {
  const key=callbackIndex(raw);
  if(key===-1)return {time:0,verified:true,source:'SkillInfo: início de ação (-1)',label};
  if(key===-2){
    if(clipDuration>0)return {time:precision(clipDuration),verified:true,
      source:pose?.source?'SkillInfo: fim de ação (-2) + '+pose.source:
        'SkillInfo: fim de ação (-2) + duração do clipe GLB',label};
    warnings.push(label+': callback -2 (fim), mas a pose 3D não está disponível; t=0 é apenas fallback.');
    return {time:0,verified:false,source:'Pose ausente',label};
  }
  if(key>=0){
    // Índices de callback do DX9 são índices de eventos da pose, não frames GLB.
    if(manualKeyframes && Object.hasOwn(manualKeyframes,key) &&
      Number.isFinite(Number(manualKeyframes[key])) && Number(manualKeyframes[key])>=0)
      return {time:precision(positive(manualKeyframes[key])),verified:true,manual:true,
        source:'Ajuste manual do evento DX9 #'+key+' (não é tempo original)',label};
    const poseKey=pose?.keyframes?.find(k=>k.index===key);
    if(poseKey)return {time:precision(poseKey.time),verified:true,
      source:poseKey.source+' · frame '+poseKey.frame+' (evento #'+key+')',label};
    // Compatibilidade com overrides explícitos do porte OpenGL.
    if(impactTime!=null && Number.isFinite(Number(impactTime)) && Number(impactTime)>=0){
      const t=positive(impactTime);
      return {time:precision(clipDuration>0?Math.min(t,clipDuration):t),verified:true,
        source:'Callback de impacto da pose: timestamp fornecido explicitamente',label};
    }
    warnings.push(label+': callback '+key+' requer frame impact da pose (.lab/tabela de ações); início em t=0 é só prévia.');
    return {time:0,verified:false,source:'Impacto não mapeado',label};
  }
  return {time:0,verified:false,source:'Callback ausente',label};
}

export function stageTimes({layers=[],resources,historical,distance=3.8,
  flightSpeed=0,clipDuration=0,overrides=null,pose=null}={}) {
  const actors=layers.filter(l=>l.channel==='actor'||l.channel==='item'||l.channel==='itemExtra');
  const flight=layers.filter(l=>l.channel==='flight');
  const speed=positive(flightSpeed)||positive(flight.find(l=>positive(l.vis?.speed))?.vis?.speed)||
    positive(flight.find(l=>positive(l.flightSpeed))?.flightSpeed);
  const warnings=[],events=[],known={};
  const anim=historical?.animation||{},visual=historical?.visual||{};
  const impactTime=overrides?.verifiedImpactTime;
  const actionDuration=positive(clipDuration)||positive(pose?.duration);
  const callbacks={actor:anim.keyframe,item:itemCallback(visual.itemEffect,anim.keyframe),
    itemExtra:itemCallback(visual.itemEffect2,anim.keyframe),
    flight:visual.flightKeyframe??anim.keyframe};
  const starts={};
  for(const channel of ['actor','item','itemExtra','flight']){
    if(!layers.some(l=>l.channel===channel)){
      starts[channel]=0;known[channel]=false;continue;
    }
    const label={actor:'Personagem',item:'Item',itemExtra:'Item extra',flight:'Voo'}[channel];
    const resolved=resolveCallback(callbacks[channel],label,actionDuration,impactTime,warnings,pose,overrides?.manualKeyframes);
    starts[channel]=resolved.time;known[channel]=resolved.verified;
    if(resolved.verified)events.push({channel,time:resolved.time,label,source:resolved.source,kind:resolved.manual?'edited':'callback'});
  }
  // Um instante medido de lançamento só altera o canal de voo.
  if(overrides?.verifiedRelease!=null && Number.isFinite(Number(overrides.verifiedRelease))){
    starts.flight=positive(overrides.verifiedRelease);
    known.flight=true;
    if(flight.length)events.push({channel:'flight',time:starts.flight,label:'Voo (verificado)',
      source:'Evento de liberação informado e verificado',kind:'callback'});
  }
  const release=starts.flight;
  const flightTime=flight.length&&speed>0 ? positive(distance)/speed : 0;
  const impact=release+flightTime;
  if(flight.length){
    for(const c of ['target','ground','water'])starts[c]=precision(impact);
    if(speed>0)events.push({channel:'target',time:precision(impact),label:'Chegada (estimada)',
      source:'Distância/velocidade do voo: estimativa, não callback original',kind:'estimated'});
  }else{
    const hit=layers.some(l=>['target','ground','water'].includes(l.channel))
      ? resolveCallback(visual.durationPoint,'Impacto sem voo',actionDuration,impactTime,warnings,pose,overrides?.manualKeyframes)
      : {time:0,verified:false,source:'Sem efeito de alvo'};
    for(const c of ['target','ground','water'])starts[c]=hit.time;
    if(hit.verified&&layers.some(l=>['target','ground','water'].includes(l.channel)))
      events.push({channel:'target',time:hit.time,label:'Impacto sem voo',source:hit.source,kind:hit.manual?'edited':'callback'});
  }
  if(flight.length && speed<=0)warnings.push('Projétil sem velocidade verificável: não é possível estimar chegada.');
  if(flight.length && speed>0)warnings.push('Chegada estimada por distância/velocidade (não é colisão DX9).');
  if(flight.length&&!known.flight)warnings.push('Voo sem timestamp de callback: sai em t=0 somente para prévia.');
  if(!historical)warnings.push('SkillInfo histórico indisponível para esta skill.');
  return {release:precision(release),impact:precision(impact),flightTime:precision(flightTime),
    speed:precision(speed),starts,warnings,actors:actors.length,flight:flight.length,
    releaseVerified:known.flight,events,pose:pose?{actor:pose.actor,action:pose.action,source:pose.source}:null};
}

// As informações de resources precisam ser os valores EFETIVOS, inclusive edições
// locais. O callback `resolve(layer)` entrega .par/.eff resolvido de cada camada.
export function buildTimeline({layers=[],resolve,resolveEff,historical=null,distance=3.8,
  flightSpeed=0,clipDuration=0,clip=null,overrides=null,pose=null}={}){
  const stage=stageTimes({layers,historical,distance,flightSpeed,clipDuration,overrides,pose});
  const tracks=[];let end=Math.max(0,positive(clipDuration),positive(pose?.duration)),continuous=0,visibleKeyCount=0;
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

  // Marcadores de eventos DX9 originais, separados das curvas do GLB.
  // Valores individuais podem ser substituídos sem modificar a tabela.
  if(pose?.keyframes?.length){
    const keys=pose.keyframes.map(k=>{
      const v=overrides?.manualKeyframes?.[k.index];
      const edited=v!==undefined && Number.isFinite(Number(v)) && Number(v)>=0;
      return {...k,time:edited?precision(Number(v)):k.time,
        kind:edited?'edited':'dx9',
        source:edited?'Ajuste manual (original '+k.time.toFixed(3)+'s)':k.source};
    });
    tracks.push({key:'__pose',label:'Chaves DX9',file:'CharacterAction · '+pose.actor+' / ação '+pose.action,
      channel:'pose',start:0,end:positive(pose.duration),open:false,keys,
      timing:pose.source+' · frames '+pose.startFrame+'–'+pose.endFrame+
        ' · índices 0..'+(keys.length-1)});
    visibleKeyCount+=keys.length;
    end=Math.max(end,...keys.map(k=>k.time));
  }
  if(stage.events?.length){
    const keys=stage.events.map((e,index)=>({...e,index,time:precision(e.time)}));
    tracks.push({key:'__callbacks',label:'Callbacks históricos',file:'Eventos OpenGL / SkillInfo',
      channel:'callbacks',start:0,end:Math.max(0,...keys.map(k=>k.time)),open:false,keys,
      timing:'Início/fim conforme callback; impacto pode permanecer não verificado.'});
    visibleKeyCount+=keys.length;
    end=Math.max(end,...keys.map(k=>k.time));
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
