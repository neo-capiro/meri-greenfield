import test from 'node:test';
import assert from 'node:assert/strict';
import {startTemporalWorker,BROKER_NATIVE_MS} from '../temporal-worker.mjs';

const configuration={temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri',taskQueue:'meri-conversations',tls:{}},native:{capabilityFile:'/synthetic/not-read'},limits:{requestMs:100,shutdownMs:100},http:{}};
function boundaries(){
 const calls=[],controller=new AbortController();let state='INITIALIZED',resolveRun;
 const run=new Promise(resolve=>{resolveRun=resolve;});
 const worker={getState:()=>state,run(){calls.push('run');state='RUNNING';return run;},shutdown(){calls.push('shutdown');state='STOPPED';resolveRun();}};
 const connection={async close(){calls.push('connection-close');if(state==='INITIALIZED')throw Error('native connection holder still allocated');}};
 const owners={async tls(){calls.push('tls');return {};},async readMaterial(){calls.push('material');return Buffer.from('synthetic-existing-capability');},nativeClient(){return {async readiness(){calls.push('native-readiness');},async call(){assert.fail('startup does not execute activities');}};},async connect(options){calls.push('connect');assert.equal(Object.hasOwn(options,'apiKey'),false);return connection;},async createWorker(){calls.push('create');return worker;},async listen(){calls.push('listen');return {address:'synthetic',async close(){calls.push('listener-close');}};}};
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

test('visibility: startup failure stages preserve the cause without retries or private error content',async t=>{
 const lines=[];t.mock.method(process.stderr,'write',line=>{lines.push(String(line));return true;});
 for(const [stage,owner,code] of [['worker-material','readMaterial','RUNTIME_SECRET_FILE'],['worker-readiness','nativeClient','NATIVE_UNAVAILABLE'],['worker-connect','connect','ECONNRESET'],['worker-create','createWorker','WORKER_CONFIGURATION'],['worker-listen','listen','EADDRINUSE']]){
  const b=boundaries(),error=Object.assign(Error('PRIVATE_STARTUP_CANARY'),{code});let attempts=0;
  const fail=async()=>{attempts++;throw error;};
  if(owner==='nativeClient')b.owners.nativeClient=()=>({readiness:fail});else b.owners[owner]=fail;
  if(owner==='createWorker')b.owners.connect=async()=>({async close(){b.calls.push('connection-close');}});
  await assert.rejects(startTemporalWorker(configuration,{signal:b.signal,testOwners:b.owners}),e=>e.code==='WORKER_STARTUP_FAILED'&&e.cause===error);
  assert.equal(attempts,1);assert.match(lines.at(-1)??'',new RegExp(`^RUNTIME_STARTUP_FAILURE role=temporal-worker stage=${stage} code=${code} class=ERROR `));
 }
 assert.equal(lines.length,5);assert.equal(lines.join('').includes('PRIVATE_STARTUP_CANARY'),false);
});
test('visibility: startup cleanup uncertainty is a separate diagnostic and a failed writer cannot replace it',async t=>{
 const lines=[];t.mock.method(process.stderr,'write',line=>{lines.push(String(line));return true;});
 const b=boundaries();b.owners.createWorker=async()=>{b.lose();return b.worker;};
 await assert.rejects(startTemporalWorker(configuration,{signal:b.signal,testOwners:b.owners}),{code:'TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'});
 assert.equal(lines.length,2);assert.match(lines[0],/stage=worker-create code=TEMPORAL_AUTHORIZATION_UNAVAILABLE /);
 assert.match(lines[1],/stage=worker-cleanup code=TEMPORAL_PRODUCT_CLEANUP_UNKNOWN /);assert.equal(b.calls.includes('run'),false);
 t.mock.method(process.stderr,'write',()=>{throw Error('writer unavailable');});
 const c=boundaries();c.owners.nativeClient=()=>({async readiness(){throw Error('private');}});
 await assert.rejects(startTemporalWorker(configuration,{signal:c.signal,testOwners:c.owners}),{code:'WORKER_STARTUP_FAILED'});
});

test('visibility: a rejected poller reports worker-run without replacing completion or cleanup uncertainty',async t=>{
 const lines=[];t.mock.method(process.stderr,'write',line=>{lines.push(String(line));return true;});
 const b=boundaries(),start=b.worker.run,error=Object.assign(Error('PRIVATE_POLLER_CANARY'),{code:'ECONNRESET'});
 b.worker.run=()=>{start();return Promise.reject(error);};
 const runtime=await startTemporalWorker(configuration,{signal:b.signal,testOwners:b.owners});
 try{
  await assert.rejects(runtime.completion,e=>e===error);
  assert.equal(lines.length,1);assert.match(lines[0],/^RUNTIME_STARTUP_FAILURE role=temporal-worker stage=worker-run code=ECONNRESET /);
  assert.equal(lines[0].includes('PRIVATE_POLLER_CANARY'),false);
 }finally{await assert.rejects(runtime.close(),{code:'TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'});assert.equal(b.state(),'STOPPED');}
});
