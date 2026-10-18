/** SYNTHETIC: option B read consent beside the routine's approval (lane RD) through the actual routines service, runtime context,
 * schedule owner (scripted SQL, migration 0004 column) and Temporal wire fixture. The consent port is scripted here; the real port
 * over consent.mjs, the Core client and the action-session owner is proven in
 * apps/runtime/native-authority/read-delegation/test/routine-consents.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {applicationFixture,routineRequest,binding,clientId,id,NOW} from './application-fixture.mjs';
import {ROUTINE_READ_CONSENT_EVENTS,createRoutineReadConsentLifecycle} from '../read-consent-lifecycle.mjs';
const DAY=86400000;
/** The runtime port's interface (native-authority/read-delegation/routine-consents.mjs), scripted. */
function scriptedConsents(){
 const calls=[],state={failApprove:null,failNarrow:null,failResume:null};let n=0;
 const record=(method,{signal,...input})=>calls.push({method,...input});
 const port=Object.freeze({
  async approve(input){record('approve',input);if(state.failApprove)throw state.failApprove;return {consentId:id(900+n++),state:'active',createdAtMs:NOW,expiresAtMs:Math.min(input.scheduleEndsAtMs??Infinity,NOW+30*DAY),operationsDigest:'a'.repeat(64)};},
  async narrow(input){record('narrow',input);if(state.failNarrow)throw state.failNarrow;return {consentId:input.consentId,state:input.state};},
  async resume(input){record('resume',input);if(state.failResume)throw state.failResume;return {consentId:input.consentId,state:'active'};},
 });
 return {port,calls,state,last:()=>calls.at(-1)};
}
const stored=(f,scheduleId)=>f.owner.readReadConsent({tenantId:binding.tenantId,scheduleId},()=>{});
const cancelRequest=(scheduleId,mode)=>({scheduleId,mode,note:'Explicit '+mode,running:'leave',runs:[]});

test('the owner approval creates the read consent for the exact schedule, client, policy and projection; replay creates none; option B off is byte-for-byte the same',async()=>{
 const s=scriptedConsents(),events=[],f=await applicationFixture({readConsents:s.port,log:e=>events.push(e)}),g=await applicationFixture();
 try{
  const prepared=await f.prepare(),result=await f.approve(prepared);assert.equal(result.status,'acknowledged');
  const p=result.receipt.projection,scheduleId=p.scheduleId;
  assert.equal(s.calls.length,1);const call=s.calls[0];
  assert.equal(call.method,'approve');assert.deepEqual(call.attended,{binding,selectedClientId:clientId},'the approving request\'s own session selection');
  assert.equal(call.scheduleId,scheduleId);assert.equal(call.clientId,clientId);assert.equal(call.policyRevision,'p1');assert.equal(call.scheduleProjectionSha256,hash(p));assert.equal(call.scheduleEndsAtMs,null);
  assert.ok(Number.isSafeInteger(call.deadlineMs)&&call.deadlineMs<=NOW+5000);
  assert.deepEqual(await stored(f,scheduleId),{consentId:id(900),state:'active',createdAtMs:NOW,expiresAtMs:NOW+30*DAY,scheduleProjectionSha256:hash(p),operationsDigest:'a'.repeat(64)});
  // Replay of the acknowledged approval touches no consent.
  assert.deepEqual(await f.approve(prepared),result);assert.equal(s.calls.length,1);
  // Option B off: the same approval, byte for byte, with no consent port, no consent call and no consent row.
  const other=await g.approve(await g.prepare());assert.deepEqual(other,result);assert.equal(await stored(g,scheduleId),null);
  assert.deepEqual(events,[]);
  // The schedule's end bounds the consent request.
  const ending=routineRequest();ending.policy.spec.endAt=new Date(NOW+3*DAY).toISOString();
  await f.approve(await f.prepare(ending,'schedule_task','request-ending'),ending);assert.equal(s.last().scheduleEndsAtMs,NOW+3*DAY);
 }finally{await f.close();await g.close();}
});
test('pause narrows the consent, an update restoring the approved projection resumes it from the live session, a scope change makes a new consent, delete revokes',async()=>{
 const s=scriptedConsents(),events=[],f=await applicationFixture({readConsents:s.port,log:e=>events.push(e)});
 try{
  const prepared=await f.prepare(),result=await f.approve(prepared),p=result.receipt.projection,scheduleId=p.scheduleId;
  const pause=cancelRequest(scheduleId,'pause'),paused=await f.approve(await f.prepare(pause,'cancel_scheduled_task','request-pause'),pause);
  assert.equal(paused.receipt.projection.state,'paused');assert.equal(f.temporal.calls.patch,1);
  assert.equal(s.last().method,'narrow');assert.equal(s.last().consentId,id(900));assert.equal(s.last().state,'paused');assert.equal((await stored(f,scheduleId)).state,'paused');
  // Pausing a paused consent again narrows nothing.
  const calls=s.calls.length;const again=cancelRequest(scheduleId,'pause');await f.approve(await f.prepare(again,'cancel_scheduled_task','request-pause-again'),again);assert.equal(s.calls.length,calls);
  // Resume: the approved policy with paused:false restores the approved projection digest, so the same consent resumes (live login).
  const resume={scheduleId,...routineRequest()},resumed=await f.approve(await f.prepare(resume,'update_scheduled_task','request-resume'),resume);
  assert.equal(resumed.receipt.projection.state,'active');assert.equal(hash(resumed.receipt.projection),hash(p));assert.equal(f.temporal.calls.update,1);
  assert.equal(s.last().method,'resume');assert.equal(s.last().consentId,id(900));assert.deepEqual(s.last().attended,{binding,selectedClientId:clientId});
  assert.deepEqual(await stored(f,scheduleId),{consentId:id(900),state:'active',createdAtMs:NOW,expiresAtMs:NOW+30*DAY,scheduleProjectionSha256:hash(p),operationsDigest:'a'.repeat(64)});
  // An update that leaves the projection as approved needs no consent change.
  const same={scheduleId,...routineRequest()};const before=s.calls.length;await f.approve(await f.prepare(same,'update_scheduled_task','request-same'),same);assert.equal(s.calls.length,before);
  // A changed timezone is a projection change: a new consent for the new digest (a limit already clamped by the allocation is not).
  const changed={scheduleId,...routineRequest()};changed.policy.spec.timezone='America/New_York';
  const updated=await f.approve(await f.prepare(changed,'update_scheduled_task','request-changed'),changed);assert.notEqual(hash(updated.receipt.projection),hash(p));
  assert.equal(s.last().method,'approve');assert.equal(s.last().scheduleProjectionSha256,hash(updated.receipt.projection));
  const second=await stored(f,scheduleId);assert.equal(second.consentId,id(901));assert.equal(second.state,'active');assert.equal(second.scheduleProjectionSha256,hash(updated.receipt.projection));
  // Delete revokes the consent in force.
  const remove=cancelRequest(scheduleId,'delete'),removed=await f.approve(await f.prepare(remove,'cancel_scheduled_task','request-delete'),remove);
  assert.equal(removed.receipt.projection.state,'cancelled');assert.equal(f.temporal.calls.delete,1);
  assert.equal(s.last().method,'narrow');assert.equal(s.last().consentId,id(901));assert.equal(s.last().state,'revoked');assert.equal((await stored(f,scheduleId)).state,'revoked');
  assert.deepEqual(events,[]);
 }finally{await f.close();}
});
test('a consent that cannot be approved refuses the routine before anything is dispatched; a failed narrowing is reported and the pause proceeds',async()=>{
 const s=scriptedConsents(),events=[],f=await applicationFixture({readConsents:s.port,log:e=>events.push(e)});
 try{
  s.state.failApprove=Object.assign(Error('synthetic consent refused'),{code:'UNAVAILABLE'});
  const prepared=await f.prepare(),error=await f.approve(prepared).then(()=>null,e=>e);
  assert.equal(error?.code,'ROUTINES_READ_CONSENT_REFUSED');assert.equal(error.outcome,'NOT_DISPATCHED');assert.equal(f.temporal.calls.create,0);assert.equal(f.sql.state.projections.size,0);
  // A deadline or cancellation of the consent call keeps its own code.
  s.state.failApprove=Object.assign(Error('DEADLINE'),{code:'DEADLINE'});await assert.rejects(f.approve(prepared),e=>e.code==='DEADLINE');assert.equal(f.temporal.calls.create,0);
  // The same retained proposal is approved once the consent can be.
  s.state.failApprove=null;const result=await f.approve(prepared);assert.equal(result.status,'acknowledged');const scheduleId=result.receipt.projection.scheduleId;
  s.state.failNarrow=Object.assign(Error('synthetic narrow outage'),{code:'UNAVAILABLE'});
  const pause=cancelRequest(scheduleId,'pause'),paused=await f.approve(await f.prepare(pause,'cancel_scheduled_task','request-pause'),pause);
  assert.equal(paused.receipt.projection.state,'paused');assert.equal(f.temporal.calls.patch,1);
  assert.deepEqual(events,[{event:ROUTINE_READ_CONSENT_EVENTS.narrowFailed,operation:'cancel_scheduled_task',scheduleId,consentId:id(900),state:'paused',code:'UNAVAILABLE'}]);
  assert.equal((await stored(f,scheduleId)).state,'active','the record keeps Core\'s last known state');
  // A resume that fails is a refusal: nothing dispatched.
  s.state.failNarrow=null;const retry=cancelRequest(scheduleId,'pause');await f.approve(await f.prepare(retry,'cancel_scheduled_task','request-pause-retry'),retry);assert.equal((await stored(f,scheduleId)).state,'paused');
  s.state.failResume=Object.assign(Error('refused'),{code:'ACCESS_DENIED'});const resume={scheduleId,...routineRequest()};
  const refused=await f.approve(await f.prepare(resume,'update_scheduled_task','request-resume'),resume).then(()=>null,e=>e);
  assert.equal(refused?.code,'ROUTINES_READ_CONSENT_REFUSED');assert.equal(refused.outcome,'NOT_DISPATCHED');assert.equal(f.temporal.calls.update,0);
 }finally{await f.close();}
});
test('a mutation that is not dispatched revokes the consent created for it; a routine created or updated paused carries no consent until it is resumed',async()=>{
 const s=scriptedConsents(),events=[],f=await applicationFixture({readConsents:s.port,log:e=>events.push(e)});
 try{
  f.state.refusePhase='before_claim';
  const prepared=await f.prepare(),error=await f.approve(prepared).then(()=>null,e=>e);
  assert.equal(error?.outcome,'NOT_DISPATCHED');assert.deepEqual(s.calls.map(c=>c.method),['approve','narrow']);assert.equal(s.calls[1].consentId,id(900));assert.equal(s.calls[1].state,'revoked');
  f.state.refusePhase=null;assert.deepEqual(events,[]);
  // Created paused: a paused schedule never fires, so no consent is created.
  const pausedRequest=routineRequest();pausedRequest.policy.paused=true;
  const created=await f.approve(await f.prepare(pausedRequest,'schedule_task','request-paused'),pausedRequest);const scheduleId=created.receipt.projection.scheduleId;
  assert.equal(created.receipt.projection.state,'paused');assert.equal(s.calls.length,2);assert.equal(await stored(f,scheduleId),null);
  // Resumed by update: the first consent for this schedule.
  const resume={scheduleId,...routineRequest()},resumed=await f.approve(await f.prepare(resume,'update_scheduled_task','request-resume'),resume);
  assert.equal(resumed.receipt.projection.state,'active');assert.equal(s.last().method,'approve');assert.equal((await stored(f,scheduleId)).consentId,id(901));
  // Updated paused: the consent narrows; nothing new is created.
  const pauseUpdate={scheduleId,...routineRequest()};pauseUpdate.policy.paused=true;
  await f.approve(await f.prepare(pauseUpdate,'update_scheduled_task','request-pause-update'),pauseUpdate);
  assert.equal(s.last().method,'narrow');assert.equal(s.last().state,'paused');assert.equal(s.last().consentId,id(901));assert.equal((await stored(f,scheduleId)).state,'paused');
  assert.deepEqual(events,[]);
 }finally{await f.close();}
});
test('the lifecycle refuses a malformed port or owner at construction',()=>{
 const owner={async readReadConsent(){},async recordReadConsent(){}};
 for(const bad of [undefined,{},{approve(){},narrow(){}},{approve(){},narrow(){},resume:'x'},{approve(){},narrow(){},resume(){},extra(){}}])
  assert.throws(()=>createRoutineReadConsentLifecycle({readConsents:bad,scheduleOwner:owner,now:Date.now}),{code:'ROUTINES_CONFIGURATION'});
 assert.throws(()=>createRoutineReadConsentLifecycle({readConsents:{approve(){},narrow(){},resume(){}},scheduleOwner:{},now:Date.now}));
 assert.throws(()=>createRoutineReadConsentLifecycle({readConsents:{approve(){},narrow(){},resume(){}},scheduleOwner:owner,now:Date.now,log:'x'}),{code:'ROUTINES_CONFIGURATION'});
});
