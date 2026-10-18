/** SYNTHETIC: startup owner derivation and native retirement. No Core, SQL, Temporal or ECS operation runs here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {allocation} from '../../../gateway/budget/tool-budget-binding.mjs';
import {applicationFixture} from '../../../control/schedules/test/application-fixture.mjs';
import {createAttendedRoutinesContextOwner,createAttendedRoutinesOwnerComposition,createAttendedRoutinesRetirement,deriveAttendedRoutinesOwners,retargetRoutinesAllocation} from '../routines-owner-composition.mjs';

const code=value=>error=>error?.code===value;
const binding={tenantId:'10000000-0000-4000-8000-000000000001',actorId:'10000000-0000-4000-8000-000000000002',conversationId:'10000000-0000-4000-8000-000000000003',runId:'10000000-0000-4000-8000-000000000004',attemptId:'10000000-0000-4000-8000-000000000005',workerId:'10000000-0000-4000-8000-000000000006',writerFence:1};
const principal={tenantId:binding.tenantId,actorId:binding.actorId};
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
const at=1000000;

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
