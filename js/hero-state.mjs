// Balanceamento novo; os arquivos históricos fornecem somente visuais.
export const CHARACTERS=Object.freeze({
  lance:{name:'Lance',model:'assets/characters/lance.glb'},
  phyllis:{name:'Phyllis',model:'assets/characters/phyllis.glb'},
  carsise:{name:'Carsise',model:'assets/characters/carsise.glb'},
  ami:{name:'Ami',model:'assets/characters/ami.glb'}
});
export const ATTRIBUTE_KEYS=['strength','intelligence','constitution','dexterity','agility'];
export const CLASSES=Object.freeze({
  crusader:{name:'Crusader',characters:['lance','phyllis'],weapon:'sword',attackAttribute:'strength',growth:[2,0,1,1,1]},
  champion:{name:'Champion',characters:['carsise'],weapon:'greatsword',attackAttribute:'strength',growth:[2,0,3,0,0]},
  sharpshooter:{name:'Sharpshooter',characters:['lance','phyllis'],weapon:'firearm',attackAttribute:'dexterity',growth:[0,0,1,3,1]},
  hunter:{name:'Hunter',characters:['lance','phyllis'],weapon:'bow',attackAttribute:'dexterity',growth:[0,0,1,3,1]},
  cleric:{name:'Cleric',characters:['phyllis','ami'],weapon:'staff',attackAttribute:'intelligence',growth:[0,3,2,0,0]},
  'seal-master':{name:'Seal Master',characters:['phyllis','ami'],weapon:'staff',attackAttribute:'intelligence',growth:[0,2,2,1,0]},
  voyager:{name:'Voyager',characters:['lance','phyllis','ami'],weapon:'dagger',attackAttribute:'intelligence',growth:[1,2,2,0,0]}
});
export const PRACTICES=Object.freeze({unarmed:'Punhos',sword:'Espadas',greatsword:'Espadões',firearm:'Tiro',bow:'Arcos',staff:'Cajados',dagger:'Adagas'});
export function attributesFor(job,level){
  return Object.fromEntries(ATTRIBUTE_KEYS.map((key,i)=>[key,5+CLASSES[job].growth[i]*(level-1)]));
}
export function deriveStats(attributes,level=1,{equipped=false,practiceLevel=10,attackAttribute='strength'}={}){
  const {strength:s,intelligence:i,constitution:c,dexterity:d,agility:a}=attributes;
  return {maxHp:80+c*12+(level-1)*10,maxMp:30+i*8+(level-1)*4,
    attack:6+attributes[attackAttribute]*2+(equipped?4:0)+(practiceLevel-10),magic:4+i*2,
    defense:c+(equipped?4:0),accuracy:70+d*3,evasion:a*2,
    attackSpeed:Math.round(Math.min(2.5,.7+a*.03)*100)/100};
}
export function practiceKey(hero){return hero.equipped?CLASSES[hero.job].weapon:'unarmed';}
export function practiceRequirement(level){return 20+(level-10)*10;}
export function refreshHero(hero,{heal=false}={}){
  const previous=hero.stats;
  hero.attributes=attributesFor(hero.job,hero.level);
  // Melhorias da tentativa não fazem parte do save permanente do personagem.
  for(const key of ATTRIBUTE_KEYS)if(Number.isFinite(hero.arenaBonuses?.[key]))hero.attributes[key]+=Math.max(0,hero.arenaBonuses[key]);
  hero.stats=deriveStats(hero.attributes,hero.level,{equipped:hero.equipped,attackAttribute:CLASSES[hero.job].attackAttribute,practiceLevel:hero.practice[practiceKey(hero)].level});
  hero.hp=heal?hero.stats.maxHp:Math.min(hero.stats.maxHp,(hero.hp??hero.stats.maxHp)+Math.max(0,hero.stats.maxHp-(previous?.maxHp??hero.stats.maxHp)));
  hero.mp=heal?hero.stats.maxMp:Math.min(hero.stats.maxMp,(hero.mp??hero.stats.maxMp)+Math.max(0,hero.stats.maxMp-(previous?.maxMp??hero.stats.maxMp)));
}
export function createHero(character='lance'){
  character=CHARACTERS[character]?character:'lance';
  const job=Object.keys(CLASSES).find(k=>CLASSES[k].characters.includes(character));
  const hero={character,job,level:1,xp:0,equipped:false,practice:Object.fromEntries(Object.keys(PRACTICES).map(k=>[k,{level:10,uses:0}]))};
  refreshHero(hero,{heal:true});return hero;
}
export function selectClass(hero,job){
  if(!CLASSES[job])return false;
  hero.job=job;if(!CLASSES[job].characters.includes(hero.character))hero.character=CLASSES[job].characters[0];
  refreshHero(hero);return true;
}
export function trainAttack(hero){
  const skill=hero.practice[practiceKey(hero)];
  if(skill.level>=200)return false;
  skill.uses++;
  if(skill.uses<practiceRequirement(skill.level))return false;
  skill.uses-=practiceRequirement(skill.level);skill.level++;refreshHero(hero);return true;
}
export function gainExperience(hero,amount){
  if(!Number.isFinite(amount)||amount<0)return 0;
  hero.xp+=amount;let levels=0;
  while(hero.level<1000&&hero.xp>=hero.level*40){hero.xp-=hero.level*40;hero.level++;levels++;}
  if(levels)refreshHero(hero,{heal:true});return levels;
}
export function heroSnapshot(hero){
  const key=practiceKey(hero),skill=hero.practice[key];
  return {name:CHARACTERS[hero.character].name,className:CLASSES[hero.job].name,level:hero.level,
    ...hero.attributes,...hero.stats,hp:Math.ceil(hero.hp),mp:Math.ceil(hero.mp),xp:`${hero.xp} / ${hero.level*40}`,
    practiceName:PRACTICES[key],practiceLevel:skill.level,practiceProgress:`${skill.uses} / ${practiceRequirement(skill.level)}`,
    equipment:hero.equipped?'Evanescence · nível 1':'Sem conjunto'};
}
export function serializeHero(hero){
  return JSON.stringify({version:2,character:hero.character,job:hero.job,level:hero.level,xp:hero.xp,equipped:hero.equipped,practice:hero.practice});
}
export function restoreHero(raw,fallback='lance'){
  const hero=createHero(fallback);
  try{
    const data=JSON.parse(raw);
    if(data?.version!==2||!CLASSES[data.job]||!CHARACTERS[data.character]||!CLASSES[data.job].characters.includes(data.character))return hero;
    if(!Number.isInteger(data.level)||data.level<1||data.level>1000||!Number.isFinite(data.xp)||data.xp<0||data.xp>=data.level*40)return hero;
    // Saves da versão anterior ainda não tinham a habilidade de prática de arco.
    // Preserve todos os outros valores ao adicionar Hunter.
    const practice={...hero.practice,...data.practice};
    for(const key of Object.keys(PRACTICES)){
      const p=practice[key];
      if(!Number.isInteger(p?.level)||p.level<10||p.level>200||!Number.isInteger(p?.uses)||p.uses<0||p.uses>=practiceRequirement(p.level))return hero;
    }
    Object.assign(hero,{character:data.character,job:data.job,level:data.level,xp:data.xp,equipped:data.equipped===true,practice});
    refreshHero(hero,{heal:true});return hero;
  }catch{return hero;}
}
