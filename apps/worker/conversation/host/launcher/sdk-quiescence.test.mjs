import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createSdkChildQuiescenceObserver,createSdkLaunchGate,createSdkQuiescenceReader,sdkChildCgroup,SDK_QUIESCENT_SCHEMA} from './sdk-quiescence.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:uuid(2),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+60000};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',bootId:uuid(6),
 conversationId:binding.conversationId,hostId:uuid(2)};
const networkProof={kind:'sdk',allocationSha256:canonicalSha256(allocation),bindingSha256:canonicalSha256(binding),
 namespaceDev:'42',namespaceIno:'84'};
function fixture(events=['populated 1\n','populated 0\n','populated 0\n'],leader=[sdkChildCgroup({allocation,binding,hostIdentity}).relative,null]){
 const scope=sdkChildCgroup({allocation,binding,hostIdentity});let reads=0,lookups=0,closes=0;
 const ports={async openGroup(path){assert.equal(path,scope.path);return {identity:{dev:'3',ino:'4'},
  async readEvents(){return events[Math.min(reads++,events.length-1)];},async close(){closes++;}};},
  async leaderCgroup(pid){assert.equal(pid,321);return leader[Math.min(lookups++,leader.length-1)];},
  async bootId(){return hostIdentity.bootId;}};
 return {observer:createSdkChildQuiescenceObserver({allocation,binding,hostIdentity,ports,timeoutMs:100,pollMs:1}),
  get closes(){return closes;}};
}
test('armed SDK child must become empty before exact frozen-network receipt',async()=>{
 const f=fixture(),gate=createSdkLaunchGate();
 await f.observer.arm({sdkLeaderPid:321});
 const held=gate.freeze(),read=createSdkQuiescenceReader({observer:f.observer,allocation,binding,networkProof,
  assertLaunchFrozen:held.assertFrozen});
 const receipt=await read({allocation,binding,networkProof});
 assert.equal(receipt.schema,SDK_QUIESCENT_SCHEMA);assert.equal(receipt.sdkChildEmpty,true);
 assert.equal(receipt.namespaceIno,'84');assert.equal(f.closes,1);
 await assert.rejects(read({allocation,binding,networkProof}),/HOST_SDK_QUIESCENCE_UNKNOWN/);
 held.release();assert.equal(gate.state,'idle');
});
test('empty group without initial SDK leader, or a live/migrated leader, is never quiescent',async()=>{
 const empty=fixture(['populated 0\n']);
 await assert.rejects(empty.observer.arm({sdkLeaderPid:321}),/HOST_SDK_QUIESCENCE_UNKNOWN/);
 const moved=fixture(['populated 1\n','populated 0\n'],[sdkChildCgroup({allocation,binding,hostIdentity}).relative,'/outside']);
 await moved.observer.arm({sdkLeaderPid:321});
 await assert.rejects(moved.observer.waitQuiescent(),/HOST_SDK_QUIESCENCE_UNKNOWN/);
 const gate=createSdkLaunchGate(),release=gate.enter();assert.throws(()=>gate.freeze(),/HOST_SDK_QUIESCENCE_UNKNOWN/);
 release();const held=gate.freeze();assert.throws(()=>gate.enter(),/HOST_SDK_QUIESCENCE_UNKNOWN/);held.release();
});
test('late cgroup open is disposed and never revives an expired arm',async()=>{
 let resolveOpen,closed=0;
 const ports={openGroup:()=>new Promise(resolve=>{resolveOpen=resolve;}),leaderCgroup:async()=>null,bootId:async()=>hostIdentity.bootId};
 const observer=createSdkChildQuiescenceObserver({allocation,binding,hostIdentity,ports,timeoutMs:20,pollMs:1});
 await assert.rejects(observer.arm({sdkLeaderPid:321}),/HOST_SDK_QUIESCENCE_UNKNOWN/);
 resolveOpen({identity:{dev:'3',ino:'4'},readEvents:async()=> 'populated 0\n',async close(){closed++;}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(closed,1);
});
test('group returned after elapsed deadline is disposed even before arm changes state',async()=>{
 let clock=0,closed=0;
 const ports={async openGroup(){clock=30;return {identity:{dev:'3',ino:'4'},readEvents:async()=> 'populated 1\n',
  async close(){closed++;}};},leaderCgroup:async()=>null,bootId:async()=>hostIdentity.bootId};
 const observer=createSdkChildQuiescenceObserver({allocation,binding,hostIdentity,ports,timeoutMs:20,pollMs:1,
  now:()=>clock});
 await assert.rejects(observer.arm({sdkLeaderPid:321}),/HOST_SDK_QUIESCENCE_UNKNOWN/);
 assert.equal(closed,1);
});
test('concurrent close calls await the same native group close',async()=>{
 const f=fixture();await f.observer.arm({sdkLeaderPid:321});
 const first=f.observer.close(),second=f.observer.close();
 assert.strictEqual(first,second);await first;assert.equal(f.closes,1);
});
test('unsettled close and concurrent cancellation cannot report quiescence',async()=>{
 const scope=sdkChildCgroup({allocation,binding,hostIdentity});let reads=0,release;
 const ports={openGroup:async()=>({identity:{dev:'3',ino:'4'},
  readEvents:()=>++reads===1?Promise.resolve('populated 1\n'):new Promise(resolve=>{release=resolve;}),
  close:()=>new Promise(()=>{})}),leaderCgroup:async()=>scope.relative,bootId:async()=>hostIdentity.bootId};
 const observer=createSdkChildQuiescenceObserver({allocation,binding,hostIdentity,ports,timeoutMs:100,pollMs:1,closeTimeoutMs:10});
 await observer.arm({sdkLeaderPid:321});const pending=observer.waitQuiescent();pending.catch(()=>{});
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(observer.close(),/HOST_SDK_QUIESCENCE_UNKNOWN/);
 release('populated 0\n');
 await assert.rejects(pending,/HOST_SDK_QUIESCENCE_UNKNOWN/);
});
