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
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
async function fixture(t){
 const f=await applicationFixture();t.after(()=>f.close());
 const configuration={sourceEnabled:true,intents:{enabled:true},routines:{enabled:true},limits:{requestMs:5000,requestBytes:131072},native:{maxResponseBytes:131072}};
 const store={async read(){return {run:{binding,scopes:f.scopes(),versions,policyRevision:'p1',state:'running'}};},async readModelPolicy(){return {maxBudgetMicroUsd:2000000};},nextRuns:{async current(){return {reserved:false,binding,scopes:f.scopes(),policyRevision:'p1'};}}};
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
 return {...f,port,prepare,post};
}
test('SDK offers all three schedules through the real family and one journal; explicit approval reaches Temporal once',async t=>{
 const f=await fixture(t),available=await (await f.port()).readAvailability();
 assert.deepEqual(available.operations.map(o=>o.id),['schedule_task','update_scheduled_task','cancel_scheduled_task']);
 const prepared=await f.prepare();assert.equal(f.preparations.state.rows.size,1);assert.equal(f.temporal.calls.create,0);assert.deepEqual(prepared.request,routineRequest());
 assertPreparedResult('schedule',{id:'schedule_task',version:'0.2.0'},prepared,binding,{scopes:f.scopes(),nowMs:f.now()});
 const history=createIntentApprovalOwner({journal:createPostgresIntentJournalStore({pool:f.pool}),now:f.now,limits:{maxRequestMs:5000},enabled:true});
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
