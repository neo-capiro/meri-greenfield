/** Native-purpose teardown coordinator: explicit allocation-owned branch with inert OS/physical ports.
 *  No native, FS, EC2 or SQL effect; the observations are synthetic but must be exactly bound. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createConversationHostTeardown} from '../teardown.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=()=>Date.now();
const BINDING={tenantId:uuid(1),actorId:uuid(2),conversationId:uuid(3),runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1};
const IMAGE=`sha256:${'b'.repeat(64)}`;
const ALLOCATION={schema:'meri-conversation-host-allocation/1',tenantId:BINDING.tenantId,conversationId:BINDING.conversationId,
 generation:3,hostId:uuid(7),hostMode:'native-processing',imageDigest:IMAGE,leaseDeadlineMs:Date.now()+600000};
const IDENTITY={schema:'meri-d005-host-identity/1',hostId:uuid(7),conversationId:BINDING.conversationId,
 instanceId:'i-0123456789abcdef0',bootId:uuid(8)};
const ROOT_VOLUME='vol-0123456789abcdef0',ENIS=['eni-0123456789abcdef0'];
const bound=extra=>({allocationSha256:hash(ALLOCATION),bindingSha256:hash(BINDING),hostIdentitySha256:hash(IDENTITY),
 observedAtMs:now(),...extra});

/** The CURRENT canonical native absence wire (schema+scope required by the pure validator). */
const absentRecord=(extra={})=>bound({schema:'meri-d005-native-absence/1',allocationSha256:hash(ALLOCATION),
 bindingSha256:hash(BINDING),hostIdentitySha256:hash(IDENTITY),observedAtMs:now(),
 scope:'native-processing-descendants',cgroup:'removed',networkNamespace:'removed',status:'absent',...extra});

function ports(overrides={}){
 return {
  processes:{async waitForExit(request,{signal}){assert.equal(signal?.aborted,false);
   return bound({schema:'meri-d005-process-absence/1',scope:'native-processing-descendants',exited:true,remainingPids:[]});}},
  native:{async close(){return {closed:true};},
   async observe(request){assert.equal(request.allocation.hostMode,'native-processing');
   return absentRecord();}},
  host:{async destroy(){return {requested:true,instanceId:IDENTITY.instanceId,rootVolumeId:ROOT_VOLUME,
    networkInterfaceIds:ENIS};},
   async observeAbsent(request){assert.deepEqual(request.resources.networkInterfaceIds,ENIS);
    return bound({schema:'meri-d005-physical-absence/1',instanceId:IDENTITY.instanceId,rootVolumeId:ROOT_VOLUME,
     networkInterfaceIds:ENIS,instanceState:'terminated',rootVolumeAbsent:true,networkInterfacesAbsent:true});}},
  ...overrides};
}
const teardown=(overrides={})=>createConversationHostTeardown({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
 cwd:'/srv/host/'+BINDING.conversationId,browserPolicySha256:'a'.repeat(64),ports:ports(overrides),now});

test('NATIVE: verified receipt needs only native observations, with browser/bash honestly not-applicable',async()=>{
 const receipt=await teardown().settle({reason:'conversation-end'});
 assert.equal(receipt.status,'VERIFIED');
 assert.equal(receipt.browserEgress,'not-applicable');
 assert.equal(receipt.bashEgress,'not-applicable');
 assert.equal(receipt.browserState,'not-applicable');
 assert.equal(receipt.processScope,'native-processing-descendants');
 assert.equal(receipt.cgroup,'removed');assert.equal(receipt.networkNamespace,'removed');
 assert.equal(receipt.processes,'exited');
 assert.equal(receipt.hostDestroy,'requested');assert.equal(receipt.hostAbsence,'confirmed');
});

test('NATIVE: browser/Bash ports are refused outright and never consulted',async()=>{
 let touched=0;
 const p=ports({browser:{revoke:async()=>{touched++;return {revoked:true};},close:async()=>{touched++;return {closed:true};}},
  bash:{revoke:async()=>{touched++;return {revoked:true};},close:async()=>{touched++;return {closed:true};}}});
 let threw=null;
 try{
  await createConversationHostTeardown({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
   cwd:'/srv/host/'+BINDING.conversationId,browserPolicySha256:'a'.repeat(64),ports:p,now}).settle({reason:'failed'});
 }catch(error){threw=error;}
 assert.equal(threw?.code,'HOST_TEARDOWN_CONFIGURATION','a native declaration carrying browser/Bash ports is refused');
 assert.equal(touched,0,'no browser or Bash effect is attempted');
});

test('NATIVE UNKNOWN: still-present cgroup/netns or missing physical proof never yields VERIFIED',async()=>{
 const present=await createConversationHostTeardown({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  cwd:'/srv/host/'+BINDING.conversationId,browserPolicySha256:'a'.repeat(64),now,
  ports:ports({native:{async close(){return {closed:true};},async observe(){return bound({cgroup:'present',networkNamespace:'removed',status:'present'});}}})})
  .settle({reason:'failed'}).then(v=>({v}),e=>({e}));
 assert.equal(present.e?.code,'HOST_TEARDOWN_UNKNOWN');
 assert.equal(present.e.receipt.cgroup,'unknown');
 const noPhysical=await createConversationHostTeardown({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  cwd:'/srv/host/'+BINDING.conversationId,browserPolicySha256:'a'.repeat(64),now,
  ports:ports({host:{async destroy(){throw Error('DESTROY_FAILED');},async observeAbsent(){return bound({});}}})})
  .settle({reason:'failed'}).then(v=>({v}),e=>({e}));
 assert.equal(noPhysical.e?.code,'HOST_TEARDOWN_UNKNOWN');
 assert.equal(noPhysical.e.receipt.status,'UNKNOWN');
 assert.equal(noPhysical.e.receipt.hostDestroy,'unknown');
});

test('NATIVE UNKNOWN: a stale or foreign-bound observation is refused, and settle is idempotent',async()=>{
 const t=teardown({native:{async close(){return {closed:true};},async observe(){return absentRecord({allocationSha256:'0'.repeat(64)});}}});
 const first=await t.settle({reason:'cancelled'}).then(v=>({v}),e=>({e}));
 assert.equal(first.e?.code,'HOST_TEARDOWN_UNKNOWN');
 const second=await t.settle({reason:'conversation-end'}).then(v=>({v}),e=>({e}));
 assert.equal(second.e,first.e,'the settled result is reused, not recomputed');
});

test('LEGACY: a browser/browser-only declaration never requires a native port (constructor only, zero effects)',()=>{
 let touched=0;
 const legacyPorts={browser:{revoke:async()=>{touched++;return {revoked:true};},close:async()=>{touched++;return {closed:true};}},
  processes:{waitForExit:async()=>{touched++;return {};}},
  host:{destroy:async()=>{touched++;return {};},observeAbsent:async()=>{touched++;return {};}}};
 const legacy={...ALLOCATION,hostMode:'browser-only'};
 const teardownLegacy=createConversationHostTeardown({allocation:legacy,binding:BINDING,hostIdentity:IDENTITY,
  cwd:'/srv/host/'+BINDING.conversationId,browserPolicySha256:'a'.repeat(64),ports:legacyPorts,now});
 assert.equal(typeof teardownLegacy.settle,'function','legacy construct accepts its own ports without a native port');
 assert.equal(touched,0,'constructing a legacy teardown performs no effects');
});

test('ORDER: native.observe runs BEFORE host.destroy, and no local read happens after destroy',async()=>{
 const order=[];let destroyed=false;
 const p=ports({
  native:{async close(){order.push('close');return {closed:true};},
   async observe(){order.push('observe');if(destroyed)throw Error('READ_AFTER_DESTROY');return absentRecord();}},
  processes:{async waitForExit(){order.push('wait');return bound({schema:'meri-d005-process-absence/1',scope:'native-processing-descendants',exited:true,remainingPids:[]});}},
  host:{async destroy(){order.push('destroy');destroyed=true;return {requested:true,instanceId:IDENTITY.instanceId,rootVolumeId:ROOT_VOLUME,networkInterfaceIds:ENIS};},
   async observeAbsent(){order.push('observeAbsent');return bound({schema:'meri-d005-physical-absence/1',instanceId:IDENTITY.instanceId,rootVolumeId:ROOT_VOLUME,
    networkInterfaceIds:ENIS,instanceState:'terminated',rootVolumeAbsent:true,networkInterfacesAbsent:true});}}});
 const receipt=await createConversationHostTeardown({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  cwd:'/srv/host/'+BINDING.conversationId,browserPolicySha256:'a'.repeat(64),ports:p,now}).settle({reason:'failed'});
 assert.deepEqual(order,['close','wait','observe','destroy','observeAbsent']);
 assert.equal(receipt.status,'VERIFIED');
});

test('LOCAL FAILURE: a held local observer still triggers the bounded physical backstop, and local state stays unknown',async()=>{
 const order=[];
 const p=ports({
  native:{async close(){order.push('close');return {closed:true};},
   async observe(){order.push('observe');return new Promise(()=>{});}}});
 const result=await createConversationHostTeardown({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
  cwd:'/srv/host/'+BINDING.conversationId,browserPolicySha256:'a'.repeat(64),ports:p,now,localCleanupMs:40})
  .settle({reason:'failed'}).then(v=>({v}),e=>({e}));
 assert.equal(result.e?.code,'HOST_TEARDOWN_UNKNOWN');
 assert.equal(result.e.receipt.cgroup,'unknown','a held observer never becomes a local absence claim');
 assert.equal(result.e.receipt.hostDestroy,'requested','the physical backstop still ran');
});
