import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {HOST_PROCESS_ABSENCE_SCHEMA} from '../teardown.mjs';
import {HOST_CGROUP_CONFINEMENT_SCHEMA,createHostWideProcessObserver,createLinuxHostCgroupPorts,hostWideCgroup} from '../host-wide-process-observer.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:'tenant-a',conversationId:uuid(1),generation:1,hostId:uuid(2),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:1792425600000};
const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:uuid(1),runId:uuid(3),attemptId:uuid(4),workerId:uuid(5),writerFence:1};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',bootId:uuid(6),conversationId:uuid(1),hostId:uuid(2)};
const profile=`/workspace/${binding.conversationId}/.browser/profile`;
const code=expected=>error=>error?.code===expected;
const request=()=>({allocation,binding,hostIdentity,profile,scope:'browser-bash-sdk-descendants'});

function fixture({events=['populated 1\nfrozen 0\n','populated 1\nfrozen 0\n','populated 0\nfrozen 0\n'],
 leader=[undefined,null],bootId=hostIdentity.bootId,confinement={},tick=100,
 hangEventReadAt=0,hangCheckAt=0,timeoutMs=500}={}){
 const scope=hostWideCgroup({allocation,binding,hostIdentity}),groupIdentity={dev:'24',ino:'42'};
 let elapsed=0,reads=0,leaders=0,closed=0,checks=0;
 const ports={
  async openGroup(path){assert.equal(path,scope.path);return {identity:groupIdentity,
   async readEvents(){reads++;if(reads===hangEventReadAt)return new Promise(()=>{});
    return events[Math.min(reads-1,events.length-1)];},async close(){closed++;}};},
  async readLeaderCgroup(pid){assert.equal(pid,123);return leader[Math.min(leaders++,leader.length-1)]??(leaders===1?scope.sdkLeaderRelative:null);},
  async readBootId(){return bootId;},
 };
 const verifyConfinement=async input=>{
  checks++;assert.equal(input.cgroupRelative,scope.relative);assert.equal(input.sdkLeaderPid,123);
  assert.deepEqual(input.groupIdentity,groupIdentity);
  if(checks===hangCheckAt)return new Promise(()=>{});
  return {schema:HOST_CGROUP_CONFINEMENT_SCHEMA,allocationSha256:canonicalSha256(allocation),
   bindingSha256:canonicalSha256(binding),hostIdentitySha256:canonicalSha256(hostIdentity),
   groupIdentitySha256:canonicalSha256(groupIdentity),cgroupRelative:scope.relative,sdkLeaderPid:123,
   observedAtMs:Date.now(),preExecPlacement:true,allEntrypointsConfined:true,
   untrustedCgroupfsUnavailable:true,untrustedMigrationDenied:true,...confinement};
 };
 const observer=createHostWideProcessObserver({allocation,binding,hostIdentity,profile,ports,verifyConfinement,
  monotonic:()=>elapsed,pause:async()=>{elapsed+=tick;},timeoutMs,pollMs:Math.min(100,timeoutMs)});
 return {observer,scope,counts:()=>({reads,leaders,closed,checks})};
}

test('initial live SDK leader plus confinement proof and recursive populated=0 yield an exact teardown-compatible receipt',async()=>{
 const f=fixture();const armed=await f.observer.arm({sdkLeaderPid:123});
 assert.equal(armed.armed,true);assert.equal(armed.scope,f.scope.relative);
 const receipt=await f.observer.waitForExit(request());
 assert.equal(receipt.schema,HOST_PROCESS_ABSENCE_SCHEMA);
 assert.deepEqual(receipt.remainingPids,[]);assert.equal(receipt.exited,true);
 assert.equal(receipt.scope,'browser-bash-sdk-descendants');
 assert.equal(receipt.allocationSha256,canonicalSha256(allocation));
 assert.equal(receipt.bindingSha256,canonicalSha256(binding));
 assert.equal(receipt.hostIdentitySha256,canonicalSha256(hostIdentity));
 assert.deepEqual(f.counts(),{reads:3,leaders:2,closed:1,checks:4});
 await f.observer.close();assert.equal(f.counts().closed,1);
});

test('missing initial population, wrong live SDK membership or host boot identity refuses before arming',async()=>{
 for(const input of [{events:['populated 0\n']},{leader:['/other']},{bootId:uuid(7)}]){
  const f=fixture(input);
  await assert.rejects(f.observer.arm({sdkLeaderPid:123}),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
  assert.equal(f.counts().closed,1);
  await assert.rejects(f.observer.waitForExit(request()),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
 }
});

test('untrusted cgroup migration remains a mandatory, fresh launcher prerequisite',async()=>{
 for(const confinement of [
  {untrustedMigrationDenied:false},{allEntrypointsConfined:false},{untrustedCgroupfsUnavailable:false},
  {preExecPlacement:false},{hostIdentitySha256:'0'.repeat(64)},{observedAtMs:1},
 ]){
  const f=fixture({confinement});
  await assert.rejects(f.observer.arm({sdkLeaderPid:123}),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
  assert.equal(f.counts().closed,1);
 }
 assert.throws(()=>createHostWideProcessObserver({allocation,binding,hostIdentity,profile}),code('HOST_PROCESS_CONFIGURATION'),
  'no permissive production confinement verifier exists');
});

test('migrated or lingering SDK leader, nonempty cgroup, cancellation, and cross-run requests stay UNKNOWN',async()=>{
 const migrated=fixture({events:['populated 1\n','populated 0\n'],leader:[undefined,'/other']});
 await migrated.observer.arm({sdkLeaderPid:123});
 await assert.rejects(migrated.observer.waitForExit(request()),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
 const lingering=fixture({events:['populated 1\n','populated 0\n'],leader:[undefined,hostWideCgroup({allocation,binding,hostIdentity}).sdkLeaderRelative]});
 await lingering.observer.arm({sdkLeaderPid:123});
 await assert.rejects(lingering.observer.waitForExit(request()),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
 const neverEmpty=fixture({events:['populated 1\n']});await neverEmpty.observer.arm({sdkLeaderPid:123});
 await assert.rejects(neverEmpty.observer.waitForExit(request()),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
 const wrong=fixture();await wrong.observer.arm({sdkLeaderPid:123});
 for(const candidate of [
  {...request(),binding:{...binding,writerFence:2}},
  {...request(),allocation:{...allocation,generation:2}},
  {...request(),hostIdentity:{...hostIdentity,bootId:uuid(7)}},
  {...request(),scope:'browser-only'},
 ])await assert.rejects(wrong.observer.waitForExit(candidate),code('HOST_PROCESS_BINDING_REFUSED'));
 const controller=new AbortController();controller.abort();
 await assert.rejects(wrong.observer.waitForExit(request(),{signal:controller.signal}),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
});

test('the host root covers successive runs and the native port refuses unrelated paths',async()=>{
 const first=hostWideCgroup({allocation,binding,hostIdentity});
 const next=hostWideCgroup({allocation,binding:{...binding,runId:uuid(8)},hostIdentity});
 assert.equal(first.path,next.path);assert.notEqual(first.sdkLeaderRelative,next.sdkLeaderRelative);
 await assert.rejects(createLinuxHostCgroupPorts().openGroup('/tmp/unrelated'),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
});

test('stuck native event reads and launcher checks are bounded and cannot produce an absence receipt',async()=>{
 for(const input of [{hangEventReadAt:2},{hangCheckAt:2}]){
  const f=fixture({...input,timeoutMs:30,tick:1});await f.observer.arm({sdkLeaderPid:123});
  const start=Date.now();
  await assert.rejects(f.observer.waitForExit(request()),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
  assert.ok(Date.now()-start<500,'the observer does not await an uncooperative port forever');
  assert.equal(f.counts().closed,1);
 }
});

test('close during a pending arm cannot revive the observer and closes a late cgroup handle',async()=>{
 const scope=hostWideCgroup({allocation,binding,hostIdentity});let release,start,closed=0;
 const begun=new Promise(resolve=>{start=resolve;});
 const lateClosed=new Promise(resolve=>{
  const handle={identity:{dev:'24',ino:'42'},async readEvents(){return 'populated 1\n';},async close(){closed++;resolve();}};
  release=()=>deliver(handle);
 });
 let deliver;
 const ports={async openGroup(path){assert.equal(path,scope.path);start();return new Promise(resolve=>{deliver=resolve;});},
  async readLeaderCgroup(){return scope.sdkLeaderRelative;},async readBootId(){return hostIdentity.bootId;}};
 const observer=createHostWideProcessObserver({allocation,binding,hostIdentity,profile,ports,verifyConfinement:async()=>{throw Error('should not run');},armTimeoutMs:100});
 const pending=observer.arm({sdkLeaderPid:123});await begun;
 await observer.close();release();
 await assert.rejects(pending,code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
 await lateClosed;assert.equal(closed,1);
 await assert.rejects(observer.waitForExit(request()),code('HOST_PROCESS_OBSERVATION_UNKNOWN'));
});
