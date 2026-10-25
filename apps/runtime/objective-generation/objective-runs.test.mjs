/** Worker -> private control HTTP -> existing run-start owner. SQL, Core, admission and Temporal transports are synthetic. */
import test,{beforeEach} from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {createObjectiveActivitiesApplication,OBJECTIVE_ACTIVITIES_PREFIX} from '../native-authority/objective-runs-http.mjs';
import {composeObjectiveRuns} from '../native-authority/objective-runs-composition.mjs';
import {createPostgresObjectiveRunStartStore} from '../objective-source/postgres-run-starts.mjs';
import {runStartFixture,syntheticObjectivePool,id,NOW} from '../objective-source/test/run-start-fixture.mjs';
import {createObjectiveRunOwner} from './run-owner.mjs';
import {createObjectiveGenerationActivities} from './lifecycle-activities.mjs';
import {createObjectiveWorkerActivities,objectiveWorkerPorts} from './worker-activities.mjs';
import {compileObjectiveGenerationConfiguration} from './configuration.mjs';
import {createMemoryRetentionJournal} from '../../control/retention/memory-journal.mjs';
import {createRetentionReadGate} from '../../control/retention/suppression.mjs';
import {createServingGate} from '../../control/retention/reconciliation.mjs';
import {subjectKey} from '../../control/retention/boundary.mjs';

const CONTROL='synthetic-control-capability-0123456789abcdef',origin='https://control.internal.invalid';
beforeEach(t=>t.mock.timers.enable({apis:['Date'],now:NOW}));
function harness({admitFails=false,dispatchFails=false,acceptFails=null,enabled=true,gateController=null}={}){
 const f=runStartFixture(),{pool,state}=syntheticObjectivePool(),clock={now:NOW},calls={admit:[],accept:[],dispatch:[],reads:0},conversation={saved:null,accepted:false};
 const runStarts=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:f.tenantId,now:()=>clock.now});
 const run={binding:f.binding,state:'queued',scopes:[{tenantId:f.tenantId,kind:'client',resourceId:f.clientId,policyRevision:'policy1'}],createdAt:new Date(NOW).toISOString(),policyRevision:'policy1',
  versions:{imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};
 const admission={async prepare({record,signal}){conversation.registered=true;if(gateController){gateController.abort();assert.equal(signal.aborted,true);}return {binding:record.binding};},async admit({record}){calls.admit.push(record);if(admitFails)throw Error('admission lost');conversation.saved={run:structuredClone(run),request:structuredClone(f.acceptedRequest)};
  return {binding:record.binding,requestSha256:record.sourceRequestSha256};}};
 const core={async accept({record}){calls.accept.push(record);assert.ok(conversation.saved,'canonical queued run exists before Core claim');assert.equal(calls.dispatch.length,0);
  if(acceptFails==='before')throw Error('lost');conversation.accepted=true;if(acceptFails==='after')throw Error('lost reply');},
  async readAcceptance(){if(!conversation.accepted)throw Error('acceptance unconfirmed');}};
 const dispatcher={async start({binding}){assert.equal(conversation.accepted,true);calls.dispatch.push(binding);if(dispatchFails)throw Error('lost dispatch acknowledgment');}};
 const store={async readOptional(binding,_page,check){check();calls.reads++;return conversation.saved&&hash(conversation.saved.run.binding)===hash(binding)?structuredClone(conversation.saved):null;}};
 const retentionJournal=createMemoryRetentionJournal(),gate=createRetentionReadGate({journal:retentionJournal,serving:createServingGate()});
 const retention=gateController?{...gate,withRelease(subjects,release,options){return gate.withRelease(subjects,(_signal,...rest)=>release(gateController.signal,...rest),options);}}:gate;
 const owner=createObjectiveRunOwner(enabled?{enabled:true,runStarts,admission,core,dispatcher,store,retention,now:()=>clock.now}:{}),runs={start:owner.start,async read(v){return (await owner.read(v)).run;}};
 const client={async current(){return {};},async admit(){return {sourceAdmission:f.selection.sourceAdmission,sourceAdmissionSha256:f.record.sourceAdmissionSha256};},
  async publish(){return {request:f.selection.request,requestSha256:hash(f.selection.request)};},
  async readAdmission(){return {sourceAdmission:f.selection.sourceAdmission,sourceAdmissionSha256:f.record.sourceAdmissionSha256,acceptance:conversation.accepted?{}:null};},
  async readRequest(){return {requestSha256:hash(f.selection.request),request:f.selection.request,executionContext:f.selection.executionContext,queuedType:f.selection.queuedType};},
  async readCompletion(){return {strategyId:id(70),strategyVersionId:id(71),objectiveReceiptSha256:'b'.repeat(64)};}};
 const app=createObjectiveActivitiesApplication({controlCapabilitySha256:capabilityDigest(CONTROL),activitiesFor:({signal})=>createObjectiveGenerationActivities({clientFor:()=>client,runs,context:()=>({cancellationSignal:signal}),now:()=>clock.now}),now:()=>clock.now});
 const requests=[],native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:16384},credential:CONTROL,now:()=>clock.now,fetch:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return await app.handle(new Request(url,init))??Response.json({}, {status:404});}});
 const context=()=>({cancellationSignal:new AbortController().signal}),activities=createObjectiveWorkerActivities({native,context}),input={generationJobId:f.generationJobId,binding:f.binding,notAfterMs:NOW+3600000};
 return {f,state,clock,calls,conversation,owner,app,native,activities,input,requests,run,context,retentionJournal};
}
const effect=h=>h.activities.objectiveGenerationStartRun({...h.input,mode:'effect',requestSha256:hash(h.f.selection.request)});
const readBack=h=>h.activities.objectiveGenerationStartRun({...h.input,mode:'read',requestSha256:hash(h.f.selection.request)});
test('all four worker activities carry only job/binding/state while control accepts Core before dispatch',async()=>{
 const h=harness();assert.equal((await h.activities.objectiveGenerationSource(h.input)).kind,'ready');
 assert.deepEqual(await effect(h),{kind:'started'});assert.equal(h.state.runStarts.size,1);assert.deepEqual(h.calls.admit,[h.f.record]);assert.deepEqual(h.calls.accept,[h.f.record]);assert.deepEqual(h.calls.dispatch,[h.f.binding]);
 assert.deepEqual(await h.activities.objectiveGenerationReadRun(h.input),{kind:'state',state:'queued'});
 h.conversation.saved.run.state='completed';
 assert.equal((await h.activities.objectiveGenerationComplete({...h.input,sourceAdmissionSha256:h.f.record.sourceAdmissionSha256})).kind,'completed');
 assert.ok(h.requests.every(r=>r.url.startsWith(origin+OBJECTIVE_ACTIVITIES_PREFIX)));
 assert.equal(JSON.stringify(h.requests).includes(h.f.acceptedRequest.prompt),false);assert.equal(JSON.stringify(h.requests).includes('service-secret'),false);
});
test('unknown admission never becomes a second run; Core acceptance unknown blocks dispatch until exact readback',async()=>{
 const a=harness({admitFails:true});assert.deepEqual(await effect(a),{kind:'unconfirmed'});assert.equal(a.state.runStarts.size,1);assert.deepEqual(await readBack(a),{kind:'absent'});assert.equal(a.calls.dispatch.length,0);
 const before=harness({acceptFails:'before'});assert.deepEqual(await effect(before),{kind:'unconfirmed'});assert.deepEqual(await readBack(before),{kind:'unconfirmed'});assert.equal(before.calls.dispatch.length,0);assert.equal(before.calls.accept.length,1);
 const after=harness({acceptFails:'after'});assert.deepEqual(await effect(after),{kind:'unconfirmed'});assert.equal(after.calls.dispatch.length,0);assert.deepEqual(await readBack(after),{kind:'started'});assert.equal(after.calls.accept.length,1);assert.equal(after.calls.dispatch.length,1);
});
test('suppression blocks Objective registration, saved prompt reads and dispatch through the canonical retention gate',async()=>{
 const before=harness(),subject=h=>({tenantId:h.f.tenantId,kind:'conversation',subjectId:h.f.binding.conversationId});
 await before.retentionJournal.set(subjectKey(subject(before)),{state:'SUPPRESSED'});
 assert.deepEqual(await effect(before),{kind:'unconfirmed'});assert.equal(before.conversation.registered,undefined);assert.equal(before.state.connects,0);assert.equal(before.calls.dispatch.length,0);
 const after=harness();assert.deepEqual(await effect(after),{kind:'started'});const reads=after.calls.reads,dispatches=after.calls.dispatch.length;
 await after.retentionJournal.set(subjectKey(subject(after)),{state:'PURGED'});
 assert.deepEqual(await readBack(after),{kind:'unconfirmed'});assert.equal(after.calls.reads,reads);assert.equal(after.calls.dispatch.length,dispatches);
});

test('serving lease cancellation reaches preparation and prevents a later private write or dispatch',async()=>{
 const h=harness({gateController:new AbortController()});assert.deepEqual(await effect(h),{kind:'unconfirmed'});
 assert.equal(h.conversation.registered,true);assert.equal(h.state.runStarts.size,0);assert.equal(h.state.connects,0);
 assert.equal(h.calls.admit.length,0);assert.equal(h.calls.dispatch.length,0);
});
test('dispatch retry is only the same accepted Temporal identity; unavailable stores never invent absence',async()=>{
 const h=harness({dispatchFails:true});assert.deepEqual(await effect(h),{kind:'unconfirmed'});assert.deepEqual(await readBack(h),{kind:'unconfirmed'});assert.deepEqual(h.calls.dispatch,[h.f.binding,h.f.binding]);
 const off=harness({enabled:false});assert.deepEqual(await effect(off),{kind:'not-started'});assert.equal(off.state.connects,0);assert.deepEqual(await readBack(off),{kind:'unconfirmed'});
 const down=harness();down.state.queryHook=item=>{if(item.text.startsWith('INSERT'))throw Error('down');};assert.deepEqual(await effect(down),{kind:'not-started'});assert.equal(down.state.runStarts.size,0);
});
test('private activity transport requires existing capability and closed bounded job input',async()=>{
 const h=harness(),url=origin+OBJECTIVE_ACTIVITIES_PREFIX+'source',call=(body,headers={})=>h.app.handle(new Request(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+CONTROL,...headers},body:JSON.stringify(body)}));
 assert.equal((await call(h.input,{authorization:'Bearer wrong'})).status,503);assert.equal((await call({...h.input,prompt:'injected'})).status,503);
 assert.equal((await call({...h.input,sourcePath:'injected'})).status,503);assert.equal(h.state.connects,0);
 assert.equal(await h.app.handle(new Request(origin+'/v1/objective-generation/runs/start',{method:'POST'})),null);
});
test('worker refuses foreign/open result shapes and has no Core client port',async()=>{
 const h=harness();for(const answer of [{kind:'ready',sourceAdmissionSha256:'x',requestSha256:'x',effectExpiresAtMs:NOW+10},{kind:'unconfirmed',extra:true},{kind:'started'}]){
  const worker=createObjectiveWorkerActivities({native:{async call(){return answer;}},context:h.context});await assert.rejects(worker.objectiveGenerationSource(h.input));}
 assert.throws(()=>createObjectiveWorkerActivities({clientFor(){}}));assert.throws(()=>createObjectiveWorkerActivities({runs:{}}));
});
test('enabled configuration requires actual owners and a starter requires enabled runs',()=>{
 const native={call(){throw Error('not called');}},configuration={limits:{requestMs:3000},temporal:{taskQueue:'q'}},controlCapabilitySha256=capabilityDigest(CONTROL);
 assert.deepEqual(compileObjectiveGenerationConfiguration({},'control'),{runs:false,start:null});assert.deepEqual(objectiveWorkerPorts({configuration:{},native}),{});
 assert.deepEqual(Object.keys(objectiveWorkerPorts({configuration:{objectiveGeneration:{runs:{enabled:true}}},native})),['native']);
 assert.equal(composeObjectiveRuns({configuration,controlCapabilitySha256}).state,'disabled');
 assert.throws(()=>composeObjectiveRuns({configuration:{...configuration,objectiveGeneration:{runs:{enabled:true}}},controlCapabilitySha256}));
 assert.throws(()=>compileObjectiveGenerationConfiguration({objectiveGeneration:{start:{enabled:true,windowMs:1800000}}},'control'));
});
