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
 const store={allocations:{async read(){return null;}}},pool={connect(){throw Error('no connection in this control');}};
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
 assert.deepEqual(Object.keys(b).sort(),['admissionForBinding','configurationSha256','controlCapabilitySha256','issuanceIntent','issuer','runIssuance','runWindowMs']);
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
