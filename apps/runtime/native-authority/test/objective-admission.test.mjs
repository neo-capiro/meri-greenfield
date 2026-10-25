/** Objective-origin admission over the canonical original-binding journal and the actual conversation store, on the
 * scripted conversation SQL fixtures (no database engine). Core authority is a SYNTHETIC port: no Core claim is proven. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {initialInputFixture} from '../../../control/conversations/test/initial-input-fixture.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createObjectiveNativeAdmission} from '../objective-admission.mjs';
import {runStartFixture,syntheticObjectivePool,id,NOW} from '../../objective-source/test/run-start-fixture.mjs';
import {createPostgresObjectiveRunStartStore} from '../../objective-source/postgres-run-starts.mjs';
import {composeObjectiveRuns} from '../objective-runs-composition.mjs';
import {capabilityDigest} from '../task-verifier.mjs';
import {createMemoryRetentionJournal} from '../../../control/retention/memory-journal.mjs';
import {createRetentionReadGate} from '../../../control/retention/suppression.mjs';
import {createServingGate} from '../../../control/retention/reconciliation.mjs';
import {subjectKey} from '../../../control/retention/boundary.mjs';

function fixture(){
 const conversations=initialInputFixture(),bindings=new Map(),copy=v=>structuredClone(v),key=p=>p.slice(0,2).join(':');
 conversations.advance(NOW-conversations.now());
 const pool={async connect(){const client=await conversations.pool.connect();let backup;return {async query(sql,p=[]){
  const rows=v=>({rows:copy(v),rowCount:v.length});
  if(sql==='BEGIN'||sql==='BEGIN ISOLATION LEVEL READ COMMITTED'){backup=copy(bindings);return client.query('BEGIN');}
  if(sql==='ROLLBACK'){bindings.clear();for(const [k,v] of backup)bindings.set(k,v);return client.query(sql,p);}
  if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings'))return rows(bindings.has(key(p))?[bindings.get(key(p))]:[]);
  if(sql.startsWith('INSERT INTO meri_conversations.initial_run_bindings')){if(bindings.has(key(p)))return rows([]);
   const row={tenant_id:p[0],conversation_id:p[1],run_id:p[2],record:copy(p[3]),record_sha256:p[4],generation:p[5]??1};bindings.set(key(p),row);return rows([row]);}
  if(sql.startsWith('SELECT projection,projection_sha256 FROM meri_conversations.runs'))return rows([...conversations.state.runs.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]).slice(0,1));
  if(sql.startsWith('SELECT reservation,reservation_sha256 FROM meri_conversations.next_runs'))return rows([]);
  if(sql.startsWith('SELECT 1 FROM meri_conversations.next_runs'))return rows([]);
  return client.query(sql,p);
 },release(reason){client.release(reason);}};}};
 const now=conversations.now,store=createPostgresConversationStore({pool,now}),f=runStartFixture();
 const template={versions,policyRevision:'policy1',configurationSha256:'c'.repeat(64),runWindowMs:60000};
 const policy={calls:[],expiresAtMs:f.record.effectExpiresAtMs,refuse:null};
 const scopes=[{tenantId:f.tenantId,kind:'client',resourceId:f.clientId,policyRevision:'policy1'}];
 const authority={async currentRecord(q){policy.calls.push(q);if(policy.refuse)throw Error('SYNTHETIC_CORE_DENIED');
  return {generationJobId:f.generationJobId,tenantId:f.tenantId,actorId:f.actorId,clientId:f.clientId,consentId:f.selection.sourceAdmission.consentId,controlVersion:f.selection.sourceAdmission.controlVersion,effectExpiresAtMs:policy.expiresAtMs};}};
 const options={pool,store,authority,template,now};
 return {conversations,bindings,store,f,template,policy,authority,options,scopes,now,admission:createObjectiveNativeAdmission(options)};
}
const counts=x=>({bindings:x.bindings.size,inputs:x.conversations.allocations.size,runs:x.conversations.state.runs.size});

test('enabled private Objective route composes real registration, prompt store and admission before Temporal dispatch',async t=>{
 t.mock.timers.enable({apis:['Date'],now:NOW});const x=fixture(),pg=syntheticObjectivePool(),journal=createMemoryRetentionJournal();
 const retention=createRetentionReadGate({journal,serving:createServingGate()}),runStarts=createPostgresObjectiveRunStartStore({enabled:true,pool:pg.pool,now:x.now});
 pg.state.queryHook=({text})=>{if(text.startsWith('INSERT INTO meri_objective_source.run_starts')){assert.equal(x.conversations.state.conversations.size,1);assert.deepEqual(counts(x),{bindings:0,inputs:0,runs:0});}};
 let accepted=false,dispatches=0;
 const core={...x.authority,async accept(){const saved=await x.store.readOptional(x.f.binding,{after:0,limit:1},()=>{});assert.equal(saved.run.state,'queued');accepted=true;},async readAcceptance(){assert.equal(accepted,true);},
  clientFor:()=>({async readAdmission(){return {sourceAdmission:x.f.selection.sourceAdmission};},async readRequest(){return {...x.f.selection,requestSha256:hash(x.f.selection.request)};}})};
 const client={connection:{withDeadline(_deadline,operation){return operation();},withAbortSignal(_signal,operation){return operation();}},workflow:{async start(){assert.equal(accepted,true);dispatches++;},getHandle(){assert.fail('this test does not cancel');}}};
 const capability='synthetic-objective-control-capability',options={configuration:{objectiveGeneration:{runs:{enabled:true}},limits:{requestMs:3000},temporal:{taskQueue:'synthetic-objective-queue'}},controlCapabilitySha256:capabilityDigest(capability),pool:x.options.pool,store:x.store,client,runStarts,core,template:x.template,retention,now:x.now};
 assert.throws(()=>composeObjectiveRuns({...options,retention:undefined}));
 const composed=composeObjectiveRuns(options),input={generationJobId:x.f.generationJobId,binding:x.f.binding,notAfterMs:NOW+30000};
 const call=async(operation,body)=>{const response=await composed.application.handle(new Request('https://control.synthetic.invalid/v1/objective-generation/activities/'+operation,{method:'POST',headers:{authorization:'Bearer '+capability,'content-type':'application/json'},body:JSON.stringify(body)}));assert.equal(response.status,200);return response.json();};
 assert.deepEqual(await call('start-run',{...input,mode:'effect',requestSha256:hash(x.f.selection.request)}),{kind:'started'});
 assert.equal(dispatches,1);assert.equal(pg.state.runStarts.size,1);assert.deepEqual(counts(x),{bindings:1,inputs:1,runs:1});
 assert.deepEqual(await call('read-run',input),{kind:'state',state:'queued'});
 await journal.set(subjectKey({tenantId:x.f.tenantId,kind:'conversation',subjectId:x.f.binding.conversationId}),{state:'SUPPRESSED'});
 const before=dispatches;assert.deepEqual(await call('read-run',input),{kind:'unconfirmed'});assert.equal(dispatches,before);
});

test('current-authorized preparation registers only zero-run custody and replays its immutable identity',async()=>{
 const x=fixture();assert.deepEqual(await x.admission.prepare({record:x.f.record}),{binding:x.f.binding});
 assert.deepEqual(counts(x),{bindings:0,inputs:0,runs:0});assert.equal(x.conversations.state.conversations.size,1);
 const original=structuredClone([...x.conversations.state.conversations.values()][0]);
 assert.equal(original.owner_actor_id,x.f.actorId);assert.deepEqual(original.projection.scopes,x.scopes);
 assert.equal(JSON.stringify(original).includes(x.f.acceptedRequest.prompt),false);
 x.conversations.advance(100);await x.admission.prepare({record:x.f.record});
 assert.deepEqual([...x.conversations.state.conversations.values()][0],original);
 const admitted=await x.admission.admit({record:x.f.record});assert.equal(admitted.replayed,false);assert.deepEqual(counts(x),{bindings:1,inputs:1,runs:1});
 assert.equal(x.conversations.state.conversations.size,1);
});

test('refused current Objective authority writes neither conversation custody nor original admission',async()=>{
 const x=fixture();x.policy.refuse=true;await assert.rejects(x.admission.prepare({record:x.f.record}));
 assert.equal(x.conversations.state.conversations.size,0);assert.deepEqual(counts(x),{bindings:0,inputs:0,runs:0});
});

test('admits exactly the derived original run with Core request ID and prompt, bounded by the run window and Core effect',async()=>{
 const x=fixture(),first=await x.admission.admit({record:x.f.record});
 assert.deepEqual(first,{binding:x.f.binding,requestSha256:x.f.record.sourceRequestSha256,expiresAtMs:NOW+60000,replayed:false});
 assert.deepEqual(counts(x),{bindings:1,inputs:1,runs:1});
 const saved=await x.store.readOptional(x.f.binding,{after:0,limit:1},()=>{});
 assert.deepEqual(saved.request,x.f.acceptedRequest);assert.equal(saved.run.state,'queued');assert.deepEqual(saved.run.scopes,x.scopes);
 assert.equal(hash(saved.request),x.f.record.sourceRequestSha256,'the run start record names this exact accepted request');
 assert.equal(x.policy.calls.length,1);assert.deepEqual(x.policy.calls[0].record,x.f.record);
 const replay=await createObjectiveNativeAdmission(x.options).admit({record:x.f.record});
 assert.deepEqual(replay,{...first,replayed:true});assert.deepEqual(counts(x),{bindings:1,inputs:1,runs:1});
});

test('Core current job/actor/client/consent mismatch refuses before canonical admission',async()=>{
 for(const field of ['clientId','actorId','tenantId','generationJobId','consentId','controlVersion','effectExpiresAtMs']){
  const x=fixture(),original=x.authority.currentRecord;x.authority.currentRecord=async q=>({...await original(q),[field]:field==='controlVersion'?99:field==='effectExpiresAtMs'?NOW:id(77)});
  await assert.rejects(createObjectiveNativeAdmission(x.options).admit({record:x.f.record}),/OBJECTIVE_ADMISSION_AUTHORITY/u);assert.deepEqual(counts(x),{bindings:0,inputs:0,runs:0});
 }
 const denied=fixture();denied.policy.refuse=true;await assert.rejects(denied.admission.admit({record:denied.f.record}));assert.deepEqual(counts(denied),{bindings:0,inputs:0,runs:0});
 const expired=fixture();expired.conversations.advance(expired.f.record.effectExpiresAtMs-NOW);await assert.rejects(expired.admission.admit({record:expired.f.record}),/OBJECTIVE_ADMISSION_EXPIRED/u);assert.equal(expired.policy.calls.length,0);
});

test('a tampered or foreign record and an incomplete composition are refused before any SQL',async()=>{
 const x=fixture(),tampered={...structuredClone(x.f.record),sourceRequestSha256:'0'.repeat(64)};
 await assert.rejects(x.admission.admit({record:tampered}),/OBJECTIVE_ADMISSION_REQUEST/u);
 await assert.rejects(x.admission.admit({record:x.f.record,extra:1}),/OBJECTIVE_ADMISSION_UNKNOWN|OBJECTIVE_ADMISSION_REQUEST/u);
 assert.deepEqual(counts(x),{bindings:0,inputs:0,runs:0});assert.equal(x.policy.calls.length,0);
 for(const change of [o=>{delete o.authority;},o=>{o.template={...o.template,runWindowMs:0};},o=>{o.template={...o.template,configurationSha256:'x'};},o=>{o.store={};},o=>{o.maxRequestMs=30001;}]){
  const options={...x.options};change(options);assert.throws(()=>createObjectiveNativeAdmission(options),/OBJECTIVE_ADMISSION_CONFIGURATION/u);
 }
});
