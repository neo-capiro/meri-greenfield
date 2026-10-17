import test from 'node:test';
import assert from 'node:assert/strict';
import {startTemporalWorker} from '../temporal-worker.mjs';

const configuration={temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri',taskQueue:'meri-conversations',tls:{}},native:{capabilityFile:'/synthetic/not-read'},limits:{requestMs:100,shutdownMs:100},http:{}};
function boundaries(){
 const calls=[];let fail,state='INITIALIZED',resolveRun;
 const run=new Promise(resolve=>{resolveRun=resolve;});
 const authorization={watch(fn){fail=fn;return ()=>{};},apiKey:()=> 'synthetic-existing-token',healthy:()=>state!=='STOPPED',attach(){calls.push('attach');},async close(){calls.push('authorization-close');}};
 const worker={getState:()=>state,run(){calls.push('run');state='RUNNING';return run;},shutdown(){calls.push('shutdown');state='STOPPED';resolveRun();}};
 const connection={async close(){calls.push('connection-close');if(state==='INITIALIZED')throw Error('native connection holder still allocated');}};
 const owners={async authorization(){calls.push('issuer');return authorization;},async tls(){calls.push('tls');return {};},async readMaterial(){calls.push('material');return Buffer.from('synthetic-existing-capability');},nativeClient(){return {async readiness(){calls.push('native-readiness');}};},async connect(){calls.push('connect');return connection;},async createWorker(){calls.push('create');return worker;},async listen(){calls.push('listen');return {address:'synthetic',async close(){calls.push('listener-close');}};}};
 return {calls,owners,worker,lose:()=>fail('revoked'),state:()=>state};
}

test('authorization loss while native Worker.create allocates never runs an INITIALIZED stale poller and preserves cleanup uncertainty',async()=>{
 const b=boundaries();b.owners.createWorker=async()=>{b.calls.push('create');b.lose();return b.worker;};
 await assert.rejects(startTemporalWorker(configuration,{testOwners:b.owners}),error=>error.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'&&error.cause instanceof AggregateError);
 assert.equal(b.state(),'INITIALIZED');assert.equal(b.calls.includes('run'),false);assert.equal(b.calls.includes('listen'),false);
 assert.ok(b.calls.includes('connection-close'));assert.ok(b.calls.includes('authorization-close'));
});

test('loss during listener binding immediately fences its actual application and shuts down the RUNNING worker',async()=>{
 const b=boundaries();let denied;
 b.owners.listen=async({application})=>{b.calls.push('listen');b.lose();denied=await application.handle(new Request('https://worker.synthetic.invalid/v1/execution/kickoff',{method:'POST'}));return {address:'synthetic',async close(){b.calls.push('listener-close');}};};
 await assert.rejects(startTemporalWorker(configuration,{testOwners:b.owners}),{code:'WORKER_STARTUP_FAILED'});
 assert.equal(denied.status,503);assert.equal(b.state(),'STOPPED');assert.ok(b.calls.includes('listener-close'));
});

test('real startup orders issuer before private material and exposes asynchronous loss through completion',async()=>{
 const b=boundaries(),runtime=await startTemporalWorker(configuration,{testOwners:b.owners});
 assert.equal(b.calls[0],'issuer');assert.ok(b.calls.indexOf('material')<b.calls.indexOf('connect'));
 b.lose();await assert.rejects(runtime.completion,{code:'TEMPORAL_AUTHORIZATION_UNAVAILABLE'});await runtime.close();
 assert.equal(b.state(),'STOPPED');assert.ok(b.calls.includes('connection-close'));
});
