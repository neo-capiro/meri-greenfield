/** MR-04 PUBLIC RECEIVING. The ACTUAL Meri routines HTTP owner is driven end to end over the existing scripted
 * SQL/Core/Temporal fixture, and every answer is admitted twice: by this source's new receiver and by the PHYSICAL
 * released `@capiro/meri-contracts@0.1.26` receiver the installed clients already carry. No live Core, model, provider,
 * database or browser is touched, and no authority is claimed by validating a shape. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {fileURLToPath,pathToFileURL} from 'node:url';
import {receiveRoutinesRequest,receiveRoutinesResponse,routinesPaths,routinesMetadata} from '../dist/intents-application.mjs';
import {routinesPublicFixture} from './routines-application-fixture.mjs';
import {NOW,clientId} from '../../../apps/control/schedules/test/application-fixture.mjs';
import {createRoutineManagementPreparations} from '../../../apps/control/schedules/management-preparations.mjs';
import {canonicalSha256 as hash} from '../validate.mjs';
import localSchema from '../dist/intents-application.schema.json' with {type:'json'};
import canonicalTool from '../schedules-0.3/tool-interface.schema.json' with {type:'json'};

const code=expected=>error=>error?.code===expected;
/** The PHYSICAL released receiver the installed clients carry, reached by its installed path and never by the package
 *  name: from inside this package the name resolves to this source, which is exactly the difference being measured. */
const physicalPath=fileURLToPath(new URL('../../../node_modules/@capiro/meri-contracts/dist/intents-application.mjs',import.meta.url));
const physical=await import(pathToFileURL(physicalPath).href);
const physicalRequest=physical.receiveRoutinesRequest,physicalResponse=physical.receiveRoutinesResponse;
/** The scripted Core wire D: Core's own newest stored row for this owner and schedule, or Core's own `absent`. */
function coreObservation(){
 const state={calls:[],stored:null,refuse:null};
 return {state,port:async value=>{state.calls.push(value);
  if(state.refuse!==null)throw Object.assign(Error('ROUTINES_CORE_'+state.refuse),{code:'ROUTINES_CORE_'+state.refuse});
  const row=state.stored;
  if(row===null)return {schemaVersion:1,state:'absent',pinsMatched:false,observedAtMs:NOW,generation:value.generation,consentGeneration:null,issuedAtMs:null,expiresAtMs:null,scopeCount:null,cause:null,rightsSha256:null};
  const active=row.expiresAtMs>NOW;
  return {schemaVersion:1,state:active?'active':'expired',pinsMatched:true,observedAtMs:NOW,generation:value.generation,consentGeneration:row.generation,
   issuedAtMs:row.issuedAtMs,expiresAtMs:row.expiresAtMs,scopeCount:row.scopeCount,cause:null,rightsSha256:active?row.rightsSha256:null};}};
}
/** The REAL schedule-owned journal (the production custody module) over a scripted SQL boundary, so what the public
 *  route reaches is exactly what production reaches; no injected method and no test-only API. */
function managementJournal(){
 const rows=new Map(),pk=v=>[v[0],v[1],v[2],v[3]].join('|');
 const pool={async connect(){return {async query(text,v=[]){
  if(text==='COMMIT')return {rows:[],rowCount:0};
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
 return {rows,store:createRoutineManagementPreparations({pool})};
}
/** The scripted Core wire E: it keeps the FIRST window for a repeated decision digest, exactly as Core's stored row does. */
function coreRenewal(){
 const state={calls:[],windows:new Map()};
 return {state,port:async value=>{state.calls.push(structuredClone({intent:value.intent,approval:value.approval}));
  const decision=hash(value.approval),existing=state.windows.get(decision);
  if(existing)return {...existing,idempotent:true};
  const window={state:'active',generation:value.intent.generation,policyRevision:value.intent.projection.scopes[0].policyRevision,issuedAtMs:NOW,expiresAtMs:NOW+2592000000,observedAtMs:NOW,idempotent:false};
  state.windows.set(decision,window);return window;}};
}

test('the unchanged legacy list body keeps the exact legacy shape, and the physical 0.1.26 receiver is unaffected',async()=>{
 // The installed receiver is a DIFFERENT physical artifact from this source's own generated receiver.
 assert.notEqual(createHash('sha256').update(readFileSync(physicalPath)).digest('hex'),
  createHash('sha256').update(readFileSync(new URL('../dist/intents-application.mjs',import.meta.url))).digest('hex'));
 const observation=coreObservation(),f=await routinesPublicFixture({consentObservation:observation.port});
 try{
  await f.approve(await f.prepare());
  const listed=await f.exchange('list',{});
  assert.equal(listed.status,200);
  const page=listed.json.page,row=page.rows[0];
  // Not one new member: the legacy body is answered with the legacy shape, even though the observation port is wired.
  assert.deepEqual(Object.keys(row).sort(),['generation','inspection','inspectionState','projection','trigger','unresolved']);
  assert.deepEqual(Object.keys(page).sort(),['coverage','hasMore','nextAfterScheduleId','operation','originalRuns','rows']);
  assert.equal(observation.state.calls.length,0,'an unchanged body must not ask Core anything');
  // The physical receiver the installed clients carry admits those legacy members, and refuses the answer ONLY for the
  // pre-existing 0.3 `trigger` observation, which is not part of this slice: with that one member removed it is admitted.
  await assert.rejects(physicalResponse('list',200,listed.text,{request:{}}),code('ROUTINES_SHAPE'));
  const withoutTrigger=structuredClone(listed.json);for(const r of withoutTrigger.page.rows)delete r.trigger;
  const physical=await physicalResponse('list',200,JSON.stringify(withoutTrigger),{request:{}});
  assert.deepEqual(Object.keys(physical.page.rows[0]).sort(),['generation','inspection','inspectionState','projection','unresolved']);
  assert.deepEqual(physical.page,withoutTrigger.page);
  // An old client can neither ask for the facet nor be handed one.
  await assert.rejects(physicalRequest('list',JSON.stringify({observation:'consent'})),code('ROUTINES_SHAPE'));
  assert.deepEqual(await physicalRequest('list','{}'),{});
  assert.deepEqual(await receiveRoutinesRequest('list','{}'),{});
 }finally{f.close();}
});

test('the observation facet is released only to a body that asks for it, and the new receiver requires it exactly then',async()=>{
 const observation=coreObservation(),f=await routinesPublicFixture({consentObservation:observation.port});
 try{
  const approved=await f.approve(await f.prepare()),scheduleId=approved.receipt.projection.scheduleId,generation=approved.receipt.generation;
  const body={limit:20,observation:'consent'},asked=await f.exchange('list',body);
  assert.equal(asked.status,200);
  assert.equal(routinesPaths.list,'/api/routines/list');
  const row=asked.json.page.rows[0];
  // Core has no stored row: `absent` is Core's own statement, and it is reported as such.
  assert.deepEqual(row.consent,{state:'absent',pinsMatched:false,stale:false,observedAtMs:NOW,generation,consentGeneration:null,issuedAtMs:null,expiresAtMs:null,scopeCount:null,cause:null,rightsSha256:null});
  const pins=observation.state.calls.at(-1);
  assert.deepEqual(Object.keys(pins).sort(),['deadlineMs','generation','intentSha256','ownerActorId','projectionSha256','scheduleId','signal','tenantId']);
  assert.equal(pins.scheduleId,scheduleId);assert.equal(pins.generation,generation);
  const received=await receiveRoutinesResponse('list',asked.status,asked.text,{request:body});
  assert.deepEqual(received,asked.json);assert(Object.isFrozen(received));
  // An observation that was asked for but withheld, and a facet nobody asked for, are both refused.
  await assert.rejects(receiveRoutinesResponse('list',asked.status,asked.text,{request:{limit:20}}),code('ROUTINES_CORRELATION'));
  const legacy=await f.exchange('list',{limit:20});
  await assert.rejects(receiveRoutinesResponse('list',legacy.status,legacy.text,{request:body}),code('ROUTINES_CORRELATION'));
  // An opt-in this boundary does not define is refused by the producer and by the request receiver.
  const unknown=await f.exchange('list',{limit:20,observation:'everything'});
  assert.equal(unknown.status,400);assert.equal(unknown.json.error.code,'ROUTINES_INVALID_REQUEST');
  await assert.rejects(receiveRoutinesRequest('list',JSON.stringify({observation:'everything'})),code('ROUTINES_SHAPE'));
  // The facet distinguishes Core's own states from this service's inability to observe at all.
  observation.state.refuse='UNAVAILABLE';
  assert.equal((await f.exchange('list',body)).json.page.rows[0].consent.state,'unknown');
  observation.state.refuse=null;
  observation.state.stored={generation,intentSha256:'a'.repeat(64),projectionSha256:'b'.repeat(64),issuedAtMs:NOW-1000,expiresAtMs:NOW+60000,scopeCount:1,rightsSha256:'c'.repeat(64)};
  const active=(await f.exchange('list',body)).json.page.rows[0];
  assert.equal(active.consent.state,'active');assert.equal(active.projection.state,'active');
  observation.state.stored.expiresAtMs=NOW-1;
  const expired=(await f.exchange('list',body)).json.page.rows[0];
  assert.equal(expired.consent.state,'expired');assert.equal(expired.projection.state,'active');
 }finally{f.close();}
});

test('the review and the approval are public spans with closed types and canonical correlation',async()=>{
 const observation=coreObservation(),renewal=coreRenewal(),journal=managementJournal();
 const f=await routinesPublicFixture({consentObservation:observation.port,consentRenewal:renewal.port,managementPreparations:journal.store});
 try{
  const approved=await f.approve(await f.prepare()),scheduleId=approved.receipt.projection.scheduleId;
  const reviewRequest={scheduleId},review=await f.exchange('consentReview',reviewRequest);
  assert.equal(review.status,200);assert.equal(routinesPaths.consentReview,'/api/routines/consent/review');
  assert.equal(review.json.status,'review_required');assert.equal(review.json.scheduleId,scheduleId);
  assert.equal(review.json.generation,approved.receipt.generation);
  assert.equal(review.json.intent.generation,review.json.generation);
  assert.equal(review.json.reviewSha256,hash({scheduleId,generation:review.json.generation,intentSha256:review.json.intentSha256,
   projectionSha256:review.json.projectionSha256,scopesSha256:review.json.scopesSha256,limits:review.json.limits}));
  assert.deepEqual(review.json.limits,{maxCostMicrousd:1000,maxRuntimeSeconds:60,retryLimit:0});
  assert.deepEqual(await receiveRoutinesResponse('consentReview',review.status,review.text,{request:reviewRequest}),review.json);
  // A review of another schedule, and a review that is not this request's own answer, are refused.
  const foreign=structuredClone(review.json);foreign.scheduleId=clientId;
  await assert.rejects(receiveRoutinesResponse('consentReview',200,JSON.stringify(foreign),{request:reviewRequest}),code('ROUTINES_CORRELATION'));
  await assert.rejects(receiveRoutinesResponse('consentReview',review.status,review.text,{request:{scheduleId:clientId}}),code('ROUTINES_CORRELATION'));
  const moved=structuredClone(review.json);moved.intent.generation=moved.generation+1;
  await assert.rejects(receiveRoutinesResponse('consentReview',200,JSON.stringify(moved),{request:reviewRequest}),code('ROUTINES_CORRELATION'));
  // A reviewed limit set that is not the reviewed intent's own limits is refused: the review can never show an owner a
  // widened budget the original intent does not carry.
  const wide=structuredClone(review.json);wide.limits.maxCostMicrousd=99999999;
  await assert.rejects(receiveRoutinesResponse('consentReview',200,JSON.stringify(wide),{request:reviewRequest}),code('ROUTINES_CORRELATION'));
  // The decision binds the review it was shown. A decision without that review, a decision for another review, and a
  // decision for a different reviewed generation are all refused before any approval is admitted.
  const decision={scheduleId,reviewSha256:review.json.reviewSha256,requestId:'public-renewal-one',decision:'approved'};
  const renewed=await f.exchange('consentApprove',decision);
  assert.equal(renewed.status,200);assert.equal(routinesPaths.consentApprove,'/api/routines/consent/approve');
  assert.deepEqual(Object.keys(renewed.json).sort(),['expiresAtMs','generation','idempotent','issuedAtMs','observedAtMs','policyRevision','state','status']);
  assert.equal(renewed.json.status,'renewed');assert.equal(renewed.json.generation,review.json.generation);
  assert.deepEqual(await receiveRoutinesResponse('consentApprove',renewed.status,renewed.text,{request:decision,review:review.json}),renewed.json);
  await assert.rejects(receiveRoutinesResponse('consentApprove',renewed.status,renewed.text,{request:decision}),code('ROUTINES_EXPECTATION'));
  await assert.rejects(receiveRoutinesResponse('consentApprove',renewed.status,renewed.text,{request:{...decision,reviewSha256:'0'.repeat(64)},review:review.json}),code('ROUTINES_CORRELATION'));
  await assert.rejects(receiveRoutinesResponse('consentApprove',renewed.status,renewed.text,{request:decision,review:{...review.json,generation:review.json.generation+1}}),code('ROUTINES_CORRELATION'));
  const stale=structuredClone(renewed.json);stale.generation=renewed.json.generation+1;
  await assert.rejects(receiveRoutinesResponse('consentApprove',200,JSON.stringify(stale),{request:decision,review:review.json}),code('ROUTINES_CORRELATION'));
  // A window whose own state and expiry contradict each other is refused here exactly as the durable journal refuses it.
  const contradictory=structuredClone(renewed.json);contradictory.expiresAtMs=contradictory.issuedAtMs;
  await assert.rejects(receiveRoutinesResponse('consentApprove',200,JSON.stringify(contradictory),{request:decision,review:review.json}),code('ROUTINES_CORRELATION'));
  // The identical decision retried is served from the claimed window: one durable decision, one window, one Core call.
  const replay=await f.exchange('consentApprove',decision);
  assert.deepEqual(replay.json,renewed.json);assert.equal(journal.rows.size,1);assert.equal(renewal.state.calls.length,1);
  // An approval is an explicit operation over the review, never a route the caller can invent: no caller can mint a
  // decision, a limit, a decided instant or an expiry of its own.
  await assert.rejects(receiveRoutinesRequest('consentApprove',JSON.stringify({...decision,decision:'denied'})),code('ROUTINES_SHAPE'));
  await assert.rejects(receiveRoutinesRequest('consentApprove',JSON.stringify({...decision,expiresAtMs:NOW+60000})),code('ROUTINES_SHAPE'));
  await assert.rejects(receiveRoutinesRequest('consentApprove',JSON.stringify({...decision,decidedAtMs:NOW})),code('ROUTINES_SHAPE'));
  assert.equal(renewal.state.calls.length,1);
 }finally{f.close();}
});

test('the mirrored list request, row and page stay member for member equal to the canonical tool interface',()=>{
 const local=localSchema.$defs,canonical=canonicalTool.$defs;
 assert.deepEqual(Object.keys(local.RoutinesListRow.properties).sort(),[...Object.keys(canonical.ListRow.properties).sort(),'consent'].sort());
 assert.deepEqual(local.RoutinesListRow.required,canonical.ListRow.required);
 assert.deepEqual(Object.keys(local.RoutinesListPage.properties).sort(),Object.keys(canonical.ListPage.properties).sort());
 assert.deepEqual(local.RoutinesListPage.required,canonical.ListPage.required);
 for(const name of ['afterScheduleId','limit','historyLimit'])
  assert.deepEqual(local.RoutinesListRequest.properties[name],canonical.ListScheduledTasksRequest.properties[name]);
 assert.deepEqual(Object.keys(local.RoutinesListRequest.properties).sort(),[...Object.keys(canonical.ListScheduledTasksRequest.properties).sort(),'observation'].sort());
 assert.deepEqual(local.RoutinesListRequest.required,[]);assert.equal(local.RoutinesListRequest.additionalProperties,false);
 assert.equal(local.RoutinesListRow.additionalProperties,false);assert.equal(local.RoutinesListPage.additionalProperties,false);
 assert.deepEqual(local.RoutinesListResponse.properties.page.$ref,'#/$defs/RoutinesListPage');
 assert.equal(local.RoutinesListPage.properties.rows.items.$ref,'#/$defs/RoutinesListRow');
 // The observation facet is closed and every member is always present: no optional claim can ever be read as an absence.
 assert.equal(local.RoutinesConsentObservation.additionalProperties,false);
 assert.deepEqual(local.RoutinesConsentObservation.required,Object.keys(local.RoutinesConsentObservation.properties));
 assert.deepEqual(local.RoutinesConsentObservation.properties.state.enum,['active','expired','revoked','absent','unknown']);
 assert.equal(routinesMetadata.version,'0.2.0');
 assert.equal(routinesMetadata.routes.consentReview,'/api/routines/consent/review');
 assert.equal(routinesMetadata.routes.consentApprove,'/api/routines/consent/approve');
 assert.deepEqual(Object.keys(routinesPaths),['prepare','approve','list','reconcile','consentReview','consentApprove']);
});
