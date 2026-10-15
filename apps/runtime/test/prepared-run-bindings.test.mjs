/** S2 controls: production composition of the three multi-run ports from startup-supplied owners; configuration names no callback. */
import test from 'node:test';import assert from 'node:assert/strict';import {normalize} from 'node:path';import {randomUUID} from 'node:crypto';
import {createPreparedRunBindings} from '../prepared-run-bindings.mjs';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {compilePreparedCandidateConfiguration} from '../prepared-candidate-config.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
function fixture({multiRun={runWindowMs:600000}}={}){
 const f=candidateFixture(),config=f.configuration.nativeCandidate;
 for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])config.preparationIntent[k]=normalize(config.preparationIntent[k]);
 config.preparationIntent.launchTemplate.command=normalize(config.preparationIntent.launchTemplate.command);config.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=config.preparationIntent.secureStorageDirectory;
 if(multiRun)config.multiRun=multiRun;
 const authority={generated:0,async generate({issuanceKey}){this.generated++;const capability='synthetic-material-'+issuanceKey.slice(0,8);return {grantId:randomUUID(),capability,materialRef:'ref-'+issuanceKey.slice(0,8)};},async retrieve({materialRef}){return {state:'PRESENT',capability:'synthetic-material-'+materialRef.slice(4)};},async status(){return {state:'ABSENT'};}};
 const store={allocations:{async read(){return null;}},async readOptional(){return null;}},pool={connect(){throw Error('no connection in this control');}};
 return {f,config,authority,store,pool,credentials:{proxy:f.secret.proxy,control:f.secret.control}};
}
test('multi-run bounds are a closed configuration declaration; ports are built only from startup-supplied owners and a declared mode without them fails readiness',()=>{
 const x=fixture();assert.equal(compilePreparedCandidateConfiguration(x.config,x.f.configuration.versions).multiRun.runWindowMs,600000);
 assert.throws(()=>compilePreparedCandidateConfiguration({...x.config,multiRun:{runWindowMs:1000}},x.f.configuration.versions),/PREPARED_CANDIDATE_CONFIGURATION/);
 assert.throws(()=>compilePreparedCandidateConfiguration({...x.config,multiRun:{runWindowMs:600000,issuer:'./module.mjs'}},x.f.configuration.versions),/INVALID_COMMAND/,'no module or callback names in configuration');
 const none=fixture({multiRun:null});assert.throws(()=>createPreparedRunBindings({configuration:none.f.configuration,pool:none.pool,store:none.store,credentials:none.credentials,issuanceStore:createMemoryIssuanceStore(),capabilityAuthority:none.authority}),/PREPARED_RUN_BINDINGS_NOT_CONFIGURED/);
 assert.throws(()=>createPreparedRunBindings({configuration:x.f.configuration,pool:x.pool,store:x.store,credentials:x.credentials}),/PREPARED_RUN_BINDINGS_UNAVAILABLE/,'declared multi-run mode without the durable issuer fails readiness');
 assert.throws(()=>createPreparedRunBindings({configuration:x.f.configuration,pool:x.pool,store:x.store,credentials:x.credentials,issuanceStore:createMemoryIssuanceStore()}),/PREPARED_RUN_BINDINGS_UNAVAILABLE/,'and without the capability authority');
 assert.throws(()=>createPreparedRunBindings({configuration:x.f.configuration,pool:x.pool,store:x.store,credentials:{proxy:x.f.secret.proxy,control:x.f.secret.proxy},issuanceStore:createMemoryIssuanceStore(),capabilityAuthority:x.authority}),/PREPARED_RUN_BINDINGS_CONFIGURATION/,'proxy and control credentials must differ');
});
test('the composed ports reach the canonical owners: prepare issues once through the durable issuer, binds facts, resolves the capability; the next-run window is bounded by the allocation schedule; admission per binding exposes revoke',async()=>{
 const x=fixture(),now=()=>Date.now(),b=createPreparedRunBindings({configuration:x.f.configuration,pool:x.pool,store:x.store,credentials:x.credentials,issuanceStore:createMemoryIssuanceStore(),capabilityAuthority:x.authority,now});
 assert.deepEqual(Object.keys(b).sort(),['admissionForBinding','configurationSha256','controlCapabilitySha256','facts','issuanceIntent','issuer','runIssuance','runWindowMs']);
 const intent=await b.issuanceIntent({binding:x.f.binding,source:null,request:{requestId:randomUUID()}});assert.ok(intent.expiresAtMs>now()&&intent.expiresAtMs<=now()+600000);
 const input={binding:x.f.binding,requestSha256:hash({prompt:'First prompt'}),expiresAtMs:x.config.runtime.deadlineMs};
 const prepared=await b.runIssuance.prepare(input);assert.equal(x.authority.generated,1);assert.equal(prepared.issuance.issuanceKey,hash(x.f.binding));assert.ok(prepared.factsSha256);assert.equal(prepared.controlCapabilitySha256,capabilityDigest(x.f.secret.control));
 assert.ok(!JSON.stringify(prepared).includes(x.f.secret.proxy),'the proxy credential never enters a receipt');
 const again=await b.runIssuance.prepare(input);assert.equal(x.authority.generated,1,'replay never generates');assert.equal(again.issuance.capabilitySha256,prepared.issuance.capabilitySha256);
 const capability=await b.runIssuance.resolveCapability(prepared.issuance);assert.equal(capabilityDigest(capability),prepared.issuance.capabilitySha256);
 const configuration=await b.runIssuance.resolveFacts(prepared.issuance);assert.equal(configuration.runtime.proxyCredential,x.f.secret.proxy,'trusted in-memory facts carry the credential only in process');
 const record={state:'RETIRED',original:prepared.original,grantIntents:prepared.grantIntents,resource:{taskArn:'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+'c'.repeat(32),physicalStopProven:true},qualification:x.config.qualification};
 const admission=await b.admissionForBinding({binding:x.f.binding,record});assert.equal(typeof admission.revoke,'function');
 await assert.rejects(b.admissionForBinding({binding:x.f.binding,record:{...record,extra:1}}),/INVALID_COMMAND/);
});
test('original expiry and authoritative target facts persist: a later target is admitted against its own retargeted allocation, process recreation after a clock advance keeps the recorded expiry and replays without re-minting, the facts bind the current run record and the per-entry transport, and a record naming another allocation hash is refused',async()=>{
 const x=fixture();let t=Date.now();const now=()=>t,issuanceStore=createMemoryIssuanceStore();
 const rows=new Map();x.store.readOptional=async binding=>rows.get(hash(binding))??null;
 const first=createPreparedRunBindings({configuration:x.f.configuration,pool:x.pool,store:x.store,credentials:x.credentials,issuanceStore,capabilityAuthority:x.authority,now});
 const intent1=await first.issuanceIntent({binding:x.f.binding,source:null,request:{requestId:randomUUID()}});assert.equal(intent1.persisted,false);
 const input={binding:x.f.binding,requestSha256:hash({prompt:'First prompt'}),expiresAtMs:intent1.expiresAtMs};const prepared=await first.runIssuance.prepare(input);assert.equal(x.authority.generated,1);
 assert.deepEqual(prepared.transport,{origin:x.config.taskOrigin,http:x.config.taskHttp},'the transport contract is part of the issued facts');assert.equal(prepared.original.expiresAtMs,intent1.expiresAtMs);
 // Process recreation after the clock moved: the intent is the recorded one, so the replay is exact and nothing is re-minted.
 t+=60000;const second=createPreparedRunBindings({configuration:x.f.configuration,pool:x.pool,store:x.store,credentials:x.credentials,issuanceStore,capabilityAuthority:x.authority,now});
 const intent2=await second.issuanceIntent({binding:x.f.binding,source:null,request:{requestId:randomUUID()}});assert.deepEqual(intent2,{expiresAtMs:intent1.expiresAtMs,persisted:true},'the original expiry is persisted, never recomputed from a later clock');
 const replay=await second.runIssuance.prepare({...input,expiresAtMs:intent2.expiresAtMs});assert.deepEqual(replay,prepared);assert.equal(x.authority.generated,1,'no re-mint across process recreation');
 await assert.rejects(second.runIssuance.prepare({...input,expiresAtMs:intent1.expiresAtMs-1}),/INTENT_CONFLICT/,'a recomputed expiry for the same binding is refused by the durable intent');
 // A later target: its admission is built against the allocation retargeted to it, not the first run's; a record naming another hash is refused.
 const later={...x.f.binding,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2};const retargeted=JSON.parse(x.config.allocationJson);retargeted.run=Object.fromEntries(Object.keys(retargeted.run).map(k=>[k,later[k]]));
 const record={state:'RETIRED',original:{...prepared.original,binding:later},grantIntents:prepared.grantIntents,resource:{taskArn:'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+'d'.repeat(32),physicalStopProven:true},allocationSha256:hash(retargeted)};
 const admission=await second.admissionForBinding({binding:later,record});assert.equal(typeof admission.revoke,'function','the later binding is admissible against its own allocation');
 await assert.rejects(second.admissionForBinding({binding:later,record:{...record,allocationSha256:hash(JSON.parse(x.config.allocationJson))}}),/PREPARED_RUN_BINDINGS_ALLOCATION_MISMATCH/,'the first run\'s allocation hash does not admit the later target');
 // The fact producer binds the current durable run record: a later run without one is refused; another policy revision or versions refuse; a matching record compiles the retargeted allocation and this entry's transport.
 const laterIntent={binding:later,requestSha256:hash({prompt:'Second prompt'}),expiresAtMs:intent1.expiresAtMs,issuanceKey:hash(later)},laterIssuance={grantId:randomUUID(),capabilitySha256:'e'.repeat(64)};
 await assert.rejects(second.facts.compile({intent:laterIntent,issuance:laterIssuance}),/PREPARED_RUN_BINDINGS_RUN_RECORD_REQUIRED/);
 rows.set(hash(later),{run:{binding:later,versions:x.config.runtime.versions,policyRevision:'f'.repeat(64)}});await assert.rejects(second.facts.compile({intent:laterIntent,issuance:laterIssuance}),/PREPARED_RUN_BINDINGS_RUN_RECORD_MISMATCH/);
 rows.set(hash(later),{run:{binding:later,versions:{...x.config.runtime.versions,cli:'9.9.9'},policyRevision:x.config.qualification.policyRevision}});await assert.rejects(second.facts.compile({intent:laterIntent,issuance:laterIssuance}),/PREPARED_RUN_BINDINGS_RUN_RECORD_MISMATCH/);
 rows.set(hash(later),{run:{binding:later,versions:x.config.runtime.versions,policyRevision:x.config.qualification.policyRevision}});const compiled=await second.facts.compile({intent:laterIntent,issuance:laterIssuance});
 assert.equal(hash(JSON.parse(compiled.allocationJson)),hash(retargeted),'the facts carry the allocation retargeted to the later run');assert.deepEqual(compiled.transport,{origin:x.config.taskOrigin,http:x.config.taskHttp});assert.deepEqual(compiled.runtime.binding,later);assert.equal(compiled.runtime.deadlineMs,laterIntent.expiresAtMs);
 assert.ok(!JSON.stringify(prepared).includes(x.f.secret.proxy)&&compiled.runtime.proxyCredential===x.f.secret.proxy,'the credential stays in trusted memory');
});
