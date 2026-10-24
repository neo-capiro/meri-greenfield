import test from 'node:test';
import assert from 'node:assert/strict';
import {startTemporalWorker,BROKER_NATIVE_MS} from '../temporal-worker.mjs';

const configuration={temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri',taskQueue:'meri-conversations',tls:{}},native:{capabilityFile:'/synthetic/not-read'},limits:{requestMs:100,shutdownMs:100},http:{}};
function boundaries(){
 const calls=[],controller=new AbortController();let state='INITIALIZED',resolveRun;
 const run=new Promise(resolve=>{resolveRun=resolve;});
 const worker={getState:()=>state,run(){calls.push('run');state='RUNNING';return run;},shutdown(){calls.push('shutdown');state='STOPPED';resolveRun();}};
 const connection={async close(){calls.push('connection-close');if(state==='INITIALIZED')throw Error('native connection holder still allocated');}};
 const owners={async tls(){calls.push('tls');return {};},async readMaterial(){calls.push('material');return Buffer.from('synthetic-existing-capability');},nativeClient(){return {async readiness(){calls.push('native-readiness');}};},async connect(options){calls.push('connect');assert.equal(Object.hasOwn(options,'apiKey'),false);return connection;},async createWorker(){calls.push('create');return worker;},async listen(){calls.push('listen');return {address:'synthetic',async close(){calls.push('listener-close');}};}};
 return {calls,owners,worker,signal:controller.signal,lose:()=>controller.abort(Error('synthetic shutdown')),state:()=>state};
}

test('shutdown while native Worker.create allocates never runs an INITIALIZED stale poller and preserves cleanup uncertainty',async()=>{
 const b=boundaries();b.owners.createWorker=async()=>{b.calls.push('create');b.lose();return b.worker;};
 await assert.rejects(startTemporalWorker(configuration,{signal:b.signal,testOwners:b.owners}),error=>error.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'&&error.cause instanceof AggregateError);
 assert.equal(b.state(),'INITIALIZED');assert.equal(b.calls.includes('run'),false);assert.equal(b.calls.includes('listen'),false);
 assert.ok(b.calls.includes('connection-close'));
});

test('loss during listener binding immediately fences its actual application and shuts down the RUNNING worker',async()=>{
 const b=boundaries();let denied;
 b.owners.listen=async({application})=>{b.calls.push('listen');b.lose();denied=await application.handle(new Request('https://worker.synthetic.invalid/v1/execution/kickoff',{method:'POST'}));return {address:'synthetic',async close(){b.calls.push('listener-close');}};};
 await assert.rejects(startTemporalWorker(configuration,{signal:b.signal,testOwners:b.owners}),{code:'WORKER_STARTUP_FAILED'});
 assert.equal(denied.status,503);assert.equal(b.state(),'STOPPED');assert.ok(b.calls.includes('listener-close'));
});

test('real startup passes native TLS without a token and stops its poller on shutdown',async()=>{
 const b=boundaries(),runtime=await startTemporalWorker(configuration,{signal:b.signal,testOwners:b.owners});
 assert.equal(b.calls[0],'tls');assert.ok(b.calls.indexOf('material')<b.calls.indexOf('connect'));
 b.lose();await runtime.completion;await runtime.close();
 assert.equal(b.state(),'STOPPED');assert.ok(b.calls.includes('connection-close'));
});

test('the worker uses the bounded current control exchange timeout',async()=>{
 const b=boundaries(),stub=b.owners.nativeClient;let options;b.owners.nativeClient=value=>{options=value;return stub(value);};
 const runtime=await startTemporalWorker(configuration,{signal:b.signal,testOwners:b.owners});
 try{assert.equal(options.maxRequestMs,BROKER_NATIVE_MS);assert.equal(BROKER_NATIVE_MS,10000);}finally{await runtime.close();}
});
