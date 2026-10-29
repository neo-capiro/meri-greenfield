import test from 'node:test';
import assert from 'node:assert/strict';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {sdkChildCgroup} from './sdk-quiescence.mjs';
import {createSdkChildHold,sdkFrozenState} from './sdk-hold.mjs';
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:uuid(2),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+60000};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',bootId:uuid(6),
 conversationId:binding.conversationId,hostId:uuid(2)};
function fixture(overrides={}){
 const scope=sdkChildCgroup({allocation,binding,hostIdentity}),writes=[],identity={dev:'3',ino:'4'};
 let frozen=false,closes=0;
 const group={identity,readEvents:async()=>`populated 1\nfrozen ${Number(frozen)}\n`,
  setFrozen:async value=>{writes.push(value);frozen=value;},close:async()=>{closes++;}};
 const ports={openGroup:async path=>{assert.equal(path,scope.path);return group;},
  leaderCgroup:async pid=>{assert.equal(pid,321);return scope.relative;},bootId:async()=>hostIdentity.bootId};
 const hold=createSdkChildHold({allocation,binding,hostIdentity,ports,timeoutMs:100,pollMs:1,...overrides});
 return {hold,group,ports,writes,identity,get frozen(){return frozen;},get closes(){return closes;}};
}
test('native hold confirms the pinned subtree and never thaws on close',async()=>{
 const f=fixture();await f.hold.arm({sdkLeaderPid:321});
 const held=await f.hold.freeze();assert.equal(held.frozen,true);assert.equal(held.leaderPid,321);
 assert.notEqual(held.groupIdentity,f.identity);assert.ok(Object.isFrozen(held.groupIdentity));
 await f.hold.freeze();assert.deepEqual(f.writes,[true]);
 assert.equal((await f.hold.thaw()).frozen,false);await f.hold.freeze();await f.hold.close();
 assert.equal(f.frozen,true);assert.deepEqual(f.writes,[true,false,true]);assert.equal(f.closes,1);
 await assert.rejects(f.hold.thaw(),/HOST_SDK_HOLD_UNKNOWN/);
});
test('freeze waits for the kernel, and concurrent changes are refused',async()=>{
 const f=fixture(),waiting=Promise.withResolvers(),release=Promise.withResolvers();
 await f.hold.arm({sdkLeaderPid:321});
 const read=f.group.readEvents;
 f.group.readEvents=async()=>{if(f.writes.length){waiting.resolve();await release.promise;}return read();};
 const pending=f.hold.freeze();await waiting.promise;
 await assert.rejects(f.hold.thaw(),/HOST_SDK_HOLD_UNKNOWN/);
 release.resolve();assert.equal((await pending).frozen,true);await f.hold.close();
});
for(const fault of ['boot','leader','empty','malformed'])test(`${fault} change prevents thaw and closes the native handle`,async()=>{
 const f=fixture();await f.hold.arm({sdkLeaderPid:321});await f.hold.freeze();
 if(fault==='boot')f.ports.bootId=async()=>uuid(7);
 if(fault==='leader')f.ports.leaderCgroup=async()=>'/other';
 if(fault==='empty')f.group.readEvents=async()=> 'populated 0\nfrozen 1\n';
 if(fault==='malformed')f.group.readEvents=async()=> 'populated 1\nfrozen 1\nfrozen 0\n';
 await assert.rejects(f.hold.thaw(),/HOST_SDK_HOLD_UNKNOWN/);
 assert.deepEqual(f.writes,[true]);assert.equal(f.closes,1);
});
test('cancellation after freeze does not issue a compensating thaw',async()=>{
 const f=fixture(),abort=new AbortController();await f.hold.arm({sdkLeaderPid:321});
 const write=f.group.setFrozen;
 f.group.setFrozen=async value=>{await write(value);abort.abort();};
 await assert.rejects(f.hold.freeze({signal:abort.signal}),/HOST_SDK_HOLD_UNKNOWN/);
 assert.deepEqual(f.writes,[true]);assert.equal(f.frozen,true);assert.equal(f.closes,1);
});
test('a native group that arrives after cancellation is closed, never armed',async()=>{
 const f=fixture(),abort=new AbortController(),waiting=Promise.withResolvers();
 f.ports.openGroup=()=>waiting.promise;
 const pending=f.hold.arm({sdkLeaderPid:321,signal:abort.signal});
 await Promise.resolve();abort.abort();await assert.rejects(pending,/HOST_SDK_HOLD_UNKNOWN/);
 waiting.resolve(f.group);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.closes,1);assert.deepEqual(f.writes,[]);
});
test('kernel freeze readback requires exactly one live populated/frozen pair',()=>{
 for(const text of ['','populated 1\n','frozen 1\n','populated 0\nfrozen 1\n','populated 1\nfrozen 2\n','populated 1\npopulated 1\nfrozen 1\n'])
  assert.throws(()=>sdkFrozenState(text),/HOST_SDK_HOLD_UNKNOWN/);
 assert.equal(sdkFrozenState('populated 1\nfrozen 0\n'),false);
});

test('unknown kernel read and stalled cleanup finish within their separate budgets',async()=>{
 const f=fixture({timeoutMs:20,closeTimeoutMs:20});await f.hold.arm({sdkLeaderPid:321});
 f.group.readEvents=()=>new Promise(()=>{});f.group.close=()=>new Promise(()=>{});
 const keepAlive=setTimeout(()=>{},1000);
 try{await assert.rejects(f.hold.freeze(),/HOST_SDK_HOLD_UNKNOWN/);}
 finally{clearTimeout(keepAlive);}
 assert.deepEqual(f.writes,[]);await assert.rejects(f.hold.thaw(),/HOST_SDK_HOLD_UNKNOWN/);
});
