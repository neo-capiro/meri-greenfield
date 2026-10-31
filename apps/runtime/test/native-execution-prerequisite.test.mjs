import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {createNativeExecutionPrerequisite} from '../native-execution-prerequisite.mjs';

const policy='a'.repeat(64);
const binding={tenantId:'t',actorId:'a',conversationId:'00000000-0000-4000-8000-000000000001',clientId:null};
const deferred=()=>{const d=Promise.withResolvers();return d;};
function owner({uploads,reads}={}){
 const store={async read(){return {request:uploads===undefined?{}:{uploads}};}};
 const uploadInputSource={async read(){reads?.();return {ok:true};}};
 const allocations={async ready(){return {status:'ready',binding,generation:1,ownerInstanceId:'00000000-0000-4000-8000-000000000009',leaseDeadlineMs:Date.now()+60000,currentUntilMs:Date.now()+60000,policySha256:policy,bootstrapReady:true,recordSha256:'b'.repeat(64)};}};
 return createNativeExecutionPrerequisite({store,uploadInputSource,nativeAllocations:allocations,policySha256:policy,
  now:Date.now,requestTimeoutMs:1000,effectTimeoutMs:2000});
}
const selection={uploadId:'00000000-0000-4000-8000-000000000002',sha256:'c'.repeat(64)};

test('saved request without uploads is explicit none',async()=>{
 const p=owner();assert.equal((await p.need({binding,signal:undefined})).kind,'none');
 assert.equal((await p.ready({binding,deadlineMs:Date.now()+5000,signal:undefined})).status,'none');
});
test('saved uploads return native-processing after source read',async()=>{
 let reads=0;const p=owner({uploads:[selection],reads:()=>reads++});
 const need=await p.need({binding,signal:undefined});assert.equal(need.kind,'native-processing');assert.equal(reads,1);
});
test('ready rejects an expired receipt at dispatch',async()=>{
 const noUpload=owner();assert.equal((await noUpload.ready({binding,deadlineMs:Date.now()+5000})).status,'none');
 const p=owner({uploads:[selection]});
 await assert.rejects(()=>p.ready({binding,deadlineMs:Date.now()-1}),/EXECUTION_NATIVE_PREREQUISITE_REFUSED/);
});
test('cancellation rejects a noncooperative saved request read',async()=>{
 const gate=deferred();const ctl=new AbortController();
 const p=createNativeExecutionPrerequisite({store:{read:()=>new Promise(()=>{})},
  uploadInputSource:{read:async()=>({})},nativeAllocations:{ready:async()=>({})},policySha256:policy,now:Date.now,
  requestTimeoutMs:1000,effectTimeoutMs:2000});
 const work=p.need({binding,signal:ctl.signal});setTimeout(()=>ctl.abort(),20);
 await assert.rejects(()=>work,/EXECUTION_NATIVE_PREREQUISITE_REFUSED/);
});
const custom=({store,ready,requestTimeoutMs=1000,effectTimeoutMs=2000,now=Date.now})=>createNativeExecutionPrerequisite({store,
 uploadInputSource:{read:async()=>({ok:true})},nativeAllocations:{ready},policySha256:policy,now,
 requestTimeoutMs,effectTimeoutMs});
test('same-count retained upload replacement cannot satisfy the original readiness',async()=>{
 let reads=0;const second={...selection,uploadId:'00000000-0000-4000-8000-000000000003'};
 const p=custom({store:{async read(){return {request:{uploads:[++reads===1?selection:second]}};}},
  ready:async()=>({status:'ready',binding,generation:1,ownerInstanceId:'00000000-0000-4000-8000-000000000009',
   leaseDeadlineMs:Date.now()+60000,currentUntilMs:Date.now()+60000,policySha256:policy})});
 await assert.rejects(()=>p.ready({binding,deadlineMs:Date.now()+5000}),{code:'EXECUTION_NATIVE_PREREQUISITE_REFUSED'});
});
test('noncooperative allocation read is bounded by the short request budget',async()=>{
 const p=custom({store:{async read(){return {request:{uploads:[selection]}};}},ready:()=>new Promise(()=>{}),requestTimeoutMs:20});
 const started=Date.now();await assert.rejects(()=>p.ready({binding,deadlineMs:Date.now()+2000}),{code:'EXECUTION_NATIVE_PREREQUISITE_REFUSED'});
 assert.ok(Date.now()-started<150);
});
test('noncooperative saved request read is bounded by the short request budget',async()=>{
 const p=custom({store:{read:()=>new Promise(()=>{})},ready:async()=>({}),requestTimeoutMs:20});
 const started=Date.now();await assert.rejects(()=>p.need({binding}),{code:'EXECUTION_NATIVE_PREREQUISITE_REFUSED'});
 assert.ok(Date.now()-started<150);
});

test('ready receipt expiring during the final retained read is refused',async()=>{
 let clock=1000,reads=0;
 const p=custom({now:()=>clock,store:{async read(){if(++reads===2)clock=1011;return {request:{uploads:[selection]}};}},
  ready:async()=>({status:'ready',binding,generation:1,ownerInstanceId:'00000000-0000-4000-8000-000000000009',
   leaseDeadlineMs:1010,currentUntilMs:1010,policySha256:policy,bootstrapReady:true,recordSha256:'b'.repeat(64)})});
 await assert.rejects(()=>p.ready({binding,deadlineMs:3000}),/EXECUTION_NATIVE_PREREQUISITE_REFUSED/);
 assert.equal(reads,2);assert.equal(clock,1011);
});
test('successful readiness polls do not accumulate abort listeners',{timeout:2000},async()=>{
 let polls=0;const listeners=[];
 const p=custom({store:{async read(){return {request:{uploads:[selection]}};}},
  ready:async({signal})=>{listeners.push(getEventListeners(signal,'abort').length);
   return ++polls<4?{status:'not-ready'}:{status:'ready',binding,generation:1,
    ownerInstanceId:'00000000-0000-4000-8000-000000000009',leaseDeadlineMs:Date.now()+60000,
    currentUntilMs:Date.now()+60000,policySha256:policy,bootstrapReady:true,recordSha256:'b'.repeat(64)};}});
 await p.ready({binding,deadlineMs:Date.now()+1500});
 assert.equal(polls,4);assert.equal(Math.max(...listeners),listeners[0],'each completed poll must remove its own abort listener');
});
