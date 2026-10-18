/** The Objective `runs` port end to end in one process: lifecycle activity -> worker native port -> actual native capability
 * client -> private control native operation -> run owner -> run-start store (SYNTHETIC pg pool). Core, admission, the
 * conversation store and Temporal are SYNTHETIC ports; no Core claim, database, socket or Temporal server is involved. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {createObjectiveRunsApplication,OBJECTIVE_RUNS_PREFIX} from '../native-authority/objective-runs-http.mjs';
import {composeObjectiveRuns} from '../native-authority/objective-runs-composition.mjs';
import {createPostgresObjectiveRunStartStore} from '../objective-source/postgres-run-starts.mjs';
import {runStartFixture,syntheticObjectivePool,id,NOW} from '../objective-source/test/run-start-fixture.mjs';
import {createObjectiveRunOwner} from './run-owner.mjs';
import {createObjectiveNativeRunsPort} from './native-runs-port.mjs';
import {createObjectiveGenerationActivities} from './lifecycle-activities.mjs';
import {createObjectiveWorkerActivities,objectiveWorkerPorts} from './worker-activities.mjs';
import {compileObjectiveGenerationConfiguration} from './configuration.mjs';

const CONTROL='synthetic-control-capability-0123456789abcdef',origin='https://control.internal.invalid';
function harness({admitFails=false,dispatchFails=false,enabled=true}={}){
 const f=runStartFixture(),{pool,state}=syntheticObjectivePool(),clock={now:NOW},calls={admit:[],dispatch:[],reads:0};
 const runStarts=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:f.tenantId,now:()=>clock.now});
 const run={binding:f.binding,state:'queued',scopes:[{tenantId:f.tenantId,kind:'client',resourceId:f.clientId,policyRevision:'policy1'}],createdAt:new Date(NOW).toISOString(),policyRevision:'policy1',
  versions:{imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};
 const conversation={saved:null};
 const admission={async admit({record}){calls.admit.push(record);if(admitFails)throw Error('SYNTHETIC_ADMISSION_LOST');conversation.saved={run:structuredClone(run),request:structuredClone(f.acceptedRequest)};
  return {binding:record.binding,requestSha256:record.sourceRequestSha256,expiresAtMs:NOW+60000,replayed:calls.admit.length>1};}};
 const dispatcher={async start({binding}){calls.dispatch.push(binding);if(dispatchFails)throw Object.assign(Error('lost'),{code:'TEMPORAL_DISPATCH_UNKNOWN'});}};
 const store={async readOptional(binding,_page,check){check();calls.reads++;return conversation.saved&&hash(conversation.saved.run.binding)===hash(binding)?structuredClone(conversation.saved):null;}};
 const owner=createObjectiveRunOwner(enabled?{enabled:true,runStarts,admission,dispatcher,store,now:()=>clock.now}:{});
 const app=createObjectiveRunsApplication({controlCapabilitySha256:capabilityDigest(CONTROL),owner,enabled:true,now:()=>clock.now});
 const requests=[];
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:4194304},credential:CONTROL,now:()=>clock.now,
  fetch:async(url,init)=>{const request=new Request(url,init);requests.push(request.url);return await app.handle(request)??Response.json({error:{code:'ROUTE_NOT_FOUND'}},{status:404});}});
 const port=createObjectiveNativeRunsPort({native});
 const client={async readAdmission(){return {sourceAdmission:structuredClone(f.selection.sourceAdmission)};},
  async readRequest(){return {requestSha256:hash(f.selection.request),request:structuredClone(f.selection.request),executionContext:structuredClone(f.selection.executionContext),queuedType:f.selection.queuedType};}};
 const activities=createObjectiveGenerationActivities({clientFor:()=>client,runs:port,context:()=>({cancellationSignal:new AbortController().signal}),now:()=>clock.now});
 const input={generationJobId:f.generationJobId,binding:f.binding,notAfterMs:NOW+3600000};
 return {f,state,clock,calls,conversation,owner,app,native,port,activities,input,requests};
}
const effect=h=>h.activities.objectiveGenerationStartRun({...h.input,mode:'effect',requestSha256:hash(h.f.selection.request)});
const readBack=h=>h.activities.objectiveGenerationStartRun({...h.input,mode:'read',requestSha256:hash(h.f.selection.request)});

test('startRun effect persists the run start first, then admits and dispatches; readRun observes the accepted run',async()=>{
 const h=harness();assert.deepEqual(await h.activities.objectiveGenerationReadRun(h.input),{kind:'unconfirmed'},'no run yet: read answers run:null');
 assert.deepEqual(await effect(h),{kind:'started'});
 assert.equal(h.state.runStarts.size,1);assert.deepEqual([...h.state.runStarts.values()][0].record,h.f.record);
 assert.deepEqual(h.calls.admit,[h.f.record]);assert.deepEqual(h.calls.dispatch,[h.f.binding]);
 assert.ok(h.requests.every(u=>u.startsWith(origin+OBJECTIVE_RUNS_PREFIX)));
 assert.deepEqual(await h.activities.objectiveGenerationReadRun(h.input),{kind:'state',state:'queued'});
 assert.deepEqual(await readBack(h),{kind:'started'});
 assert.deepEqual(await effect(h),{kind:'started'},'a repeated effect is idempotent');assert.equal(h.state.runStarts.size,1);assert.equal(h.calls.admit.length,2);
});

test('a failure after the run-start write is unconfirmed; read-back reports absence until the run exists, never a second start',async()=>{
 const h=harness({admitFails:true});assert.deepEqual(await effect(h),{kind:'unconfirmed'});
 assert.equal(h.state.runStarts.size,1,'the start row precedes any run, so the run can only ever be Objective');
 assert.deepEqual(await readBack(h),{kind:'absent'});
 const d=harness({dispatchFails:true});assert.deepEqual(await effect(d),{kind:'unconfirmed'});assert.deepEqual(await readBack(d),{kind:'started'});
});

test('a disabled owner and a refused selection are definite no-ops: not-started, nothing written',async()=>{
 const off=harness({enabled:false});assert.deepEqual(await effect(off),{kind:'not-started'});assert.equal(off.state.connects,0);
 assert.deepEqual(await readBack(off),{kind:'unconfirmed'},'read never claims absence for an unavailable owner');
 const h=harness();
 assert.deepEqual(await h.port.start({binding:{...h.f.binding,runId:id(99)},generationJobId:h.f.generationJobId,acceptedRequest:h.f.acceptedRequest,selection:h.f.selection}),{kind:'not-started'});
 assert.deepEqual(await h.port.start({binding:h.f.binding,generationJobId:h.f.generationJobId,acceptedRequest:{...h.f.acceptedRequest,prompt:'x'},selection:h.f.selection}),{kind:'not-started'});
 h.clock.now=h.f.record.effectExpiresAtMs;
 assert.deepEqual(await h.port.start({binding:h.f.binding,generationJobId:h.f.generationJobId,acceptedRequest:h.f.acceptedRequest,selection:h.f.selection}),{kind:'not-started'});
 assert.equal(h.state.connects,0);
 const down=harness();down.state.queryHook=item=>{if(item.text.startsWith('INSERT'))throw Error('SYNTHETIC_CONNECTION_RESET');};
 assert.deepEqual(await effect(down),{kind:'not-started'},'the store committed nothing: still a definite no-op');
 assert.equal(down.state.runStarts.size,0);assert.equal(down.calls.admit.length,0);
 down.state.queryHook=null;assert.deepEqual(await effect(down),{kind:'started'},'the repeated effect completes the same single run');
});

test('the native operations require the exact control capability, POST JSON and closed bodies',async()=>{
 const h=harness(),url=origin+OBJECTIVE_RUNS_PREFIX+'read',body=JSON.stringify({binding:h.f.binding});
 const call=(init={},target=url)=>h.app.handle(new Request(target,{method:'POST',headers:{authorization:'Bearer '+CONTROL,'content-type':'application/json'},body,...init}));
 assert.equal((await call()).status,200);assert.deepEqual(await (await call()).json(),{run:null});
 for(const init of [{headers:{authorization:'Bearer wrong-capability','content-type':'application/json'}},{headers:{'content-type':'application/json'}},
  {headers:{authorization:'Bearer '+CONTROL,'content-type':'text/plain'}},{body:JSON.stringify({binding:h.f.binding,extra:1})},{body:'{'}])assert.equal((await call(init)).status,503);
 assert.equal((await call({},url+'?x=1')).status,503);assert.equal(await call({},origin+'/v1/objective-generation/other'),null);
 const disabled=createObjectiveRunsApplication({controlCapabilitySha256:capabilityDigest(CONTROL)});assert.equal(disabled.state(),'disabled');
 assert.equal(await disabled.handle(new Request(url,{method:'POST',body})),null,'disabled: the boundary answers 404, nothing is read');
 assert.throws(()=>createObjectiveRunsApplication({controlCapabilitySha256:capabilityDigest(CONTROL),enabled:true}),/OBJECTIVE_RUNS_UNAVAILABLE/u);
});

test('the worker port refuses a reply for another binding or an open reply shape',async()=>{
 const other=runStartFixture({generationJobId:id(22)}).binding,f=runStartFixture();
 const reply=value=>createObjectiveNativeRunsPort({native:{async call(){return value;}}});
 await assert.rejects(reply({run:{binding:other,state:'queued'}}).read({binding:f.binding}),/OBJECTIVE_RUNS_UNAVAILABLE|INVALID/u);
 await assert.rejects(reply({kind:'started',extra:1}).start({binding:f.binding,generationJobId:f.generationJobId,acceptedRequest:f.acceptedRequest,selection:f.selection}),/OBJECTIVE_RUNS_UNAVAILABLE/u);
 await assert.rejects(reply({kind:'maybe'}).start({binding:f.binding,generationJobId:f.generationJobId,acceptedRequest:f.acceptedRequest,selection:f.selection}),/OBJECTIVE_RUNS_UNAVAILABLE/u);
 assert.throws(()=>createObjectiveNativeRunsPort({}),/OBJECTIVE_RUNS_UNAVAILABLE/u);
});

test('declarations: absent is disabled everywhere; worker ports and control composition follow objectiveGeneration only',()=>{
 assert.deepEqual(compileObjectiveGenerationConfiguration({},'control'),{runs:false,start:null});
 assert.deepEqual(compileObjectiveGenerationConfiguration({objectiveGeneration:{runs:{enabled:true}}},'temporal-worker'),{runs:true,start:null});
 assert.deepEqual(compileObjectiveGenerationConfiguration({objectiveGeneration:{start:{enabled:true,windowMs:1800000}}},'control'),{runs:false,start:{windowMs:1800000}});
 for(const [c,role] of [[{objectiveGeneration:{start:{enabled:true,windowMs:1800000}}},'temporal-worker'],[{objectiveGeneration:{runs:{enabled:'yes'}}},'control'],
  [{objectiveGeneration:{runs:{enabled:true,extra:1}}},'control'],[{objectiveGeneration:{start:{enabled:true,windowMs:1000}}},'control'],[{objectiveGeneration:{}},'conversation-runner']])
  assert.throws(()=>compileObjectiveGenerationConfiguration(c,role),/OBJECTIVE_GENERATION_CONFIGURATION/u);
 const native={call(){throw Error('MUST_NOT_CALL');}};
 assert.deepEqual(objectiveWorkerPorts({configuration:{},native}),{});
 assert.deepEqual(Object.keys(objectiveWorkerPorts({configuration:{objectiveGeneration:{runs:{enabled:true}}},native})),['runs']);
 assert.deepEqual(Object.keys(createObjectiveWorkerActivities(objectiveWorkerPorts({configuration:{objectiveGeneration:{runs:{enabled:true}}},native}))).length,4);
 const digest=capabilityDigest(CONTROL),configuration={limits:{requestMs:3000},temporal:{taskQueue:'q'}};
 assert.equal(composeObjectiveRuns({configuration,controlCapabilitySha256:digest}).state,'disabled');
 const declared=composeObjectiveRuns({configuration:{...configuration,objectiveGeneration:{runs:{enabled:true}}},controlCapabilitySha256:digest});
 assert.equal(declared.state,'owners-unavailable','declared without Core authority or the dynamic-initial-run template: mounted, answers not-started');
 assert.deepEqual(declared.tables,[]);
});
