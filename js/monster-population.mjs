// Índice espacial leve: os milhares de nascimentos não viram milhares de atores.
export function monsterBudget(mobile){
  return mobile?{limit:12,radius:55,models:6,loads:2}:{limit:28,radius:80,models:12,loads:3};
}
export function indexMonsterSpawns(spawns,cellSize=64){
  const cells=new Map();
  spawns.forEach((spawn,id)=>{
    const key=`${Math.floor(spawn.x/cellSize)},${Math.floor(spawn.z/cellSize)}`;
    if(!cells.has(key))cells.set(key,[]);
    cells.get(key).push({...spawn,id});
  });
  return (position,radius)=>{
    const nearby=[];
    for(let z=Math.floor((position.z-radius)/cellSize);z<=Math.floor((position.z+radius)/cellSize);z++)
      for(let x=Math.floor((position.x-radius)/cellSize);x<=Math.floor((position.x+radius)/cellSize);x++)
        for(const spawn of cells.get(`${x},${z}`)||[])
          if(Math.hypot(spawn.x-position.x,spawn.z-position.z)<=radius)nearby.push(spawn);
    return nearby.sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z)||a.id-b.id);
  };
}

export function createMonsterPopulation({manifest,findSpawn,budget=monsterBudget(true),release=()=>{}}){
  let streaming=manifest.streaming===true,query=indexMonsterSpawns(manifest.spawns);
  const states=new Map(),monsters=[];
  let elapsed=0;
  function record(spawn){
    const type=manifest.species[spawn.species];
    if(!type||!/^models\/[\w-]+\.glb$/.test(type.model))return null;
    const free=findSpawn(spawn.x,spawn.z,type);
    if(!free)return null; // Reavaliar depois de carregar terreno/colisões.
    const patrol=(spawn.route||[[free[0],free[1]],[free[0]+1.5,free[1]],[free[0]+1.5,free[1]+1.5],[free[0],free[1]+1.5]])
      .flatMap(point=>{const p=findSpawn(point[0],point[1],type);return p?[{x:p[0],z:p[1]}]:[];});
    return {...type,...spawn,x:free[0],z:free[1],home:{x:free[0],z:free[1]},patrol,hp:type.maxHp,
      ready:false,object:null,mixer:null,pending:false,failed:false,action:null,loadVersion:0};
  }
  function deactivate(m){
    release(m);m.loadVersion++;m.pending=false;m.ready=false;m.failed=false;
    m.engaged=false;m.attackPending=null;m.path=[];m.pathGoal=null;m.motion='patrol';m.routeIndex=0;
    m.status={};m.cooldown=0;m.deathTime=0;m.recoil=0;m.moving=false;m.x=m.home.x;m.z=m.home.z;m.offscreenAt=elapsed;
    if(m.hp>0)m.hp=m.maxHp;
  }
  function sync(position,target,dt=0,{habitat=null}={}){
    elapsed+=dt;
    if(!streaming&&monsters.length)return;
    const candidates=streaming?query(position,budget.radius):manifest.spawns.map((s,id)=>({...s,id}));
    if(habitat)candidates.sort((a,b)=>Number((manifest.species[b.species]?.habitat||'land')===habitat)-Number((manifest.species[a.species]?.habitat||'land')===habitat));
    // Alvo e inimigos em combate conservam sua vaga até deixar a vizinhança.
    const keep=streaming?monsters.filter(m=>(!habitat||(m.habitat||'land')===habitat)&&(m===target||m.engaged)&&Math.hypot(m.x-position.x,m.z-position.z)<budget.radius+20)
      .sort((a,b)=>(b===target)-(a===target)||Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))
      .slice(0,budget.limit):[];
    const desired=new Set(keep.map(m=>m.id));
    for(const spawn of candidates){
      if(desired.size>=(streaming?budget.limit:12))break;
      if(desired.has(spawn.id))continue;
      let m=states.get(spawn.id);
      if(!m){m=record(spawn);if(!m)continue;states.set(spawn.id,m);}
      desired.add(m.id);
    }
    for(let i=monsters.length-1;i>=0;i--)if(!desired.has(monsters[i].id)){
      deactivate(monsters[i]);monsters.splice(i,1);
    }
    for(const id of desired){
      const m=states.get(id);if(monsters.includes(m))continue;
      if(m.hp<=0&&m.respawn!==false){
        m.respawnIn=Math.max(0,(m.respawnIn||0)-(elapsed-(m.offscreenAt??elapsed)));
        if(!m.respawnIn)m.hp=m.maxHp;
      }
      m.offscreenAt=null;monsters.push(m);
    }
  }
  function reset(data){
    for(const m of monsters)deactivate(m);
    monsters.splice(0);states.clear();manifest=data;streaming=data.streaming===true;query=indexMonsterSpawns(data.spawns);
    sync({x:0,z:0});
  }
  if(!streaming)sync({x:0,z:0});
  return {monsters,sync,reset};
}
