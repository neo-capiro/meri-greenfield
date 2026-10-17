/** Synthetic source qualification only. Credentials below are inert fixture
 * strings; no actual authority, provider, database, network or task is invoked.
 * The real candidate factory and real prepared-run compiler produce the inputs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertRequest,requestInputHash,without} from '../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {sourceAdmissionDigest,issuedObjectiveSelection} from '../../../packages/runtime/objective-generation-custody.mjs';
import {nativeReadOperations,NATIVE_READS_SCHEMA_VERSION} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {id} from '../../../packages/contracts/strategy-operations-candidate/fixture-source.mjs';
import {objectiveProtectedFactsFixture as fixture} from './test/protected-facts-fixture.mjs';
import {compilePreparedRunFacts} from '../prepared-run-issuance.mjs';
import {compileObjectiveProtectedFacts,decorateObjectiveBindFactsInput,assertIssuedObjectiveProtectedFacts} from './protected-facts.mjs';

const refused=/^OBJECTIVE_PROTECTED_FACTS_REFUSED$/u;
const rejects=fn=>assert.throws(fn,error=>refused.test(error.message));

test('actual candidate and prepared-run compiler compose with explicit synthetic credentials into immutable bind input',()=>{
 const f=fixture(),result=f.decorate(),pair=f.compile();
 assert.deepEqual(result.facts.objectiveGeneration,pair.objectiveGeneration);assert.deepEqual(result.facts.objectiveStrategy,pair.objectiveStrategy);
 assert.equal(pair.objectiveGeneration.sourceAdmissionSha256,sourceAdmissionDigest(f.raw.sourceAdmission));
 assert.equal(pair.objectiveStrategy.requestSha256,hash(f.raw.request));
 const {factsSha256,...facts}=result.facts;assert.equal(factsSha256,hash(facts));assert.notEqual(factsSha256,f.preparedFacts.factsSha256);
 assert.deepEqual(result.bindFactsInput,{...f.options.issuance,factsSha256});
 assert.equal(result.bindFactsInput.expiresAtMs,f.options.issuance.expiresAtMs);
 for(const credential of Object.values(f.secret))assert.ok(!JSON.stringify(result).includes(credential));
 const issued={issuance:{...f.options.issuance,factsSha256},...result.facts};
 assert.deepEqual(assertIssuedObjectiveProtectedFacts(issued,{accepted:f.options.accepted}),issued);
 assert.equal(issuedObjectiveSelection(issued,{binding:f.options.accepted.run.binding,acceptedRequest:f.options.accepted.request}).sourceRequestSha256,f.options.issuance.requestSha256);
 assert.ok(Object.isFrozen(result.facts.objectiveStrategy.request));
});

test('late caller mutations do not alter compiled pair or decorator result',()=>{
 const f=fixture(),pair=f.compile(),result=f.decorate(),expected=structuredClone(result);
 f.raw.request.input.goal='late caller mutation';f.options.accepted.request.prompt='late prompt';f.raw.sourceAdmission.canonical.clientId=id(999);
 assert.equal(pair.objectiveStrategy.request.input.goal,null);assert.deepEqual(result,expected);
});

test('existing bound whole facts allow exact retry and refuse another selection or original expiry',()=>{
 const f=fixture(),first=f.decorate();f.options.issuance.factsSha256=first.facts.factsSha256;
 assert.deepEqual(f.decorate(),first);f.raw.executionSelection.model='another-synthetic-model';rejects(f.decorate);
 const g=fixture();g.options.issuance.factsSha256=g.preparedFacts.factsSha256;rejects(g.decorate);
 const h=fixture();h.options.issuance.expiresAtMs++;rejects(h.decorate);
});

for(const [name,mutate] of Object.entries({
 callerBinding:f=>{f.raw.binding={...f.options.accepted.run.binding,workerId:id(999)};},
 acceptedBinding:f=>{f.options.accepted.run.binding.workerId=id(999);},
 requestHash:f=>{f.options.issuance.requestSha256='f'.repeat(64);},
 actor:f=>{f.raw.sourceAdmission.clerkUserId='other-actor';},
 tenant:f=>{f.raw.sourceAdmission.canonical.tenantId=id(999);},
 source:f=>{f.raw.sourceAdmission.canonical.requestedObjectiveRevisionId=id(999);},
 selectedType:f=>{f.raw.queuedType='legislation';},
 prompt:f=>{f.raw.executionContext.prompt='substituted';},
 owner:f=>{f.raw.executionContext.ownerRefs[0].ownerRef='foreign-owner';},
 packet:f=>{f.raw.executionContext.contextPacketId=id(999);},
 expired:f=>{f.options.nowMs=f.options.issuance.expiresAtMs;},
 terminal:f=>{f.options.accepted.run.state='completed';},
 scope:f=>{f.options.accepted.run.scopes[0].resourceId=id(999);},
 issuerKey:f=>{f.options.issuance.issuanceKey='f'.repeat(64);},
 executionSelection:f=>{f.raw.executionSelection.provider=' ';},
 originalEffect:f=>{f.raw.sourceAdmission.effectExpiresAtMs=f.options.issuance.expiresAtMs-1;},
 legacyRequestShape:f=>{delete f.options.accepted.request.windowRequest;}
}))test('protected pair refuses '+name+' without accepting caller authority',()=>{const f=fixture();mutate(f);rejects(f.compile);});

test('full candidate request validation cannot be replaced by matching outer pair hashes',()=>{
 for(const mutate of [f=>{f.raw.request.inputSha256='f'.repeat(64);},f=>{f.raw.request.context.contextSha256='f'.repeat(64);},f=>{f.raw.request.input.typeHint='not-a-type';},
  f=>{f.raw.request.context.evidence[0].asOfMs=f.options.nowMs+1000;},f=>{f.raw.request.delegation.absoluteExpiresAtMs=f.options.nowMs;}]){
  const f=fixture();mutate(f);rejects(f.compile);
 }
});

test('valid legacy candidate with null type cannot permanently bind an unselected Objective source',()=>{
 const f=fixture(),pair=structuredClone(f.compile()),request=structuredClone(f.raw.request);
 request.input.typeHint=null;request.context.draft.input.typeHint=null;
 request.context.contextSha256=hash(without(request.context,'contextSha256'));request.inputSha256=requestInputHash(request);
 assert.doesNotThrow(()=>assertRequest(request));
 Object.assign(f.raw,{request,queuedType:null});rejects(f.compile);
 Object.assign(pair.objectiveStrategy,{request,requestSha256:hash(request),queuedType:null});
 rejects(()=>decorateObjectiveBindFactsInput({preparedFacts:f.preparedFacts,pair},f.options));
 const {factsSha256:ignored,...base}=f.preparedFacts,facts={...base,...pair},factsSha256=hash(facts);
 rejects(()=>assertIssuedObjectiveProtectedFacts({issuance:{...f.options.issuance,factsSha256},...facts,factsSha256},{accepted:f.options.accepted}));
});

for(const [name,mutate] of Object.entries({
 rawConfiguration:f=>f.rawConfiguration,
 nestedSecret:f=>{const facts=structuredClone(f.preparedFacts);facts.transport.http.proxyCredential='synthetic-secret';return facts;},
 grantSecret:f=>{const facts=structuredClone(f.preparedFacts);facts.grantIntents[0].capability='synthetic-secret';return facts;},
 originalBinding:f=>{const facts=structuredClone(f.preparedFacts);facts.original.binding.workerId=id(999);return facts;},
 versions:f=>{const facts=structuredClone(f.preparedFacts);facts.original.versions.cli='other';return facts;},
 qualification:f=>{const facts=structuredClone(f.preparedFacts);facts.qualification.policyRevision='e'.repeat(64);return facts;},
 grant:f=>{const facts=structuredClone(f.preparedFacts);facts.grantIntents[0].grantId=id(999);return facts;},
 duplicateGrant:f=>{const facts=structuredClone(f.preparedFacts);facts.grantIntents.push(facts.grantIntents[0]);return facts;},
 digest:f=>{const facts=structuredClone(f.preparedFacts);facts.factsSha256='e'.repeat(64);return facts;},
 expiry:f=>{const facts=structuredClone(f.preparedFacts);facts.original.expiresAtMs++;return facts;},
 controlReuse:f=>{const facts=structuredClone(f.preparedFacts);facts.controlCapabilitySha256=f.options.issuance.capabilitySha256;return facts;}
}))test('bindFacts decorator refuses '+name+' even if caller recomputes the base hash',()=>{
 const f=fixture(),facts=mutate(f);if(name!=='digest'){const {factsSha256:ignored,...rest}=facts;facts.factsSha256=hash(rest);}
 rejects(()=>decorateObjectiveBindFactsInput({preparedFacts:facts,pair:f.compile()},f.options));
});

test('optional approved reads are preserved in the exact whole-facts commitment',()=>{
 const f=fixture(),approvedReads={schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:false,operations:[],maxExecuteMs:1000,maxRequestBytes:65536,maxResponseBytes:1048576};
 const raw={...f.rawConfiguration,approvedReads,operations:[...f.rawConfiguration.operations,...nativeReadOperations]};
 const preparedFacts=compilePreparedRunFacts(raw,{intent:f.intent,issuance:f.options.issuance,now:()=>f.options.nowMs});
 const decorated=decorateObjectiveBindFactsInput({preparedFacts,pair:f.compile()},f.options);
 assert.deepEqual(decorated.facts.approvedReads,approvedReads);assert.notEqual(decorated.facts.factsSha256,f.decorate().facts.factsSha256);
});

test('historical integrity accepts terminal expired original without renewing execution or accepting new expiry',()=>{
 const f=fixture(),decorated=f.decorate(),issued={issuance:{...f.options.issuance,factsSha256:decorated.facts.factsSha256},...decorated.facts};
 f.options.accepted.run.state='completed';f.options.nowMs=f.options.issuance.expiresAtMs+100000;
 const historical=assertIssuedObjectiveProtectedFacts(issued,{accepted:f.options.accepted});
 assert.equal(historical.original.expiresAtMs,f.options.issuance.expiresAtMs);rejects(f.compile);
 rejects(()=>assertIssuedObjectiveProtectedFacts(issued,{accepted:f.options.accepted,nowMs:f.options.nowMs}));
 const changed=structuredClone(issued);changed.issuance.expiresAtMs++;rejects(()=>assertIssuedObjectiveProtectedFacts(changed,{accepted:f.options.accepted}));
});

test('historical integrity rejects whole-facts substitution, unknown receipt state and secret-bearing source fields',()=>{
 for(const mutate of [v=>{v.objectiveStrategy.executionSelection.model='substituted';},v=>{v.issuance.state='ISSUED';},v=>{v.issuance.materialRef='synthetic-private-material';},
  v=>{v.original.proxyCredential='synthetic-secret';},v=>{v.issuance.factsSha256='f'.repeat(64);},v=>{v.objectiveStrategy.request.inputSha256='f'.repeat(64);}]){
  const f=fixture(),decorated=f.decorate(),issued=structuredClone({issuance:{...f.options.issuance,factsSha256:decorated.facts.factsSha256},...decorated.facts});mutate(issued);
  rejects(()=>assertIssuedObjectiveProtectedFacts(issued,{accepted:f.options.accepted}));
 }
});

test('hostile getters and proxies are refused without invoking caller code',()=>{
 const f=fixture();let called=0;
 const hostile=Object.defineProperty({...f.raw},'sourceAdmission',{get(){called++;throw Error('synthetic-secret');},enumerable:true});
 rejects(()=>compileObjectiveProtectedFacts(hostile,f.options));assert.equal(called,0);
 rejects(()=>compileObjectiveProtectedFacts(new Proxy(f.raw,{}),f.options));
 rejects(()=>decorateObjectiveBindFactsInput({preparedFacts:f.preparedFacts,pair:new Proxy(f.compile(),{})},f.options));
});
