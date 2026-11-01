import test from 'node:test';
import assert from 'node:assert/strict';
import {ARGENT_CITY_POSE_AREA,CITY_COMBAT_HOLD_MS,isInsideCity,
  extendCombatHold,resolveCityCombatPose} from '../js/city-combat-pose.mjs';

test('área urbana de Argent: cidade, borda e campo exterior',()=>{
 const {centerX,centerZ,radius}=ARGENT_CITY_POSE_AREA;
 assert.equal(isInsideCity(centerX,centerZ),true);
 assert.equal(isInsideCity(centerX+radius,centerZ),true);
 assert.equal(isInsideCity(centerX+radius+1,centerZ),false);
 assert.equal(isInsideCity(0,0),false);
 assert.equal(isInsideCity(NaN,centerZ),false);
});

test('descanso/corrida na cidade e guarda/corrida armada fora dela',()=>{
 const state=(props={})=>resolveCityCombatPose({inCity:true,now:100,...props});
 assert.equal(state(), 'idle');
 assert.equal(state({moving:true}), 'run');
 assert.equal(state({inCity:false}), 'guard');
 assert.equal(state({inCity:false,moving:true}), 'armedRun');
 assert.equal(state({autoCombat:true}), 'guard');
 assert.equal(state({autoCombat:true,moving:true}), 'armedRun');
 assert.equal(state({performing:true}), 'attack');
 assert.equal(state({inCity:false,performing:true}), 'attack');
});

test('skill na cidade mantém guarda e espadas até 3,5 s após terminar',()=>{
 const finish=1000;
 const until=extendCombatHold(0,finish);
 assert.equal(until,finish+CITY_COMBAT_HOLD_MS);
 const city=(now,moving=false)=>resolveCityCombatPose({inCity:true,now,moving,holdUntil:until});
 assert.equal(city(finish),'guard');
 assert.equal(city(finish+CITY_COMBAT_HOLD_MS-1,true),'armedRun');
 assert.equal(city(finish+CITY_COMBAT_HOLD_MS),'idle');
 assert.equal(city(finish+CITY_COMBAT_HOLD_MS+1,true),'run');
 assert.equal(extendCombatHold(until,finish+1000),finish+1000+CITY_COMBAT_HOLD_MS);
 assert.equal(extendCombatHold(until,finish-1000),until);
 assert.equal(extendCombatHold(until,NaN),until);
});

test('ao voltar para cidade após combate no campo, não mantém estado armado sem skill local',()=>{
 const pose=({inCity,moving,holdUntil=0})=>resolveCityCombatPose({inCity,moving,holdUntil,now:9999});
 assert.equal(pose({inCity:false,moving:false}),'guard');
 assert.equal(pose({inCity:true,moving:false}),'idle');
 assert.equal(pose({inCity:false,moving:true}),'armedRun');
 assert.equal(pose({inCity:true,moving:true}),'run');
});
