import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize} from 'node:path';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {NOW} from '../../gateway/budget/product-scripted-fixture.mjs';
import {productControlFixture} from './test/control-fixture.mjs';
import {compilePreparedRunConfigurationSha256} from '../../runtime/prepared-run-configuration.mjs';
import {createPreparedRunBindings} from '../../runtime/prepared-run-bindings.mjs';
import {createMemoryIssuanceStore} from '../../runtime/prepared-run-issuance-store.mjs';
import {compileNativeTaskRequest} from '../../runtime/native-authority/task-request.mjs';
import {createProductProxyPersistedFacts} from './product-owner-facts.mjs';
import {createProductOwnerPlacement} from './product-owner-placement.mjs';

const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const refused=/PRODUCT_PROXY_PLACEMENT_UNAVAILABLE/;

/** Fixed PostgreSQL protocol rows, the real persisted-facts resolver and canonical conversation decoder. No server/client socket. */
function fixture({successor=false}={}){
 const {seed,model,binding,qualification:q,clientId,configuration}=productControlFixture(),c=configuration.nativeCandidate;
 const firstBinding=structuredClone(binding);
 if(successor){
  Object.assign(binding,{runId:id(60),attemptId:id(61),workerId:id(62),writerFence:2});
  Object.assign(q,{runId:binding.runId,fence:binding.writerFence});
  seed.allocation.run=Object.fromEntries(Object.keys(seed.allocation.run).map(k=>[k,binding[k]]));model.allocationSha256=hash(seed.allocation);
 }
 const task={...structuredClone(model),grantId:id(44),capabilitySha256:'c'.repeat(64)},request={requestId:id(45),prompt:'Synthetic accepted request',skill:null,window:null};
 const expiresAtMs=NOW+8000,issuanceKey=hash(binding),createdAt=new Date(NOW).toISOString();
 const run={binding,state:'running',scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,policyRevision:q.policyRevision}],policyRevision:q.policyRevision,versions:configuration.versions,createdAt};
 const original={binding,executionKey:issuanceKey,executionId:issuanceKey,planSha256:'d'.repeat(64),expiresAtMs,versions:configuration.versions};
 const resource={taskArn:q.workerArn,createdAtMs:NOW,clusterArn:c.taskRequest.cluster,taskDefinitionArn:c.taskRequest.taskDefinition,containerName:'worker',grantFactsJsons:[model,task].map(JSON.stringify)};
 const record={binding,allocationKey:issuanceKey,original,allocationSha256:model.allocationSha256,qualification:{attempt:q.attempt,policyRevision:q.policyRevision},grantIntents:[model,task].map(g=>({grantId:g.grantId,capabilitySha256:g.capabilitySha256,expiresAtMs})),taskRequestSha256:compileNativeTaskRequest({original,taskRequest:c.taskRequest,containerName:'worker'}).taskRequestSha256,expiresAtMs,state:'ADMITTED',resource};
 const state={budget:{id:1,cap_micro_usd:'10000',consumed_micro_usd:'0',quarantined:false},budgetRun:{run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision},
  grants:[model,task].map(g=>({grant_id:g.grantId,run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision,capability_sha256:g.capabilitySha256,state:'ACTIVE',expires_at:new Date(expiresAtMs)})),
  facts:[model,task].map(g=>({grant_id:g.grantId,run_id:binding.runId,facts:g})),allocation:{run_id:binding.runId,allocation:seed.allocation,allocation_sha256:model.allocationSha256,max_tool_calls:String(seed.allocation.budgets.maxToolCalls),max_cost_micro_usd:String(seed.allocation.budgets.maxCostMicroUSD),started_at:new Date(NOW)},
  issuance:{issuance_key:issuanceKey,binding,request_sha256:hash(request),expires_at_ms:String(expiresAtMs),state:'ISSUED',claim_fence:id(46),version:'1',grant_id:model.grantId,capability_sha256:model.capabilitySha256,material_ref:'model-material:v1:'+issuanceKey,facts_sha256:null,claimed_at:new Date(NOW),issued_at:new Date(NOW)},
  run:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,request_id:request.requestId,request,request_sha256:hash(request),projection:run,projection_sha256:hash(run),last_sequence:1},
  native:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,intent_key:issuanceKey,record,record_sha256:hash(record)},
  event:{sequence:1,event_id:id(47),event:{contractVersion:'0.1.0',eventId:id(47),binding,sequence:1,createdAt,scopes:run.scopes,type:'run.status',data:{state:'running',reasonCode:null}}},admission:null};
 state.event.event_sha256=hash(state.event.event);
 const calls=[],releases=[];let before=()=>{},initialReads=0;
 async function query(sql,p=[]){
  calls.push({sql,p});await before(sql,p);const rows=value=>({rows:structuredClone(value),rowCount:value.length});
  if(sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory')||sql==='COMMIT'||sql==='ROLLBACK')return rows([]);
  assert.equal(/(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\s/iu.test(sql.replace(/FOR UPDATE/gu,'')),false,'projection never mutates a row');
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(NOW)}]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants WHERE capability_sha256='))return rows(state.grants.filter(g=>g.capability_sha256===p[0]));
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants WHERE grant_id='))return rows(state.grants.filter(g=>g.grant_id===p[0]));
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants WHERE run_id='))return rows(state.grants.filter(g=>g.run_id===p[0]).sort((a,b)=>a.grant_id.localeCompare(b.grant_id)));
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE grant_id='))return rows(state.facts.filter(g=>g.grant_id===p[0]));
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE run_id='))return rows(state.facts.filter(g=>g.run_id===p[0]).sort((a,b)=>a.grant_id.localeCompare(b.grant_id)));
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations WHERE'))return rows(state.allocation?[state.allocation]:[]);
  if(sql==='SELECT * FROM meri_product_budget.budget WHERE id=1')return rows([state.budget]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.runs WHERE'))return rows([state.budgetRun]);
  if(sql.includes('FROM meri_conversations.model_run_issuances WHERE'))return rows(state.issuance?[state.issuance]:[]);
  if(sql.startsWith('SELECT * FROM meri_conversations.runs WHERE'))return rows([state.run,state.firstRun].filter(r=>r&&r.tenant_id===p[0]&&r.conversation_id===p[1]&&r.run_id===p[2]));
  if(sql.startsWith('SELECT * FROM meri_conversations.native_allocations WHERE'))return rows(state.native?[state.native]:[]);
  if(sql.startsWith('SELECT * FROM meri_conversations.events WHERE'))return rows([state.firstRun?.run_id===p[2]?state.firstEvent:state.event]);
  assert.fail('Unexpected scripted placement SQL: '+sql);
 }
 const pool={query,async connect(){return {query,release:error=>releases.push(error)};}};
 const initialBindings={async read(){return null;},async readConversation(_input,check){check();initialReads++;return structuredClone(state.admission);}};
 const configurationSha256=compilePreparedRunConfigurationSha256(configuration);
 state.admission={schemaVersion:1,state:'ADMITTED',binding:firstBinding,selectedClientId:clientId,policyRevision:q.policyRevision,versions:configuration.versions,configurationSha256,expiresAtMs:successor?NOW-100:expiresAtMs,createdAtMs:NOW-1000};
 if(successor){
  const originalRun={...run,binding:firstBinding,state:'completed'};
  state.firstRun={...state.run,run_id:firstBinding.runId,projection:originalRun,projection_sha256:hash(originalRun)};
  state.firstEvent={...state.event,event:{...state.event.event,binding:firstBinding,data:{state:'completed',reasonCode:null}}};state.firstEvent.event_sha256=hash(state.firstEvent.event);
 }
 const facts=createProductProxyPersistedFacts({pool,selectedClientId:clientId,now:()=>NOW,limits:{maxRequestMs:1000,maxFactBytes:131072},enabled:true});
 const options={configuration,pool,persistedFacts:facts,initialBindings,now:()=>NOW,limits:{maxRequestMs:1000,maxFactBytes:131072},enabled:true};
 return {options,state,model,task,calls,releases,initialReads:()=>initialReads,make:extra=>createProductOwnerPlacement({...options,...extra}),query:()=>({capabilitySha256:model.capabilitySha256,deadlineMs:NOW+5000}),before:fn=>{before=fn;},rehash:()=>{state.native.record_sha256=hash(state.native.record);}};
}

test('real model ISSUED/admitted custody yields only original expected placement and distinct lease',async()=>{
 const f=fixture(),owner=f.make(),out=await owner.resolve(f.query()),p=out.issuedTaskNetwork;
 assert.deepEqual(Object.keys(out),['issuedTaskNetwork','checkedAtMs','effectiveExpiresAtMs']);
 assert.equal(p.vpc_id,'vpc-12345678');assert.equal(p.subnet_id,'subnet-12345678');assert.deepEqual(p.security_group_ids,['sg-12345678']);
 assert.equal(p.grant_id,f.model.grantId);assert.deepEqual(p.execution_binding,f.model.binding);
 assert.deepEqual(p.binding,{run_id:f.model.binding.runId,attempt:f.model.qualificationBinding.attempt,worker_arn:f.model.qualificationBinding.workerArn,fence:f.model.binding.writerFence,policy_revision:f.model.qualificationBinding.policyRevision});
 assert.equal(p.expires_at_ms,NOW+8000);assert.equal(new Map(p.tags).get('meri:expires-at-ms'),String(NOW+8000));
 assert.ok(out.effectiveExpiresAtMs<=NOW+1000);assert.equal(p.started_by,hash(f.model.binding));assert.equal(p.group,'meri:'+p.started_by);
 assert.equal(f.initialReads(),2);assert.ok(f.calls.some(c=>c.sql.includes('FROM meri_conversations.model_run_issuances')));
 assert.ok(Object.isFrozen(p.execution_binding));assert.equal(/proxyCredential|material_ref|overrides|credentialFile|model-material:/u.test(JSON.stringify(out)),false);
 assert.deepEqual(await owner.resolve(f.query()),out);
});

test('disabled, caller placement and already-aborted requests refuse before borrowed reads',async()=>{
 const f=fixture(),owner=f.make({enabled:false});assert.equal(owner.available,false);await assert.rejects(owner.resolve(f.query()),refused);
 const active=f.make(),controller=new AbortController();controller.abort();
 await assert.rejects(active.resolve({...f.query(),subnetId:'subnet-ffffffff'}),refused);
 await assert.rejects(active.resolve({...f.query(),signal:controller.signal}),refused);assert.equal(f.calls.length,0);
});

test('original placement, request identity, config or immutable custody drift is never repaired from observations',async t=>{
 const mutations={
  subnet:f=>{f.options.configuration.nativeCandidate.taskRequest.networkConfiguration.awsvpcConfiguration.subnets=['subnet-ffffffff'];},
  groups:f=>{f.options.configuration.nativeCandidate.taskRequest.networkConfiguration.awsvpcConfiguration.securityGroups=['sg-ffffffff'];},
  command:f=>{f.options.configuration.nativeCandidate.taskRequest.overrides.containerOverrides[0].command=['other'];},
  requestHash:f=>{f.state.native.record.taskRequestSha256='f'.repeat(64);f.rehash();},
  originalConfig:f=>{f.state.admission.configurationSha256='f'.repeat(64);},
  missingOriginal:f=>{f.state.admission=null;},
  originalOwner:f=>{f.state.admission.binding.actorId='foreign';},
  originalFence:f=>{f.state.admission.binding.writerFence=2;},
  initialExpiry:f=>{f.state.admission.expiresAtMs++;},
  modelUnknown:f=>{f.state.issuance.state='CLAIMED';f.state.issuance.grant_id=null;},
  modelRevoked:f=>{f.state.grants[0].state='REVOKED';},
  admissionUnknown:f=>{f.state.native.record.state='UNKNOWN';f.rehash();},
  archivedRun:f=>{f.state.run.projection.state='completed';f.state.run.projection_sha256=hash(f.state.run.projection);},
  requestedImage:f=>{f.options.configuration.versions={...f.options.configuration.versions,imageDigest:'sha256:'+'f'.repeat(64)};},
  resource:f=>{f.state.native.record.resource.taskDefinitionArn='arn:aws:ecs:us-east-1:967807252336:task-definition/MeriSynthetic:2';f.rehash();},
 };
 for(const [name,change] of Object.entries(mutations))await t.test(name,async()=>{const f=fixture();change(f);let owner;try{owner=f.make();}catch{return;}await assert.rejects(owner.resolve(f.query()),refused);});
});

test('configuration is snapshotted; fresh original recheck detects a concurrent journal change',async()=>{
 const f=fixture(),owner=f.make();f.options.configuration.taskRouter.vpcId='vpc-ffffffff';
 assert.equal((await owner.resolve(f.query())).issuedTaskNetwork.vpc_id,'vpc-12345678');
 const g=fixture();let count=0;const original=g.options.initialBindings.readConversation;
 g.options.initialBindings.readConversation=async(...args)=>{const result=await original(...args);if(++count===2)result.configurationSha256='f'.repeat(64);return result;};
 await assert.rejects(g.make().resolve(g.query()),refused);
});

test('pure workload identity preserves retargeting semantics and explicitly excludes independently pinned router VPC',()=>{
 const f=fixture(),before=compilePreparedRunConfigurationSha256(f.options.configuration),changed=structuredClone(f.options.configuration),c=changed.nativeCandidate;
 const noEffect=()=>assert.fail('pure digest and binding construction never resolve or issue material');
 const bindings=createPreparedRunBindings({configuration:f.options.configuration,pool:f.options.pool,store:{allocations:{read:noEffect},readOptional:noEffect},credentials:{control:'synthetic-control-only'},issuanceStore:createMemoryIssuanceStore(),capabilityAuthority:{generate:noEffect,retrieve:noEffect,status:noEffect},modelGrants:{issue:noEffect},initialBindings:f.options.initialBindings,now:()=>NOW});
 assert.equal(bindings.configurationSha256,before,'existing issuance composition consumes the extracted canonical digest');
 const binding={...c.runtime.binding,conversationId:id(70),runId:id(71),attemptId:id(72),workerId:id(73)};
 c.runtime.binding=binding;c.identity.commandContext.binding=binding;c.runtime.deadlineMs--;
 c.preparationIntent.workspace=normalize('/workspace/'+binding.conversationId);
 const allocated=JSON.parse(c.allocationJson);allocated.run=Object.fromEntries(Object.keys(allocated.run).map(k=>[k,binding[k]]));c.allocationJson=JSON.stringify(allocated);
 c.proxyCredentialFile='/run/meri/other-proxy';c.identity.credentialFile='/run/meri/other-identity';
 changed.taskRouter.vpcId='vpc-ffffffff';
 assert.equal(compilePreparedRunConfigurationSha256(changed),before,'retargeted identity/clock/file references and external VPC do not alter the existing workload digest');
 c.taskRequest.networkConfiguration.awsvpcConfiguration.subnets=['subnet-ffffffff'];
 assert.notEqual(compilePreparedRunConfigurationSha256(changed),before,'requested subnet remains committed');
 let getters=0;const poisoned=structuredClone(f.options.configuration);Object.defineProperty(poisoned,'nativeCandidate',{enumerable:true,get(){getters++;throw Error('must not invoke');}});
 assert.throws(()=>compilePreparedRunConfigurationSha256(poisoned));assert.equal(getters,0);
});

test('fresh read leases may shorten independently without replacing immutable expiry or refusing identical custody',async()=>{
 const f=fixture(),resolveFacts=f.options.persistedFacts.resolve;let calls=0;
 const owner=f.make({persistedFacts:{available:true,async resolve(input){const result=await resolveFacts(input);return {...result,expiresAtMs:NOW+(++calls===1?900:800)};}}});
 const out=await owner.resolve(f.query());assert.equal(out.effectiveExpiresAtMs,NOW+800);assert.equal(out.issuedTaskNetwork.expires_at_ms,NOW+8000);
});

test('a raced-out owner is quarantined; subsequent lookups cannot accumulate background work',async()=>{
 const f=fixture();let calls=0;const owner=f.make({limits:{maxRequestMs:20,maxFactBytes:131072},persistedFacts:{available:true,resolve(){calls++;return new Promise(()=>{});}}});
 await assert.rejects(owner.resolve(f.query()),refused);assert.equal(owner.available,false);
 await assert.rejects(owner.resolve(f.query()),refused);assert.equal(calls,1);assert.equal(f.calls.length,0);
});

test('active successor joins the actual original first-run row even after its admission window expired',async()=>{
 const f=fixture({successor:true}),out=await f.make().resolve(f.query());
 assert.equal(out.issuedTaskNetwork.execution_binding.writerFence,2);
 assert.equal(out.issuedTaskNetwork.expires_at_ms,NOW+8000);
 assert.ok(f.state.admission.expiresAtMs<NOW);
 assert.ok(f.calls.some(c=>c.sql.startsWith('SELECT * FROM meri_conversations.runs WHERE')&&c.p[2]===f.state.admission.binding.runId));
 for(const mutate of [s=>{s.admission.binding={...s.admission.binding,runId:id(80),attemptId:id(81),workerId:id(82)};},s=>{s.firstRun=null;},s=>{s.firstRun.projection.scopes=[];s.firstRun.projection_sha256=hash(s.firstRun.projection);},s=>{s.firstRun.projection.versions={...s.firstRun.projection.versions,cli:'changed'};s.firstRun.projection_sha256=hash(s.firstRun.projection);}]){
  const g=fixture({successor:true});mutate(g.state);await assert.rejects(g.make().resolve(g.query()),refused);
 }
});
