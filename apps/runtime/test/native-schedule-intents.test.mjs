/** Real native context, opaque session, intent journal and routines service; scripted SQL/Core/Temporal edges. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,routineRequest,binding,clientId,id} from '../../control/schedules/test/application-fixture.mjs';
import {routinesFamily} from '../product-ports/routines.mjs';
import {createNativeRoutinesContextOwner} from '../native-authority/routines-owner-composition.mjs';
import {createAgentCoreIntentResolver} from '../native-authority/execution-composition.mjs';
import {assertPreparedResult} from '../../worker/conversation/intents/prepared.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createRetentionReadGate} from '../../control/retention/suppression.mjs';
import {createIntentApprovalOwner} from '../../control/intents/approval.mjs';
import {createPostgresIntentJournalStore} from '../../control/intents/postgres-journal.mjs';
import {receiveIntentsResponse} from '../../../packages/contracts/dist/intents-application.mjs';
import {ROUTINE_PATHS} from '../../control/schedules/application-http.mjs';
import {createRoutineIntentPreparers} from '../routines-intents.mjs';
import {CURRENT_SCHEDULE_OPERATION_VERSION,LEGACY_SCHEDULE_OPERATION_VERSION} from '../../../packages/contracts/schedule-operation-family.mjs';
import {intentRow} from '../../worker/conversation/intents/catalog.mjs';
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
async function fixture(t){
 const f=await applicationFixture();t.after(()=>f.close());
 const configuration={sourceEnabled:true,intents:{enabled:true},routines:{enabled:true},limits:{requestMs:5000,requestBytes:131072},native:{maxResponseBytes:131072}};
 const nativeState={runState:'running',versions,reserved:false,budget:2000000,budgetReads:0,budgetUnavailable:false};
 const store={async read(){return {run:{binding,scopes:f.scopes(),versions:nativeState.versions,policyRevision:'p1',state:nativeState.runState}};},async readModelPolicy(){nativeState.budgetReads++;if(nativeState.budgetUnavailable)throw Error('model settings unavailable');return {maxBudgetMicroUsd:nativeState.budget};},nextRuns:{async current(){return {reserved:nativeState.reserved,binding,scopes:f.scopes(),policyRevision:'p1'};}}};
 const {template,workflow,limits,policy}=f.contextConfiguration;
 const context={configuration,pool:f.pool,client:{...f.client,connection:{withDeadline:(_deadline,fn)=>fn(),withAbortSignal:(_signal,fn)=>fn()}},now:f.now};
 const family=routinesFamily({context:{template,workflow,limits,policy},newId:f.newId,runControl:{async cancel(){throw Error('unexpected');}},retirement:{async retire(){throw Error('unexpected');}},
  contextOwnerFactory:({sessions,scheduleOwner,now,newId,runCancellation,...base})=>createNativeRoutinesContextOwner({base:{...base,versions,maxRuntimeSeconds:900},sessions,scheduleOwner,now,newId,store,runCancellation})});
 const retention=createRetentionReadGate({journal:{async get(){return f.state.retentionRefused?{state:'SUPPRESSED'}:null;}},serving:{isEnabled:()=>f.state.retentionEnabled!==false}});
 const ports=family(context).ports,app=ports.routinesApplicationFactory.create({sessions:f.sessions,retention});
 const execution={async authenticate(){if(f.state.revoked)throw Error('revoked');return {execution:{binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs:f.now()+60000,runtimeSessionId:id(90)},scopes:f.scopes(),selectedClientId:clientId,policyRevision:'p1',state:'running'};}};
 const transitionAuthority={async readCurrent(){return {binding,scopes:f.scopes(),selectedClientId:clientId,policyRevision:'p1',checkedAtMs:f.now(),expiresAtMs:f.now()+60000};}};
 const resolve=createAgentCoreIntentResolver({context,execution,transitionAuthority,nativeCredentials:f.sessions});
 const port=()=>resolve({binding,credential:'fixture-execution',deadlineMs:f.now()+60000});
 const post=(route,body)=>app.handle(new Request('https://synthetic.invalid'+ROUTINE_PATHS[route],{method:'POST',headers:{authorization:'Bearer '+f.session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const prepare=async(operation='schedule_task',args=routineRequest(),n=1)=>(await port()).prepare({operation:{id:operation,version:'0.2.0'},arguments:args,deliveryId:'sdk:'+hash({n})});
 return {...f,port,prepare,post,nativeState};
}
test('SDK offers all three schedules through the real family and one journal; explicit approval reaches Temporal once',async t=>{
 const f=await fixture(t),available=await (await f.port()).readAvailability();
 assert.deepEqual(available.operations.map(o=>o.id),['schedule_task','update_scheduled_task','cancel_scheduled_task']);
 // The worker lists a schedule tool only when the offer names exactly the id@version its catalog advertises: the composed
 // pin must be an advertised row, or every schedule tool answers UNAVAILABLE in every scope (the 2 Nov "scheduling
 // function is not available in this conversation" answer, when the catalog advertised the 0.3 successor instead).
 for(const operation of available.operations)assert.ok(intentRow(operation),`${operation.id}@${operation.version} is an advertised worker row`);
 const prepared=await f.prepare();assert.equal(f.preparations.state.rows.size,1);assert.equal(f.temporal.calls.create,0);assert.deepEqual(prepared.request,routineRequest());
 assertPreparedResult('schedule',{id:'schedule_task',version:'0.2.0'},prepared,binding,{scopes:f.scopes(),nowMs:f.now()});
 const {read,list}=createPostgresIntentJournalStore({pool:f.pool});
 const history=createIntentApprovalOwner({journal:{read,list},now:f.now,limits:{maxRequestMs:5000},enabled:true});
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]},request={conversationId:binding.conversationId};
 const listed=await history.list({principal,request}),received=await receiveIntentsResponse('list',200,JSON.stringify(listed),{request});
 assert.deepEqual(received.intents[0].request,prepared.request);assert.deepEqual(received.intents[0].proposal,prepared.proposal);assert.deepEqual(received.intents[0].binding,binding);
 const hidden=await history.list({principal:{...principal,clientIds:[]},request});assert.equal(hidden.intents[0].withheld,true);assert.equal(Object.hasOwn(hidden.intents[0],'request'),false);
 await receiveIntentsResponse('list',200,JSON.stringify(hidden),{request});
 const tampered=structuredClone(listed);tampered.intents[0].request.taskInstruction='Changed';await assert.rejects(receiveIntentsResponse('list',200,JSON.stringify(tampered),{request}));
 const ids=f.state.ids;assert.deepEqual(await f.prepare(),prepared);assert.equal(f.state.ids,ids);
 await assert.rejects(f.prepare('schedule_task',{...routineRequest(),taskInstruction:'Changed'}),{code:'CONFLICT'});
 const body={operation:'schedule_task',request:prepared.request,proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'};
 const approved=await f.post('approve',body);assert.equal(approved.status,200,await approved.clone().text());assert.equal(f.temporal.calls.create,1);
 assert.equal((await f.post('approve',body)).status,200);assert.equal(f.temporal.calls.create,1);
 const scheduleId=prepared.proposal.projection.scheduleId;
 const update=await f.prepare('update_scheduled_task',{...routineRequest(),scheduleId},2);assert.equal(update.proposal.operation,'update_scheduled_task');
 const cancel=await f.prepare('cancel_scheduled_task',{scheduleId,mode:'pause',running:'leave',runs:[],note:'Reviewed pause'},3);assert.equal(cancel.proposal.operation,'cancel_scheduled_task');assert.equal(f.preparations.state.rows.size,3);
});
test('the runtime schedule preparers declare one exact family pin, and an unsupported pin fails before any session is borrowed',async t=>{
 const f=await fixture(t),service={async prepareIntent(){throw Error('unexpected prepare');}};
 const composed={sessions:f.sessions,service,binding,selectedClientId:clientId,now:f.now,maxRequestMs:5000};
 const preparers=createRoutineIntentPreparers(composed);
 assert.deepEqual(preparers.map(p=>p.operation.id),['schedule_task','update_scheduled_task','cancel_scheduled_task']);
 for(const p of preparers)assert.equal(p.operation.version,LEGACY_SCHEDULE_OPERATION_VERSION,'the composed runtime declares the one pin it can record today');
 assert.equal(createRoutineIntentPreparers({...composed,operationVersion:CURRENT_SCHEDULE_OPERATION_VERSION})[0].operation.version,CURRENT_SCHEDULE_OPERATION_VERSION);
 // The pin is validated before the session owner is consulted: no borrow and no service call for an unsupported pin.
 for(const version of ['0.9.9','0.3','0.2.0.0','','v0.3.0',null,3])
  assert.throws(()=>createRoutineIntentPreparers({sessions:{},service,binding,selectedClientId:clientId,now:f.now,maxRequestMs:5000,operationVersion:version}),
   error=>error.code==='INTENT_CONFIGURATION',`pin ${String(version)}`);
 assert.deepEqual(f.temporal.calls,{describe:0,create:0,update:0,patch:0,delete:0},'no provider effect of any kind');
});
test('SDK schedule preparation remains prepare-only on revoked policy and session',async t=>{
 const f=await fixture(t);f.state.allowed=false;await assert.rejects(f.prepare());assert.equal(f.temporal.calls.create,0);
 f.state.allowed=true;f.sessions.close();await assert.rejects(f.prepare('schedule_task',routineRequest(),2));assert.equal(f.temporal.calls.create,0);
});
test('SDK original review survives a later HTTP request deadline while approval uses fresh current policy',async t=>{
 const f=await fixture(t),prepared=await f.prepare();f.state.now+=6000;
 const result=await f.post('approve',{operation:'schedule_task',request:prepared.request,proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'});
 assert.equal(result.status,200,await result.clone().text());assert.equal(f.temporal.calls.create,1);
});
test('dedicated preparation and exact lost response recovery survive the old request deadline',async t=>{
 const f=await fixture(t),response=await f.post('prepare',{requestId:'dedicated-review',operation:'schedule_task',request:routineRequest()});assert.equal(response.status,200);
 const prepared=await response.json();f.state.now+=6000;
 const result=await f.post('approve',{operation:'schedule_task',request:routineRequest(),proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'});
 assert.equal(result.status,200,await result.clone().text());assert.equal(f.temporal.calls.create,1);
 const replay=await f.post('prepare',{requestId:'dedicated-review',operation:'schedule_task',request:routineRequest()});assert.equal(replay.status,200);assert.deepEqual(await replay.json(),prepared);
 assert.equal((await f.post('approve',{operation:'schedule_task',request:routineRequest(),proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'})).status,200);assert.equal(f.temporal.calls.create,1);
});

for(const refusal of ['revoked','expired','policy','retention'])test(`delayed explicit approval refuses fresh ${refusal} before Temporal`,async t=>{
 const f=await fixture(t),prepared=await f.prepare();f.state.now+=6000;
 if(refusal==='revoked')f.state.revoked=true;else if(refusal==='expired')f.state.now+=60000;else if(refusal==='retention')f.state.retentionRefused=true;else f.state.allowed=false;
 const result=await f.post('approve',{operation:'schedule_task',request:prepared.request,proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'});
 assert.notEqual(result.status,200);assert.equal(f.temporal.calls.create,0);
});

const approveBody=prepared=>({operation:prepared.proposal.operation,request:prepared.request,proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'});
async function createRoutine(f){
 const prepared=await f.prepare(),response=await f.post('approve',approveBody(prepared));
 assert.equal(response.status,200,await response.clone().text());return prepared.proposal.projection.scheduleId;
}
for(const [runState,changedImage] of [['failed',false],['cancelled',false],['completed',true],['failed',true],['cancelled',true]])test(`existing session lists and stops future firings after ${runState}${changedImage?' and a changed image':''} without starting model work`,async t=>{
 const f=await fixture(t),scheduleId=await createRoutine(f);f.nativeState.runState=runState;
 if(changedImage)f.nativeState.versions={...versions,imageDigest:'sha256:'+'c'.repeat(64)};
 const listed=await f.post('list',{limit:1,historyLimit:0});assert.equal(listed.status,200,await listed.clone().text());
 assert.equal((await listed.json()).page.rows[0].projection.scheduleId,scheduleId);
 for(const mode of ['pause','delete']){
  const request={scheduleId,mode,running:'leave',runs:[],note:`Stop future firings: ${mode}`},before={...f.temporal.calls};
  const response=await f.post('prepare',{requestId:`terminal-${mode}`,operation:'cancel_scheduled_task',request});
  assert.equal(response.status,200,await response.clone().text());const prepared={...await response.json(),request};
  assert.equal(prepared.status,'approval_required');assert.deepEqual(f.temporal.calls,before,'preparation does not apply the schedule change');
  const approved=await f.post('approve',approveBody(prepared));assert.equal(approved.status,200,await approved.clone().text());const result=await approved.json();
  assert.equal(result.receipt.projection.state,mode==='pause'?'paused':'cancelled');assert.equal(result.receipt.physicalStopProven,false);
  assert.equal(f.temporal.calls[mode==='pause'?'patch':'delete'],1);
  const after={...f.temporal.calls},replayed=await f.post('approve',approveBody(prepared));assert.equal(replayed.status,200);
  assert.deepEqual(await replayed.json(),result);assert.deepEqual(f.temporal.calls,after,'ACK replay never repeats a provider effect');
 }
 assert.equal(f.temporal.calls.create,1);assert.equal(f.temporal.calls.update,0);
});

for(const runState of ['failed','cancelled'])test(`terminal ${runState} management does not enable create, update or current-work cancellation`,async t=>{
 const f=await fixture(t),scheduleId=await createRoutine(f);
 const update=await f.prepare('update_scheduled_task',{...routineRequest(),scheduleId},2);
 f.nativeState.runState=runState;const before={...f.temporal.calls};
 for(const [operation,request] of [['schedule_task',routineRequest()],['update_scheduled_task',{...routineRequest(),scheduleId}],
  ['cancel_scheduled_task',{scheduleId,mode:'pause',running:'request_cancel',runs:[],note:'Stop current work'}]]){
  const response=await f.post('prepare',{requestId:`terminal-${operation}`,operation,request});assert.notEqual(response.status,200);
 }
 const approved=await f.post('approve',approveBody(update));assert.notEqual(approved.status,200);
 assert.deepEqual(f.temporal.calls,before,'terminal management cannot widen or retire running work');
});

test('changed image does not enable create, update or current-work cancellation for an existing running session',async t=>{
 const f=await fixture(t),scheduleId=await createRoutine(f),update=await f.prepare('update_scheduled_task',{...routineRequest(),scheduleId},2);
 f.nativeState.versions={...versions,imageDigest:'sha256:'+'c'.repeat(64)};const before={...f.temporal.calls};
 for(const [operation,request] of [['schedule_task',routineRequest()],['update_scheduled_task',{...routineRequest(),scheduleId}],
  ['cancel_scheduled_task',{scheduleId,mode:'pause',running:'request_cancel',runs:[],note:'Stop current work'}]]){
  const response=await f.post('prepare',{requestId:`changed-image-${operation}`,operation,request});assert.notEqual(response.status,200);
 }
 assert.notEqual((await f.post('approve',approveBody(update))).status,200);
 assert.deepEqual(f.temporal.calls,before,'a historical image cannot authorize execution changes or current-work retirement');
});

test('terminal routine management after a changed image retains current policy, owner, head, retention and generation fences',async t=>{
 const f=await fixture(t),scheduleId=await createRoutine(f);f.nativeState.runState='failed';
 f.nativeState.budget=0;f.nativeState.budgetUnavailable=true;
 f.nativeState.versions={...versions,imageDigest:'sha256:'+'c'.repeat(64)};
 const request={scheduleId,mode:'pause',running:'leave',runs:[],note:'Pause the selected generation'};
 const prepare=async requestId=>{const r=await f.post('prepare',{requestId,operation:'cancel_scheduled_task',request});assert.equal(r.status,200,await r.clone().text());return {...await r.json(),request};};
 const first=await prepare('terminal-pause-first'),stale=await prepare('terminal-pause-stale');
 assert.equal((await f.post('approve',approveBody(first))).status,200);const after={...f.temporal.calls};
 assert.notEqual((await f.post('approve',approveBody(stale))).status,200);assert.deepEqual(f.temporal.calls,after);
 f.nativeState.reserved=true;assert.notEqual((await f.post('list',{})).status,200);f.nativeState.reserved=false;
 f.state.allowed=false;assert.notEqual((await f.post('list',{})).status,200);f.state.allowed=true;
 f.state.retentionRefused=true;assert.notEqual((await f.post('list',{})).status,200);f.state.retentionRefused=false;
 f.state.revoked=true;assert.notEqual((await f.post('list',{})).status,200);f.state.revoked=false;
 f.state.actorId='another-actor';assert.notEqual((await f.post('list',{})).status,200);
 assert.deepEqual(f.temporal.calls,after);
});

for(const modelPolicy of ['zero','unavailable','changed'])test(`exact-session public management remains available with ${modelPolicy} model policy`,async t=>{
 const f=await fixture(t),scheduleId=await createRoutine(f);f.nativeState.runState='failed';f.nativeState.budgetReads=0;
 f.nativeState.versions={...versions,imageDigest:'sha256:'+'c'.repeat(64)};
 if(modelPolicy==='zero')f.nativeState.budget=0;
 if(modelPolicy==='unavailable')f.nativeState.budgetUnavailable=true;
 if(modelPolicy==='changed')f.state.policyHook=()=>{f.nativeState.budget=0;f.nativeState.budgetUnavailable=true;};
 const listed=await f.post('list',{limit:1,historyLimit:0});assert.equal(listed.status,200,await listed.clone().text());
 assert.equal((await listed.json()).page.rows[0].projection.scheduleId,scheduleId);
 for(const mode of ['pause','delete']){
  const request={scheduleId,mode,running:'leave',runs:[],note:'Stop future firings'},before={...f.temporal.calls};
  const response=await f.post('prepare',{requestId:`budget-${mode}`,operation:'cancel_scheduled_task',request});assert.equal(response.status,200,await response.clone().text());
  const prepared={...await response.json(),request};assert.equal(prepared.status,'approval_required');assert.deepEqual(f.temporal.calls,before);
  const approved=await f.post('approve',approveBody(prepared));assert.equal(approved.status,200,await approved.clone().text());
  const result=await approved.json();assert.equal(result.receipt.physicalStopProven,false);assert.equal(result.receipt.projection.state,mode==='pause'?'paused':'cancelled');
  const after={...f.temporal.calls};assert.equal(after[mode==='pause'?'patch':'delete'],1);
  const replay=await f.post('approve',approveBody(prepared));assert.equal(replay.status,200);assert.deepEqual(await replay.json(),result);assert.deepEqual(f.temporal.calls,after);
 }
 assert.equal(f.nativeState.budgetReads,0);assert.equal(f.temporal.calls.create,1);assert.equal(f.temporal.calls.update,0);
});

for(const modelPolicy of ['zero','unavailable','changed'])test(`execution preparation and approval still refuse ${modelPolicy} model policy`,async t=>{
 const f=await fixture(t),scheduleId=await createRoutine(f),update=await f.prepare('update_scheduled_task',{...routineRequest(),scheduleId},2),before={...f.temporal.calls};
 if(modelPolicy==='zero')f.nativeState.budget=0;
 if(modelPolicy==='unavailable')f.nativeState.budgetUnavailable=true;
 if(modelPolicy==='changed')f.state.policyHook=()=>{f.nativeState.budget=1000000;};
 for(const [operation,request] of [['schedule_task',routineRequest()],['update_scheduled_task',{...routineRequest(),scheduleId}],
  ['cancel_scheduled_task',{scheduleId,mode:'pause',running:'request_cancel',runs:[],note:'Stop current work'}]]){
  if(modelPolicy==='changed')f.nativeState.budget=2000000;
  assert.notEqual((await f.post('prepare',{requestId:`budget-denial-${operation}`,operation,request})).status,200);
 }
 if(modelPolicy==='changed')f.nativeState.budget=2000000;
 assert.notEqual((await f.post('approve',approveBody(update))).status,200);assert.deepEqual(f.temporal.calls,before);
});
