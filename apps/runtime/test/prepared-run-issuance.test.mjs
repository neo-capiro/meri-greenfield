import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize} from 'node:path';
import {createPreparedRunIssuance} from '../prepared-run-issuance.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {compileNativeBrokerPlan} from '../native-authority/broker-stack.mjs';
import {id} from '../../control/conversations/test/application-fixture.mjs';
function fixture(){
 const f=candidateFixture(),config=f.configuration.nativeCandidate,rows=new Map(),stats={issue:0,resolve:0,revoke:0,compile:0},state={now:f.now,readUnknown:false,throwIssue:false,loseAck:false,wrongCapability:false,changeFacts:false};
 for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])config.preparationIntent[k]=normalize(config.preparationIntent[k]);
 config.preparationIntent.launchTemplate.command=normalize(config.preparationIntent.launchTemplate.command);config.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=config.preparationIntent.secureStorageDirectory;
 const input={binding:f.binding,requestSha256:hash({prompt:'First prompt'}),expiresAtMs:config.runtime.deadlineMs};
 const issuer={
  async read({issuanceKey}){return state.readUnknown?{state:'UNKNOWN'}:rows.get(issuanceKey)??{state:'ABSENT'};},
  async issue({signal,...intent}){
   stats.issue++;if(rows.has(intent.issuanceKey))return rows.get(intent.issuanceKey);
   rows.set(intent.issuanceKey,{state:'UNKNOWN'});if(state.throwIssue)throw Error('Synthetic lost acknowledgement');
   const capability='synthetic-per-run-'+intent.issuanceKey,issuance={...intent,grantId:id(99+intent.binding.writerFence),capabilitySha256:capabilityDigest(capability)};
   rows.set(intent.issuanceKey,{state:'ISSUED',issuance});if(state.loseAck)throw Error('Synthetic lost acknowledgement');return rows.get(intent.issuanceKey);
  },
  async bindFacts({issuanceKey,factsSha256}){const row=rows.get(issuanceKey);assert.equal(row.state,'ISSUED');if(row.issuance.factsSha256&&row.issuance.factsSha256!==factsSha256)throw Error('Immutable provider conflict');row.issuance={...row.issuance,factsSha256};return row.issuance;},
  async resolve({issuanceKey}){stats.resolve++;return state.wrongCapability?'synthetic-substitute':'synthetic-per-run-'+issuanceKey;}
 };
 const facts={async compile({intent,issuance}){
  stats.compile++;const c=structuredClone(config),allocation=JSON.parse(c.allocationJson);
  allocation.run=Object.fromEntries(Object.keys(allocation.run).map(k=>[k,intent.binding[k]]));
  return {runtime:{...c.runtime,binding:intent.binding,deadlineMs:intent.expiresAtMs,proxyCredential:f.secret.proxy},plan:{...c.plan,...(state.changeFacts?{changed:true}:{})},preparationIntent:c.preparationIntent,allocationJson:JSON.stringify(allocation),qualification:c.qualification,grantIntents:[{grantId:issuance.grantId,capabilitySha256:issuance.capabilitySha256,expiresAtMs:intent.expiresAtMs}],grantId:issuance.grantId,operations:c.operations,taskRequest:c.taskRequest,containerName:c.containerName,controlCapabilitySha256:capabilityDigest(f.secret.control),transport:{origin:c.taskOrigin,http:c.taskHttp}};
 }};
 const original=compileNativeBrokerPlan({runtime:{...config.runtime,proxyCredential:f.secret.proxy},plan:config.plan,preparationIntent:config.preparationIntent}).original;
 const sourceRecord={state:'RETIRED',original,grantIntents:[{grantId:id(77),capabilitySha256:'a'.repeat(64),expiresAtMs:input.expiresAtMs}],resource:{taskArn:'synthetic-owned-task',physicalStopProven:true}};
 const sourceOwners={allocations:{async read(){return {record:sourceRecord};}},admission:{async revoke({taskArn}){stats.revoke++;if(state.rejectRevocation)throw Error('Synthetic revocation rejected');return {state:'REVOKED',taskArn,grantIds:sourceRecord.grantIntents.map(g=>g.grantId),revocationProven:!state.unrevoked};}}};
 const create=()=>createPreparedRunIssuance({issuer,facts,sourceOwners,now:()=>state.now,maxRequestMs:1000}),owner=create();
 return {input,owner,create,issuer,facts,rows,state,stats,sourceRecord,source:{original:sourceRecord.original,grantIntents:sourceRecord.grantIntents},next:{...input,binding:{...input.binding,runId:id(200),attemptId:id(201),workerId:id(202),writerFence:2},requestSha256:hash({prompt:'Second prompt'})},secret:f.secret};
}
test('per-run receipt compiles canonical facts; exact retries and restart preserve issuance, allocation and grants',async()=>{
 const f=fixture(),first=await f.owner.prepare(f.input),retry=await f.create().prepare(f.input);
 assert.deepEqual(retry,first);assert.equal(f.stats.issue,1);assert.equal(first.original.expiresAtMs,f.input.expiresAtMs);
 assert.equal(first.issuance.issuanceKey,hash(f.input.binding));assert.equal(first.issuance.factsSha256,first.factsSha256);
 assert.equal(await f.owner.resolveCapability(first.issuance),'synthetic-per-run-'+first.issuance.issuanceKey);
 const serialized=JSON.stringify(first);for(const value of Object.values(f.secret))assert.ok(!serialized.includes(value));assert.ok(!serialized.includes('synthetic-per-run-'));
});
test('fresh target gets independent capability/allocation identity after injected journal retirement and admission revoke',async()=>{
 const f=fixture(),a=await f.owner.prepare(f.input),b=await f.owner.prepare({...f.next,source:f.source});
 assert.notEqual(a.issuance.capabilitySha256,b.issuance.capabilitySha256);assert.notEqual(a.allocationSha256,b.allocationSha256);assert.notEqual(a.original.executionKey,b.original.executionKey);assert.notEqual(a.issuance.grantId,b.issuance.grantId);assert.equal(f.stats.revoke,2);
});
for(const state of ['ADMITTED','ALLOCATED','UNKNOWN'])test('source '+state+' refuses issuance without redispatch',async()=>{
 const f=fixture();f.sourceRecord.state=state;f.sourceRecord.resource.launchBinding={state:'STARTED'};
 await assert.rejects(f.owner.prepare({...f.next,source:f.source}),/SOURCE_NOT_RETIRED/);assert.equal(f.stats.issue,0);assert.equal(f.stats.revoke,0);
});
test('unproven stop and rejected/unrevoked grants refuse fresh issuance',async()=>{
 for(const change of ['stop','revocation','rejection']){const f=fixture();if(change==='stop')f.sourceRecord.resource.physicalStopProven=false;if(change==='revocation')f.state.unrevoked=true;if(change==='rejection')f.state.rejectRevocation=true;
  await assert.rejects(f.owner.prepare({...f.next,source:f.source}));assert.equal(f.stats.issue,0);
 }
});
test('lost issuance acknowledgement reconciles durable issued identity once',async()=>{
 const f=fixture();f.state.loseAck=true;const receipt=await f.owner.prepare(f.input);assert.equal(f.stats.issue,1);assert.deepEqual(await f.create().prepare(f.input),receipt);assert.equal(f.stats.issue,1);
});
test('durable UNKNOWN never reissues, including process-owner recreation',async()=>{
 const f=fixture();f.state.throwIssue=true;await assert.rejects(f.owner.prepare(f.input),/ISSUANCE_UNKNOWN/);
 for(const owner of [f.owner,f.create()])await assert.rejects(owner.prepare(f.input),/ISSUANCE_UNKNOWN/);assert.equal(f.stats.issue,1);assert.equal(f.stats.compile,0);
});
test('uncertain attempt never reissues even if broken provider subsequently reports absent',async()=>{
 const f=fixture();f.state.throwIssue=true;await assert.rejects(f.owner.prepare(f.input));f.rows.clear();await assert.rejects(f.owner.prepare(f.input),/ISSUANCE_UNKNOWN/);assert.equal(f.stats.issue,1);
});
test('competing requests and changed compiled facts refuse immutable issuance replay',async()=>{
 const f=fixture();await f.owner.prepare(f.input);await assert.rejects(f.owner.prepare({...f.input,requestSha256:'e'.repeat(64)}),/ISSUER_REFUSED/);f.state.changeFacts=true;await assert.rejects(f.owner.prepare(f.input),/PREPARED_RUN_UNKNOWN/);assert.equal(f.stats.issue,1);
});
test('concurrent exact requests share the provider durable issuance identity',async()=>{
 const f=fixture(),[a,b]=await Promise.all([f.owner.prepare(f.input),f.create().prepare(f.input)]);assert.deepEqual(a,b);assert.equal(f.rows.size,1);
});
test('original deadline never extends on retry or credential resolution',async()=>{
 const f=fixture(),r=await f.owner.prepare(f.input);await assert.rejects(f.owner.prepare({...f.input,expiresAtMs:f.input.expiresAtMs+1}),/ISSUER_REFUSED/);f.state.now=f.input.expiresAtMs;await assert.rejects(f.owner.prepare(f.input));await assert.rejects(f.owner.resolveCapability(r.issuance));assert.equal(f.stats.resolve,0);
});
test('issuer capability, binding and grant substitutions fail closed',async()=>{
 const f=fixture(),r=await f.owner.prepare(f.input);f.state.wrongCapability=true;await assert.rejects(f.owner.resolveCapability(r.issuance),/CAPABILITY_REFUSED/);
 await assert.rejects(f.owner.resolveCapability({...r.issuance,grantId:id(345)}),/ISSUER_REFUSED/);
 f.rows.get(r.issuance.issuanceKey).issuance.binding={...f.input.binding,actorId:'foreign'};await assert.rejects(f.owner.prepare(f.input),/ISSUER_REFUSED/);
});
test('source retirement is rechecked after issuance and fact compilation',async()=>{
 const f=fixture(),compile=f.facts.compile;f.facts.compile=async input=>{const result=await compile(input);f.sourceRecord.state='ADMITTED';return result;};
 const owner=f.create();await assert.rejects(owner.prepare({...f.next,source:f.source}),/SOURCE_NOT_RETIRED/);assert.equal(f.stats.issue,1);
});
test('absent issuer provider and already aborted requests perform no issuance',async()=>{
 const f=fixture();assert.throws(()=>createPreparedRunIssuance({issuer:{},facts:f.facts}));await assert.rejects(f.owner.prepare({...f.input,signal:AbortSignal.abort()}));assert.equal(f.stats.issue,0);
});
for(const [name,mutate] of Object.entries({
 binding:c=>{c.runtime.binding={...c.runtime.binding,actorId:'foreign'};},
 allocation:c=>{const a=JSON.parse(c.allocationJson);a.run.runId=id(333);c.allocationJson=JSON.stringify(a);},
 budget:c=>{c.runtime.maxCostMicroUSD=999;},
 deadline:c=>{c.runtime.deadlineMs++;},
 grant:c=>{c.grantIntents[0].capabilitySha256='d'.repeat(64);},
 expiry:c=>{c.grantIntents[0].expiresAtMs++;},
 request:c=>{c.taskRequest.overrides.containerOverrides[0].environment=[{name:'MERI_PASSWORD',value:'synthetic-forbidden'}];},
 control:c=>{c.controlCapabilitySha256=c.grantIntents[0].capabilitySha256;},
 transportOrigin:c=>{c.transport={...c.transport,origin:'http://plain.synthetic.invalid'};},
 transportListener:c=>{c.transport={...c.transport,http:{...c.transport.http,frontendOrigin:'https://other.synthetic.invalid'}};}
}))test('canonical compiler rejects substituted '+name,async()=>{
 const f=fixture(),compile=f.facts.compile;f.facts.compile=async input=>{const config=structuredClone(await compile(input));mutate(config);return config;};
 await assert.rejects(f.create().prepare(f.input));assert.equal(f.rows.get(hash(f.input.binding)).issuance.factsSha256,undefined);
});
test('next run requires source and refuses reused source capability and grant identities',async()=>{
 const f=fixture();await assert.rejects(f.owner.prepare(f.next),/SOURCE_REQUIRED/);assert.equal(f.stats.issue,0);
 f.sourceRecord.grantIntents[0].capabilitySha256=capabilityDigest('synthetic-per-run-'+hash(f.next.binding));
 await assert.rejects(f.owner.prepare({...f.next,source:f.source}),/SOURCE_CAPABILITY_REUSE/);
});
test('provider errors never escape with opaque credential text',async()=>{
 const f=fixture();f.facts.compile=async()=>{throw Error('synthetic-credential-must-not-escape');};await assert.rejects(f.create().prepare(f.input),e=>e.message==='PREPARED_RUN_UNKNOWN');
});
test('trusted in-memory controller facts resolve only against exact durable compiled hash',async()=>{
 const f=fixture(),prepared=await f.owner.prepare(f.input),configuration=await f.owner.resolveFacts(prepared.issuance);
 assert.equal(configuration.runtime.proxyCredential,f.secret.proxy);assert.deepEqual(configuration.runtime.binding,f.input.binding);assert.equal(configuration.runtime.deadlineMs,f.input.expiresAtMs);assert.equal(configuration.grantIntents[0].capabilitySha256,prepared.issuance.capabilitySha256);
 f.state.changeFacts=true;await assert.rejects(f.owner.resolveFacts(prepared.issuance),/FACTS_REPLAY_REFUSED/);
 f.state.now=f.input.expiresAtMs;await assert.rejects(f.owner.resolveFacts(prepared.issuance));
});
for(const field of ['grantId','capabilitySha256'])test('every target grant refuses retired source '+field+' reuse',async()=>{
 const f=fixture(),compile=f.facts.compile;f.facts.compile=async input=>{const config=structuredClone(await compile(input));config.grantIntents.push({grantId:id(444),capabilitySha256:'f'.repeat(64),expiresAtMs:f.next.expiresAtMs,[field]:f.sourceRecord.grantIntents[0][field]});return config;};
 await assert.rejects(f.create().prepare({...f.next,source:f.source}),/SOURCE_CAPABILITY_REUSE/);assert.equal(f.rows.get(hash(f.next.binding)).issuance.factsSha256,undefined);
});
for(const field of ['attemptId','workerId'])test('next run refuses reused source '+field,async()=>{
 const f=fixture();await assert.rejects(f.owner.prepare({...f.next,binding:{...f.next.binding,[field]:f.input.binding[field]},source:f.source}),/SOURCE_REFUSED/);assert.equal(f.stats.issue,0);
});
test('aborted trusted materialization resolves neither capability nor controller configuration',async()=>{
 const f=fixture(),prepared=await f.owner.prepare(f.input),compiled=f.stats.compile,signal=AbortSignal.abort();
 await assert.rejects(f.owner.resolveCapability(prepared.issuance,{signal}));await assert.rejects(f.owner.resolveFacts(prepared.issuance,{signal}));assert.equal(f.stats.resolve,0);assert.equal(f.stats.compile,compiled);
});
test('a source that never claimed an allocation is admitted only on its exact foreclosure evidence; nothing is revoked and a missing row refuses',async()=>{
 const f=fixture(),source=f.input.binding,evidence={binding:source,allocationKey:hash(source),state:'FORECLOSED',foreclosure:{eventId:id(88),eventSha256:'e'.repeat(64),state:'cancelled'}};let revokes=0;
 const owner=record=>createPreparedRunIssuance({issuer:f.issuer,facts:f.facts,sourceOwners:{allocations:{async read(query){assert.deepEqual(query,{binding:source,allocationKey:hash(source)});return {record};}},admission:{async revoke(){revokes++;throw Error('nothing to revoke');}}},now:()=>f.state.now,maxRequestMs:1000});
 const issued=await owner(evidence).prepare({...f.next,source:{binding:source,foreclosureSha256:hash(evidence)}});assert.equal(issued.issuance.issuanceKey,hash(f.next.binding));assert.equal(revokes,0);
 for(const [record,sha] of [[null,hash(evidence)],[evidence,'f'.repeat(64)],[{...evidence,state:'RETIRED'},hash(evidence)],[{...evidence,binding:f.next.binding},hash({...evidence,binding:f.next.binding})]]){const g=fixture();
  await assert.rejects(createPreparedRunIssuance({issuer:g.issuer,facts:g.facts,sourceOwners:{allocations:{async read(){return {record};}},admission:{async revoke(){throw Error('unused');}}},now:()=>g.state.now,maxRequestMs:1000}).prepare({...g.next,source:{binding:record?.binding??source,foreclosureSha256:sha}}),/SOURCE_NOT_RETIRED|SOURCE_REFUSED/);assert.equal(g.stats.issue,0);}});
