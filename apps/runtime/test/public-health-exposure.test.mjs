import test from 'node:test';
import assert from 'node:assert/strict';
import {listenRuntime} from '../http-server.mjs';
import {listenControlApplications} from '../control-route-boundary.mjs';

const configuration={http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://frontend.invalid'},limits:{requestMs:1000,shutdownMs:100}};
const readiness=async()=>({product:{ready:true,ports:{secret:'internal-detail'}}});
async function handlerFor(exposeReadiness){
 let fetch;const server={listening:true,on(){},once(){},close(cb){cb?.();},closeIdleConnections(){},address:()=>({port:0})};
 const listener=await listenRuntime({configuration,application:{handle:async()=>new Response('app',{status:200})},readiness,
  ...(exposeReadiness===undefined?{}:{exposeReadiness}),testOwners:{serve(options){fetch=options.fetch;return server;}}});
 return {fetch,listener};
}
const get=(fetch,path,method='GET')=>fetch(new Request('http://meri.invalid'+path,{method}));

test('public listener (exposeReadiness false) serves liveness only; readiness details are not reachable',async()=>{
 const {fetch,listener}=await handlerFor(false);
 const live=await get(fetch,'/health/live');assert.equal(live.status,200);assert.deepEqual(await live.json(),{status:'live'});
 for(const method of ['GET','POST','HEAD']){
  const ready=await get(fetch,'/health/ready',method);assert.equal(ready.status,404);
  const text=method==='HEAD'?'':await ready.text();assert.equal(text.includes('internal-detail'),false);
 }
 await listener.close();
});

test('default and private listeners keep full readiness; non-boolean option refuses',async()=>{
 for(const value of [undefined,true]){
  const {fetch,listener}=await handlerFor(value);
  const ready=await get(fetch,'/health/ready');assert.equal(ready.status,200);assert.match(await ready.text(),/internal-detail/u);
  await listener.close();
 }
 for(const bad of ['false',0,null])await assert.rejects(handlerFor(bad),{message:/HTTP_CONFIGURATION/u});
});

test('control binds the private listener with readiness and the public listener with liveness only',async()=>{
 const calls=[];const listen=async options=>{calls.push(options);return {close:async()=>({})};};
 const app={handle:async()=>null};
 await listenControlApplications({configuration:{...configuration,privateHttp:{...configuration.http,port:8082}},publicApplication:app,privateApplication:app,readiness,listen});
 assert.equal(calls.length,2);assert.equal(calls[0].configuration.http.port,8082);assert.equal('exposeReadiness' in calls[0],false);
 assert.equal(calls[1].exposeReadiness,false);
 calls.length=0;await listenControlApplications({configuration,publicApplication:app,privateApplication:null,readiness,listen});
 assert.equal(calls.length,1);assert.equal(calls[0].exposeReadiness,true);
});
