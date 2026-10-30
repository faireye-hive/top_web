import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTimeline} from '../../js/skill-fx-timing.mjs';
const root=new URL('../../assets/skills/',import.meta.url);
const read=(f)=>JSON.parse(readFileSync(new URL(f,root),'utf8'));
const v=read('visuals.json'),h=read('historical.json');
let totalTracks=0,totalKeys=0,unknown=0,broken=[];
for(const [id,skill] of Object.entries(v.skills)){
 const layers=(skill.channels||[]).flatMap((channel,ci)=>(channel.visual||[]).flatMap(vis=>{
  let visuals=vis.kind==='magic'?(vis.models||[]):[vis];
  return visuals.flatMap(part=>(part.files||[]).flatMap(file=>{
   const resource=v.resources[file];if(!resource){broken.push(`${id} ${file}`);return []}
   if(resource.kind==='eff')return [{key:`${ci}:${file}:eff`,file,channel:channel.kind,kind:'eff',vis:part,flightSpeed:skill.speed}];
   const systems=(resource.systems||[]).map((_,idx)=>({key:`${ci}:${file}:s${idx}`,file,idx,channel:channel.kind,kind:'system',vis:part,flightSpeed:skill.speed}));
   const strips=(resource.strips||[]).map((_,idx)=>({key:`${ci}:${file}:t${idx}`,file,idx,channel:channel.kind,kind:'strip',vis:part,flightSpeed:skill.speed}));
   return [...systems,...strips];
  }));
 }));
 const out=buildTimeline({layers,resolve:l=>l.kind==='eff'?v.resources[l.file]:(l.kind==='strip'?v.resources[l.file].strips[l.idx]:v.resources[l.file].systems[l.idx]),resolveEff:f=>v.resources[f],historical:h.skills[id],distance:3.8});
 assert.ok(Number.isFinite(out.duration)&&out.duration>0&&out.duration<=180,`window invalid ${id}`);
 assert.ok(out.tracks.every(t=>Number.isFinite(t.start)&&Number.isFinite(t.end)&&t.end>=t.start),`bad track ${id}`);
 assert.ok(out.tracks.every(t=>t.keys.every(k=>Number.isFinite(k.time)&&k.time>=0)),`bad markers ${id}`);
 totalTracks+=out.tracks.length;totalKeys+=out.visibleKeyCount;if(!h.skills[id])unknown++;
}
console.log(`OK: ${Object.keys(v.skills).length} skills, ${totalTracks} tracks, ${totalKeys} keyframes, ${unknown} sem SkillInfo, ${broken.length} recursos ausentes`);
if(broken.length)console.log('Alguns recursos referenciados no catálogo não estão em visuals.json:',broken.slice(0,12));
