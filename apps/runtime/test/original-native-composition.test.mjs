/** Joint SYNTHETIC: real config/schema/compiler, original helper, canonical issuer + journal and registry; fixed synthetic material/models/allocation. */
import test from 'node:test';import assert from 'node:assert/strict';import {normalize} from 'node:path';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {applicationFixture,id} from '../../control/conversations/test/application-fixture.mjs';
import {createPreparedRunBindings} from '../prepared-run-bindings.mjs';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {createPreparedRunRegistry} from '../prepared-run-registry.mjs';
import {compilePreparedCandidateConfiguration} from '../prepared-candidate-config.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion,nativeReadOperations} from '../../../packages/contracts/runtime-0.2/reads.mjs';
async function fixture(){
 const f=candidateFixture(),c=f.configuration.nativeCandidate;
 for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])c.preparationIntent[k]=normalize(c.preparationIntent[k]);c.preparationIntent.launchTemplate.command=normalize(c.preparationIntent.launchTemplate.command);c.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=c.preparationIntent.secureStorageDirectory;
 c.multiRun={runWindowMs:60000};c.approvedReads={schemaVersion,enabled:true,operations:JSON.parse(c.allocationJson).manifest.allowedOperations,maxExecuteMs:10000,maxRequestBytes:65536,maxResponseBytes:1048576};
 const app=await applicationFixture({scopes:f.scopes});await app.service.submit({credential:app.credential,input:app.input});const saved=structuredClone(await app.store.read(f.binding,{},()=>{}));saved.run.versions=c.runtime.versions;
 const stats={generate:0,model:0,allocate:0,read:0,closed:0},state={saved,record:null},issuanceStore=createMemoryIssuanceStore(),capability='synthetic-canonical-task-material',modelCredential='synthetic-canonical-model-material-32-plus',now=()=>f.now;
 const store={async readOptional(){return structuredClone(state.saved);},async read(){stats.read++;return structuredClone(state.saved);},allocations:{async read(){return {record:state.record};}},nextRuns:{async readTarget(){return null;},async current(){return {binding:f.binding,reserved:false,policyRevision:c.qualification.policyRevision,scopes:f.scopes};}},async append(){assert.fail('No status mutation expected');}};
 const capabilityAuthority={async generate({issuanceKey}){stats.generate++;assert.equal(issuanceStore.snapshot().get(issuanceKey).state,'CLAIMED');return {grantId:id(900),capability,materialRef:'synthetic-task-reference'};},async retrieve(){return {state:'PRESENT',capability};},async status(){return {state:'UNKNOWN'};}};
 const modelGrants={async issue({intent}){stats.model++;return {...intent,grantId:id(901),capabilitySha256:capabilityDigest(modelCredential),proxyCredential:modelCredential};}},pool={connect(){assert.fail('No DB');}};
 const ports=createPreparedRunBindings({configuration:f.configuration,pool,store,credentials:{control:f.secret.control},issuanceStore,capabilityAuthority,modelGrants,now});
 let allocated;const options={issuance:ports.runIssuance,issuanceIntent:ports.issuanceIntent,prepareOriginal:ports.prepareOriginal,approvedReads:c.approvedReads,sourceEnabled:false,store,pool,client:{send(){assert.fail('No AWS');}},identity:{origin:c.identity.origin,credential:f.secret.identity,commandContext:c.identity.commandContext,fetchImpl(){assert.fail('No identity network');}},controlCapability:f.secret.control,objects:{},limits:{maxRequestMs:1000,maxFactBytes:131072,cleanupMs:1000},now,
 async allocate(configuration){stats.allocate++;allocated=configuration;const entry=await ports.prepareOriginal(),resource={taskArn:'arn:aws:ecs:us-east-1:967807252336:task/synthetic/'+'a'.repeat(32)};state.record={state:'ADMITTED',original:entry.original,allocationSha256:entry.allocationSha256,taskRequestSha256:entry.taskRequestSha256,grantIntents:entry.grantIntents,resource:{...resource,launchBinding:{state:'STARTED'}}};return {resource,productPorts:{sdkSessionOwner:{async load(v){return v;}},sdkSessionSnapshot:{}},readsOwner:{async handle(...args){return state.readHandler?state.readHandler(...args):{syntheticRouted:true};}},application:{async handle(){return null;}},supervisor:{application:{async handle(){return null;}},taskVerifier:{async verify(){}}},prepared:{preparationAuthorizer:{async admitted(){return {original:entry.original,...resource};}},stack:{broker:{async poll(){return {binding:f.binding,executionId:entry.original.executionId,state:'executing'};}}}},async reconcile(){return {original:entry.original,...resource};},async close(){stats.closed++;}};}};
 return {...f,config:c,stats,state,ports,options,issuanceStore,capability,close:()=>app.close(),get allocated(){return allocated;}};
}
const post=(path,input,credential)=>new Request('https://control.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(input)});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('joint original startup uses actual accepted request, fixed expiry, canonical task/model facts and same registry session owner',async()=>{
 const f=await fixture(),registry=createPreparedRunRegistry(f.options);try{
  assert.ok(nativeReadOperations.every(op=>compilePreparedCandidateConfiguration(f.config,f.configuration.versions).operations.includes(op)));
  const start=await registry.handle(post('/v1/execution/kickoff',{binding:f.binding,executionKey:hash(f.binding)},f.secret.control));assert.equal(start.status,200);
  const entry=registry.get(f.binding);for(let i=0;i<50;i++){await settle();try{if((await entry.kickoff.status({binding:f.binding,executionId:hash(f.binding)})).state==='executing')break;}catch{}}
  assert.equal(f.stats.allocate,1);assert.equal(f.stats.generate,1);assert.equal(f.allocated.taskCapability,f.capability);assert.notEqual(f.allocated.taskCapability,f.secret.task);assert.deepEqual(f.allocated.approvedReads,f.config.approvedReads);assert.equal(f.allocated.runRequestSha256,hash(f.state.saved.request));assert.equal(f.allocated.runtime.deadlineMs,f.config.runtime.deadlineMs);
  const current=await f.allocated.readCurrentEntry({binding:f.binding,deadlineMs:f.config.runtime.deadlineMs});assert.equal(current.issuanceFactsSha256,f.allocated.issuanceFactsSha256);assert.equal(current.taskArn,f.state.record.resource.taskArn);
  const boot=await entry.bootstrap({binding:f.binding,versions:f.config.runtime.versions,credential:f.capability});assert.deepEqual(boot.approvedReads,f.config.approvedReads);
  const request={binding:f.binding};assert.deepEqual(await entry.session('sdkSessionOwner','load',{request}),{request});assert.equal(f.issuanceStore.size(),1);
  const gate=Promise.withResolvers();let readSignal;f.state.readHandler=(_op,_input,_cap,signal)=>{readSignal=signal;return gate.promise;};const pending=entry.read('availability',{schemaVersion,binding:f.binding},f.capability),denied=assert.rejects(pending);assert.equal(readSignal.aborted,false);await registry.close();assert.equal(readSignal.aborted,true);gate.resolve({syntheticLateResult:true});await denied;
 }finally{await registry.close();await f.close();}assert.equal(f.stats.closed,1);
});
test('READS lookup never prepares or allocates; global control and missing/foreign entries cannot borrow authority',async()=>{
 const f=await fixture(),registry=createPreparedRunRegistry(f.options),body={schemaVersion,binding:f.binding};try{
  assert.equal((await registry.handle(post('/v1/runner/reads/availability',body,f.capability))).status,503);assert.equal(f.stats.generate,0);assert.equal(f.stats.allocate,0);assert.equal(f.stats.read,0);
  assert.equal((await registry.handle(post('/v1/runner/reads/availability',body,f.secret.control))).status,403);assert.equal(f.stats.generate,0);
  const entry=await registry.ensure({binding:f.binding});const generated=f.stats.generate;assert.equal((await registry.handle(post('/v1/runner/reads/availability',body,f.capability))).status,403);assert.equal(f.stats.generate,generated);assert.equal(f.stats.allocate,0);
  await assert.rejects(entry.read('availability',body,f.secret.task));assert.equal(f.stats.allocate,0);
 }finally{await registry.close();await f.close();}
});
test('static original or changed accepted input cannot receive new canonical authority, stop-only never issues',async()=>{
 const f=await fixture();try{f.state.record={state:'ALLOCATED',original:{binding:f.binding,expiresAtMs:f.config.runtime.deadlineMs,executionKey:hash(f.binding)},grantIntents:f.config.grantIntents};await assert.rejects(f.ports.prepareOriginal(),/STATIC_ORIGINAL_UNAVAILABLE/);assert.equal(f.stats.generate,0);await assert.rejects(f.ports.prepareOriginal({stopOnly:true}),/STOP_ONLY_UNAVAILABLE/);assert.equal(f.stats.generate,0);
  f.state.record=null;const entry=await f.ports.prepareOriginal();f.state.saved.request.prompt='changed';await assert.rejects(f.ports.prepareOriginal());assert.equal(f.stats.generate,1);assert.equal(entry.original.expiresAtMs,f.config.runtime.deadlineMs);
 }finally{await f.close();}
});
