/** Objective-origin admission over the canonical original-binding journal and the actual conversation store, on the
 * scripted conversation SQL fixtures (no database engine). Core authority is a SYNTHETIC port: no Core claim is proven. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {initialInputFixture} from '../../../control/conversations/test/initial-input-fixture.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createObjectiveNativeAdmission} from '../objective-admission.mjs';
import {runStartFixture,id,NOW} from '../../objective-source/test/run-start-fixture.mjs';

function fixture(){
 const conversations=initialInputFixture(),bindings=new Map(),copy=v=>structuredClone(v),key=p=>p.slice(0,2).join(':');
 conversations.advance(NOW-conversations.now());
 const pool={async connect(){const client=await conversations.pool.connect();let backup;return {async query(sql,p=[]){
  const rows=v=>({rows:copy(v),rowCount:v.length});
  if(sql==='BEGIN'||sql==='BEGIN ISOLATION LEVEL READ COMMITTED'){backup=copy(bindings);return client.query('BEGIN');}
  if(sql==='ROLLBACK'){bindings.clear();for(const [k,v] of backup)bindings.set(k,v);return client.query(sql,p);}
  if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings'))return rows(bindings.has(key(p))?[bindings.get(key(p))]:[]);
  if(sql.startsWith('INSERT INTO meri_conversations.initial_run_bindings')){if(bindings.has(key(p)))return rows([]);
   const row={tenant_id:p[0],conversation_id:p[1],run_id:p[2],record:copy(p[3]),record_sha256:p[4]};bindings.set(key(p),row);return rows([row]);}
  if(sql.startsWith('SELECT projection,projection_sha256 FROM meri_conversations.runs'))return rows([...conversations.state.runs.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]).slice(0,1));
  if(sql.startsWith('SELECT reservation,reservation_sha256 FROM meri_conversations.next_runs'))return rows([]);
  if(sql.startsWith('SELECT 1 FROM meri_conversations.next_runs'))return rows([]);
  return client.query(sql,p);
 },release(reason){client.release(reason);}};}};
 const now=conversations.now,store=createPostgresConversationStore({pool,now}),f=runStartFixture();
 const template={versions,policyRevision:'policy1',configurationSha256:'c'.repeat(64),runWindowMs:60000};
 const policy={calls:[],expiresAtMs:NOW+120000,refuse:null};
 const scopes=[{tenantId:f.tenantId,kind:'client',resourceId:f.clientId,policyRevision:'policy1'}];
 const authority={async authorize(q){policy.calls.push(q);if(policy.refuse===q.phase)throw Error('SYNTHETIC_CORE_DENIED');
  return {authorized:true,selectionSha256:q.selectionSha256,binding:q.selection.binding,scopes,selectedClientId:f.clientId,policyRevision:'policy1',
   configurationSha256:template.configurationSha256,checkedAtMs:now(),expiresAtMs:policy.expiresAtMs};}};
 const options={pool,store,authority,template,now};
 return {conversations,bindings,store,f,template,policy,authority,options,scopes,now,admission:createObjectiveNativeAdmission(options)};
}
const counts=x=>({bindings:x.bindings.size,inputs:x.conversations.allocations.size,runs:x.conversations.state.runs.size});

test('admits exactly the derived original run with Core request ID and prompt, bounded by the run window and Core effect',async()=>{
 const x=fixture(),first=await x.admission.admit({record:x.f.record});
 assert.deepEqual(first,{binding:x.f.binding,requestSha256:x.f.record.sourceRequestSha256,expiresAtMs:NOW+60000,replayed:false});
 assert.deepEqual(counts(x),{bindings:1,inputs:1,runs:1});
 const saved=await x.store.readOptional(x.f.binding,{after:0,limit:1},()=>{});
 assert.deepEqual(saved.request,x.f.acceptedRequest);assert.equal(saved.run.state,'queued');assert.deepEqual(saved.run.scopes,x.scopes);
 assert.equal(hash(saved.request),x.f.record.sourceRequestSha256,'the run start record names this exact accepted request');
 assert.deepEqual(x.policy.calls.map(q=>q.phase),['before_claim','before_accept','before_release']);
 for(const q of x.policy.calls){assert.equal(q.selection.runStartSha256,hash(x.f.record));assert.equal(q.selection.generationJobId,x.f.generationJobId);assert.equal(q.selectionSha256,hash(q.selection));}
 const replay=await createObjectiveNativeAdmission(x.options).admit({record:x.f.record});
 assert.deepEqual(replay,{...first,replayed:true});assert.deepEqual(counts(x),{bindings:1,inputs:1,runs:1});
});

test('Core authority bounds expiry, and any refusal or mismatch admits nothing',async()=>{
 const short=fixture();short.policy.expiresAtMs=NOW+30000;
 assert.equal((await short.admission.admit({record:short.f.record})).expiresAtMs,NOW+30000);
 const denied=fixture();denied.policy.refuse='before_claim';
 await assert.rejects(denied.admission.admit({record:denied.f.record}),/OBJECTIVE_ADMISSION_UNKNOWN|OBJECTIVE_ADMISSION_AUTHORITY/u);assert.deepEqual(counts(denied),{bindings:0,inputs:0,runs:0});
 const foreign=fixture();foreign.authority.authorize=async q=>({authorized:true,selectionSha256:q.selectionSha256,binding:q.selection.binding,scopes:foreign.scopes,
  selectedClientId:id(77),policyRevision:'policy1',configurationSha256:foreign.template.configurationSha256,checkedAtMs:foreign.now(),expiresAtMs:NOW+120000});
 await assert.rejects(createObjectiveNativeAdmission(foreign.options).admit({record:foreign.f.record}),/OBJECTIVE_ADMISSION_AUTHORITY/u);assert.deepEqual(counts(foreign),{bindings:0,inputs:0,runs:0});
 const expired=fixture();expired.conversations.advance(expired.f.record.effectExpiresAtMs-NOW);
 await assert.rejects(expired.admission.admit({record:expired.f.record}),/OBJECTIVE_ADMISSION_EXPIRED/u);assert.equal(expired.policy.calls.length,0);
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
