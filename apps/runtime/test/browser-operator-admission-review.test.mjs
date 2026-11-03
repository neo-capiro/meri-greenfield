/** PR594 review counterexamples. Real material composer; synthetic owner callbacks, no physical effects. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {operatorCaseFixture,cleanupOperatorFixture} from './browser-operator-fixture.mjs';
import {createOperatorBrowserExecutionPrerequisite} from '../browser-execution-prerequisite.mjs';
import {createOperatorBrowserAdmission,bindOperatorBrowserInvocation,operatorBrowserDeadline} from '../browser-operator-admission.mjs';
import {nativeObserverDeadline} from '../../../packages/contracts/native-observer.mjs';
import {binding} from '../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
after(cleanupOperatorFixture);
const afterMicrotasks=(count,action)=>queueMicrotask(()=>count===1?action():afterMicrotasks(count-1,action));

for(const mode of ['revoke','expire'])test(`review: ${mode} between policy completion and cached need refuses`,async()=>{
 let time=Date.now(),armed=false,invalidated=false,demandReads=0;
 const c=await operatorCaseFixture({binding,now:()=>time});c.bind();
 const p=createOperatorBrowserExecutionPrerequisite({activation:{state:'held'},now:()=>time,requestTimeoutMs:1000,effectTimeoutMs:2000,
  policy:{read:async()=>{if(armed)afterMicrotasks(6,()=>{invalidated=true;if(mode==='revoke')c.capability.revoke();else time=c.expiresAtMs;});return {enabled:true};}},
  demands:{read:async()=>{demandReads++;return true;},record:async()=>assert.fail('No write')},allocations:{ready:async()=>assert.fail('No allocation')}},c.capability);
 const input={binding,executionId:hash(binding),deadlineMs:c.expiresAtMs};
 assert.deepEqual(await p.need(input),{kind:'browser-only',hostMode:'browser-only'});armed=true;
 await assert.rejects(p.need(input));assert.equal(invalidated,true);assert.equal(demandReads,1,'no second read or positive cached answer');
});

for(const mode of ['revoke','expire'])for(const depth of [6,7])test(`review: ${mode} at demand microtask ${depth} prevents the durable write`,async()=>{
 let time=Date.now(),invalidated=false,writes=0,allocations=0;
 const c=await operatorCaseFixture({binding,now:()=>time});c.bind();
 const p=createOperatorBrowserExecutionPrerequisite({activation:{state:'held'},now:()=>time,requestTimeoutMs:1000,effectTimeoutMs:2000,
  policy:{read:async()=>{afterMicrotasks(depth,()=>{invalidated=true;if(mode==='revoke')c.capability.revoke();else time=c.expiresAtMs;});return {enabled:true};}},
  demands:{read:async()=>false,record:async()=>{writes++;}},allocations:{ready:async()=>{allocations++;return {status:'absent'};}}},c.capability);
 await assert.rejects(p.demand({binding,deadlineMs:c.expiresAtMs,executionDeadlineMs:c.expiresAtMs}));
 assert.equal(invalidated,true);assert.equal(writes,0,'no durable provisioning demand after invalidation');assert.equal(allocations,0);
});

for(const outcome of ['committed','unknown'])test(`review: revocation after ${outcome} demand preserves the original effect and refuses readiness`,async()=>{
 const c=await operatorCaseFixture({binding});c.bind();let writes=0,allocations=0,durable=false;
 const p=createOperatorBrowserExecutionPrerequisite({activation:{state:'held'},now:Date.now,requestTimeoutMs:1000,effectTimeoutMs:2000,
  policy:{read:async()=>({enabled:true})},demands:{read:async()=>durable,record:async()=>{writes++;durable=true;c.capability.revoke();if(outcome==='unknown')throw Error('acknowledgment lost');}},
  allocations:{ready:async()=>{allocations++;return {status:'absent'};}}},c.capability);
 const input={binding,deadlineMs:c.expiresAtMs,executionDeadlineMs:c.expiresAtMs};
 await assert.rejects(p.demand(input));assert.equal(writes,1);assert.equal(durable,true);assert.equal(allocations,0);
 await assert.rejects(p.need(input));await assert.rejects(p.demand(input));assert.equal(writes,1,'no retry/rollback/replacement demand');
});

test('review: real material retention bounds binding at exact cleanup boundary and one millisecond excess',async()=>{
 const time=Date.now(),expiry=time+60000,cleanup=nativeObserverDeadline(expiry);
 const exact=await operatorCaseFixture({binding,now:()=>time,expiresAtMs:expiry,cleanupCeilingMs:cleanup});
 assert.equal(exact.bind(),expiry);assert.equal(nativeObserverDeadline(operatorBrowserDeadline(exact.capability,{binding})),exact.material.retainUntilMs);
 for(const retain of [cleanup-1,expiry+1]){
  const short=await operatorCaseFixture({binding,now:()=>time,expiresAtMs:expiry,cleanupCeilingMs:retain});
  assert.throws(()=>short.bind());assert.throws(()=>operatorBrowserDeadline(short.capability,{binding}),'refused binding never gains later launch eligibility');
  let writes=0;
  const p=createOperatorBrowserExecutionPrerequisite({activation:{state:'held'},now:()=>time,requestTimeoutMs:1000,effectTimeoutMs:2000,
   policy:{read:async()=>({enabled:true})},demands:{read:async()=>true,record:async()=>{writes++;}},allocations:{ready:async()=>assert.fail('No allocation')}},short.capability);
  await assert.rejects(p.need({binding,deadlineMs:expiry}));await assert.rejects(p.demand({binding,deadlineMs:expiry,executionDeadlineMs:expiry}));assert.equal(writes,0);
 }
});

test('review: invalid, elapsed and overflowing execution windows cannot become bound capabilities',async()=>{
 let time=Date.now();const c=await operatorCaseFixture({binding,now:()=>time});
 const bind=(cap,expiresAtMs)=>bindOperatorBrowserInvocation(cap,{binding,run:{binding,state:'queued'},request:{prompt:'Synthetic ordinary request'},expiresAtMs});
 for(const expires of [0,-1,NaN,Infinity,time,time-1,time+0.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>bind(c.capability,expires));
 assert.throws(()=>operatorBrowserDeadline(c.capability,{binding}));
 const material=structuredClone(c.material);material.retainUntilMs=Number.MAX_SAFE_INTEGER;
 const enormous=createOperatorBrowserAdmission({selection:c.selection,material,sourceCommit:c.sourceCommit,expiresAtMs:Number.MAX_SAFE_INTEGER-1,now:()=>time});
 assert.throws(()=>nativeObserverDeadline(Number.MAX_SAFE_INTEGER-1));
 assert.throws(()=>bind(enormous,Number.MAX_SAFE_INTEGER-1));assert.throws(()=>operatorBrowserDeadline(enormous,{binding}));
 time=c.expiresAtMs;assert.throws(()=>bind(c.capability,time+1));
});
