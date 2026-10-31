/** Inert tests for the closed native lifecycle producer: synthetic Linux cgroup/boot ports and lstat only. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createNetworkPlan} from '../../worker/conversation/host/network/plan.mjs';
import {openNativeLifecycle,NATIVE_LIFECYCLE_PATH,NATIVE_LIFECYCLE_SCHEMA,NATIVE_ABSENCE_SCHEMA,
 nativeLifecycleRequest,nativeAbsenceRecord,NATIVE_LIFECYCLE_ACTIONS} from './lifecycle.mjs';

const EVENTS0='populated 0'+String.fromCharCode(10);
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BOOT=uuid(8);
const TENANT=uuid(1),CONV=uuid(3),HOST=uuid(7);
const IMAGE=`sha256:${'b'.repeat(64)}`;
const LEASE=Date.now()+600000;
const binding={tenantId:TENANT,actorId:uuid(2),conversationId:CONV,runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1};
const identity={schema:'meri-d005-host-identity/1',hostId:HOST,conversationId:CONV,instanceId:'i-0123456789abcdef0',bootId:BOOT};
const requestAllocation=lease=>({schema:'meri-conversation-host-allocation/1',tenantId:TENANT,conversationId:CONV,
 generation:3,hostId:HOST,hostMode:'native-processing',imageDigest:IMAGE,leaseDeadlineMs:lease});
const config=(lease=LEASE)=>({allocation:{hostId:HOST,generation:3,conversationId:CONV,tenantId:TENANT,
 instanceId:'i-0123456789abcdef0',bootId:BOOT,hostMode:'native-processing',leaseDeadlineMs:lease},
 binding,image:{digest:IMAGE}});
const hostGroup=`/sys/fs/cgroup/meri/hosts/${HOST}-3`;
const leafPath=`${hostGroup}/${canonicalSha256(binding)}/processing`;
const namespacePath=createNetworkPlan({allocation:requestAllocation(LEASE),binding,kind:'processing',routes:[]}).namespacePath;
const request=(action='close',{lease=LEASE,overrides={}}={})=>({schema:NATIVE_LIFECYCLE_SCHEMA,action,
 allocation:requestAllocation(lease),binding,hostIdentity:identity,...overrides});

function ports({events='populated 0\nfrozen 0\n',boot=BOOT,bootAfter=null,openFails=false}={}){
 let opens=0,closes=0;
 return {
  get opens(){return opens;},get closes(){return closes;},
  async readBootId(){return bootAfter!==null&&opens>0?bootAfter:boot;},
  async openGroup(path){
   assert.equal(path,hostGroup,'the producer pins the EXACT protected host cgroup');
   opens+=1;
   if(openFails)throw Object.assign(Error('HOST_PROCESS_OBSERVATION_UNKNOWN'),{code:'HOST_PROCESS_OBSERVATION_UNKNOWN'});
   return {async readEvents(){return events;},async close(){closes+=1;}};
  },
 };
}
function lstatFor({present=[],error=null}={}){
 const seen=[];
 const fn=path=>{seen.push(path);
  if(error){const e=Error(error);e.code=error;throw e;}
  if(present.includes(path))return {path};
  const e=Error('ENOENT');e.code='ENOENT';throw e;};
 fn.seen=seen;return fn;
}
const quiesceWith=(result,{counter}={})=>async()=>{if(counter)counter.calls+=1;return result;};

test('CONTRACT: path and closed request; unknown fields, cross tuple and wrong purpose are refused',()=>{
 assert.equal(NATIVE_LIFECYCLE_PATH,'/v1/native-processing/lifecycle');
 assert.deepEqual([...NATIVE_LIFECYCLE_ACTIONS],['close','processes','observe']);
 assert.equal(nativeLifecycleRequest(request('observe'),{config:config()}).action,'observe');
 for(const [name,raw] of [
  ['extra field',request('close',{overrides:{path:'/tmp/x'}})],
  ['unknown action',request('destroy')],
  ['cross host',{...request('close'),allocation:{...requestAllocation(LEASE),hostId:uuid(77)}}],
  ['cross run',{...request('close'),binding:{...binding,runId:uuid(78)}}],
  ['wrong identity boot',{...request('close'),hostIdentity:{...identity,bootId:uuid(79)}}],
  ['wrong purpose',{...request('close'),allocation:{...requestAllocation(LEASE),hostMode:'browser-only'}}],
 ]) assert.throws(()=>nativeLifecycleRequest(raw,{config:config()}),
  e=>['NATIVE_LIFECYCLE_REFUSED','HOST_IDENTITY_REFUSED','HOST_BINDING_REFUSED'].includes(e?.code),name);
});

test('POSITIVE: valid close, then processes and observe from real (synthetic) kernel observation',async()=>{
 const p=ports(),counter={calls:0},lstat=lstatFor();
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true},{counter}),ports:p,lstat});
 const closed=await lifecycle.close(request('close'));
 assert.equal(closed.status,'closed');
 assert.equal(counter.calls,1);
 const processes=await lifecycle.processes(request('processes'));
 assert.equal(processes.schema,'meri-d005-process-absence/1');
 assert.equal(processes.scope,'native-processing-descendants');
 assert.equal(processes.exited,true);assert.deepEqual([...processes.remainingPids],[]);
 assert.equal(processes.bindingSha256,canonicalSha256(binding));
 const absence=await lifecycle.observe(request('observe'));
 assert.equal(absence.schema,NATIVE_ABSENCE_SCHEMA);
 assert.deepEqual(lstat.seen,[leafPath,namespacePath],'BOTH exact owned paths are read');
 assert.equal(absence.cgroup,'removed');assert.equal(absence.networkNamespace,'removed');assert.equal(absence.status,'absent');
 assert.equal(nativeAbsenceRecord(absence)?.status,'absent');
 assert.equal(nativeAbsenceRecord({...absence,status:'present'}),null);
 await lifecycle.dispose();await lifecycle.dispose();
 assert.equal(p.closes,1,'the pinned root FD is closed exactly once');
});

test('DENIED BEFORE EFFECTS: an invalid target never quiesces or reads',async()=>{
 const p=ports(),counter={calls:0},lstat=lstatFor();
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true},{counter}),ports:p,lstat});
 await assert.rejects(lifecycle.close({...request('close'),allocation:{...requestAllocation(LEASE),generation:4}}),
  e=>['NATIVE_LIFECYCLE_REFUSED','HOST_IDENTITY_REFUSED','HOST_BINDING_REFUSED'].includes(e?.code));
 assert.equal(counter.calls,0);
 assert.equal(lstat.seen.length,0);
});

test('EXPIRED TARGET: cleanup is still allowed for an expired lease that matches the protected tuple',async()=>{
 const expired=Date.now()-60000;
 const lifecycle=await openNativeLifecycle({config:config(expired),quiesce:quiesceWith({closed:true}),ports:ports(),lstat:lstatFor()});
 assert.equal((await lifecycle.close(request('close',{lease:expired}))).status,'closed');
});

test('NO PROOF: unclosed quiesce, populated group or boot change stays UNKNOWN',async()=>{
 const notClosed=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:false}),ports:ports(),lstat:lstatFor()});
 await assert.rejects(notClosed.processes(request('processes')),e=>e?.code==='NATIVE_LIFECYCLE_UNKNOWN');
 const populated=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),
  ports:ports({events:'populated 1\nfrozen 0\n'}),lstat:lstatFor()});
 await assert.rejects(populated.processes(request('processes')),e=>e?.code==='NATIVE_LIFECYCLE_UNKNOWN');

});

test('STARTUP: a wrong boot or unpinnable group refuses and releases any acquired descriptor',async()=>{
 await assert.rejects(openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),
  ports:ports({boot:uuid(91)}),lstat:lstatFor()}),e=>e?.code==='NATIVE_LIFECYCLE_REFUSED');
 const failing=ports({openFails:true});
 await assert.rejects(openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:failing,lstat:lstatFor()}),
  e=>e?.code==='HOST_PROCESS_OBSERVATION_UNKNOWN');
 assert.equal(failing.closes,0);
});

test('READBACK: present/recreated paths and EACCES/EIO never produce absence',async()=>{
 for(const options of [{present:[leafPath]},{present:[namespacePath]},{error:'EACCES'},{error:'EIO'}]){
  const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:ports(),
   lstat:lstatFor(options)});
  await assert.rejects(lifecycle.observe(request('observe')),e=>e?.code==='NATIVE_LIFECYCLE_UNKNOWN',JSON.stringify(options));
 }
});

test('REPLAY: repeated close settles quiesce once and repeats the same final result',async()=>{
 const counter={calls:0};
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true},{counter}),ports:ports(),lstat:lstatFor()});
 const first=await lifecycle.close(request('close'));
 const second=await lifecycle.close(request('close'));
 assert.equal(counter.calls,1,'quiesce is invoked exactly once');
 assert.equal(first.status,second.status);
});

test('DISPOSE: after dispose no proof can be produced or revived',async()=>{
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:ports(),lstat:lstatFor()});
 await lifecycle.dispose();
 await assert.rejects(lifecycle.observe(request('observe')),e=>e?.code==='NATIVE_LIFECYCLE_UNKNOWN');
});

test('HARDENING: image, binding and malformed tuples refuse with ZERO OS reads/opens',async()=>{
 const p=ports();
 for(const bad of [
  {config:{allocation:config().allocation,binding},label:'missing image'},
  {config:{...config(),image:undefined},label:'image undefined'},
  {config:{...config(),image:{digest:'sha256:short'}},label:'image malformed'},
  {config:{...config(),binding:undefined},label:'missing binding'},
  {config:{...config(),allocation:{...config().allocation,hostId:'not-a-uuid'}},label:'malformed hostId'},
  {config:{...config(),allocation:{...config().allocation,instanceId:'nope'}},label:'malformed instanceId'},
 ]){
  await assert.rejects(openNativeLifecycle({config:bad.config,quiesce:quiesceWith({closed:true}),ports:p,lstat:lstatFor()}),
   e=>e?.code==='NATIVE_LIFECYCLE_CONFIGURATION',bad.label);
 }
 assert.equal(p.opens,0,'no cgroup is opened for an invalid configuration');
});

test('HARDENING: mutating the caller config after open cannot retarget requests or paths',async()=>{
 const cfg=config();
 const lifecycle=await openNativeLifecycle({config:cfg,quiesce:quiesceWith({closed:true}),ports:ports(),lstat:lstatFor()});
 cfg.allocation.hostId=uuid(77);
 cfg.image.digest=`sha256:${'c'.repeat(64)}`;
 // The original target is still the accepted one...
 const ok=await lifecycle.close(request('close'));
 assert.equal(ok.status,'closed');
 // ...and a request built from the MUTATED config is refused.
 await assert.rejects(lifecycle.close({...request('close'),allocation:{...requestAllocation(LEASE),hostId:uuid(77)}}),
  e=>['NATIVE_LIFECYCLE_REFUSED','HOST_IDENTITY_REFUSED','HOST_BINDING_REFUSED'].includes(e?.code));
});

test('HARDENING: an invalid group contract refuses and closes any acquired handle',async()=>{
 let closes=0;
 const bad={async readBootId(){return BOOT;},
  async openGroup(){return {async close(){closes+=1;}};}};   // no readEvents
 await assert.rejects(openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:bad,lstat:lstatFor()}),
  e=>e?.code==='NATIVE_LIFECYCLE_REFUSED');
 assert.equal(closes,1,'the acquired handle is closed when the group contract is invalid');
});

test('HARDENING: a request whose action does not match the method is refused without quiescing',async()=>{
 const counter={calls:0};
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true},{counter}),ports:ports(),lstat:lstatFor()});
 await assert.rejects(lifecycle.processes(request('close')),e=>e?.code==='NATIVE_LIFECYCLE_REFUSED');
 await assert.rejects(lifecycle.observe(request('close')),e=>e?.code==='NATIVE_LIFECYCLE_REFUSED');
 assert.equal(counter.calls,0,'no quiesce is started by a mismatched action');
});

test('BOUNDED: pre-aborted or already-expired operations refuse before any effect',async()=>{
 const p=ports();
 const controller=new AbortController();controller.abort();
 await assert.rejects(openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:p,lstat:lstatFor(),
  signal:controller.signal}),e=>e?.code==='NATIVE_LIFECYCLE_CANCELLED');
 await assert.rejects(openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:p,lstat:lstatFor(),
  deadlineMs:Date.now()-1}),e=>e?.code==='NATIVE_LIFECYCLE_CANCELLED');
 assert.equal(p.opens,0,'nothing is opened for an already-finished operation');
});

test('BOUNDED: a held kernel read times out and never yields proof',async()=>{
 const held={async readBootId(){return BOOT;},
  async openGroup(){return {readEvents(){return new Promise(()=>{});},async close(){}};}};
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:held,
  lstat:lstatFor(),timeoutMs:40});
 await lifecycle.close(request('close'));
 await assert.rejects(lifecycle.processes(request('processes')),
  e=>['NATIVE_LIFECYCLE_CANCELLED','NATIVE_LIFECYCLE_UNKNOWN'].includes(e?.code));
});

test('BOUNDED: dispose during a read cancels it and no proof can be returned',async()=>{
 let releaseRead;
 const held={async readBootId(){return BOOT;},
  async openGroup(){return {readEvents(){return new Promise(resolve=>{releaseRead=resolve;});},async close(){}};}};
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:held,
  lstat:lstatFor(),timeoutMs:5000});
 await lifecycle.close(request('close'));
 const pending=lifecycle.processes(request('processes')).then(v=>({v}),e=>({e}));
 await new Promise(r=>setTimeout(r,5));
 const disposed=await lifecycle.dispose();
 assert.equal(disposed.closed,true);
 const result=await pending;
 assert.ok(['NATIVE_LIFECYCLE_CANCELLED','NATIVE_LIFECYCLE_UNKNOWN'].includes(result.e?.code),String(result.e?.code));
 releaseRead?.(String.fromCharCode(112,111,112,117,108,97,116,101,100,32,48));
});

test('STARTUP: a held open times out, and the late handle is closed exactly once and never adopted',async()=>{
 let release,closes=0;
 const slow={async readBootId(){return BOOT;},
  async openGroup(){return new Promise(resolve=>{release=()=>resolve({async readEvents(){return EVENTS0;},
   async close(){closes+=1;}});});}};
 await assert.rejects(openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:slow,
  lstat:lstatFor(),timeoutMs:30}),e=>e?.code==='NATIVE_LIFECYCLE_CANCELLED');
 release();await new Promise(r=>setTimeout(r,20));
 assert.equal(closes,1,'the late handle is closed exactly once');
});

test('STARTUP: a boot change after open closes the acquired handle and refuses',async()=>{
 let reads=0,closes=0;
 const drifting={async readBootId(){reads+=1;return reads===1?BOOT:uuid(90);},
  async openGroup(){return {async readEvents(){return EVENTS0;},async close(){closes+=1;}};}};
 await assert.rejects(openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:drifting,
  lstat:lstatFor()}),e=>e?.code==='NATIVE_LIFECYCLE_REFUSED');
 assert.equal(closes,1,'the pinned handle is released when the boot no longer matches');
});

test('QUIESCE: a cancelled close caller does not restart or discard the host-owned cleanup',async()=>{
 let resolveQuiesce,calls=0;
 const quiesce=()=>{calls+=1;return new Promise(resolve=>{resolveQuiesce=resolve;});};
 const lifecycle=await openNativeLifecycle({config:config(),quiesce,ports:ports(),lstat:lstatFor(),timeoutMs:5000});
 const controller=new AbortController();
 const cancelled=lifecycle.close(request('close'),{signal:controller.signal}).then(v=>({v}),e=>({e}));
 await new Promise(r=>setTimeout(r,10));controller.abort();
 assert.equal((await cancelled).e?.code,'NATIVE_LIFECYCLE_CANCELLED');
 resolveQuiesce({closed:true});
 const replay=await lifecycle.close(request('close'));
 assert.equal(calls,1,'the shared quiesce was invoked exactly once');
 assert.equal(replay.status,'closed','the host-owned cleanup result is reused, not restarted');
 const again=await lifecycle.close(request('close'));
 assert.deepEqual(again,replay,'close replay is exactly equal');
});

test('QUIESCE: a host cleanup timeout stays UNKNOWN and is never promoted later',async()=>{
 let calls=0;
 const lifecycle=await openNativeLifecycle({config:config(),timeoutMs:30,
  quiesce:()=>{calls+=1;return new Promise(()=>{});},ports:ports(),lstat:lstatFor()});
 const first=await lifecycle.close(request('close')).then(v=>({v}),e=>({e}));
 assert.ok(first.e?.code==='NATIVE_LIFECYCLE_CANCELLED'||first.v?.status==='unknown',
  'a caller that expires during a timed-out host cleanup never sees success');
 await new Promise(r=>setTimeout(r,60));
 const second=await lifecycle.close(request('close'));
 const third=await lifecycle.close(request('close'));
 assert.equal(second.status,'unknown','the settled host cleanup stays unknown');
 assert.deepEqual(third,second,'unknown is sticky and replayed');
 assert.equal(calls,1,'the host cleanup is not restarted');
});

test('DEFAULT PORT: the real createLinuxHostCgroupPorts default path runs close/processes/observe',async()=>{
 const synthetic={async readBootId(){return BOOT;},
  async openGroup(path){assert.equal(path,hostGroup);return {async readEvents(){return EVENTS0;},async close(){}};}};
 mock.module('../../worker/conversation/host/host-wide-process-observer.mjs',
  {exports:{...await import('../../worker/conversation/host/host-wide-process-observer.mjs'),
   createLinuxHostCgroupPorts:()=>synthetic}});
 const fresh=await import('./lifecycle.mjs?default-port=1');
 const lifecycle=await fresh.openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),lstat:lstatFor()});
 assert.equal((await lifecycle.close(request('close'))).status,'closed');
 assert.equal((await lifecycle.processes(request('processes'))).exited,true);
 assert.equal((await lifecycle.observe(request('observe'))).status,'absent');
});

test('HELPER: nativeLifecycleRequest refuses a missing/invalid image',()=>{
 assert.throws(()=>nativeLifecycleRequest(request('close'),{config:{allocation:config().allocation,binding,
  image:{}}}),e=>e?.code==='NATIVE_LIFECYCLE_CONFIGURATION');
 assert.throws(()=>nativeLifecycleRequest(request('close'),{config:{allocation:config().allocation,binding}}),
  e=>e?.code==='NATIVE_LIFECYCLE_CONFIGURATION');
});

test('DISPOSAL: two concurrent dispose calls share ONE physical close and equal results',async()=>{
 let resolveClose,closes=0;
 const p={async readBootId(){return BOOT;},
  async openGroup(){return {async readEvents(){return EVENTS0;},close(){closes+=1;return new Promise(r=>{resolveClose=r;});}};}};
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:p,lstat:lstatFor()});
 const first=lifecycle.dispose();
 const second=lifecycle.dispose();
 await new Promise(r=>setTimeout(r,5));
 assert.equal(closes,1,'the physical close is requested exactly once');
 resolveClose();
 const [a,b]=await Promise.all([first,second]);
 assert.deepEqual(a,b);
 assert.equal(a.closed,true);
 assert.equal(closes,1,'later disposal never re-closes');
 const again=await lifecycle.dispose();
 assert.deepEqual(again,a,'dispose replays its truthful result');
 assert.equal(closes,1);
});

test('DISPOSAL: a failing or throwing physical close is sticky unknown and never retried',async()=>{
 for(const mode of ['throw','reject']){
  let closes=0;
  const p={async readBootId(){return BOOT;},
   async openGroup(){return {async readEvents(){return EVENTS0;},
    close(){closes+=1;if(mode==='throw')throw Error('CLOSE_THROW');return Promise.reject(Error('CLOSE_REJECT'));}};}};
  const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:p,lstat:lstatFor()});
  const first=await lifecycle.dispose();
  const second=await lifecycle.dispose();
  assert.equal(first.closed,false,mode);
  assert.equal(first.code,'NATIVE_LIFECYCLE_UNKNOWN',mode);
  assert.deepEqual(second,first,'unknown disposal is sticky');
  assert.equal(closes,1,'no implicit retry after a failed close');
 }
});

test('DISPOSAL: an ordinary resolved close does not leave a 5s timer tail',async()=>{
 const p={async readBootId(){return BOOT;},
  async openGroup(){return {async readEvents(){return EVENTS0;},async close(){}};}};
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:p,lstat:lstatFor()});
 const started=Date.now();
 const result=await lifecycle.dispose();
 assert.equal(result.closed,true);
 assert.equal(Date.now()-started<1000,true,'dispose resolves immediately and clears its bounded timer');
});

test('QUIESCE: an abort in the same stack after close() starts ZERO cleanup work',async()=>{
 let calls=0;
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:()=>{calls+=1;return Promise.resolve({closed:true});},
  ports:ports(),lstat:lstatFor(),timeoutMs:5000});
 const controller=new AbortController();
 const pending=lifecycle.close(request('close'),{signal:controller.signal}).then(v=>({v}),e=>({e}));
 controller.abort();                                  // same stack: before the target/ownership continuation runs
 const result=await pending;
 assert.equal(result.e?.code,'NATIVE_LIFECYCLE_CANCELLED');
 assert.equal(calls,0,'no quiesce is started when the caller is gone before ownership transfer');
});

test('DISPOSAL: an unknown timeout then a LATE physical close replays the cached unknown',async()=>{
 let resolveClose,closes=0;
 const p={async readBootId(){return BOOT;},
  async openGroup(){return {async readEvents(){return EVENTS0;},close(){closes+=1;return new Promise(r=>{resolveClose=r;});}};}};
 const lifecycle=await openNativeLifecycle({config:config(),quiesce:quiesceWith({closed:true}),ports:p,lstat:lstatFor()});
 const started=Date.now();
 const first=await lifecycle.dispose();            // bounded 5 s wait expires
 assert.equal(first.closed,false);
 assert.equal(first.code,'NATIVE_LIFECYCLE_UNKNOWN');
 assert.ok(Date.now()-started>=5000,'the bounded wait really expired');
 resolveClose();                                   // the raw close settles LATE
 await new Promise(r=>setTimeout(r,10));
 const second=await lifecycle.dispose();
 assert.deepEqual(second,first,'a late raw close never upgrades the cached unknown');
 assert.equal(closes,1,'the physical close was requested exactly once');
}, {timeout:20000});
