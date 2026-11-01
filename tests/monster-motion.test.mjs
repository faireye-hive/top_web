import test from 'node:test';
import assert from 'node:assert/strict';
import {findMonsterRoute,updateMonsterMotion,returnMonsterHome} from '../js/monster-motion.mjs';
const monster=extra=>({x:0,z:0,hp:60,ready:true,status:{},...extra});
test('patrulha avança nos pontos e respeita pausa por stun e modelo não carregado',()=>{
  const m=monster({patrol:[{x:1,z:0},{x:1,z:1}]});
  for(let i=0;i<25;i++)updateMonsterMotion(m,.05,{x:9,z:9});
  assert.equal(m.routeIndex,1);assert.ok(m.z>0);assert.equal(m.motion,'patrol');
  for(const state of [{status:{stun:1}},{status:{},ready:false}]){
    Object.assign(m,state);const before=[m.x,m.z];updateMonsterMotion(m,1,{x:9,z:9});assert.deepEqual([m.x,m.z],before);
  }
});
test('rota contorna parede e nunca atravessa os trechos bloqueados',()=>{
  const canReach=(a,b)=>{
    for(let i=0;i<=20;i++){
      const x=a.x+(b.x-a.x)*i/20,z=a.z+(b.z-a.z)*i/20;
      if(x>.8&&x<1.7&&Math.abs(z)<1.4)return false;
    }
    return true;
  };
  const start={x:0,z:0},goal={x:3,z:0},route=findMonsterRoute(start,goal,canReach);
  assert.ok(route.length>2);
  let previous=start;
  for(const point of route){assert.ok(canReach(previous,point));previous=point;}
  const m=monster({engaged:true});
  for(let i=0;i<120;i++){
    const before={x:m.x,z:m.z};updateMonsterMotion(m,.05,goal,{canReach,range:.1});
    assert.ok(canReach(before,m));
  }
  assert.ok(Math.hypot(m.x-goal.x,m.z-goal.z)<.15);
  assert.deepEqual(findMonsterRoute(start,goal,()=>false),[]);
});
test('perseguição acompanha alvo móvel, lentidão reduz passo e retorno restaura a origem',()=>{
  const m=monster({engaged:true});updateMonsterMotion(m,.2,{x:10,z:0});
  assert.ok(m.x>0);assert.equal(m.motion,'chase');const fast=m.x;
  const slow=monster({engaged:true,status:{slow:2}});updateMonsterMotion(slow,.2,{x:10,z:0});assert.ok(slow.x<fast);
  updateMonsterMotion(m,.2,{x:0,z:10});assert.ok(m.z>0);
  returnMonsterHome(m);
  for(let i=0;i<40;i++)updateMonsterMotion(m,.05,{x:10,z:10});
  assert.equal(m.engaged,false);assert.equal(m.motion,'patrol');assert.ok(Math.hypot(m.x,m.z)<.13);
  m.x=10;m.poisonTick=.8;returnMonsterHome(m,{teleport:true});assert.equal(m.x,0);assert.equal(m.poisonTick,0);
});
