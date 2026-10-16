import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize} from 'node:path';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {id} from '../../control/conversations/test/store-fixture.mjs';
import {createPreparedRunBindings} from '../prepared-run-bindings.mjs';
import {createPreparedRunRegistry} from '../prepared-run-registry.mjs';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';

async function fixture(){
 const f=candidateFixture(),c=f.configuration.nativeCandidate,binding={...f.binding,conversationId:id(300),runId:id(301),attemptId:id(302),workerId:id(303)},scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:c.identity.commandContext.clientResolution.clientId,policyRevision:c.qualification.policyRevision}];
 for(const key of ['workspace','configParentDirectory','secureStorageDirectory'])c.preparationIntent[key]=normalize(c.preparationIntent[key]);
 c.preparationIntent.launchTemplate.command=normalize(c.preparationIntent.launchTemplate.command);c.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=c.preparationIntent.secureStorageDirectory;c.multiRun={runWindowMs:60000};
 const proposal=await initialInputFixture().proposal({context:{binding,scopes,versions:c.runtime.versions,selectedClientId:c.identity.commandContext.clientResolution.clientId}});
 const saved={run:proposal.acceptance.run,request:proposal.acceptance.request};
 const state={saved,admission:null,modelCalls:0,taskCalls:0,allocations:0,currentBinding:binding,clock:f.now,allocation:null,events:[]},initialBindings={async read({binding:asked},check){check();return hash(asked)===hash(state.admission?.binding)?structuredClone(state.admission):null;},async readConversation({principal,conversationId,selectedClientId},check){check();const r=state.admission;return r&&r.binding.tenantId===principal.tenantId&&r.binding.actorId===principal.actorId&&r.binding.conversationId===conversationId&&r.selectedClientId===selectedClientId?structuredClone(r):null;}},store={async readOptional(){return structuredClone(state.saved);},async read(){return structuredClone(state.saved);},async append(b,event){assert.deepEqual(b,binding);state.events.push(event.data);state.saved.run.state=event.data.state;return structuredClone(event);},nextRuns:{async readTarget(){return null;},async current(){return {binding:state.currentBinding,reserved:false,policyRevision:c.qualification.policyRevision,scopes:state.saved.run.scopes};}},allocations:{async read(){return {record:structuredClone(state.allocation)};},async claim(){assert.fail('No allocation claim');},async record(){assert.fail('No allocation record');}}};
 const capability='synthetic-dynamic-task-grant',proxyCredential='synthetic-dynamic-model-grant-0001';
 const capabilityAuthority={async generate(){state.taskCalls++;return {grantId:id(304),capability,materialRef:'synthetic-dynamic-material'};},async retrieve(){return {state:'PRESENT',capability};},async status(){return {state:'ABSENT'};}};
 const modelGrants={async issue({intent}){state.modelCalls++;return {...intent,grantId:id(305),capabilitySha256:capabilityDigest(proxyCredential),proxyCredential};}};
 const now=()=>state.clock,issuanceStore=createMemoryIssuanceStore(),ports=createPreparedRunBindings({configuration:f.configuration,pool:{connect(){assert.fail('No database');}},store,credentials:{control:f.secret.control},issuanceStore,capabilityAuthority,modelGrants,initialBindings,now});
 const expiresAtMs=ports.proposeInitialExpiry();state.admission={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:c.identity.commandContext.clientResolution.clientId,policyRevision:c.qualification.policyRevision,versions:c.runtime.versions,configurationSha256:ports.configurationSha256,expiresAtMs,createdAtMs:f.now};
 return {f,c,binding,scopes,store,ports,state,initialBindings,issuanceStore,close:async()=>{}};
}

test('opt-in original preparation uses the durable binding and expiry with the same issuer, and retargets only its workspace suffix',async()=>{
 const x=await fixture();try{
  assert.equal(typeof x.ports.proposeInitialExpiry,'function');assert.equal(x.ports.proposeInitialExpiry(),x.state.admission.expiresAtMs);
  const issued=await x.ports.prepareInitial({binding:x.binding});assert.deepEqual(issued.original.binding,x.binding);assert.equal(issued.original.expiresAtMs,x.state.admission.expiresAtMs);assert.equal(x.state.taskCalls,1);
  const facts=await x.ports.runIssuance.resolveFacts(issued.issuance);assert.ok(facts.preparationIntent.workspace.endsWith(x.binding.conversationId));assert.ok(!facts.preparationIntent.workspace.endsWith(x.f.binding.conversationId));assert.equal(facts.preparationIntent.authoritySha256,hash({scopes:x.scopes,selectedClientId:x.state.admission.selectedClientId,policyRevision:x.state.admission.policyRevision}));
  assert.deepEqual(JSON.parse(facts.allocationJson).run,{tenantId:x.binding.tenantId,actorId:x.binding.actorId,conversationId:x.binding.conversationId,runId:x.binding.runId});
  assert.deepEqual(await x.ports.prepareInitial({binding:x.binding}),issued);assert.equal(x.state.taskCalls,1,'replay uses the existing issued material');
 }finally{await x.close();}
});

test('absent, expired, changed owner, policy, versions, config, or persisted window refuses before new authority',async()=>{
 for(const change of [s=>{s.admission=null;},s=>{s.admission.expiresAtMs=s.admission.createdAtMs-1;},s=>{s.admission.selectedClientId=id(999);},s=>{s.admission.policyRevision='changed';},s=>{s.admission.versions={...s.admission.versions,sdk:'changed'};},s=>{s.admission.configurationSha256='a'.repeat(64);},s=>{s.admission.expiresAtMs=s.admission.createdAtMs+60001;}]){
  const x=await fixture();try{change(x.state);await assert.rejects(x.ports.prepareInitial({binding:x.binding}));assert.equal(x.state.taskCalls,0);assert.equal(x.state.modelCalls,0);}finally{await x.close();}
 }
});

test('dynamic original cannot use the static startup binding or a caller-chosen expiry',async()=>{
 const x=await fixture();try{await assert.rejects(x.ports.prepareInitial({binding:x.f.binding}));await assert.rejects(x.ports.prepareInitial({binding:x.binding,expiresAtMs:x.state.admission.expiresAtMs+1}));assert.equal(x.state.taskCalls,0);}finally{await x.close();}
});

test('a durable record for another tenant or actor cannot borrow the startup issuer',async()=>{
 for(const field of ['tenantId','actorId']){const x=await fixture();try{
  const foreign={...x.binding,[field]:'foreign-'+field};x.state.admission.binding=foreign;x.state.saved.run.binding=foreign;x.state.saved.run.scopes=x.state.saved.run.scopes.map(scope=>({...scope,tenantId:foreign.tenantId}));x.state.currentBinding=foreign;
  await assert.rejects(x.ports.prepareInitial({binding:foreign}));assert.equal(x.state.taskCalls,0);assert.equal(x.state.modelCalls,0);
  const owner=registry(x);try{await assert.rejects(owner.ensure({binding:foreign}));assert.equal(x.state.taskCalls,0);}finally{await owner.close();}
 }finally{await x.close();}}
});
test('an admitted original with an extra persisted scope cannot issue task or model authority',async()=>{
 const x=await fixture();x.state.saved.run.scopes.push({kind:'client',tenantId:x.binding.tenantId,resourceId:id(998),policyRevision:x.state.admission.policyRevision});const owner=registry(x);try{await assert.rejects(x.ports.prepareInitial({binding:x.binding}));await assert.rejects(owner.ensure({binding:x.binding}));assert.equal(x.state.taskCalls,0);assert.equal(x.state.modelCalls,0);}finally{await owner.close();await x.close();}
});

function registry(x,retireInitial=x.ports.retireInitial){return createPreparedRunRegistry({issuance:x.ports.runIssuance,issuanceIntent:x.ports.issuanceIntent,prepareOriginal:x.ports.prepareOriginal,prepareInitial:x.ports.prepareInitial,retireInitial,initialBindings:x.initialBindings,configurationSha256:x.ports.configurationSha256,store:x.store,pool:{connect(){assert.fail('No database');}},client:{send(){assert.fail('No AWS');}},identity:{origin:x.c.identity.origin,credential:x.f.secret.identity,commandContext:x.c.identity.commandContext,fetchImpl(){assert.fail('No authority network');}},controlCapability:x.f.secret.control,objects:{},limits:{maxRequestMs:1000,maxFactBytes:131072,cleanupMs:1000},now:()=>x.state.clock,maximumExpiresAtMs:x.c.runtime.deadlineMs,allocate(){x.state.allocations++;assert.fail('No physical allocation in this check');}});}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('registry accepts a journal-backed dynamic original without next-run reservation, then checks the same admission before kickoff',async()=>{
 const x=await fixture(),owner=registry(x);try{
  const entry=await owner.ensure({binding:x.binding});assert.deepEqual(entry.original.binding,x.binding);assert.equal(entry.original.expiresAtMs,x.state.admission.expiresAtMs);assert.equal(x.state.taskCalls,1);assert.equal(x.state.allocations,0);
  x.state.admission={...x.state.admission,policyRevision:'changed'};await entry.kickoff.kickoff({binding:x.binding,executionKey:entry.original.executionKey});for(let i=0;i<8;i++)await settle();assert.equal(x.state.allocations,0,'a changed durable admission never reaches allocation');
 }finally{await owner.close();await x.close();}
});
test('registry refuses an unadmitted writer-fence-one binding before task issuance',async()=>{
 const x=await fixture();x.state.admission=null;const owner=registry(x);try{await assert.rejects(owner.ensure({binding:x.binding}));assert.equal(x.state.taskCalls,0);assert.equal(x.state.allocations,0);}finally{await owner.close();await x.close();}
});
const post=(binding,credential)=>new Request('https://control.synthetic.invalid/v1/execution/kickoff/stop',{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({binding,executionId:hash(binding)})});
test('a restarted registry stops an admitted original after expiry using durable cleanup, without preparation or allocation',async()=>{
 const x=await fixture();const issued=await x.ports.prepareInitial({binding:x.binding});assert.equal(x.state.taskCalls,1);
 x.state.saved.run.state='running';x.state.allocation={state:'ALLOCATED',original:issued.original,resource:{taskArn:'synthetic-task'}};x.state.clock=x.state.admission.expiresAtMs+1;
 let stops=0;const owner=registry(x,async({binding,client})=>{assert.deepEqual(binding,x.binding);assert.equal(typeof client.send,'function');stops++;x.state.allocation={...x.state.allocation,state:'RETIRED',resource:{...x.state.allocation.resource,physicalStopProven:true}};return {physicalStopProven:true};});
 try{const response=await owner.handle(post(x.binding,x.f.secret.control));assert.equal(response.status,200);assert.deepEqual(await response.json(),{binding:x.binding,executionId:hash(x.binding),expiresAtMs:x.state.admission.expiresAtMs});assert.equal(stops,1);assert.deepEqual(x.state.events,[{state:'failed',reasonCode:'ATTEMPT_LOST'}]);assert.equal(x.state.taskCalls,1);assert.equal(x.state.modelCalls,1);assert.equal(x.state.allocations,0);
  assert.equal((await owner.handle(post(x.binding,x.f.secret.control))).status,200);assert.equal(stops,1);assert.equal(x.state.events.length,1);
  await assert.rejects(owner.ensure({binding:x.binding}),'expired journal evidence cannot prepare a new kickoff');
 }finally{await owner.close();await x.close();}
});
test('an uncertain dynamic original stop stays unknown and writes no terminal event',async()=>{
 const x=await fixture();x.state.saved.run.state='running';x.state.allocation={state:'UNKNOWN',resource:null};x.state.clock=x.state.admission.expiresAtMs+1;const owner=registry(x,async()=>{throw Error('synthetic physical stop unknown');});
 try{const response=await owner.handle(post(x.binding,x.f.secret.control));assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'PREPARED_KICKOFF_UNKNOWN'}});assert.deepEqual(x.state.events,[]);assert.equal(x.state.taskCalls,0);assert.equal(x.state.allocations,0);}finally{await owner.close();await x.close();}
});
test('a foreign successor cannot borrow the opt-in registry issuer or stop route',async()=>{
 const x=await fixture(),foreign={...x.binding,tenantId:'foreign-tenant',writerFence:2};const owner=registry(x);try{await assert.rejects(owner.ensure({binding:foreign}));assert.equal((await owner.handle(post(foreign,x.f.secret.control))).status,403);assert.equal(x.state.taskCalls,0);assert.equal(x.state.modelCalls,0);assert.equal(x.state.allocations,0);}finally{await owner.close();await x.close();}
});
test('dynamic retirement replays exact durable intent and refuses drift before budget or ECS effects',async()=>{
 const x=await fixture(),issued=await x.ports.prepareInitial({binding:x.binding});x.state.saved.run.state='running';x.state.allocation={binding:x.binding,allocationKey:hash(x.binding),original:issued.original,allocationSha256:issued.allocationSha256,qualification:issued.qualification,grantIntents:issued.grantIntents,taskRequestSha256:issued.taskRequestSha256,expiresAtMs:issued.original.expiresAtMs,state:'RETIRED',resource:{physicalStopProven:true}};x.state.clock=x.state.admission.expiresAtMs+1;
 const client={send(){assert.fail('No AWS');}};try{assert.deepEqual(await x.ports.retireInitial({binding:x.binding,client}),{physicalStopProven:true});x.state.allocation.taskRequestSha256='f'.repeat(64);await assert.rejects(x.ports.retireInitial({binding:x.binding,client}),{code:'PREPARED_RUN_BINDINGS_INITIAL_STOP_CONFLICT'});assert.equal(x.state.taskCalls,1);assert.equal(x.state.modelCalls,1);assert.deepEqual(x.state.events,[]);}finally{await x.close();}
});
