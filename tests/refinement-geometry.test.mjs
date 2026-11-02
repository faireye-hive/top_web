import test from 'node:test';
import assert from 'node:assert/strict';
import {refinementFollowsSurface,refinementSurfaceSamples,refinementSurfaceSpine} from '../js/refinement-geometry.mjs';

const positions=values=>({count:values.length/3,getX:i=>values[i*3],getY:i=>values[i*3+1],getZ:i=>values[i*3+2]});
test('cajados, Voyager, rifles e arcos seguem a malha; espadas conservam a lâmina editável',()=>{
 for(const job of ['cleric','seal-master','voyager','sharpshooter','hunter'])assert.equal(refinementFollowsSurface(job),true);
 for(const job of ['crusader','champion',null,undefined])assert.equal(refinementFollowsSurface(job),false);
});
test('halo amostra arestas reais, inclusive uma haste longa e estreita, em ambos os limites de desempenho',()=>{
 const values=[0,0,0, .02,0,0, 0,4,0, .02,4,0];
 const indices=[0,1,2,1,3,2];
 const geometry={attributes:{position:positions(values)},index:{count:6,getX:i=>indices[i]}};
 const samples=refinementSurfaceSamples(geometry);
 assert.equal(samples.length,96);
 for(const count of [64,96]){
   const heights=[];
   for(const {a,b,t} of samples.slice(0,count)){
     assert.ok(indices.includes(a)&&indices.includes(b));assert.ok(t>=0&&t<=1);
     const x=values[a*3]*(1-t)+values[b*3]*t,y=values[a*3+1]*(1-t)+values[b*3+1]*t;
     assert.ok(x>=-1e-10&&x<=.02+1e-10&&y>=-1e-10&&y<=4+1e-10);heights.push(y);
   }
   assert.ok(Math.min(...heights)<.2&&Math.max(...heights)>3.8);
 }
 assert.deepEqual(refinementSurfaceSamples(geometry),samples);
});
test('arestas degeneradas não geram NaN, geometria sem índices funciona e posições de repouso não são armazenadas',()=>{
 assert.deepEqual(refinementSurfaceSamples(null),[]);
 assert.deepEqual(refinementSurfaceSamples({attributes:{position:positions([0,0,0,0,0,0,0,0,0])}}),[]);
 const samples=refinementSurfaceSamples({attributes:{position:positions([0,0,0,1,0,0,0,1,0])}},12);
 assert.equal(samples.length,12);assert.deepEqual(Object.keys(samples[0]),['a','b','t']);
 // These indices interpolate current skinned vertices, including arbitrary
 // rotations/translations, instead of reusing a stale world-space position.
 const {a,b,t}=samples[0],posed=[[5,2,0],[5,3,0],[4,2,0]];
 const point=posed[a].map((v,i)=>v*(1-t)+posed[b][i]*t);
 assert.ok(point[0]>=4&&point[0]<=5&&point[1]>=2&&point[1]<=3);
});
test('centro da aura interpola hastes de poucos polígonos e segue uma arma rotacionada',()=>{
 const values=[0,0,0,.02,0,0,0,4,0,.02,4,0].map((v,i,all)=>i%3===0?all[i+1]+5:i%3===1?-all[i-1]+2:v);
 const spine=refinementSurfaceSpine({attributes:{position:positions(values)}});
 assert.equal(spine.length,17);
 const centers=spine.map(s=>{
   assert.ok(Math.abs(s.weights.reduce((a,b)=>a+b,0)-1)<1e-10);
   return [0,1,2].map(axis=>s.indices.reduce((sum,index,k)=>sum+values[index*3+axis]*s.weights[k],0));
 });
 for(const point of centers){assert.ok(point[0]>=5&&point[0]<=9);assert.ok(Math.abs(point[1]-1.99)<.02);}
 for(let i=1;i<centers.length;i++)assert.ok(Math.abs(centers[i][0]-centers[i-1][0])<.4,'sem salto entre centros de uma haste');
});
test('corda do arco une pontas e a aura acompanha o corpo curvo, em vez da diagonal da caixa',()=>{
 const values=[];
 for(let n=0;n<=16;n++){
   const y=-2+n/4,x=.7*(1-y*y/4);values.push(x-.02,y,0,x+.02,y,0);
 }
 const spine=refinementSurfaceSpine({attributes:{position:positions(values)}});
 const center=n=>spine[n].indices.reduce((sum,index,k)=>sum+values[index*3]*spine[n].weights[k],0);
 assert.ok(Math.abs(center(0))<.2&&Math.abs(center(16))<.2,'corda entre as pontas');
 assert.ok(center(8)>.6,'órbita acompanha o corpo curvado');
 assert.deepEqual(refinementSurfaceSpine(null),[]);
 assert.deepEqual(refinementSurfaceSpine({attributes:{position:positions([0,0,0])}}),[]);
});
