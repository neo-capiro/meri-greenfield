/** Composed runtime Stop, with canonical journals and allocator over scripted SQL/ECS/admission.
 * Fresh registries share durable rows; no real SQL, task or credential authority is claimed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,resolve} from 'node:path';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {id} from '../../control/conversations/test/store-fixture.mjs';
import {createPreparedRunBindings} from '../prepared-run-bindings.mjs';
import {admissionRecordOf,createPreparedNextRunOwner} from '../prepared-next-run.mjs';
import {createPreparedRunRegistry} from '../prepared-run-registry.mjs';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {compilePreparedRunFacts} from '../prepared-run-issuance.mjs';
import {createHistoricalRunRetirement} from '../historical-run-retirement.mjs';
import {compileHistoricalStopFacts} from '../native-authority/historical-stop-facts.mjs';
import {createNativeTaskAllocator} from '../native-authority/task-allocator.mjs';
import {createOriginalRetirement} from '../native-authority/remote-composition.mjs';
import {fakeEcs,syntheticAdmission} from '../native-authority/test/original-retirement-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const check=()=>{};
async function fixture({later=false,allocated=true,legacy=false,claimed=true,priorSdk=false,launch=false}={}){
 const f=candidateFixture(),c=f.configuration.nativeCandidate,sql=initialInputFixture();
 for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])c.preparationIntent[k]=normalize(c.preparationIntent[k]);

 c.taskRequest.overrides.containerOverrides[0].command=['start'];c.multiRun={runWindowMs:60000,materialDirectory:resolve('synthetic-meri-material'),dynamicInitialRuns:true};
 const originalBinding={...f.binding,conversationId:id(1300),runId:id(1301),attemptId:id(1302),workerId:id(1303)},binding={...originalBinding,...(later?{runId:id(1311),attemptId:id(1312),workerId:id(1313),writerFence:2}:{})};
 const proposal=await sql.proposal({context:{binding:originalBinding,scopes:f.scopes,versions:c.runtime.versions}});
 proposal.acceptance.run.binding=binding;proposal.acceptance.event.binding=binding;
 const durable=createPostgresConversationStore({pool:sql.pool});await durable.accept(proposal.acceptance,check);
 // Later-run admission/reservation is a scripted accepted owner answer; the allocation and Stop journals are real modules.
 const store=later?{...durable,nextRuns:{...durable.nextRuns,async readTarget(){return {state:'ACCEPTED',source:originalBinding,target:binding,scopes:f.scopes,policyRevision:c.qualification.policyRevision};}}}:durable;
 const state={clock:f.now,issues:0,material:0,allocation:0,capture:0,reservations:0};
 const admission={schemaVersion:1,state:'ADMITTED',binding:originalBinding,selectedClientId:id(5),policyRevision:c.qualification.policyRevision,versions:c.runtime.versions,configurationSha256:'0'.repeat(64),expiresAtMs:f.now+60000,createdAtMs:f.now};
 const initialBindings={async read({binding:b}){return hash(b)===hash(originalBinding)?structuredClone(admission):null;},async readConversation(){return structuredClone(admission);}};
 const issuanceStore=createMemoryIssuanceStore(),capability='synthetic-historical-task-material';
 const capabilityAuthority={async generate(){state.issues++;return {grantId:id(1320),capability,materialRef:'synthetic-existing-ref'};},async retrieve(){state.material++;throw Error('Stop must not open material');},async status(){throw Error('Stop must not reconcile issuance');}};
 const options={configuration:f.configuration,pool:sql.pool,store,credentials:{control:f.secret.control},issuanceStore,capabilityAuthority,initialBindings,now:()=>state.clock,limits:{maxRequestMs:1000,maxFactBytes:131072}};
 const ports=createPreparedRunBindings(options);admission.configurationSha256=ports.configurationSha256;
 const request=(await store.read(binding,{},check)).request,intent={binding,issuanceKey:hash(binding),requestSha256:hash(request),expiresAtMs:admission.expiresAtMs};
 const rawIssued=await ports.issuer.issue(intent),rawFacts=await ports.facts.compile({intent,issuance:rawIssued.issuance}),compiled=structuredClone(compilePreparedRunFacts(rawFacts,{intent,issuance:rawIssued.issuance,now:()=>state.clock}));
 // An immutable old-SDK row is seeded as historical evidence; no unsupported SDK executes.
 if(priorSdk){compiled.original.versions.sdk='0.3.294';const {factsSha256,...projection}=compiled;compiled.factsSha256=hash(projection);admission.versions=compiled.original.versions;const row=[...sql.state.runs.values()][0];row.projection.versions=structuredClone(compiled.original.versions);row.projection_sha256=hash(row.projection);}
 const issuance=await ports.issuer.bindFacts({...rawIssued.issuance,factsSha256:compiled.factsSha256});
 const {factsSha256:_,...issuedFacts}=compiled,original=compiled.original;
 const custody=compileHistoricalStopFacts({schemaVersion:2,original,allocationJson:rawFacts.allocationJson,taskRequest:rawFacts.taskRequest,containerName:rawFacts.containerName,qualification:rawFacts.qualification,grantIntents:rawFacts.grantIntents,issuance,issuedFacts});
 const ecs=fakeEcs(original,rawFacts.taskRequest),budget=syntheticAdmission({original,config:rawFacts});
 const allocator=createNativeTaskAllocator({journal:store.allocations,authority:{async verify(){if(!launch)throw Error('No new allocation');}},admission:budget.admission,client:{async send(command,...rest){if(command.constructor.name==='RunTaskCommand'){const row=(await store.allocations.read({binding,allocationKey:hash(binding)},check)).record;assert.deepEqual(row.retirementFacts,custody,'custody must be durable before RunTask');}return ecs.client.send(command,...rest);}},original,taskRequest:rawFacts.taskRequest,qualification:rawFacts.qualification,grantIntents:rawFacts.grantIntents,allocationSha256:compiled.allocationSha256,containerName:rawFacts.containerName,enabled:true,now:()=>state.clock,maxRequestMs:1000,...(legacy?{}:{retirementFacts:custody})});
 const key={binding,allocationKey:hash(binding)};if(launch)await allocator.allocate();else if(claimed)await store.allocations.claim(allocator.intent,check);const resource=claimed&&!launch?ecs.seed():null;
 if(claimed&&allocated&&!launch)await store.allocations.record({...key,state:'ALLOCATED',resource},check);
 let event=1400;const publish=state=>store.append(binding,{eventId:id(event++),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},check);
 if(claimed){await publish('starting');await publish('running');}
 const read=async()=>(await store.allocations.read(key,check)).record;
 function fresh(change=()=>{},registryOptions={}){
  const configuration=structuredClone(f.configuration),credentials={control:f.secret.control};change(configuration,credentials);
  const p=createPreparedRunBindings({...options,configuration,credentials});
  const retirement=createHistoricalRunRetirement({store,issuanceStore,initialBindings,principal:{tenantId:binding.tenantId,actorId:binding.actorId},selectedClientId:id(5),pool:sql.pool,limits:options.limits,now:options.now,
   retireOriginal:input=>createOriginalRetirement({...input,admission:budget.admission})});
  const registry=createPreparedRunRegistry({issuance:p.runIssuance,issuanceIntent:p.issuanceIntent,store,pool:sql.pool,client:ecs.client,identity:{origin:c.identity.origin,credential:f.secret.identity,commandContext:c.identity.commandContext,fetchImpl(){throw Error('No identity fetch');}},controlCapability:credentials.control,objects:{get(){state.capture++;throw Error('No restore');},put(){state.capture++;throw Error('No capture');}},limits:{...options.limits,cleanupMs:1000},now:options.now,
   initialBindings,configurationSha256:p.configurationSha256,prepareInitial:()=>{state.issues++;throw Error('No preparation');},retireInitial:retirement,retireHistorical:retirement,allocate(){state.allocation++;throw Error('No allocation');},...registryOptions});
  const stop=(extra={})=>registry.handle(new Request('https://control.invalid/v1/execution/kickoff/stop',{method:'POST',headers:{authorization:'Bearer '+credentials.control,'content-type':'application/json'},body:JSON.stringify({binding,executionId:hash(binding),...extra})}));
  return {registry,stop,ports:p};
 }
 const counts=()=>({issues:state.issues,material:state.material,allocation:state.allocation,capture:state.capture,reservations:state.reservations,runs:ecs.state.runs,stops:ecs.state.stops,revokes:budget.state.revokes});
 return {f,c,sql,store,ports,state,admission,binding,initialBindings,issuanceStore,custody,allocator,ecs,budget,fresh,counts,read,publish};
}
const changedRender=(configuration,credentials)=>{configuration.versions.imageDigest='sha256:'+'f'.repeat(64);configuration.nativeCandidate.runtime.versions=configuration.versions;configuration.nativeCandidate.preparationIntent.imageSha256='f'.repeat(64);configuration.nativeCandidate.taskRequest.taskDefinition='arn:aws:ecs:us-east-1:967807252336:task-definition/new-render:99';credentials.control='synthetic-rotated-control';};
for(const later of [false,true])test(`MR01 ${later?'later':'first'} run retires through a fresh render and rotated control without opening material`,async()=>{
 const x=await fixture({later}),before=x.counts(),p=x.fresh(changedRender);
 try{const response=await p.stop();assert.equal(response.status,200);assert.equal((await response.json()).expiresAtMs,x.custody.original.expiresAtMs);assert.equal((await x.read()).state,'RETIRED');assert.equal(x.ecs.stopped(),true);assert.equal((await x.store.read(x.binding,{},check)).run.state,'failed');
  assert.deepEqual(x.counts(),{...before,stops:1,revokes:1});assert.equal(p.registry.entries().length,0);
  await assert.rejects(p.registry.ensure({binding:x.binding}),'historical cleanup grants no current execution');
  const again=x.fresh(changedRender);try{assert.equal((await again.stop()).status,200);assert.deepEqual(x.counts(),{...before,stops:1,revokes:1});}finally{await again.registry.close();}
 }finally{await p.registry.close();}
});
test('MR01 expired original and changed policy/window can stop while current preparation still refuses',async()=>{
 const x=await fixture(),before=x.counts();x.state.clock=x.admission.expiresAtMs+1;
 const p=x.fresh((configuration,credentials)=>{changedRender(configuration,credentials);configuration.nativeCandidate.qualification.policyRevision='d'.repeat(64);configuration.nativeCandidate.multiRun.runWindowMs=120000;const clientId=configuration.nativeCandidate.identity.commandContext.clientResolution.clientId;const scopes=[{kind:'client',tenantId:x.binding.tenantId,resourceId:clientId,policyRevision:'d'.repeat(64)}];configuration.nativeCandidate.preparationIntent.authoritySha256=hash({scopes,selectedClientId:clientId,policyRevision:'d'.repeat(64)});});
 try{assert.equal((await p.stop()).status,200);assert.equal((await x.read()).state,'RETIRED');assert.deepEqual(x.counts(),{...before,stops:1,revokes:1});await assert.rejects(p.ports.prepareInitial({binding:x.binding}));}finally{await p.registry.close();}
});
test('MR01 claimed allocation discovers its exact old task without installing a budget allocation',async()=>{
 const x=await fixture({allocated:false}),p=x.fresh(changedRender);try{assert.equal((await p.stop()).status,200);assert.equal((await x.read()).state,'RETIRED');assert.equal(x.ecs.state.runs,0);assert.equal(x.budget.state.admits,0);assert.ok(x.ecs.state.lists>0);}finally{await p.registry.close();}
});
test('MR01 terminal outcome is retained, unknown revocation blocks settlement and fresh reentry settles once',async()=>{
 const x=await fixture();await x.publish('failed');x.budget.state.revokeWorks=false;const before=x.counts(),p=x.fresh(changedRender);
 try{assert.equal((await p.stop()).status,503);assert.notEqual((await x.read()).state,'RETIRED');assert.equal((await x.store.read(x.binding,{},check)).run.state,'failed');
  x.budget.state.revokeWorks=true;const next=x.fresh(changedRender);try{assert.equal((await next.stop()).status,200);assert.equal((await x.read()).state,'RETIRED');assert.equal((await x.store.read(x.binding,{},check)).events.filter(e=>e.type==='run.status'&&e.data.state==='failed').length,1);}finally{await next.registry.close();}
 }finally{await p.registry.close();}
});
test('MR01 legacy missing custody remains closed across a changed render',async()=>{
 const x=await fixture({legacy:true}),before=x.counts(),p=x.fresh(changedRender);try{assert.equal((await p.stop()).status,503);assert.deepEqual(x.counts(),before);assert.equal((await x.read()).state,'ALLOCATED');}finally{await p.registry.close();}
});
test('MR01 stored request, admission, issuance and task substitutions refuse before stop effects',async()=>{
 for(const mutation of ['request','admission','issuance','task','custody']){const x=await fixture(),before=x.counts();
  if(mutation==='request'){const row=[...x.sql.state.runs.values()][0];row.request={...row.request,prompt:'substituted'};row.request_sha256=hash(row.request);}
  if(mutation==='admission')x.admission.selectedClientId=id(1999);
  if(mutation==='issuance'){const read=x.issuanceStore.read;x.issuanceStore={...x.issuanceStore,read:async args=>({...await read(args),factsSha256:'e'.repeat(64)})};}
  if(mutation==='task'||mutation==='custody'){const row=[...x.sql.state.allocations.values()][0];if(mutation==='task')row.record.resource.taskDefinitionArn='arn:aws:ecs:us-east-1:967807252336:task-definition/foreign:1';else row.record.retirementFacts.issuedFacts.controlCapabilitySha256='e'.repeat(64);row.record_sha256=hash(row.record);}
  // The ordinary fixture captures its issuance store; exercise the resolver directly for replacement of that reader.
  if(mutation==='issuance'){const retire=createHistoricalRunRetirement({store:x.store,issuanceStore:x.issuanceStore,initialBindings:x.initialBindings,principal:{tenantId:x.binding.tenantId,actorId:x.binding.actorId},selectedClientId:id(5),pool:x.sql.pool,limits:{maxRequestMs:1000,maxFactBytes:131072}});await assert.rejects(retire({binding:x.binding,client:x.ecs.client}));}
  else {const p=x.fresh(changedRender);try{assert.notEqual((await p.stop()).status,200);}finally{await p.registry.close();}}
  assert.deepEqual(x.counts(),before,mutation);
 }
});

async function complete(x){
 const binding=x.binding,scopes=x.f.scopes,identity={binding,scopes,selectedClientId:id(5),completionId:id(1600),checkpointId:id(1601)},started=await x.store.completions.begin(identity,check),saved=await x.store.read(binding,{},check),createdAt=new Date().toISOString();
 const workspace={contractVersion:'0.1.0',manifestId:id(1602),binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt};
 const checkpoint={contractVersion:'0.1.0',checkpointId:identity.checkpointId,parentCheckpointId:null,binding,sessionId:id(1603),opaqueSession:{objectId:id(1604),versionId:'synthetic-immutable-checkpoint',sha256:'a'.repeat(64),bytes:10,scopes},workspace,workspaceSha256:hash(workspace),versions:x.c.runtime.versions,lastEventSequence:saved.lastSequence,scopes,createdAt,durableReceiptId:id(1605)};
 const proof={checkpoint,checkpointSha256:hash(checkpoint),sourceRequestSha256:hash(saved.request),contextSha256:hash({window:saved.request.window,skill:saved.request.skill,scopes}),resumeSessionAt:id(1606),readReceiptId:id(1607)};
 await x.store.completions.publish({...identity,proof,events:[{contractVersion:'0.1.0',eventId:started.verifiedEventId,createdAt,type:'checkpoint.verified',data:{checkpointId:identity.checkpointId}},{contractVersion:'0.1.0',eventId:started.completedEventId,createdAt,type:'run.status',data:{state:'completed',reasonCode:null}}]},check);return proof;
}
for(const terminal of ['cancelled','completed'])test(`MR01 ${terminal} unretired source preserves its terminal and checkpoint while closing the successor barrier`,async()=>{
 const x=await fixture(),proof=terminal==='completed'?await complete(x):(await x.publish(terminal),null),before=x.counts(),next=createPreparedNextRunOwner({store:x.store,versions:x.c.runtime.versions,admissionForBinding(){throw Error('No admission during assessment');}}),query={principal:{tenantId:x.binding.tenantId,actorId:x.binding.actorId},conversationId:x.binding.conversationId,sourceRunId:x.binding.runId};
 assert.deepEqual(await next.assessNextTurn(query),{admissible:false,reason:'NEXT_RUN_SOURCE_UNSETTLED'});await assert.rejects(next.admitTurn(query));
 const p=x.fresh(changedRender);try{assert.equal((await p.stop()).status,200);assert.equal((await x.store.read(x.binding,{},check)).run.state,terminal);assert.deepEqual(await next.assessNextTurn(query),{admissible:true,reason:null});assert.deepEqual(x.counts(),{...before,stops:1,revokes:1});if(proof)assert.equal((await x.store.nextRuns.latestCheckpoint(x.binding,check)).proofSha256,hash(proof));}finally{await p.registry.close();}
});
test('MR01 finite physical-stop outage keeps successor blocked and a fresh retry settles once',async()=>{
 const x=await fixture();x.ecs.state.outage=true;await x.publish('failed');const p=x.fresh(changedRender),next=createPreparedNextRunOwner({store:x.store,versions:x.c.runtime.versions,admissionForBinding(){throw Error('No mutation');}}),query={principal:{tenantId:x.binding.tenantId,actorId:x.binding.actorId},conversationId:x.binding.conversationId,sourceRunId:x.binding.runId};
 try{for(let i=0;i<3;i++)assert.equal((await p.stop()).status,503);assert.equal((await x.read()).state,'ALLOCATED');assert.deepEqual(await next.assessNextTurn(query),{admissible:false,reason:'NEXT_RUN_SOURCE_UNSETTLED'});assert.equal(x.ecs.state.stops,0);x.ecs.state.outage=false;const retry=x.fresh(changedRender);try{assert.equal((await retry.stop()).status,200);assert.deepEqual(await next.assessNextTurn(query),{admissible:true,reason:null});assert.equal(x.ecs.state.stops,1);}finally{await retry.registry.close();}}finally{await p.registry.close();}
});
test('MR01 SDK-incompatible current render still retires the original without restoring or executing it',async()=>{
 const x=await fixture({priorSdk:true}),before=x.counts(),p=x.fresh(changedRender);
 try{assert.equal((await p.stop()).status,200);assert.deepEqual(x.counts(),{...before,stops:1,revokes:1});await assert.rejects(p.registry.ensure({binding:x.binding}));}finally{await p.registry.close();}
});
test('MR01 foreclosed first attempt performs no cleanup and cannot reclaim allocation',async()=>{
 const x=await fixture({claimed:false}),before=x.counts(),p=x.fresh(changedRender);try{const response=await p.stop();assert.equal(response.status,200);assert.equal((await response.json()).expiresAtMs,x.admission.expiresAtMs);assert.notEqual(x.admission.expiresAtMs,x.state.clock);assert.equal((await x.read()).state,'FORECLOSED');assert.deepEqual(x.counts(),before);await assert.rejects(x.store.allocations.claim(x.allocator.intent,check));assert.equal((await p.stop()).status,200);}finally{await p.registry.close();}
});
test('MR01 selectors and caller-supplied history never authorize effects, including retired receipt replay',async()=>{
 const x=await fixture(),p=x.fresh(changedRender);try{const before=x.counts();for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence']){const binding={...x.binding,[field]:field==='writerFence'?99:id(1999)};assert.notEqual((await p.stop({binding,executionId:hash(binding)})).status,200);}assert.notEqual((await p.stop({retirementFacts:x.custody})).status,200);assert.deepEqual(x.counts(),before);
  assert.equal((await p.stop()).status,200);const row=[...x.sql.state.runs.values()][0];row.request.prompt='substituted after retirement';row.request_sha256=hash(row.request);const retired=x.counts();assert.notEqual((await p.stop()).status,200);assert.deepEqual(x.counts(),retired);
 }finally{await p.registry.close();}
});
test('MR01 retired custody survives next-run projection and supplies its original allocation without budget reconstruction',async()=>{
 const x=await fixture({allocated:false}),p=x.fresh((configuration,credentials)=>{changedRender(configuration,credentials);const a=JSON.parse(configuration.nativeCandidate.allocationJson);a.schedule.revision='e'.repeat(64);configuration.nativeCandidate.allocationJson=JSON.stringify(a);});try{assert.equal((await p.stop()).status,200);const r=await x.read(),projected=admissionRecordOf(r);assert.deepEqual(projected.retirementFacts,x.custody);const offset=x.sql.state.calls.length;const owner=await p.ports.admissionForBinding({binding:x.binding,record:projected});assert.equal(typeof owner.revoke,'function');assert.equal(x.sql.state.calls.length,offset,'no budget allocation row exists for this pre-admission task');}finally{await p.registry.close();}
});

test('MR01 canonical allocator persists custody before RunTask and a fresh process retires that admitted original',async()=>{
 const x=await fixture({launch:true}),before=x.counts(),p=x.fresh(changedRender);try{assert.equal(x.ecs.state.runs,1);assert.equal(x.budget.state.admits,1);assert.deepEqual((await x.read()).retirementFacts,x.custody);assert.equal((await x.read()).state,'ADMITTED');assert.equal((await p.stop()).status,200);assert.equal((await x.read()).state,'RETIRED');assert.deepEqual(x.counts(),{...before,stops:1,revokes:1});}finally{await p.registry.close();}
});

// The real store writes both the terminal event and FORECLOSED custody atomically.
// Deliberate row tampering below re-hashes storage envelopes, so pinned whole-event
// custody, rather than only the outer row checksum, must reject substitutions.
async function forecloseForReceipt(x,state='failed'){
 return x.store.append(x.binding,{eventId:id(1700),createdAt:new Date(x.f.now-12345).toISOString(),type:'run.status',data:{state,reasonCode:null}},check);
}
for(const terminal of ['failed','cancelled'])test(`MR01 later ${terminal} foreclosure returns the pinned event-time cutoff without effects`,async()=>{
 const x=await fixture({later:true,claimed:false}),event=await forecloseForReceipt(x,terminal),before=x.counts(),record=await x.read(),p=x.fresh(changedRender);
 try{
  assert.equal(record.state,'FORECLOSED');assert.equal(Object.hasOwn(record,'original'),false);
  assert.deepEqual(record.foreclosure,{eventId:event.eventId,eventSha256:hash(event),state:terminal});
  for(let attempt=0;attempt<2;attempt++){
   x.state.clock+=1000;
   const response=await p.stop();assert.equal(response.status,200);
   assert.deepEqual(await response.json(),{binding:x.binding,executionId:hash(x.binding),expiresAtMs:Date.parse(event.createdAt)});
   assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(x.counts(),before);
   assert.deepEqual(await x.read(),record);assert.equal(p.registry.entries().length,0);
  }
  await assert.rejects(x.store.allocations.claim(x.allocator.intent,check));
  assert.equal((await x.store.read(x.binding,{},check)).run.state,terminal);
 }finally{await p.registry.close();}
});
test('MR01 later foreclosure created by reconciliation is readable on a fresh repeated Stop',async()=>{
 const x=await fixture({later:true,claimed:false}),before=x.counts(),p=x.fresh(changedRender);
 try{
  const response=await p.stop();assert.equal(response.status,200);
  const record=await x.read(),event=(await x.store.read(x.binding,{},check)).events.find(e=>e.eventId===record.foreclosure.eventId);
  assert.equal((await response.json()).expiresAtMs,Date.parse(event.createdAt));assert.deepEqual(x.counts(),before);
  const fresh=x.fresh(changedRender);try{x.state.clock+=1000;const repeated=await fresh.stop();assert.equal(repeated.status,200);assert.equal((await repeated.json()).expiresAtMs,Date.parse(event.createdAt));assert.deepEqual(x.counts(),before);}finally{await fresh.registry.close();}
 }finally{await p.registry.close();}
});
test('MR01 foreclosure proof is found through canonical event pagination',async()=>{
 const x=await fixture({later:true,claimed:false}),event=await forecloseForReceipt(x),before=x.counts(),pages=[];
 const store={...x.store,async read(binding,cursor,check){if(cursor?.limit===100){pages.push(cursor.after);return x.store.read(binding,{...cursor,limit:1},check);}return x.store.read(binding,cursor,check);}};
 const p=x.fresh(changedRender,{store});try{const response=await p.stop();assert.equal(response.status,200);assert.equal((await response.json()).expiresAtMs,Date.parse(event.createdAt));assert.deepEqual(pages,[0,1]);assert.deepEqual(x.counts(),before);}finally{await p.registry.close();}
});
for(const mutation of ['event-id','event-hash','event-body','nonterminal-event','terminal-state','foreign-binding','foreign-scopes','missing-timestamp','invalid-timestamp','missing-custody'])test(`MR01 foreclosure ${mutation} refuses without effects`,async()=>{
 const x=await fixture({later:true,claimed:false}),event=await forecloseForReceipt(x),before=x.counts();
 const allocation=[...x.sql.state.allocations.values()][0],events=[...x.sql.state.events.values()][0],terminal=events.find(e=>e.event_id===event.eventId);
 if(mutation==='event-id')allocation.record.foreclosure.eventId=id(1799);
 if(mutation==='event-hash')allocation.record.foreclosure.eventSha256='e'.repeat(64);
 if(mutation==='event-body')terminal.event.data.reasonCode='SUBSTITUTED';
 if(mutation==='nonterminal-event'){const first=events[0];allocation.record.foreclosure.eventId=first.event.eventId;allocation.record.foreclosure.eventSha256=hash(first.event);}
 if(mutation==='terminal-state')allocation.record.foreclosure.state='cancelled';
 if(mutation==='foreign-binding')terminal.event.binding.workerId=id(1798);
 if(mutation==='foreign-scopes')terminal.event.scopes[0].resourceId=id(1798);
 if(mutation==='missing-timestamp')delete terminal.event.createdAt;
 if(mutation==='invalid-timestamp')terminal.event.createdAt='not-a-date';
 if(['foreign-binding','foreign-scopes','missing-timestamp','invalid-timestamp'].includes(mutation))allocation.record.foreclosure.eventSha256=hash(terminal.event);
 terminal.event_sha256=hash(terminal.event);allocation.record_sha256=hash(allocation.record);
 if(mutation==='missing-custody')x.sql.state.allocations.clear();
 const p=x.fresh(changedRender);try{assert.notEqual((await p.stop()).status,200);assert.deepEqual(x.counts(),before);assert.equal(p.registry.entries().length,0);}finally{await p.registry.close();}
});
for(const mode of ['missing-event','stalled-cursor'])test(`MR01 foreclosure ${mode} page refuses without effects`,async()=>{
 const x=await fixture({later:true,claimed:false});await forecloseForReceipt(x);const before=x.counts();let pages=0;
 const store={...x.store,async read(binding,cursor,check){const page=await x.store.read(binding,cursor,check);if(cursor?.limit===100&&++pages>1)throw Error('repeated nonadvancing proof page');return cursor?.limit===100?{...page,events:[],hasMore:mode==='stalled-cursor',nextSequence:cursor.after}:page;}};
 const p=x.fresh(changedRender,{store});try{assert.equal((await p.stop()).status,503);assert.equal(pages,1);assert.deepEqual(x.counts(),before);}finally{await p.registry.close();}
});
test('MR01 foreclosure preserves a valid epoch timestamp as the pinned cutoff',async()=>{
 const x=await fixture({later:true,claimed:false}),event=await forecloseForReceipt(x),before=x.counts();
 const allocation=[...x.sql.state.allocations.values()][0],terminal=[...x.sql.state.events.values()][0].find(e=>e.event_id===event.eventId);
 terminal.event.createdAt='1970-01-01T00:00:00.000Z';terminal.event_sha256=hash(terminal.event);allocation.record.foreclosure.eventSha256=hash(terminal.event);allocation.record_sha256=hash(allocation.record);
 const p=x.fresh(changedRender);try{const response=await p.stop();assert.equal(response.status,200);assert.equal((await response.json()).expiresAtMs,0);assert.deepEqual(x.counts(),before);}finally{await p.registry.close();}
});
