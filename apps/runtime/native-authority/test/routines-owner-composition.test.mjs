/** SYNTHETIC: startup owner derivation and native retirement. No Core, SQL, Temporal or ECS operation runs here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {allocation} from '../../../gateway/budget/tool-budget-binding.mjs';
import {applicationFixture} from '../../../control/schedules/test/application-fixture.mjs';
import {createAttendedRoutinesContextOwner,createNativeRoutinesContextOwner,createAttendedRoutinesOwnerComposition,createAttendedRoutinesRetirement,deriveAttendedRoutinesOwners,retargetRoutinesAllocation,compileNativeRoutinesTask,createNativeRoutinesOccurrenceOwners} from '../routines-owner-composition.mjs';
import {agentcoreConfig} from '../../test/agentcore-fixture.mjs';
import {scheduledAdmissionFixture} from './scheduled-admission-fixture.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';

const code=value=>error=>error?.code===value;
const binding={tenantId:'10000000-0000-4000-8000-000000000001',actorId:'10000000-0000-4000-8000-000000000002',conversationId:'10000000-0000-4000-8000-000000000003',runId:'10000000-0000-4000-8000-000000000004',attemptId:'10000000-0000-4000-8000-000000000005',workerId:'10000000-0000-4000-8000-000000000006',writerFence:1};
const principal={tenantId:binding.tenantId,actorId:binding.actorId};
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
const at=1000000;

async function nativeFixture({general=false}={}){
 const f=await applicationFixture(),b=f.contextConfiguration.commandContext.binding,selectedClientId=general?null:f.contextConfiguration.commandContext.clientResolution.clientId;
 const scopes=[{tenantId:b.tenantId,kind:general?'private-user':'client',resourceId:selectedClientId??b.actorId,policyRevision:'p1'}];
 const state={binding:b,selectedClientId,scopes,runState:'running',versions,budget:2000000,budgetReads:0,budgetUnavailable:false,reserved:false,reads:0,policyHook:null};
 const authentication={principal:{sessionId:'synthetic-session',tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId},sessionRevision:'one',checkedAtMs:f.now(),expiresAtMs:f.now()+60000};
 const sessions={async authenticateSession(){return authentication;},async readCurrentState(){return {authenticationSha256:hash(authentication),binding:state.binding,scopes:state.scopes,selectedClientId:state.selectedClientId,checkedAtMs:f.now(),expiresAtMs:f.now()+60000};}};
 const store={async read(){state.reads++;return {run:{binding:state.binding,scopes:state.scopes,versions:state.versions,policyRevision:'p1',state:state.runState}};},
  async readModelPolicy(){state.budgetReads++;if(state.budgetUnavailable)throw Error('model settings unavailable');return {maxBudgetMicroUsd:state.budget};},nextRuns:{async current(){return {reserved:state.reserved,binding:state.binding,scopes:state.scopes,policyRevision:'p1'};}}};
 const policy={async check({selectionSha256}){await state.policyHook?.();return {authorized:true,selectionSha256,binding:b,scopes,selectedClientId,destinationResolution:null,limits:null,checkedAtMs:f.now(),expiresAtMs:f.now()+10000};}};
 const {template,workflow,limits}=f.contextConfiguration;
 const owner=createNativeRoutinesContextOwner({base:{template,workflow,limits,policy,versions,maxRuntimeSeconds:900},sessions,scheduleOwner:f.owner,store,now:f.now,newId:f.newId});
 return {...f,state,owner,store,request:{credential:'opaque-synthetic',operation:'list_scheduled_tasks',request:{},deadlineMs:f.now()+5000}};
}

test('native routines use current session/run and Core policy after a completed invocation',async()=>{
 const f=await nativeFixture();try{
  for(const runState of ['running','completed','waiting-for-approval']){
   f.state.runState=runState;const result=await f.owner.authorizeRequest(f.request);assert.deepEqual(result.binding,f.state.binding);
  }
  assert.ok(f.state.reads>=9,'each preparation and release rechecks the canonical run');
 }finally{await f.close();}
});

test('native General routines preserve the exact private-user owner scope through current session and Core policy',async()=>{
 const f=await nativeFixture({general:true});try{
  const result=await f.owner.authorizeRequest(f.request);assert.equal(result.selectedClientId,null);assert.deepEqual(result.scopes,f.state.scopes);
  f.state.scopes=[{...f.state.scopes[0],resourceId:'foreign-owner'}];await assert.rejects(f.owner.authorizeRequest(f.request));
 }finally{await f.close();}
});

test('native routine task keeps configured identity and pins the effective SDK profile, independent of key order',()=>{
 const configuration={agentcore:agentcoreConfig(),versions,sourceEnabled:true,models:MODEL_CATALOG,routines:{enabled:true,task:{taskId:binding.runId,version:3}}};
 const task=compileNativeRoutinesTask(configuration);assert.equal(task.taskId,binding.runId);assert.equal(task.version,3);
 assert.deepEqual(compileNativeRoutinesTask({...configuration,agentcore:Object.fromEntries(Object.entries(configuration.agentcore).reverse())}),task);
 for(const change of [c=>c.agentcore.runtimeVersion='3',c=>c.agentcore.runWindowMs=60000,c=>c.agentcore.maxOutputBytes--,
  c=>c.versions.skillsDigest='c'.repeat(64),c=>c.sourceEnabled=false,c=>c.models.models[0].available=false,c=>c.intents={enabled:true}]){
  const altered=structuredClone(configuration);change(altered);assert.notEqual(compileNativeRoutinesTask(altered).manifestSha256,task.manifestSha256);
 }
});

test('native occurrence templates use each approved owner and scope, and retirement requires canonical settlement',async()=>{
 const f=await scheduledAdmissionFixture({agentcore:true}),configuration={agentcore:{...agentcoreConfig(),policyRevision:f.template.policyRevision},versions:f.template.versions,sourceEnabled:true,models:MODEL_CATALOG,routines:{enabled:true,task:{taskId:f.template.task.taskId,version:1}},limits:{requestMs:1000}};
 const task=compileNativeRoutinesTask(configuration),occurrence={...f.occurrence,task};let settled=false,stopped=false;
 const owners=createNativeRoutinesOccurrenceOwners({configuration,now:f.now,native:{async call(_operation,input){return {...input,expiresAtMs:f.now()+1000};}},store:{executions:{async settlement(binding){return {run:{binding},settled,stopped};}}}});
 const template=owners.templateFor(occurrence);assert.deepEqual(template.principal,occurrence.projection.owner);assert.deepEqual(template.task,task);assert.equal(Object.hasOwn(template,'allocationJson'),false);
 const general={...occurrence,projection:{...occurrence.projection,scopes:[{tenantId:template.principal.tenantId,kind:'private-user',resourceId:template.principal.actorId,policyRevision:template.policyRevision}]}};
 assert.equal(owners.templateFor(general).selectedClientId,null);
 assert.throws(()=>owners.templateFor({...occurrence,task:{...task,manifestSha256:'d'.repeat(64)}}));
 await assert.rejects(owners.retirement.retire({binding:f.identity.binding}));settled=true;
 // A settled record is the runner's acknowledgement; without a provider-confirmed stop the retirement is honestly unproven.
 assert.deepEqual(await owners.retirement.retire({binding:f.identity.binding}),{physicalStopProven:false});stopped=true;
 assert.deepEqual(await owners.retirement.retire({binding:f.identity.binding}),{physicalStopProven:true});
 const derived=deriveAttendedRoutinesOwners({configuration:{...configuration,routines:{...configuration.routines,core:{cancellationProof:{}}}},candidate:{routinesTask:task,routinesOccurrenceOwners:owners},workflow:{taskQueue:'synthetic-routines',workflowIdPrefix:'synthetic-routine'},allocations:f.store,now:f.now});
 assert.deepEqual(derived.context.template,task);assert.equal(Object.hasOwn(derived.context,'allocationJson'),false);assert.equal(typeof derived.contextOwnerFactory,'function');
});

for(const general of [false,true])test(`native routine list remains available after failed or cancelled ${general?'General':'client'} work`,async()=>{
 const f=await nativeFixture({general});try{
  for(const runState of ['failed','cancelled']){
   f.state.runState=runState;const current=await f.owner.authorizeRequest(f.request);
   assert.deepEqual(current.binding,f.state.binding);assert.deepEqual(current.scopes,f.state.scopes);
  }
 }finally{await f.close();}
});

for(const general of [false,true])test(`native ${general?'General':'client'} routine list survives a changed image for the exact existing session`,async()=>{
 const f=await nativeFixture({general});try{
  f.state.versions={...versions,imageDigest:'sha256:'+'c'.repeat(64)};
  for(const runState of ['running','completed','failed','cancelled']){
   f.state.runState=runState;const current=await f.owner.authorizeRequest(f.request);
   assert.deepEqual(current.binding,f.state.binding);assert.deepEqual(current.scopes,f.state.scopes);
  }
 }finally{await f.close();}
});

test('native routine list still refuses changed selection, non-image versions and successor reservation',async()=>{
 for(const change of [s=>{s.binding={...s.binding,actorId:'another'};},s=>{s.selectedClientId='10000000-0000-4000-8000-000000000099';},
  ...['sdk','cli','contracts','checkpointFormat'].map(key=>s=>{s.versions={...s.versions,[key]:'9.9.9'};}),
  s=>{s.versions={...s.versions,skillsDigest:'d'.repeat(64)};},s=>{s.versions={...s.versions,imageDigest:'invalid'};},
  s=>{const {imageDigest,...rest}=s.versions;s.versions=rest;},s=>{s.reserved=true;}]){
  const f=await nativeFixture();try{change(f.state);await assert.rejects(f.owner.authorizeRequest(f.request));}finally{await f.close();}
 }
 for(const change of [s=>{s.reserved=true;}]){
  const f=await nativeFixture();try{f.state.policyHook=()=>change(f.state);await assert.rejects(f.owner.authorizeRequest(f.request));}finally{await f.close();}
 }
});

for(const general of [false,true])test(`persisted ${general?'General':'client'} management does not read missing, zero or changed model policy`,async()=>{
 const f=await nativeFixture({general});try{
  f.state.runState='completed';f.state.budget=0;
  await f.owner.authorizeRequest(f.request);
  f.state.budgetUnavailable=true;await f.owner.authorizeRequest(f.request);
  f.state.budget=2000000;f.state.budgetUnavailable=false;f.state.policyHook=()=>{f.state.budget=0;f.state.budgetUnavailable=true;};
  assert.deepEqual((await f.owner.authorizeRequest(f.request)).binding,f.state.binding);assert.equal(f.state.budgetReads,0);
 }finally{await f.close();}
});

test('initial bindings retain positive model policy and drift refusal for routine list',async()=>{
 const f=await nativeFixture();try{
  const record={binding:f.state.binding,versions,selectedClientId:f.state.selectedClientId,policyRevision:'p1',expiresAtMs:f.now()+10000};
  f.store.readOptional=async()=>null;f.store.initialBindings={async readPreparation(){return {record,recordSha256:hash(record)};}};
  f.store.readCurrentModelPolicy=f.store.readModelPolicy;
  f.state.budget=0;await assert.rejects(f.owner.authorizeRequest(f.request));
  f.state.budget=2000000;f.state.budgetUnavailable=true;await assert.rejects(f.owner.authorizeRequest(f.request));
  f.state.budgetUnavailable=false;await f.owner.authorizeRequest(f.request);
  f.state.policyHook=()=>{f.state.budget=1000000;};await assert.rejects(f.owner.authorizeRequest(f.request));assert.ok(f.state.budgetReads>0);
  f.state.budget=2000000;f.state.policyHook=()=>{f.state.budget=0;f.store.readOptional=f.store.read;};
  await assert.rejects(f.owner.authorizeRequest(f.request),'persisting an initial run cannot remove its already-required model bounds');
 }finally{await f.close();}
});

test('persisted management cannot fall back to an initial binding after the run disappears',async()=>{
 const f=await nativeFixture();try{
  const record={binding:f.state.binding,versions,selectedClientId:f.state.selectedClientId,policyRevision:'p1',expiresAtMs:f.now()+10000};
  f.store.initialBindings={async readPreparation(){return {record,recordSha256:hash(record)};}};f.store.readCurrentModelPolicy=f.store.readModelPolicy;
  f.state.policyHook=()=>{f.store.readOptional=async()=>null;};
  await assert.rejects(f.owner.authorizeRequest(f.request));assert.equal(f.state.budgetReads,0);
 }finally{await f.close();}
});

test('native stop requires the exact owner binding and durable physical-stop proof',async()=>{
 const calls=[];let record={state:'ADMITTED',original:{binding},resource:{physicalStopProven:false}};
 const retirement=createAttendedRoutinesRetirement({principal,now:()=>at,maxRequestMs:5000,
  native:{async call(operation,input){calls.push({operation,input});record={...record,state:'RETIRED',resource:{physicalStopProven:true}};return {binding:input.binding,executionId:input.executionId,expiresAtMs:at+60000};}},
  allocations:{async read(key){assert.deepEqual(key,{binding,allocationKey:hash(binding)});return {run:{binding},record};}}});
 assert.deepEqual(await retirement.retire({binding,deadlineMs:at+4000}),{physicalStopProven:true});
 assert.equal(calls.length,1);assert.equal(calls[0].operation,'execution/kickoff/stop');assert.equal(calls[0].input.executionId,hash(binding));
 await assert.rejects(retirement.retire({binding:{...binding,actorId:'10000000-0000-4000-8000-000000000099'}}),code('ROUTINES_RETIREMENT_UNPROVEN'));
 assert.equal(calls.length,1,'a foreign actor cannot reach the native stop');
});

test('a successful stop reply without durable proof remains unproven',async()=>{
 const native={async call(_operation,input){return {binding:input.binding,executionId:input.executionId,expiresAtMs:at+60000};}};
 for(const record of [null,{state:'ADMITTED',original:{binding},resource:{physicalStopProven:false}},
  {state:'RETIRED',original:{binding},resource:{physicalStopProven:false}},
  {state:'RETIRED',original:{binding:{...binding,runId:'10000000-0000-4000-8000-000000000088'}},resource:{physicalStopProven:true}}]){
  const retirement=createAttendedRoutinesRetirement({native,principal,now:()=>at,maxRequestMs:5000,allocations:{async read(){return {run:{binding},record};}}});
  await assert.rejects(retirement.retire({binding}),code('ROUTINES_RETIREMENT_UNPROVEN'));
 }
 const wrong=createAttendedRoutinesRetirement({principal,now:()=>at,maxRequestMs:5000,allocations:{async read(){throw Error('must not read');}},
  native:{async call(){return {binding,executionId:'0'.repeat(64),expiresAtMs:at+60000};}}});
 await assert.rejects(wrong.retire({binding}),code('ROUTINES_RETIREMENT_UNPROVEN'));
});

test('attended owners use the candidate sealed task/allocation and fail on mismatched identities',async()=>{
 const f=await applicationFixture();try{
  const {commandContext,allocationJson,template,workflow}=f.contextConfiguration;
  const principal={tenantId:commandContext.binding.tenantId,actorId:commandContext.binding.actorId};
  const configuration={routines:{enabled:true,core:{cancellationProof:{}},task:{taskId:template.taskId,version:template.version}},
   nativeCandidate:{identity:{commandContext},runtime:{binding:commandContext.binding},allocationJson,multiRun:{dynamicInitialRuns:true},qualification:{policyRevision:'p1'}},
   versions,limits:{requestMs:5000}};
  const scheduled={principal,selectedClientId:commandContext.clientResolution.clientId,policyRevision:'p1',versions,task:template,
   configurationSha256:'a'.repeat(64),allocationJson,runWindowMs:60000,destinationId:'meri-inbox'};
  const candidate={original:{binding:commandContext.binding},native:{async call(){throw Error('not used');}},routinesOccurrenceOwners:{template:scheduled,retirement:{async retire(){throw Error('not used');}}}};
  const allocations={async read(){throw Error('not used');}};
  const owners=deriveAttendedRoutinesOwners({configuration,candidate,workflow,allocations,now:f.now});
  assert.deepEqual(owners.context.commandContext,commandContext);assert.equal(owners.context.allocationJson,allocationJson);
  assert.deepEqual(owners.context.template,template);assert.deepEqual(owners.context.workflow,workflow);
  assert.deepEqual(owners.context.limits,{maxRequestMs:5000,maxFactBytes:131072,retryLimit:0});
  for(const altered of [
   {candidate:{...candidate,original:{binding:{...commandContext.binding,runId:'10000000-0000-4000-8000-000000000088'}}}},
   {candidate:{...candidate,routinesOccurrenceOwners:{...candidate.routinesOccurrenceOwners,template:{...scheduled,task:{...template,manifestSha256:'0'.repeat(64)}}}}},
   {candidate:{...candidate,routinesOccurrenceOwners:{...candidate.routinesOccurrenceOwners,template:{...scheduled,selectedClientId:'10000000-0000-4000-8000-000000000099'}}}},
   {workflow:{...workflow,taskQueue:'bad queue'}},
   {configuration:{...configuration,reads:{delegation:{enabled:true}}}},
  ])assert.throws(()=>deriveAttendedRoutinesOwners({configuration,candidate,workflow,allocations,now:f.now,...altered}),code('ROUTINES_OWNER_CONFIGURATION'));
 }finally{await f.close();}
});

test('the late-bound family stays unavailable without a candidate and rejects second binding',()=>{
 const configuration={routines:{enabled:true},limits:{requestMs:5000,requestBytes:131072},native:{maxResponseBytes:131072}};
 const composition=createAttendedRoutinesOwnerComposition({configuration});
 assert.equal(composition.state(),'owners-unavailable');
 const result=composition.family({configuration,pool:{},client:{},now:Date.now});
 assert.equal(result.ports.routinesApplicationFactory.state(),'unavailable');
 composition.bindCandidate({});assert.equal(composition.state(),'owners-unavailable');
 assert.throws(()=>composition.bindCandidate({}),code('ROUTINES_OWNER_CONFIGURATION'));
});

test('a later run uses its live action session and exact admitted allocation',async()=>{
 const f=await applicationFixture();try{
  const dynamic={...f.contextConfiguration.commandContext.binding,conversationId:'10000000-0000-4000-8000-000000000077',runId:'10000000-0000-4000-8000-000000000078'};
  const selectedClientId=f.contextConfiguration.commandContext.clientResolution.clientId,policyRevision='p1';
  const scopes=[{tenantId:dynamic.tenantId,kind:'client',resourceId:selectedClientId,policyRevision}];
  const authentication={principal:{sessionId:'session-one',tenantId:dynamic.tenantId,actorId:dynamic.actorId,conversationId:dynamic.conversationId,runId:dynamic.runId},sessionRevision:'revision-one',checkedAtMs:f.now(),expiresAtMs:f.now()+60000};
  let selected=dynamic,allocationRecord=true,allocationDigest=true,aborted=false,reads=0;
  const sessions={async authenticateSession(){return authentication;},async readCurrentState(){return {authenticationSha256:hash(authentication),binding:selected,scopes,selectedClientId,checkedAtMs:f.now(),expiresAtMs:f.now()+60000};}};
  const retargeted=retargetRoutinesAllocation(f.contextConfiguration.allocationJson,dynamic);
  const allocations={async read(query){reads++;assert.deepEqual(query,{binding:dynamic,allocationKey:hash(dynamic)});return {run:{binding:dynamic,state:'running',scopes,versions,policyRevision},record:allocationRecord?{
   state:'ADMITTED',original:{binding:dynamic,executionKey:hash(dynamic),versions},qualification:{policyRevision},
   allocationSha256:allocationDigest?hash(allocation(retargeted.json)):'0'.repeat(64),expiresAtMs:f.now()+60000}:null};}};
  const policy={async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:dynamic,scopes,selectedClientId,
   destinationResolution:null,limits:null,checkedAtMs:f.now(),expiresAtMs:f.now()+10000};}};
  const {commandContext,allocationJson,template,workflow,limits}=f.contextConfiguration;
  const base={commandContext,allocationJson,template,workflow,limits,policy,versions,policyRevision};
  const owner=createAttendedRoutinesContextOwner({base,sessions,scheduleOwner:f.owner,allocations,now:f.now,newId:f.newId});
  const request={credential:'action_session_opaque',operation:'list_scheduled_tasks',request:{},deadlineMs:f.now()+5000};
  const current=await owner.authorizeRequest(request);
  assert.deepEqual(current.binding,dynamic);assert.equal(reads,1);
  selected={...dynamic,runId:'10000000-0000-4000-8000-000000000079'};
  await assert.rejects(owner.authorizeRequest(request),code('ROUTINES_CONTEXT_UNAVAILABLE'));
  selected=dynamic;allocationDigest=false;
  await assert.rejects(owner.authorizeRequest(request),code('ROUTINES_CONTEXT_UNAVAILABLE'));
  allocationDigest=true;allocationRecord=false;
  await assert.rejects(owner.authorizeRequest(request),code('ROUTINES_CONTEXT_UNAVAILABLE'));
  allocationRecord=true;const controller=new AbortController();controller.abort();aborted=true;
  await assert.rejects(owner.authorizeRequest({...request,signal:controller.signal}),code('ROUTINES_CONTEXT_UNAVAILABLE'));
  assert.equal(aborted,true);
 }finally{await f.close();}
});
