/** SYNTHETIC MR-04 consumer slice over the REAL routines application owner and the REAL schedule owner fixture: the
 * truthful read-consent observation of the public list, and the explicit review-then-approved renewal. Core is scripted
 * to its own canonical decisions (no live Core, model, provider, database or browser); the schedule-owned journal is the
 * REAL production custody module over a scripted SQL boundary, and it is the ONLY place a renewal decision is durable. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {randomUUID} from 'node:crypto';
import {applicationFixture,routineRequest,binding,clientId,NOW} from './application-fixture.mjs';
import {createRoutineManagementPreparations} from '../management-preparations.mjs';
import {createRoutinesCoreClient} from '../../../runtime/native-authority/routines-core-client.mjs';

const code=expected=>error=>error?.code===expected;
/** Core's own answering order for wire D: the newest stored row for this owner and schedule; `absent` carrying the
 *  stored generation when that row does not pin the request, and `absent` carrying nothing when there is no row. */
function answer(value,rows,nowMs){
 const stored=rows.filter(row=>row.scheduleId===value.scheduleId&&row.ownerActorId===value.ownerActorId);
 if(!stored.length)return {schemaVersion:1,state:'absent',pinsMatched:false,observedAtMs:nowMs,generation:value.generation,consentGeneration:null,issuedAtMs:null,expiresAtMs:null,scopeCount:null,cause:null,rightsSha256:null};
 const exact=stored.find(row=>row.generation===value.generation&&row.intentSha256===value.intentSha256&&row.projectionSha256===value.projectionSha256);
 if(!exact){const newest=[...stored].sort((a,b)=>b.generation-a.generation)[0];
  return {schemaVersion:1,state:'absent',pinsMatched:false,observedAtMs:nowMs,generation:value.generation,consentGeneration:newest.generation,issuedAtMs:newest.issuedAtMs,expiresAtMs:newest.expiresAtMs,scopeCount:newest.scopeCount,cause:null,rightsSha256:null};}
 const state=exact.expiresAtMs>nowMs?'active':'expired';
 return {schemaVersion:1,state,pinsMatched:true,observedAtMs:nowMs,generation:value.generation,consentGeneration:exact.generation,issuedAtMs:exact.issuedAtMs,expiresAtMs:exact.expiresAtMs,scopeCount:exact.scopeCount,cause:null,rightsSha256:state==='active'?exact.rightsSha256:null};
}
/** The scripted Core wire D. It answers only for the pins it was given, records every ask and can refuse or lie. */
function coreObservation(){
 const state={rows:[],calls:[],refuse:null,override:null,nowMs:NOW};
 return {state,port:async value=>{state.calls.push(value);
  if(state.refuse!==null)throw Object.assign(Error('ROUTINES_CORE_'+state.refuse),{code:'ROUTINES_CORE_'+state.refuse});
  return state.override??answer(value,state.rows,state.nowMs);}};
}
/** The REAL schedule-owned journal (the production module) over a scripted SQL boundary: the module's own key, record,
 *  outcome, identity and terminal-state validation all run, so what the application calls is exactly what production
 *  calls. No injected method stands in for the journal and no test-only API exists. */
function managementJournal(){
 const rows=new Map(),state={loseCommit:false},pk=v=>[v[0],v[1],v[2],v[3]].join('|');
 const pool={async connect(){return {async query(text,v=[]){
  if(text==='COMMIT'){if(state.loseCommit){state.loseCommit=false;throw Error('synthetic commit acknowledgement loss');}return {rows:[],rowCount:0};}
  if(text.startsWith('BEGIN')||text==='ROLLBACK'||text.startsWith('SET LOCAL'))return {rows:[],rowCount:0};
  if(text.startsWith('INSERT INTO meri_schedules.management_preparations')){
   if(rows.has(pk(v)))return {rows:[],rowCount:0};
   rows.set(pk(v),{tenant_id:v[0],actor_id:v[1],scope_sha256:v[2],request_id:v[3],claim_id:v[4],record:structuredClone(v[5]),record_sha256:v[6],state:'PENDING',proposal_id:null,outcome:null,settled_at:null});
   return {rows:[],rowCount:1};}
  if(text.startsWith('SELECT tenant_id,actor_id,scope_sha256')){
   if(text.includes('proposal_id=$4'))return {rows:[],rowCount:0};
   const row=rows.get(pk(v));return {rows:row?[structuredClone(row)]:[],rowCount:row?1:0};}
  if(text.startsWith('UPDATE meri_schedules.management_preparations')){
   const row=rows.get(pk(v));if(!row)return {rows:[],rowCount:0};
   Object.assign(row,{state:v[4],proposal_id:v[5],outcome:structuredClone(v[6]),settled_at:new Date().toISOString()});
   return {rows:[structuredClone(row)],rowCount:1};}
  throw Error('unexpected management preparation SQL: '+text);
 },release(){}};}};
 return {rows,state,store:createRoutineManagementPreparations({pool})};
}
/** The scripted Core wire E: it re-decides the binding digest, the caller identity, the proposal identity, the approval
 *  identity and window, and it keeps the FIRST window for a repeated decision digest — exactly as the stored row does. */
function coreRenewal(){
 const state={calls:[],windows:new Map(),fail:null};
 return {state,port:async value=>{
  state.calls.push(structuredClone({binding:value.binding,selectedClientId:value.selectedClientId,tenantId:value.tenantId,ownerActorId:value.ownerActorId,intent:value.intent,intentSha256:value.intentSha256,approval:value.approval}));
  if(state.fail!==null)throw Object.assign(Error('ROUTINES_CORE_'+state.fail),{code:'ROUTINES_CORE_'+state.fail});
  const decision=hash(value.approval),existing=state.windows.get(decision);
  if(existing)return {...existing,idempotent:true};
  const window={state:'active',generation:value.intent.generation,policyRevision:value.intent.projection.scopes[0].policyRevision,issuedAtMs:NOW,expiresAtMs:NOW+2592000000,observedAtMs:NOW,idempotent:false};
  state.windows.set(decision,window);return window;}};
}
/** The real owner's current acknowledged intent, read through the owner's own selection (never reconstructed). */
const intentOf=async(f,intentId)=>{assert.equal(typeof intentId,'string','intentId must be the acknowledged receipt intentId');return await f.owner.readIntent({tenantId:binding.tenantId,intentId},()=>{});};
const owned=async(options={})=>{const f=await applicationFixture(options);const prepared=await f.prepare();const receipt=await f.approve(prepared);
 return {f,prepared,receipt,intent:(await intentOf(f,receipt.receipt.intentId)).intent};};

test('MR-04 visibility: every listed row carries its own truthful consent observation, released after a fresh current check',async t=>{
 const observation=coreObservation(),{f,receipt,intent}=await owned({consentObservation:observation.port});t.after(f.close);
 const listed=await f.call('list',{limit:20,observation:'consent'});
 assert.equal(listed.page.rows.length,1);
 const row=listed.page.rows[0],scheduleId=row.projection.scheduleId;
 assert.deepEqual(Object.keys(row).sort(),['consent','generation','inspection','inspectionState','projection','trigger','unresolved']);
 // Core has no stored row for this owner and schedule: absent, and that is Core's own statement.
 assert.deepEqual(row.consent,{state:'absent',pinsMatched:false,stale:false,observedAtMs:NOW,generation:receipt.receipt.generation,consentGeneration:null,issuedAtMs:null,expiresAtMs:null,scopeCount:null,cause:null,rightsSha256:null});
 const pins=observation.state.calls.at(-1);
 assert.equal(pins.tenantId,binding.tenantId);assert.equal(pins.ownerActorId,binding.actorId);assert.equal(pins.scheduleId,scheduleId);
 assert.equal(pins.generation,receipt.receipt.generation);assert.equal(pins.intentSha256,hash(intent));assert.equal(pins.projectionSha256,hash(row.projection));
 assert.equal(pins.deadlineMs,NOW+4500);assert.ok(pins.signal instanceof AbortSignal);
 assert.deepEqual(Object.keys(pins).sort(),['deadlineMs','generation','intentSha256','ownerActorId','projectionSha256','scheduleId','signal','tenantId']);
 const policies=f.state.policies.length;
 // An active stored consent, then the same row lapsed: observed expiry is reported as its own value, never as the projection's state.
 observation.state.rows=[{scheduleId,ownerActorId:binding.actorId,generation:receipt.receipt.generation,intentSha256:hash(intent),projectionSha256:hash(row.projection),issuedAtMs:NOW-1000,expiresAtMs:NOW+60000,scopeCount:1,rightsSha256:'a'.repeat(64)}];
 const active=(await f.call('list',{limit:20,observation:'consent'})).page.rows[0];
 assert.equal(active.projection.state,'active');assert.equal(active.consent.state,'active');assert.equal(active.consent.expiresAtMs,NOW+60000);
 assert.equal(active.consent.rightsSha256,'a'.repeat(64));assert.equal(active.consent.scopeCount,1);assert.equal(active.consent.stale,false);
 observation.state.rows[0].expiresAtMs=NOW-1000;
 const lapsed=(await f.call('list',{limit:20,observation:'consent'})).page.rows[0];
 assert.equal(lapsed.projection.state,'active');assert.equal(lapsed.consent.state,'expired');assert.equal(lapsed.consent.expiresAtMs,NOW-1000);
 assert.equal(lapsed.consent.rightsSha256,null);
 // The observation is released only after this request's own fresh current scope/generation authorization.
 assert.ok(f.state.policies.length>policies);
});

test('MR-04: unavailable is not absent, a stored row that does not pin is a re-read, and no acknowledged intent claims nothing',async t=>{
 const observation=coreObservation(),{f,receipt,intent}=await owned({consentObservation:observation.port});t.after(f.close);
 const row=(await f.call('list',{limit:20,observation:'consent'})).page.rows[0],scheduleId=row.projection.scheduleId,pins=observation.state.calls.at(-1);
 // 1. A refused or unavailable Core is unknown, never a fabricated absence.
 for(const refuse of ['UNAVAILABLE','REFUSED']){
  observation.state.refuse=refuse;const refused=(await f.call('list',{limit:20,observation:'consent'})).page.rows[0].consent;
  assert.equal(refused.state,'unknown');assert.equal(refused.observedAtMs,null);assert.equal(refused.stale,false);
 }
 observation.state.refuse=null;
 // 2. A stored row that pins another generation is a re-read: unknown and stale, never absent. A stored row for ANOTHER
 // generation of this same schedule exists, it does not pin these bytes, and Core's own answer is therefore
 // absent-with-a-row rather than a declaration that no consent exists. The row's pins are read back once, and because
 // they did not move the same answer stands: one ask, never a duplicated call and never a loop.
 observation.state.rows=[{scheduleId,ownerActorId:binding.actorId,generation:receipt.receipt.generation+1,intentSha256:hash(intent),projectionSha256:hash(row.projection),issuedAtMs:NOW-2000,expiresAtMs:NOW+60000,scopeCount:1,rightsSha256:'b'.repeat(64)}];
 const before=observation.state.calls.length,stale=(await f.call('list',{limit:20,observation:'consent'})).page.rows[0].consent;
 assert.equal(stale.state,'unknown');assert.equal(stale.stale,true);assert.equal(observation.state.calls.length-before,1);
 // 3. A malformed answer is unknown too (an extra member, or an active consent with no rights digest).
 observation.state.override={...answer(pins,observation.state.rows,NOW),state:'active',pinsMatched:true,rightsSha256:null};
 assert.equal((await f.call('list',{limit:20,observation:'consent'})).page.rows[0].consent.state,'unknown');
 observation.state.override={...answer(pins,[],NOW),extra:true};
 assert.equal((await f.call('list',{limit:20,observation:'consent'})).page.rows[0].consent.state,'unknown');
 observation.state.override=null;observation.state.rows=[];
 // 4. A generation with no acknowledged intent has nothing to pin: the list releases no schedule row for it, and Core
 // is never asked to speak about one. Nothing is inferred, and nothing is fabricated in place of a missing intent.
 const plain=await applicationFixture({consentObservation:observation.port});t.after(plain.close);
 await plain.prepare();const asked=observation.state.calls.length;
 assert.equal((await plain.call('list',{limit:20})).page.rows.length,0);
 assert.equal(observation.state.calls.length,asked);
});

test('MR-04 renewal review: the exact original intent, its scopes and limits, and the current consent condition',async t=>{
 const observation=coreObservation(),renewal=coreRenewal(),journal=managementJournal();
 const {f,receipt,intent}=await owned();t.after(f.close);
 const scheduleId=receipt.receipt.projection.scheduleId;
 const held=await applicationFixture({consentObservation:observation.port,consentRenewal:renewal.port,managementPreparations:journal.store});
 t.after(held.close);
 const prepared=await held.prepare();const approved=await held.approve(prepared);const stored=await intentOf(held,approved.receipt.intentId);
 observation.state.rows=[{scheduleId,ownerActorId:binding.actorId,generation:stored.intent.generation,intentSha256:hash(stored.intent),projectionSha256:hash(stored.intent.projection),issuedAtMs:NOW-1000,expiresAtMs:NOW-500,scopeCount:1,rightsSha256:null}];
 const review=await held.call('consentReview',{scheduleId});
 assert.equal(review.status,'review_required');assert.equal(review.generation,stored.intent.generation);
 assert.deepEqual(review.intent,stored.intent);
 assert.equal(review.intentSha256,hash(stored.intent));assert.equal(review.projectionSha256,hash(stored.intent.projection));
 assert.equal(review.scopesSha256,hash(stored.intent.projection.scopes));
 assert.deepEqual(review.limits,{maxCostMicrousd:stored.intent.projection.maxCostMicrousd,maxRuntimeSeconds:stored.intent.projection.maxRuntimeSeconds,retryLimit:stored.intent.projection.retryLimit});
 // The reviewed limits are the effective projection limits (the selected skill's own budgets cap the request), never
 // the request's asked-for numbers: the review shows the user what the routine will actually spend.
 assert.deepEqual(review.limits,{maxCostMicrousd:1000,maxRuntimeSeconds:60,retryLimit:0});
 assert.equal(review.consent.state,'expired');
 // The review digest binds exactly the reviewed facts, and no clock value is inside it.
 assert.equal(review.reviewSha256,hash({scheduleId,generation:stored.intent.generation,intentSha256:review.intentSha256,projectionSha256:review.projectionSha256,scopesSha256:review.scopesSha256,limits:review.limits}));
 // Read-only: no schedule was dispatched and no model budget was admitted by the review.
 assert.deepEqual(Object.keys(review).sort(),['consent','generation','intent','intentSha256','limits','projectionSha256','reviewSha256','scheduleId','scopesSha256','status']);
});

test('MR-04 renewal approval: an identical retry after a lost Core ACK keeps one decision digest and one window',async t=>{
 const observation=coreObservation(),renewal=coreRenewal(),journal=managementJournal();
 const held=await applicationFixture({consentObservation:observation.port,consentRenewal:renewal.port,managementPreparations:journal.store});t.after(held.close);
 const prepared=await held.prepare();const approved=await held.approve(prepared);const stored=await intentOf(held,approved.receipt.intentId);
 const scheduleId=approved.receipt.projection.scheduleId;
 // No further schedule dispatch is permitted from here on: the renewal is not a scheduling operation.
 let dispatched=0;const create=held.client.schedule.create;held.client.schedule.create=async(...args)=>{dispatched++;return await create(...args);};
 observation.state.rows=[{scheduleId,ownerActorId:binding.actorId,generation:stored.intent.generation,intentSha256:hash(stored.intent),projectionSha256:hash(stored.intent.projection),issuedAtMs:NOW-1000,expiresAtMs:NOW-500,scopeCount:1,rightsSha256:null}];
 const review=await held.call('consentReview',{scheduleId});
 // The first attempt reaches Core and loses the answer: the decision stays claimed and PENDING. It is made one second
 // EARLIER than the retry clock below, so the durable decision instant can only be the first one.
 held.state.now=NOW-1000;
 renewal.state.fail='UNAVAILABLE';
 await assert.rejects(held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-one',decision:'approved'}),code('ROUTINES_CORE_UNAVAILABLE'));
 const pending=[...journal.rows.values()];assert.equal(pending.length,1);assert.equal(pending[0].state,'PENDING');
 assert.equal(pending[0].record.request.decidedAtMs,NOW-1000);
 const claimedId=pending[0].claim_id;
 // The retry happens at a LATER clock: it must re-present the FIRST durable decision byte for byte — its own
 // decidedAt/expiresAt and claim id — never a freshly minted decision instant, or Core would see a new decision.
 held.state.now=NOW;
 renewal.state.fail=null;
 const renewed=await held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-one',decision:'approved'});
 assert.deepEqual(Object.keys(renewed).sort(),['expiresAtMs','generation','idempotent','issuedAtMs','observedAtMs','policyRevision','state','status']);
 assert.equal(renewed.status,'renewed');assert.equal(renewed.idempotent,false);assert.equal(renewed.generation,stored.intent.generation);assert.equal(renewed.policyRevision,'p1');
 const sent=renewal.state.calls;assert.equal(sent.length,2);
 assert.equal(hash(sent[0].approval),hash(sent[1].approval),'a retry must re-present one decision digest');
 assert.deepEqual(sent[0].approval,sent[1].approval);assert.deepEqual(sent[0].intent,sent[1].intent);
 // The later clock minted nothing: the replayed approval carries the FIRST decision's own instant and window.
 assert.equal(sent[1].approval.decidedAt,new Date(NOW-1000).toISOString());
 assert.equal(sent[1].approval.expiresAt,new Date(pending[0].record.request.expiresAtMs).toISOString());
 assert.ok(Date.parse(sent[1].approval.decidedAt)<held.state.now);
 assert.equal(sent[0].approval.commandSha256,hash(stored.intent));assert.equal(sent[0].approval.proposalId,stored.intent.intentId);
 // An attended session's principal is the current tenant and actor only: the renewal never borrows the run binding.
 assert.deepEqual(sent[0].approval.approver,{tenantId:binding.tenantId,actorId:binding.actorId});assert.equal(sent[0].approval.policyRevision,'p1');
 assert.ok(Date.parse(sent[0].approval.decidedAt)<=NOW&&Date.parse(sent[0].approval.expiresAt)>NOW);
 const settled=[...journal.rows.values()][0];assert.equal(settled.state,'PREPARED');assert.equal(settled.claim_id,claimedId);
 assert.equal(settled.proposal_id,null);assert.equal(settled.outcome.status,'renewed');
 // A third retry is served from the claimed window: no second Core call, no second window.
 const replay=await held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-one',decision:'approved'});
 assert.deepEqual(replay,renewed);assert.equal(renewal.state.calls.length,2);assert.equal(renewal.state.windows.size,1);
 assert.equal(dispatched,0);
});

test('MR-04 renewal refusals: a substituted or foreign intent, a moved review and an unallocated journal all refuse',async t=>{
 const observation=coreObservation(),renewal=coreRenewal(),journal=managementJournal();
 const held=await applicationFixture({consentObservation:observation.port,consentRenewal:renewal.port,managementPreparations:journal.store});t.after(held.close);
 const prepared=await held.prepare();const approved=await held.approve(prepared);const stored=await intentOf(held,approved.receipt.intentId);
 const scheduleId=approved.receipt.projection.scheduleId;
 observation.state.rows=[{scheduleId,ownerActorId:binding.actorId,generation:stored.intent.generation,intentSha256:hash(stored.intent),projectionSha256:hash(stored.intent.projection),issuedAtMs:NOW-1000,expiresAtMs:NOW+60000,scopeCount:1,rightsSha256:'c'.repeat(64)}];
 const review=await held.call('consentReview',{scheduleId}),body={scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-two',decision:'approved'};
 // A decision for another review, a substituted intent and a foreign owner all refuse before Core is reached.
 await assert.rejects(held.call('consentApprove',{...body,reviewSha256:'0'.repeat(64)}),code('ROUTINES_STALE'));
 await assert.rejects(held.call('consentApprove',{...body,decision:'denied'}),code('ROUTINES_INVALID_REQUEST'));
 await assert.rejects(held.call('consentApprove',{...body,requestId:'not a request id'}),code('ROUTINES_INVALID_REQUEST'));
 assert.equal(renewal.state.calls.length,0);
 // The intent moved under the review: a later approved update changes the reviewed generation and digest, so the old
 // approval refuses as stale and never reaches Core.
 const update={...routineRequest(),scheduleId};
 const next=await held.prepare(update,'update_scheduled_task','request-two');
 await held.approve(next,update);
 const later=await held.call('consentReview',{scheduleId});
 assert.notEqual(later.reviewSha256,review.reviewSha256);
 await assert.rejects(held.call('consentApprove',body),code('ROUTINES_STALE'));
 assert.equal(renewal.state.calls.length,0);
 // The journal extension is not allocated: the renewal refuses UNAVAILABLE instead of approving without correlation.
 const unallocated=await applicationFixture({consentObservation:observation.port,consentRenewal:renewal.port,managementPreparations:{read:async()=>null}});
 t.after(unallocated.close);
 const second=await unallocated.prepare();await unallocated.approve(second);
 const held2=await unallocated.call('consentReview',{scheduleId:second.proposal.projection.scheduleId});
 await assert.rejects(unallocated.call('consentApprove',{scheduleId:second.proposal.projection.scheduleId,reviewSha256:held2.reviewSha256,requestId:'renewal-three',decision:'approved'}),code('ROUTINES_UNAVAILABLE'));
 assert.equal(renewal.state.calls.length,0);
});

test('MR-04: the facet is released only when the request asks for it, and an unobservable service answers unknown',async t=>{
 const f=await applicationFixture();t.after(f.close);
 await f.approve(await f.prepare());
 // The unchanged legacy body is answered with the exact legacy shape: no facet, and no new member anywhere.
 const legacy=await f.call('list',{limit:20}),row=legacy.page.rows[0];
 assert.equal(Object.hasOwn(row,'consent'),false);
 assert.deepEqual(Object.keys(row).sort(),['generation','inspection','inspectionState','projection','trigger','unresolved']);
 // An opted-in request against a service with no observation port is told that nothing is observable: `unknown`, never
 // a fabricated absence, and never a fabricated observation.
 const asked=(await f.call('list',{limit:20,observation:'consent'})).page.rows[0];
 assert.deepEqual(asked.consent,{state:'unknown',pinsMatched:false,stale:false,observedAtMs:null,generation:row.generation,consentGeneration:null,
  issuedAtMs:null,expiresAtMs:null,scopeCount:null,cause:null,rightsSha256:null});
 // An opt-in this boundary does not define is refused, never ignored.
 await assert.rejects(f.call('list',{limit:20,observation:'everything'}),code('ROUTINES_INVALID_REQUEST'));
 const review=await f.call('consentReview',{scheduleId:row.projection.scheduleId});
 assert.equal(review.consent,null);assert.equal(review.status,'review_required');
});

test('MR-04 renewal custody: a moved review over a claimed slot refuses, and the journal keeps the versions fence',async t=>{
 const observation=coreObservation(),renewal=coreRenewal(),journal=managementJournal();
 const held=await applicationFixture({consentObservation:observation.port,consentRenewal:renewal.port,managementPreparations:journal.store});t.after(held.close);
 const prepared=await held.prepare();const approved=await held.approve(prepared);const stored=await intentOf(held,approved.receipt.intentId);
 const scheduleId=approved.receipt.projection.scheduleId;
 observation.state.rows=[{scheduleId,ownerActorId:binding.actorId,generation:stored.intent.generation,intentSha256:hash(stored.intent),projectionSha256:hash(stored.intent.projection),issuedAtMs:NOW-1000,expiresAtMs:NOW+60000,scopeCount:1,rightsSha256:'d'.repeat(64)}];
 const review=await held.call('consentReview',{scheduleId});
 const first=await held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-four',decision:'approved'});
 assert.equal(first.status,'renewed');assert.equal(renewal.state.calls.length,1);
 const rowsAfterFirst=journal.rows.size;
 // The intent moves under the already-claimed slot. The same request id with the now-current review is still refused
 // on the slot's OWN stable identity, so no second decision and no second window can ever be minted for that slot.
 const update={...routineRequest(),scheduleId};
 await held.approve(await held.prepare(update,'update_scheduled_task','request-two'),update);
 const later=await held.call('consentReview',{scheduleId});assert.notEqual(later.reviewSha256,review.reviewSha256);
 await assert.rejects(held.call('consentApprove',{scheduleId,reviewSha256:later.reviewSha256,requestId:'renewal-four',decision:'approved'}),code('ROUTINES_STALE'));
 assert.equal(journal.rows.size,rowsAfterFirst);assert.equal(renewal.state.calls.length,1);
 // The journal's own record fence, exercised directly on the production module: the non-image RuntimeVersions shape the
 // session carries is accepted, and a malformed record is refused before any row exists.
 const key={tenantId:binding.tenantId,actorId:binding.actorId,scopeSha256:hash({selectedClientId:clientId}),requestId:'renewal-five'};
 const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
 const record=request=>({operation:'renew_routine_consent',request,requestSha256:hash({operation:'renew_routine_consent',request}),selectedClientId:clientId,scopes:held.scopes(),versions});
 const decision={scheduleId,reviewSha256:review.reviewSha256,decision:'approved',decidedAtMs:NOW,expiresAtMs:NOW+4500};
 const noCheck=()=>{};
 assert.equal((await journal.store.claim({key,claimId:randomUUID(),record:record(decision)},noCheck)).claimed,true);
 await assert.rejects(journal.store.claim({key:{...key,requestId:'renewal-six'},claimId:randomUUID(),record:record({...decision,reviewSha256:'not-a-digest'})},noCheck),code('ROUTINES_STALE'));
 await assert.rejects(journal.store.claim({key:{...key,requestId:'renewal-seven'},claimId:randomUUID(),record:{...record(decision),versions:{imageDigest:'sha256:'+'a'.repeat(64),sdk:7}}},noCheck));
 assert.equal(journal.rows.size,rowsAfterFirst+1,'a refused record must leave no row behind');
});

test('MR-04 multi-scope renewal: the FULL original scope set is reviewed, recorded and re-presented, never truncated to the anchor',async t=>{
 const renewal=coreRenewal(),journal=managementJournal();
 const held=await applicationFixture({consentRenewal:renewal.port,managementPreparations:journal.store});t.after(held.close);
 const prepared=await held.prepare();const approved=await held.approve(prepared);const stored=await intentOf(held,approved.receipt.intentId);
 const scheduleId=approved.receipt.projection.scheduleId;
 // The published ScheduleProjection admits a full unique scope set (minItems 1, uniqueItems, NO maxItems) and Core
 // re-decides that entire canonical set, so the owner's stored intent is moved to a supported multi-scope set —
 // consistently in the intent AND its projection row, which is what the owner's own read requires (digest match).
 const [anchor]=stored.intent.projection.scopes,scopes=[anchor,{...anchor,resourceId:'2f1c6b40-0000-4000-8000-0000000000b2'}];
 const projection={...stored.intent.projection,scopes};
 const projectionRow=held.sql.state.projections.get(`${binding.tenantId}:${scheduleId}`);
 projectionRow.projection=structuredClone(projection);projectionRow.projection_sha256=hash(projection);
 const intentRow=held.sql.state.intents.get(`${binding.tenantId}:${approved.receipt.intentId}`);
 intentRow.intent=structuredClone({...stored.intent,projection});intentRow.intent_sha256=hash(intentRow.intent);
 const review=await held.call('consentReview',{scheduleId});
 // The review binds the WHOLE original set, not just the one scope the current authority is anchored to.
 assert.equal(review.scopesSha256,hash(scopes));assert.deepEqual(review.intent.projection.scopes,scopes);
 const renewed=await held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-multi',decision:'approved'});
 assert.equal(renewed.status,'renewed');
 const rows=[...journal.rows.values()];assert.equal(rows.length,1);
 assert.deepEqual(rows[0].record.scopes,scopes,'the journal must carry the full original set, never the anchor alone');
 // Wire E receives the immutable intent verbatim: the same full set, ONE decision and ONE window.
 assert.equal(renewal.state.calls.length,1);assert.deepEqual(renewal.state.calls[0].intent.projection.scopes,scopes);
 assert.equal(renewal.state.windows.size,1);
 // An ALTERED set — one that no longer contains the scope the current authority is anchored to — is not a supported
 // multi-scope renewal: it refuses as stale and leaves no row, so no authority is ever approved over a changed set.
 const altered=[{...anchor,resourceId:'2f1c6b40-0000-4000-8000-0000000000b3'},{...anchor,resourceId:'2f1c6b40-0000-4000-8000-0000000000b2'}];
 const alteredProjection={...projection,scopes:altered};
 projectionRow.projection=structuredClone(alteredProjection);projectionRow.projection_sha256=hash(alteredProjection);
 intentRow.intent=structuredClone({...stored.intent,projection:alteredProjection});intentRow.intent_sha256=hash(intentRow.intent);
 const alteredReview=await held.call('consentReview',{scheduleId});
 await assert.rejects(held.call('consentApprove',{scheduleId,reviewSha256:alteredReview.reviewSha256,requestId:'renewal-multi-altered',decision:'approved'}),code('ROUTINES_STALE'));
 assert.equal(journal.rows.size,1);assert.equal(renewal.state.calls.length,1);
});

/** The REAL Core client's own verdict for one scripted transport: produced by executing the client's shared post() — the
 *  same function wire E uses — so `code`, `dispatched` and `received` are the client's actual evidence, never hand-made. */
async function realVerdict(script,credential='synthetic-attended-token'){
 const client=createRoutinesCoreClient({origin:'https://core.invalid',getServiceSecret:async()=>'service-secret-one',now:()=>NOW,fetchImpl:script,maxRequestMs:5000});
 try{await client.managementCurrent({credential,clientId,policyRevision:'p1',deadlineMs:NOW+4500});assert.fail('the scripted transport must not answer');}
 catch(error){assert.match(String(error.code),/^ROUTINES_CORE_/u,'the real client must raise its own verdict');return error;}
}
test('MR-04 renewal verdicts: only a received refusal is terminal; a dispatched call whose answer was lost keeps PENDING',async t=>{
 const refused=await realVerdict(async()=>new Response('',{status:403}));
 assert.deepEqual([refused.code,refused.dispatched,refused.received],['ROUTINES_CORE_REFUSED',true,true]);
 const outage=await realVerdict(async()=>new Response('',{status:503}));
 assert.deepEqual([outage.code,outage.dispatched,outage.received],['ROUTINES_CORE_UNAVAILABLE',true,false]);
 const malformed=await realVerdict(async()=>new Response('<html>not json</html>',{status:200}));
 assert.equal(malformed.dispatched,true);assert.notEqual(malformed.received,true);
 const lost=await realVerdict(async()=>{throw Object.assign(Error('the attempt was aborted'),{code:'DEADLINE'});});
 assert.deepEqual([lost.code,lost.dispatched,lost.received],['ROUTINES_CORE_DEADLINE',true,false]);
 // A local pre-call envelope refusal is the other provably-decided class: it is refused BEFORE the request is issued.
 const envelope=await realVerdict(async()=>new Response('',{status:200}),'a credential with a space');
 assert.deepEqual([envelope.code,envelope.dispatched,envelope.received],['ROUTINES_CORE_REQUEST',false,false]);
 const cases=[{name:'a received 403 refusal',verdict:refused,state:'FAILED'},{name:'a 5xx outage',verdict:outage,state:'PENDING'},
  {name:'a malformed 200 body',verdict:malformed,state:'PENDING'},{name:'a post-dispatch deadline',verdict:lost,state:'PENDING'}];
 for(const item of cases){
  const journal=managementJournal();
  const held=await applicationFixture({consentRenewal:async()=>{throw item.verdict;},managementPreparations:journal.store});t.after(held.close);
  const prepared=await held.prepare();const approved=await held.approve(prepared);const scheduleId=approved.receipt.projection.scheduleId;
  const review=await held.call('consentReview',{scheduleId});
  await assert.rejects(held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-verdict',decision:'approved'}),
   error=>item.state==='FAILED'?error.code==='ROUTINES_ACCESS_DENIED':error.code===item.verdict.code);
  const rows=[...journal.rows.values()];assert.equal(rows.length,1,item.name);
  assert.equal(rows[0].state,item.state,`${item.name}: the durable slot must be ${item.state}`);
  if(item.state==='FAILED')assert.equal(rows[0].outcome.code,'REFUSED');
  // Either way the slot holds exactly ONE immutable renewal decision and no window was invented for an undecided call.
  assert.equal(rows[0].record.operation,'renew_routine_consent');assert.equal(rows[0].proposal_id,null);
 }
});

/** MR-04 R1 end to end: the REAL Core client's own verdict (real post(), real dispatched/received evidence) reaches the
 *  REAL routines application and the REAL schedule-owned journal. A 200 whose JSON does not satisfy the closed consent
 *  contract decided nothing, so the durable renewal slot keeps its immutable decision and stays PENDING — never FAILED,
 *  and no window is minted — while a received 403 still settles FAILED/REFUSED. */
const CONSENT_RENEW_ROUTE='/api/clio/routines/consent/renew',CONSENT_OBSERVATION_ROUTE='/api/internal/routines/consent';
/** The real client over one scripted transport, recording every request. `sessionPort` is the trusted live-session
 *  boundary the runtime also borrows; without it the call is the service-identity-only wire D. */
function realConsentClient(answer,{sessionPort,status=200}={}){
 const state={calls:[],answered:answer,status};
 const client=createRoutinesCoreClient({origin:'https://core.synthetic.invalid',...(sessionPort===undefined?{}:{nativeCredentials:sessionPort}),getServiceSecret:async()=>'synthetic-service-secret',
  now:()=>NOW,fetchImpl:async(url,init)=>{state.calls.push({url,headers:{...init.headers},body:JSON.parse(init.body)});
   return new Response(JSON.stringify(state.answered),{status:state.status,headers:{'content-type':'application/json'}});},maxRequestMs:5000});
 return {state,client};
}
/** The runtime's own wire E port: the application's call credential is not part of the client's wire envelope (the client
 *  resolves the owner's bearer from the live session itself), exactly as apps/runtime/routines.mjs does. */
const renewalPort=client=>value=>{const {credential,binding:runBinding,selectedClientId,...rest}=value;return client.consentRenewal({...rest,...(runBinding===undefined||runBinding===null?{}:{binding:runBinding,selectedClientId})});};

test('MR-04 renewal custody (R1): a dispatched 200 outside the closed contract keeps the slot PENDING with its FIRST decision',async t=>{
 const answer={schemaVersion:1,state:'active',generation:1,policyRevision:'p1',issuedAtMs:NOW-1000,expiresAtMs:NOW+60000,observedAtMs:NOW,idempotent:false,extra:true};
 const journal=managementJournal();let wire=null;
 const held=await applicationFixture({consentRenewal:value=>renewalPort(wire.client)(value),managementPreparations:journal.store});t.after(held.close);
 wire=realConsentClient(answer,{sessionPort:held.sessions});
 const prepared=await held.prepare();const approved=await held.approve(prepared);const scheduleId=approved.receipt.projection.scheduleId;
 const review=await held.call('consentReview',{scheduleId});
 const first=await held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-custody',decision:'approved'}).then(()=>null,error=>error);
 assert.equal(first.code,'ROUTINES_CORE_INVALID_RESULT');
 assert.deepEqual([first.dispatched,first.received],[true,false],"the client's own custody evidence must survive the application");
 assert.equal(wire.state.calls.length,1,'one attempt: no automatic retry');
 assert.ok(wire.state.calls[0].url.endsWith(CONSENT_RENEW_ROUTE));
 assert.equal(wire.state.calls[0].headers['x-internal-service-secret'],'synthetic-service-secret');
 assert.match(wire.state.calls[0].headers.authorization,/^Bearer \S+$/u);
 const rows=[...journal.rows.values()];assert.equal(rows.length,1);
 assert.equal(rows[0].state,'PENDING','an undecided dispatched call must not terminalise the slot');
 assert.equal(rows[0].outcome,null);assert.equal(rows[0].proposal_id,null);
 assert.equal(rows[0].record.operation,'renew_routine_consent');assert.equal(rows[0].record.request.decidedAtMs,NOW);
 // The identical retry at a LATER clock re-presents the FIRST durable decision byte for byte: no new decision, no window.
 held.state.now=NOW+1000;
 const second=await held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-custody',decision:'approved'}).then(()=>null,error=>error);
 assert.equal(second.code,'ROUTINES_CORE_INVALID_RESULT');
 assert.equal(wire.state.calls.length,2);
 assert.deepEqual(wire.state.calls[0].body.selection.scheduleBinding.approval,wire.state.calls[1].body.selection.scheduleBinding.approval);
 assert.equal(wire.state.calls[1].body.selection.scheduleBinding.approval.decidedAt,new Date(NOW).toISOString());
 const after=[...journal.rows.values()];assert.equal(after.length,1);assert.equal(after[0].state,'PENDING');
 assert.equal(after[0].record.request.decidedAtMs,NOW);assert.equal(after[0].outcome,null);
});

test('MR-04 renewal custody (R1): a received 403 still settles FAILED, and the observation facet answers unknown',async t=>{
 const journal=managementJournal();let wire=null;
 const held=await applicationFixture({consentRenewal:value=>renewalPort(wire.client)(value),managementPreparations:journal.store});t.after(held.close);
 wire=realConsentClient({},{sessionPort:held.sessions,status:403});
 const prepared=await held.prepare();const approved=await held.approve(prepared);const scheduleId=approved.receipt.projection.scheduleId;
 const review=await held.call('consentReview',{scheduleId});
 const denied=await held.call('consentApprove',{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-denied',decision:'approved'}).then(()=>null,error=>error);
 assert.equal(denied.code,'ROUTINES_ACCESS_DENIED');
 const rows=[...journal.rows.values()];assert.equal(rows.length,1);assert.equal(rows[0].state,'FAILED');assert.deepEqual(rows[0].outcome,{code:'REFUSED'});
 // Wire D over the same real client: a 200 carrying an answer outside the closed eleven members is `unknown`, never
 // `absent` — only Core's own absent statement may be reported as absent.
 const observation=realConsentClient({...{schemaVersion:1,state:'absent',pinsMatched:false,observedAtMs:NOW,generation:1,consentGeneration:null,issuedAtMs:null,expiresAtMs:null,scopeCount:null,cause:null,rightsSha256:null},extra:true});
 const f=await applicationFixture({consentObservation:value=>observation.client.consentObservation(value)});t.after(f.close);
 await f.approve(await f.prepare());
 const row=(await f.call('list',{limit:20,observation:'consent'})).page.rows[0];
 assert.equal(row.consent.state,'unknown');assert.equal(row.consent.observedAtMs,null);assert.equal(row.consent.stale,false);
 assert.equal(observation.state.calls.length,1);assert.ok(observation.state.calls[0].url.endsWith(CONSENT_OBSERVATION_ROUTE));
});
