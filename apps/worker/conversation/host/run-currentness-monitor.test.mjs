/** Scripted trusted control receipts exercise the host consumer; no control service or native host is started. */
import test from 'node:test';import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {binding} from '../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,MAX_HOST_CURRENTNESS_MS} from './binding.mjs';
import {startHostRunCurrentnessMonitor} from './run-currentness-monitor.mjs';

const policy={bash:true,sandboxNetworkDomains:['records.example']};
const digest=canonicalSha256(assertCapabilityPolicy(policy));
const allocation=()=>({schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,
 hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+5000});
const receipt=(a,until,over={})=>({allocation:a,binding,policySha256:digest,phase:'active',checkedAtMs:Date.now(),currentUntilMs:until,...over});
const start=(a,readCurrent,over={})=>startHostRunCurrentnessMonitor({allocation:a,binding,capabilityPolicy:policy,readCurrent,maxFreshMs:400,refreshEveryMs:80,...over});
function waitForAbort(signal,timeoutMs=800){if(signal.aborted)return Promise.resolve();
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('abort timed out')),timeoutMs);
  signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});}

test('pins exact allocation, full binding and effective capability policy digest, then closes its signal',async()=>{
 const a=allocation();let request;
 const monitor=await start(a,async input=>{request=input;return receipt(a,Date.now()+300);});
 assert.equal(monitor.policySha256,digest);assert.deepEqual(request.allocation,a);assert.deepEqual(request.binding,binding);
 assert.equal(request.policySha256,digest);assert.equal(request.signal.aborted,false);
 a.generation=9;request.allocation.imageDigest=`sha256:${'b'.repeat(64)}`;
 assert.equal(monitor.allocation.generation,1);assert.equal(monitor.allocation.imageDigest,`sha256:${'a'.repeat(64)}`);
 assert.deepEqual(monitor.close(),{closed:true});assert.equal(monitor.signal.aborted,true);
});

test('invalid settings and mismatched, stale or widened control receipts refuse initial admission',async()=>{
 const a=allocation(),until=Date.now()+200;
 for(const options of [{maxFreshMs:MAX_HOST_CURRENTNESS_MS+1},{refreshEveryMs:201},
  {capabilityPolicy:{bash:true,sandboxNetworkDomains:['bad.local']}}]){
  await assert.rejects(start(a,async()=>receipt(a,until),options),e=>['HOST_CURRENTNESS_CONFIGURATION','CAPABILITY_POLICY_REFUSED'].includes(e?.code));
 }
 for(const change of [{allocation:{...a,generation:2}},{binding:{...binding,writerFence:2}},
  {policySha256:'0'.repeat(64)},{phase:'draining'},{checkedAtMs:Date.now()-1000},
  {currentUntilMs:Date.now()+1000},{currentUntilMs:a.leaseDeadlineMs+1}]){
  let portSignal;await assert.rejects(start(a,async input=>{portSignal=input.signal;return receipt(a,until,change);}),{code:'HOST_CURRENTNESS_REFUSED'});
  assert.equal(portSignal.aborted,true);
 }
});

test('a failed refresh aborts the SDK run lifetime signal before the old lease expires',async()=>{
 const a=allocation();let reads=0;
 const monitor=await start(a,async()=>++reads===1?receipt(a,Date.now()+300):receipt(a,Date.now()+300,{phase:'draining'}));
 await assert.rejects(monitor.refresh(),{code:'HOST_CURRENTNESS_REFUSED'});
 assert.equal(monitor.signal.aborted,true);assert.equal(reads,2);
});

test('automatic refresh observes a control revocation without browser service participation',async()=>{
 const a=allocation();let reads=0;
 const monitor=await start(a,async()=>++reads===1?receipt(a,Date.now()+220):receipt(a,Date.now()+220,{phase:'draining'}),{maxFreshMs:300,refreshEveryMs:30});
 try{await waitForAbort(monitor.signal);assert.ok(reads>=2);}finally{monitor.close();}
});

test('a hanging read times out and a late reply cannot renew an expired lease',async()=>{
 const a=allocation();let reads=0,reply;
 const monitor=await start(a,async()=>++reads===1?receipt(a,Date.now()+120):new Promise(resolve=>{reply=resolve;}),{maxFreshMs:200,refreshEveryMs:40});
 const pending=monitor.refresh();await waitForAbort(monitor.signal);
 reply(receipt(a,Date.now()+100));
 await assert.rejects(pending,{code:'HOST_CURRENTNESS_REFUSED'});
 assert.equal(monitor.signal.aborted,true);
});

test('a wall-clock rollback cannot extend the last authenticated lease or admit a late reply',async()=>{
 const a=allocation();let time=Date.now(),reads=0,reply;
 const monitor=await start(a,async()=>++reads===1?receipt(a,time+100,{checkedAtMs:time}):new Promise(resolve=>{reply=resolve;}),
  {now:()=>time,maxFreshMs:200,refreshEveryMs:25});
 const pending=monitor.refresh();time-=10000;
 await waitForAbort(monitor.signal);
 reply(receipt(a,time+150,{checkedAtMs:time}));
 await assert.rejects(pending,{code:'HOST_CURRENTNESS_REFUSED'});
 assert.equal(monitor.signal.aborted,true);
});

test('rollback between receipt validation and timer scheduling cannot lengthen the SDK lease',async()=>{
 const a=allocation(),at=Date.now();let samples=0,reads=0;
 const monitor=await start(a,async()=>++reads===1?receipt(a,at+90,{checkedAtMs:at}):new Promise(()=>{}),
  {now:()=>++samples===3?at-10000:at,maxFreshMs:400,refreshEveryMs:150});
 try{await waitForAbort(monitor.signal,180);assert.ok(reads>=1);}
 finally{monitor.close();}
});

test('a hung initial authenticated-port read times out and aborts its read signal',async()=>{
 const a=allocation();let portSignal;
 await assert.rejects(start(a,async input=>{portSignal=input.signal;return new Promise(()=>{});},
  {maxFreshMs:40,refreshEveryMs:10}),{code:'HOST_CURRENTNESS_REFUSED'});
 assert.equal(portSignal.aborted,true);
});

test('an initial late receipt cannot beat a delayed timeout callback',async()=>{
 const a=allocation();let calls=0;
 const pending=start(a,async()=>{calls++;return receipt(a,Date.now()+20);},{maxFreshMs:30,refreshEveryMs:10});
 const started=performance.now();while(performance.now()-started<55){} // Let the read settle before delayed timers.
 await assert.rejects(pending,{code:'HOST_CURRENTNESS_REFUSED'});
 assert.equal(calls,1);
});

test('external host teardown aborts a pending read and the returned SDK lifetime signal',async()=>{
 const a=allocation(),owner=new AbortController();let reads=0;
 const monitor=await start(a,async()=>++reads===1?receipt(a,Date.now()+300):new Promise(()=>{}),{signal:owner.signal});
 const pending=monitor.refresh();owner.abort();
 await assert.rejects(pending,{code:'HOST_CURRENTNESS_REFUSED'});
 assert.equal(monitor.signal.aborted,true);
});

test('offline Bash and browser-only runs still need a fresh canonical capability-policy lease',async()=>{
 for(const effective of [{bash:true},{}]){
  const a=allocation(),normalized=assertCapabilityPolicy(effective),expected=canonicalSha256(normalized);let reads=0;
  const monitor=await start(a,async request=>{assert.equal(request.policySha256,expected);
   return receipt(a,Date.now()+250,{policySha256:expected,...(++reads>1?{phase:'draining'}:{})});},
   {capabilityPolicy:effective});
  try{await assert.rejects(monitor.refresh(),{code:'HOST_CURRENTNESS_REFUSED'});
   assert.equal(monitor.signal.aborted,true);assert.equal(reads,2);}finally{monitor.close();}
 }
});
