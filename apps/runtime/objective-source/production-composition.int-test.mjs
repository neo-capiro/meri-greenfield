/** Explicit cross-repository SOURCE qualification. No database durability, native
 * deployment, production grant, delegation activation or live key is qualified.
 * Existing production factories run over named SYNTHETIC memory-CAS, capability,
 * native-HTTP, task/Core-proof and current/durable-decision fixtures. The normal
 * prepared-run caller is deliberately not spliced here: manual composition of
 * the existing S1 issuer/compiler/decorator/bindFacts is the reviewed boundary.
 * Run explicitly with CORE_OBJECTIVE_V2_MODULE_DIR holding reviewed compiled
 * Core factories. A missing fixture is a hard failure, never a positive skip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,generateKeyPairSync,randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {applicationAuthorityRoutes} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {readerPurposes} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {createPreparedRunIssuer} from '../prepared-run-issuer.mjs';
import {compilePreparedRunFacts,createPreparedRunIssuance} from '../prepared-run-issuance.mjs';
import {compileObjectiveProtectedFacts,decorateObjectiveBindFactsInput} from './protected-facts.mjs';
import {createObjectiveSourceNativeAuthority} from './native-authority.mjs';
import {createObjectiveSourcePreparedReader} from './prepared-reader.mjs';
import {createObjectiveSourceCustody} from './custody.mjs';
import {createObjectiveSourceReaderGate} from './reader-gate.mjs';
import {objectiveProtectedFactsFixture} from './test/protected-facts-fixture.mjs';

const moduleDirectory=process.env.CORE_OBJECTIVE_V2_MODULE_DIR;
assert.ok(moduleDirectory,'QUALIFICATION_REQUIRES_CORE_OBJECTIVE_V2_MODULE_DIR');
const manifest=JSON.parse(readFileSync(join(moduleDirectory,'manifest.json'),'utf8'));
assert.match(manifest.sourceHead,/^[a-f0-9]{40}$/u);assert.ok(Array.isArray(manifest.files)&&manifest.files.length>=8);
assert.equal(createHash('sha256').update(readFileSync(new URL('../../../packages/contracts/objective-reader-2/reader.schema.json',import.meta.url))).digest('hex'),manifest.schemaSha256,'CORE_MERI_FROZEN_SCHEMA_HASH');
for(const file of manifest.files){
 assert.match(file.sourceSha256,/^[a-f0-9]{64}$/u);assert.match(file.rewrittenSha256,/^[a-f0-9]{64}$/u);
 assert.equal(createHash('sha256').update(readFileSync(join(moduleDirectory,file.name+'.js'))).digest('hex'),file.emittedSha256,'CORE_QUALIFICATION_EMITTED_HASH_'+file.name);
}
const coreJwt=await import(pathToFileURL(join(moduleDirectory,'objective-reader-v2-jwt.js')).href);
const coreClient=await import(pathToFileURL(join(moduleDirectory,'objective-reader-v2-client.js')).href);
for(const name of ['createObjectiveReaderV2Signer','createObjectiveReaderV2Request','verifyObjectiveReaderV2Jwt'])assert.equal(typeof coreJwt[name],'function','CORE_QUALIFICATION_EXPORT_'+name);
assert.equal(typeof coreClient.createObjectiveReaderV2Client,'function','CORE_QUALIFICATION_EXPORT_createObjectiveReaderV2Client');

// The emitted manifest must select ACTUAL existing Core canonical owner parsers;
// no identity decoder or schema-only qualification substitute can pass this gate.
const descriptor=manifest.canonicalParsers;
assert.ok(descriptor&&typeof descriptor.module==='string'&&typeof descriptor.admission==='string'&&typeof descriptor.binding==='string');
const parserModule=await import(pathToFileURL(join(moduleDirectory,descriptor.module)).href);
assert.equal(typeof parserModule[descriptor.admission],'function');assert.equal(typeof parserModule[descriptor.binding],'function');
const canonicalParsers={admission:parserModule[descriptor.admission],binding:parserModule[descriptor.binding]};

const SYNTHETIC_NATIVE_CREDENTIAL='SYNTHETIC_OBJECTIVE_CURRENT_NATIVE_IDENTITY_ONLY';
const unavailable=/OBJECTIVE_(?:READER_V2|SOURCE)_UNAVAILABLE/;
const same=(a,b)=>hash(a)===hash(b);

async function composition(){
 const f=objectiveProtectedFactsFixture(),state={now:f.options.nowMs,accepted:structuredClone(f.options.accepted),revoked:false,mappingDrift:false,
  generate:0,compile:0,nativeReads:0,taskReads:0,coreReads:0,decisions:0,revalidations:0,transport:0,factCompiles:0,materialReads:0};
 const now=()=>state.now,issuanceStore=createMemoryIssuanceStore();
 // SYNTHETIC capability authority. The real S1 issuer owns durable claim/complete
 // semantics over its in-memory contract fixture; no product store is implied.
 const capabilityAuthority={async generate({binding}){state.generate++;assert.deepEqual(binding,f.intent.binding);return {grantId:f.options.issuance.grantId,capability:f.secret.task,materialRef:'SYNTHETIC_MATERIAL_REFERENCE_ONLY'};},
  async retrieve(){state.materialReads++;return {state:'PRESENT',capability:f.secret.task};},async status(){return {state:'UNKNOWN'};}};
 const issuer=createPreparedRunIssuer({store:issuanceStore,authority:capabilityAuthority,now,maxRequestMs:3000});
 const issuedState=await issuer.issue(f.intent);assert.equal(issuedState.state,'ISSUED');assert.equal(issuedState.issuance.factsSha256,undefined);
 const unbound=issuedState.issuance;
 // Recompile through the ACTUAL canonical compiler using the ACTUAL issued
 // receipt. No hand-authored already-bound digest enters this positive chain.
 const prepared=compilePreparedRunFacts(f.rawConfiguration,{intent:f.intent,issuance:unbound,now});state.compile++;
 const pair=compileObjectiveProtectedFacts(f.raw,{accepted:state.accepted,issuance:unbound,nowMs:now()});
 const decorated=decorateObjectiveBindFactsInput({preparedFacts:prepared,pair},{accepted:state.accepted,issuance:unbound,nowMs:now()});
 const bound=await issuer.bindFacts(decorated.bindFactsInput),issued={issuance:bound,...decorated.facts};
 assert.equal(bound.factsSha256,decorated.facts.factsSha256);assert.equal((await issuanceStore.read({issuanceKey:bound.issuanceKey})).factsSha256,bound.factsSha256);
 const runIssuance=createPreparedRunIssuance({issuer,facts:{async compile(){state.factCompiles++;throw Error('NORMAL_SHARED_PREPARED_RUN_SPLICE_HELD');}},now,maxRequestMs:3000});
 assert.deepEqual(await runIssuance.readIssuance(bound),bound);
 const source={generationJobId:pair.objectiveGeneration.sourceAdmission.generationJobId,sourceAdmissionSha256:pair.objectiveGeneration.sourceAdmissionSha256,binding:state.accepted.run.binding};
 const expected={generationJobId:source.generationJobId,sourceAdmissionSha256:source.sourceAdmissionSha256,sourceAdmission:pair.objectiveGeneration.sourceAdmission,queuedType:pair.objectiveStrategy.queuedType};
 const acceptedRuns={async read(binding,_options,check){check();assert.deepEqual(binding,source.binding);return structuredClone(state.accepted);}};
 const nativeIdentity={origin:'https://synthetic-objective-native.invalid',credential:SYNTHETIC_NATIVE_CREDENTIAL,
  commandContext:{binding:source.binding,clientResolution:{reference:expected.sourceAdmission.canonical.clientId,clientId:expected.sourceAdmission.canonical.clientId}},
  async fetchImpl(url,options){
   state.nativeReads++;if(state.revoked)throw Error('SYNTHETIC_NATIVE_REVOKED');assert.equal(options.headers.authorization,'Bearer '+SYNTHETIC_NATIVE_CREDENTIAL);
   const request=JSON.parse(options.body),principal={tenantId:source.binding.tenantId,actorId:source.binding.actorId};
   return Response.json(url.endsWith(applicationAuthorityRoutes.identity)?{principal,identityRevision:'synthetic-objective-identity-r1',checkedAtMs:now(),expiresAtMs:now()+3000}:
    {identitySha256:request.identitySha256,principal,identityRevision:'synthetic-objective-identity-r1',conversationId:source.binding.conversationId,
     selectedClientId:expected.sourceAdmission.canonical.clientId,contextRevision:'synthetic-objective-context-r1',checkedAtMs:now(),expiresAtMs:now()+3000});
  }};
 const freshAuthority=createObjectiveSourceNativeAuthority({source,acceptedRuns,identity:nativeIdentity,enabled:true,now,maxRequestMs:3000});
 const resource={taskArn:'arn:aws:ecs:us-east-1:967807252336:task/SyntheticObjective/'+'c'.repeat(32)};
 const allocation={state:'ADMITTED',original:issued.original,allocationSha256:issued.allocationSha256,taskRequestSha256:issued.taskRequestSha256,grantIntents:issued.grantIntents,resource};
 const preparedReader=createObjectiveSourcePreparedReader({issued,store:{...acceptedRuns,allocations:{async read(){return {record:structuredClone(allocation)};}}},issuance:runIssuance,
  taskProof:{async verifyTask(){state.taskReads++;if(state.taskRevoked)throw Error('SYNTHETIC_TASK_REVOKED');return {taskArn:resource.taskArn,imageSha256:issued.original.versions.imageDigest.slice(7),runnerSha256:'d'.repeat(64),checkedAtMs:now(),expiresAtMs:bound.expiresAtMs};}},
  coreCurrent:{async readCurrent(){state.coreReads++;return {binding:source.binding,sourceRequestSha256:bound.requestSha256,objectiveGeneration:pair.objectiveGeneration,objectiveStrategy:pair.objectiveStrategy,checkedAtMs:now(),expiresAtMs:now()+2000};}},enabled:true,now,maxRequestMs:3000});
 const mappings=new Map();
 // SYNTHETIC global immutable job-CAS. It checks collisions and never represents
 // PostgreSQL, crash/restart durability or a deployed custody adapter.
 const custodyStore={async read({generationJobId}){
  const saved=mappings.get(generationJobId);if(!saved)return {state:'ABSENT'};const record=structuredClone(saved);
  if(state.mappingDrift)record.binding.workerId=randomUUID();return {state:'COMMITTED',record};
 },async putOnce({generationJobId,record}){
  const existing=mappings.get(generationJobId);if(existing&&!same(existing,record))throw Error('SYNTHETIC_IMMUTABLE_MAPPING_CONFLICT');
  mappings.set(generationJobId,structuredClone(record));return {state:'COMMITTED',record:structuredClone(record)};
 }};
 const custody=createObjectiveSourceCustody({store:custodyStore,acceptedRuns,issuanceStore,preparedReader,freshAuthority,enabled:true,now,maxRequestMs:3000});
 const published=await custody.publish({issued});assert.equal(published.generationJobId,source.generationJobId);assert.equal(mappings.size,1);
 const signers={},gateTrust={},clientTrust={};
 for(const purpose of Object.keys(readerPurposes)){
  // Ephemeral SYNTHETIC Ed25519 key pairs, unique per purpose. Never exported as
  // private material or reused for historical RS256 / first-chat Temporal keys.
  const {privateKey,publicKey}=generateKeyPairSync('ed25519'),issuerName='synthetic-objective-'+purpose+'-issuer-v2',kid='synthetic-'+purpose+'-key-v2';
  signers[purpose]={purpose,issuer:issuerName,kid,privateKey};gateTrust[purpose]={issuer:issuerName,publicKeys:{[kid]:publicKey.export({format:'jwk'})}};
  clientTrust[purpose]={purpose,issuer:issuerName,kid,publicKey};
 }
 const signer=coreJwt.createObjectiveReaderV2Signer(signers),effects=new Map();
 // SYNTHETIC runOnce contract fixture: a claimed effect stays UNKNOWN on error;
 // exact committed replay only. This is not a production durable replay store.
 const idempotency={async runOnce({identity,source:observed},effect){
  const key=identity.issuer+':'+identity.subject+':'+identity.tokenId,stamp=hash({identity,source:observed}),old=effects.get(key);
  if(old){if(old.stamp!==stamp||old.state!=='COMMITTED')throw Error('SYNTHETIC_REPLAY_UNCERTAIN_OR_CONFLICT');return {status:'replayed',value:structuredClone(old.value)};}
  effects.set(key,{stamp,state:'UNKNOWN'});const value=await effect();effects.set(key,{stamp,state:'COMMITTED',value:structuredClone(value)});return {status:'executed',value};
 }};
 const gate=createObjectiveSourceReaderGate({enabled:true,trust:gateTrust,custody,idempotency,now});
 const decisions=new Map();
 // SYNTHETIC current/durable decision owner, explicitly distinct from the Core
 // disabled-delegation production constraint. Actual JWT signer/verifier run;
 // this fixture does not claim native Core DB authorization or activation.
 const credentialOwner={async issue(request,{signal}){
  if(state.revoked)throw Error('SYNTHETIC_CORE_DECISION_REVOKED');
  assert.equal(request.generationJobId,source.generationJobId);assert.equal(request.sourceAdmissionSha256,source.sourceAdmissionSha256);
  await freshAuthority.assertCurrent({purpose:request.purpose==='retained-result'?'historical-source':request.purpose,source,signal});
  const nowSeconds=Math.floor(now()/1000),decision={jti:randomUUID(),nowSeconds,expiresAtSeconds:nowSeconds+30};
  const token=signer.issue(request,decision),credential={token,expiresAtMs:decision.expiresAtSeconds*1000};
  decisions.set(token,{requestSha256:hash({purpose:request.purpose,path:request.path,body:Array.from(request.body)}),credential});state.decisions++;
  return credential;
 },async revalidate({request,credential,expected:readExpected,observation},{signal}){
  state.revalidations++;if(state.revoked)return false;
  const saved=decisions.get(credential.token);if(!saved||!same(saved.credential,credential)||!same(readExpected,expected)||
   saved.requestSha256!==hash({purpose:request.purpose,path:request.path,body:Array.from(request.body)}))return false;
  coreJwt.verifyObjectiveReaderV2Jwt(credential.token,request,{...clientTrust[request.purpose],nowSeconds:Math.floor(now()/1000)});
  await freshAuthority.assertCurrent({purpose:request.purpose==='retained-result'?'historical-source':request.purpose,source,signal});
  if(observation&&observation.generationJobId!==source.generationJobId)return false;return true;
 }};
 const client=coreClient.createObjectiveReaderV2Client({enabled:true,origin:'https://synthetic-meri-objective.invalid',credentialOwner,parsers:canonicalParsers,trust:clientTrust,now,
  async transport(url,options){
   state.transport++;const result=await gate.read({method:options.method,target:new URL(url).pathname,authorization:options.headers.authorization,rawBody:Buffer.from(options.body),signal:options.signal});
   await state.afterGate?.();return Response.json(result);
  }});
 return {f,state,issuer,issuanceStore,issued,preparedReader,freshAuthority,custody,gate,client,source,expected,mappings,effects,published,decorated,now};
}

test('actual production factories compose from real ISSUED/bound receipt through signed active source read',async()=>{
 const f=await composition(),result=await f.client.readActiveSource(f.expected);
 assert.equal(result.schemaVersion,2);assert.equal(result.purpose,'active-source');assert.deepEqual(result.binding,f.source.binding);assert.equal(result.runState,'queued');
 assert.equal(result.issuance.factsSha256,f.issued.factsSha256);assert.equal(result.expiresAtMs,f.state.now+2000);assert.equal(f.state.generate,1);assert.equal(f.state.compile,1);
 assert.equal(f.state.factCompiles,0);assert.equal(f.state.materialReads,0);assert.ok(f.state.nativeReads>0);assert.ok(f.state.taskReads>0);assert.ok(f.state.coreReads>0);
 assert.equal(f.state.decisions,1);assert.equal(f.state.revalidations,2);assert.equal(f.effects.size,1);assert.equal(f.mappings.size,1);
 for(const value of [...Object.values(f.f.secret),SYNTHETIC_NATIVE_CREDENTIAL,'SYNTHETIC_MATERIAL_REFERENCE_ONLY'])assert.ok(!JSON.stringify(result).includes(value));
 assert.deepEqual(await f.issuer.bindFacts(f.decorated.bindFactsInput),f.issued.issuance);
 await assert.rejects(f.issuer.bindFacts({...f.decorated.bindFactsInput,factsSha256:'f'.repeat(64)}),/FACTS_CONFLICT/);
});

test('active state transition keeps immutable custody, then expired original permits fresh historical read only',async()=>{
 const f=await composition();await f.client.readActiveSource(f.expected);const originalMapping=hash(f.mappings.get(f.source.generationJobId));
 f.state.accepted.run.state='running';const running=await f.client.readActiveSource(f.expected);assert.equal(running.runState,'running');assert.equal(hash(f.mappings.get(f.source.generationJobId)),originalMapping);
 f.state.accepted.run.state='completed';f.state.now=f.issued.issuance.expiresAtMs+100000;
 const taskReads=f.state.taskReads,coreReads=f.state.coreReads,historical=await f.client.readHistoricalSource(f.expected);
 assert.equal(historical.purpose,'historical-source');assert.equal(historical.runState,'completed');assert.equal(historical.issuance.expiresAtMs,f.issued.issuance.expiresAtMs);
 assert.ok(historical.checkedAtMs>historical.issuance.expiresAtMs);assert.equal(historical.expiresAtMs,f.state.now+3000);assert.equal(f.state.taskReads,taskReads);assert.equal(f.state.coreReads,coreReads);
 assert.equal(hash(f.mappings.get(f.source.generationJobId)),originalMapping);await assert.rejects(f.client.readActiveSource(f.expected),unavailable);
});

test('native revocation and immutable mapping drift deny signed source reads',async()=>{
 for(const failure of ['revoked','mappingDrift']){
  const f=await composition();await f.client.readActiveSource(f.expected);f.state[failure]=true;await assert.rejects(f.client.readActiveSource(f.expected),unavailable);
 }
});

test('revocation after Meri reply is rejected by actual Core client final credential revalidation',async()=>{
 const f=await composition();f.state.afterGate=()=>{f.state.revoked=true;};await assert.rejects(f.client.readActiveSource(f.expected),unavailable);assert.equal(f.state.transport,1);assert.equal(f.state.revalidations,2);
});

test('current admitted task refusal cannot fall back to stored source facts',async()=>{
 const f=await composition();f.state.taskRevoked=true;await assert.rejects(f.client.readActiveSource(f.expected),unavailable);assert.equal(f.effects.size,0);assert.equal(f.state.coreReads,0);
});

test('actual default-off factories remain closed before credential, key, clock or source I/O',async()=>{
 let effects=0;const poison={get read(){effects++;throw Error('SYNTHETIC_MUST_STAY_CLOSED');}},clock=()=>{effects++;return Date.now();};
 const native=createObjectiveSourceNativeAuthority({acceptedRuns:poison,now:clock}),prepared=createObjectiveSourcePreparedReader({store:poison,now:clock}),
  custody=createObjectiveSourceCustody({store:poison,now:clock}),gate=createObjectiveSourceReaderGate(),client=coreClient.createObjectiveReaderV2Client({now:clock});
 assert.equal(native.available(),false);assert.equal(prepared.available(),false);assert.equal(custody.available(),false);assert.equal(gate.available(),false);
 await assert.rejects(native.assertCurrent({}),unavailable);await assert.rejects(prepared.read({}),unavailable);await assert.rejects(custody.read({}),unavailable);await assert.rejects(gate.read({}),unavailable);
 await assert.rejects(client.readActiveSource({}),unavailable);assert.equal(effects,0);
});
