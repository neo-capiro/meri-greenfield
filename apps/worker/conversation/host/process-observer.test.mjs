import test from 'node:test';
import assert from 'node:assert/strict';
import {browserRunCgroup,createBrowserProcessObserver,createLinuxCgroupPorts,parseCgroupEvents,parseProcCgroup} from './process-observer.mjs';
import {HOST_ALLOCATION_SCHEMA} from './binding.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:'tenant-a',conversationId:uuid(1),generation:1,hostId:uuid(2),imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:1792425600000};
const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:uuid(1),runId:uuid(3),attemptId:uuid(4),workerId:uuid(5),writerFence:1};
const profile=`/workspace/${binding.conversationId}/.browser/profile`;
const fault=code=>error=>error?.code===code;

function fixture({events=['populated 1\nfrozen 0\n','populated 1\nfrozen 0\n','populated 0\nfrozen 0\n'],leader=[true,null],tick=100}={}){
 const scope=browserRunCgroup({allocation,binding});let time=0,closed=0,reads=0,leaders=0;
 const ports={
  async openGroup(path){assert.equal(path,scope.path);return {identity:{dev:'24',ino:'42'},async readEvents(){return events[Math.min(reads++,events.length-1)];},async close(){closed++;}};},
  async readLeaderCgroup(pid){assert.equal(pid,123);return leader[Math.min(leaders++,leader.length-1)]?scope.relative:null;},
 };
 const observer=createBrowserProcessObserver({allocation,binding,profile,ports,now:()=>time,pause:async()=>{time+=tick;},timeoutMs:500,pollMs:100});
 return {observer,scope,counts:()=>({closed,reads,leaders})};
}

test('only a live leader in the exact run cgroup, followed by recursive populated=0, proves exit',async()=>{
 const {observer,scope,counts}=fixture();
 const arm=await observer.arm({leaderPid:123});assert.equal(arm.armed,true);assert.equal(arm.scope,scope.relative);
 const result=await observer.waitForExit({binding,profile});
 assert.deepEqual(result,{exited:true,scope:scope.relative,leaderPid:123});
 assert.deepEqual(counts(),{closed:1,reads:3,leaders:2});
 await observer.close();assert.equal(counts().closed,1);
});

test('missing initial population, wrong membership, malformed events and leader migration stay UNKNOWN',async()=>{
 for(const input of [
  {events:['populated 0\n']},
  {leader:[false]},
  {events:['frozen 0\n']},
 ]){
  const f=fixture(input);await assert.rejects(f.observer.arm({leaderPid:123}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
  await assert.rejects(f.observer.waitForExit({binding,profile}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
  assert.equal(f.counts().closed,1);
 }
 const migrated=fixture({events:['populated 1\n','populated 0\n'],leader:[true,true]});
 await migrated.observer.arm({leaderPid:123});
 await assert.rejects(migrated.observer.waitForExit({binding,profile}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 assert.equal(migrated.counts().closed,1);
});

test('wait needs exact binding/profile and bounded live cgroup reads',async()=>{
 const f=fixture({events:['populated 1\n']});
 await assert.rejects(f.observer.waitForExit({binding,profile}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 const armed=fixture({events:['populated 1\n']});await armed.observer.arm({leaderPid:123});
 await assert.rejects(armed.observer.waitForExit({binding:{...binding,writerFence:2},profile}),fault('BROWSER_PROCESS_BINDING_REFUSED'));
 await assert.rejects(armed.observer.waitForExit({binding,profile:'/tmp/other',exited:true}),fault('BROWSER_PROCESS_BINDING_REFUSED'));
 await assert.rejects(armed.observer.waitForExit({binding,profile,exited:true}),fault('BROWSER_PROCESS_BINDING_REFUSED'));
 await assert.rejects(armed.observer.waitForExit({binding,profile}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 assert.equal(armed.counts().closed,1);
 const cancelled=fixture();await cancelled.observer.arm({leaderPid:123});
 const controller=new AbortController();controller.abort();
 await assert.rejects(cancelled.observer.waitForExit({binding,profile},{signal:controller.signal}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 assert.equal(cancelled.counts().closed,1);
});

test('Linux port refuses an unrelated path before opening it; kernel text has closed decoding',async()=>{
 await assert.rejects(createLinuxCgroupPorts().openGroup('/tmp/browser'),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 assert.equal(parseCgroupEvents('populated 0\nfrozen 0\n'),0);
 const runCgroup=browserRunCgroup({allocation,binding});
 const hostRoot=`/meri/hosts/${allocation.hostId}-${allocation.generation}`;
 assert.equal(runCgroup.relative,`${hostRoot}/${canonicalSha256(binding)}/browser`);
 assert.equal(runCgroup.path,`/sys/fs/cgroup${runCgroup.relative}`);
 assert.equal(parseProcCgroup(`0::${runCgroup.relative}\n`),runCgroup.relative);
 assert.throws(()=>parseCgroupEvents('populated 0\npopulated 1\n'),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 assert.throws(()=>parseProcCgroup('/not-a-record'),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 assert.notEqual(browserRunCgroup({allocation,binding}).path,browserRunCgroup({allocation,binding:{...binding,writerFence:2}}).path);
});

test('stalled native reads cannot leave exit observation pending or report success',async()=>{
 const scope=browserRunCgroup({allocation,binding});let reads=0,closed=0;
 const observer=createBrowserProcessObserver({allocation,binding,profile,timeoutMs:20,pollMs:1,ports:{
  async openGroup(){return {identity:{dev:'1',ino:'2'},async readEvents(){return reads++===0?'populated 1\n':new Promise(()=>{});},async close(){closed++;}};},
  async readLeaderCgroup(){return scope.relative;},
 }});
 await observer.arm({leaderPid:123});
 await assert.rejects(observer.waitForExit({binding,profile}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 assert.equal(closed,1);
});

test('close during pending arm never revives the observer and disposes the late group',async()=>{
 const scope=browserRunCgroup({allocation,binding});let releaseOpen,closed=0;
 const opened=new Promise(resolve=>{releaseOpen=resolve;});
 const observer=createBrowserProcessObserver({allocation,binding,profile,timeoutMs:100,pollMs:1,ports:{
  openGroup(){return opened;},async readLeaderCgroup(){return scope.relative;},
 }});
 const arming=observer.arm({leaderPid:123});
 await observer.close();
 releaseOpen({identity:{dev:'1',ino:'2'},async readEvents(){return 'populated 1\n';},async close(){closed++;}});
 await assert.rejects(arming,fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 assert.equal(closed,1);
 await assert.rejects(observer.waitForExit({binding,profile}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
});

test('timed-out arm disposes a group if the native open completes later',async()=>{
 let releaseOpen,closed=0;
 const opened=new Promise(resolve=>{releaseOpen=resolve;});
 const observer=createBrowserProcessObserver({allocation,binding,profile,timeoutMs:10,pollMs:1,ports:{
  openGroup(){return opened;},async readLeaderCgroup(){throw Error('should not read');},
 }});
 await assert.rejects(observer.arm({leaderPid:123}),fault('BROWSER_PROCESS_OBSERVATION_UNKNOWN'));
 releaseOpen({identity:{dev:'1',ino:'2'},async readEvents(){return 'populated 1\n';},async close(){closed++;}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(closed,1);
});
