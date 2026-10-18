/** Actual prepared/native installation composition with synthetic current qualification and mode HTTP only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {MODE_READ_OPERATIONS,decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {GENERAL_READ_ADAPTER_FAMILIES} from '../../../../gateway/general-reads/integration.mjs';
import {familyOperations} from '../../../../gateway/general-reads/registration.mjs';
import {storedCase as publicCase} from '../../../../gateway/sources/public-data/test/fixture.mjs';
import {storedCase as programCase} from '../../../../gateway/sources/program-elements/test/fixture.mjs';
import {installationReadOperations} from '../runtime.mjs';
import {createNativeReadsClient} from '../../reads-client.mjs';
import {installationFixture} from './fixture.mjs';

async function make(id,mode='off'){
 const family=resolveOperationContract({id,version:'0.2.0'}).binding.group,scene=(family==='public-data'?publicCase:programCase)(id,{evidenceAccuracyMode:mode});
 const f=await installationFixture({scene});f.core.state.mode=mode;return f;
}
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);}
const execute=(f,suffix='source')=>f.client.execute({operation:f.operation,arguments:f.request,deliveryId:`installation:mode:${f.operation.id}:${suffix}`});
function freshClient(f){const mounted=f.prepared();return createNativeReadsClient({origin:'https://native.synthetic.invalid',credential:f.tuple.taskCapability,binding:f.binding,approvedReads:f.tuple.approvedReads,fetchImpl:(url,init)=>mounted.application.handle(new Request(url,init)),now:f.now});}

test('mode installation source checkpoint derives76eligible/42families and77canonical handlers with the legal sibling still held',()=>{
 const rows=installationReadOperations(),ids=[...new Set(rows.map(row=>row.family))],eligible=rows.map(row=>`${row.operation.id}@${row.operation.version}`),kernel=ids.flatMap(id=>familyOperations(id).map(op=>`${op.id}@${op.version}`));
 assert.equal(rows.length,76);assert.equal(ids.length,42);assert.equal(kernel.length,77);assert.equal(GENERAL_READ_ADAPTER_FAMILIES.length,44);assert.deepEqual(kernel.filter(key=>!eligible.includes(key)),['get_legal_reference@0.2.0']);
});

for(const id of MODE_READ_OPERATIONS){
 for(const mode of ['off','shadow','enforce'])test(`mode installation ${id}/${mode}: prepared task forwards actual owner ports and settles exact private-mode source`,async()=>{
  const f=await make(id,mode);try{
   const available=await f.client.readAvailability();assert.deepEqual(available.installation.operations,[f.operation]);assert.deepEqual(available.discovery.operations,[f.operation]);noSource(f);
   const handlers=f.preparation.createTaskHandlers(f.tuple);assert.deepEqual([...handlers.keys()],familyOperations(f.family).map(op=>`${op.id}@${op.version}`));
   const raw=await execute(f,mode),out=JSON.parse(raw),context={evidenceAccuracyMode:mode};assert.deepEqual(out.operation,f.operation);assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));
   assert.equal(f.wire.length,1);assert.deepEqual(f.wire[0].body,f.request);assert.deepEqual(decodeNativeReadObservation(f.wire[0].options.headers[HEADER],{operation:f.operation,request:f.request}).context,context);
   assert.deepEqual(f.stateOwner.secretProof.normalizationContext,context);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.equal(f.stateOwner.modeSecretProof.requestSha256,hash(f.request));assert.deepEqual(f.stateOwner.modeSecretProof.operation,f.operation);assert.ok(f.stateOwner.modeSecrets>=3);
   assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,context).argumentsSha256);const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(reservation.charged_micro_usd,1);assert.equal([...f.state.produced.values()][0].completion.resultSha256,hash(out));
  }finally{f.scope.abort();}
 });
 for(const missing of ['mode-secret','mode-reader'])test(`mode installation ${id}: missing ${missing} never reaches a credential or native source`,async()=>{
  const f=await make(id);f.stateComposition.portsMutator=ports=>{if(missing==='mode-secret')delete ports.nativeCredentials.getReadModeServiceSecret;else{const {readModeObservation,...coreAuthority}=ports.nativeCredentials.coreAuthority;ports.nativeCredentials.coreAuthority=coreAuthority;}};
  // Prepared task ports are captured once. Mount a fresh actual client after changing this fixture's port supplier.
  try{await assert.rejects(execute({...f,client:freshClient(f)},missing),{message:'UNAVAILABLE'});assert.ok(f.stateComposition.taskPortsCalls>=2);noSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.stateOwner.modeSecrets,0);assert.equal(f.core.state.calls.length,0);}finally{f.scope.abort();}
 });
 test(`mode installation ${id}: wrong current qualification bytes deny before native observation and source IO`,async()=>{
  const f=await make(id);f.state.installationMutator=row=>row.operations[0].handlerSourceSha256='e'.repeat(64);
  try{await assert.rejects(execute(f,'wrong-qualification'),{message:'UNAVAILABLE'});assert.ok(f.stateComposition.qualifierCalls.length>0);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.stateOwner.modeSecrets,0);noSource(f);}finally{f.scope.abort();}
 });
 test(`mode installation ${id}: current task revocation denies before mode secret or tool HTTP`,async()=>{
  const f=await make(id);f.state.grant.state='REVOKED';try{await assert.rejects(execute(f,'revoked'));assert.equal(f.stateOwner.modeSecrets,0);assert.equal(f.core.state.calls.length,0);noSource(f);}finally{f.scope.abort();}
 });
 test(`mode installation ${id}: a substituted native mode operation cannot authorize a tool request`,async()=>{
  const f=await make(id);f.core.state.mutate=(value,path)=>{if(path.endsWith('/read-mode-observation'))value.operation={id:MODE_READ_OPERATIONS.find(candidate=>candidate!==id),version:'0.2.0'};};
  try{await assert.rejects(execute(f,'operation-substitution'),{message:'ACCESS_DENIED'});assert.ok(f.stateOwner.modeSecrets>0);noSource(f);}finally{f.scope.abort();}
 });
 test(`mode installation ${id}: post-source native mode drift withholds completion and preserves UNKNOWN`,async()=>{
  const f=await make(id);f.state.afterSource=()=>{f.core.state.mode='enforce';};
  try{await assert.rejects(execute(f,'mode-drift'),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);unknown(f);}finally{f.scope.abort();}
 });
}

test('mode installation: supplied normalization owner cannot replace the canonical private native context',async()=>{
 const f=await make(MODE_READ_OPERATIONS[0]);let substituted=0;f.stateComposition.portsMutator=ports=>{ports.contextPorts.nativeReadContextPorts={readCurrent(){substituted++;return 'PRIVATE';}};};
 try{assert.throws(()=>f.preparation.createReadsRuntime(f.tuple));assert.equal(substituted,0);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.stateOwner.modeSecrets,0);noSource(f);}finally{f.scope.abort();}
});
