import test,{mock} from 'node:test';
import assert from 'node:assert/strict';

// A new per-runtime dispatcher must not add a drain to the existing shutdown contract.
// Keep it pending until after the assertion, without a wall-clock timing threshold.
let pendingDrain,events;
class Agent{
 constructor(){}
 close(){events.push('dispatcher-close');return pendingDrain.promise;}
}
mock.module('undici',{namedExports:{Agent}});
const {startTemporalWorker}=await import('../temporal-worker.mjs');
const configuration={temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri',taskQueue:'meri-conversations',tls:{}},native:{capabilityFile:'/synthetic/not-read'},runWindowMs:900000,limits:{startupMs:30000,requestMs:25000,shutdownMs:10000},http:{}};

test('worker completes existing shutdown while the newly owned HTTP dispatcher is still draining',async()=>{
 events=[];pendingDrain=Promise.withResolvers();
 let state='INITIALIZED';const running=Promise.withResolvers();
 const worker={getState:()=>state,run(){state='RUNNING';return running.promise;},shutdown(){events.push('worker-shutdown');state='STOPPED';running.resolve();}};
 const testOwners={
  async authorization(){return {watch:()=>()=>{},apiKey:()=> 'synthetic',attach(){},healthy:()=>true,async close(){events.push('authorization-close');}};},
  async tls(){return {};},async readMaterial(){return Buffer.from('synthetic');},nativeClient(){return {async readiness(){}};},
  async connect(){return {async close(){events.push('connection-close');}};},async createWorker(){return worker;},
  async listen(){return {address:'synthetic',async close(){events.push('listener-close');}};},
 };
 const runtime=await startTemporalWorker(configuration,{testOwners}),closing=runtime.close();
 try{
  const completed=await Promise.race([closing.then(()=>true),new Promise(resolve=>setImmediate(()=>resolve(false)))]);
  assert.equal(completed,true,'shutdown must not wait for Agent.close()');
  assert.deepEqual(events,['worker-shutdown','listener-close','connection-close','authorization-close','dispatcher-close']);
 }finally{pendingDrain.resolve();await closing;}
});
