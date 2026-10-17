/** Synthetic PostgreSQL-shaped rows only: no engine, locks, durability, native
 * authority, database credentials or migration execution is qualified here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createObjectiveCustodyRecord} from './projection.mjs';
import {assertObjectivePostgresSources,assertObjectivePostgresLookupSources,decodeObjectiveCustodyRow,objectiveCustodyReadState,objectiveCustodyRecordColumns} from './postgres-records.mjs';
import {custodyFixture,NOW,id} from './test/custody-fixture.mjs';
const unavailable=/OBJECTIVE_SOURCE_UNAVAILABLE/;
function fixture(){
 const f=custodyFixture(),record=createObjectiveCustodyRecord({accepted:f.accepted,issued:f.issued}),b=record.binding,r=record.issued.issuance;
 const runRow={tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,projection:structuredClone(f.accepted.run),projection_sha256:hash(f.accepted.run),request_id:f.accepted.request.requestId,request:structuredClone(f.accepted.request),request_sha256:hash(f.accepted.request)};
 const issuanceRow={issuance_key:r.issuanceKey,tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,binding:structuredClone(b),binding_sha256:hash(b),request_sha256:r.requestSha256,expires_at_ms:String(r.expiresAtMs),state:'ISSUED',grant_id:r.grantId,capability_sha256:r.capabilitySha256,facts_sha256:r.factsSha256};
 const row={generation_job_id:record.generationJobId,tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,issuance_key:r.issuanceKey,binding_sha256:hash(b),binding:structuredClone(b),source_admission_sha256:record.sourceAdmissionSha256,source_request_sha256:r.requestSha256,facts_sha256:r.factsSha256,record_sha256:hash(record),original_expires_at_ms:String(r.expiresAtMs),record:structuredClone(record),state:'CLAIMED',claim_fence:id(80),version:'1',claimed_at:new Date(NOW),committed_at:null};
 return {...f,record,runRow,issuanceRow,row,options:{tenantId:b.tenantId,nowMs:NOW,activeWrite:true}};
}
const source=(f,options={})=>assertObjectivePostgresSources(f.record,{...f.options,runRow:f.runRow,issuanceRow:f.issuanceRow,...options});
const decode=f=>decodeObjectiveCustodyRow(f.row,{tenantId:f.binding.tenantId});

test('canonical accepted and already-ISSUED persistence match the closed custody record without secret columns',()=>{
 const f=fixture(),result=source(f);assert.deepEqual(result,f.record);assert.equal(Object.isFrozen(result.issued.issuance.binding),true);
 assert.equal(JSON.stringify(result).includes('materialRef'),false);
});

test('each canonical scalar locator, accepted request and projection hash must agree',()=>{
 for(const mutate of [
  f=>{f.runRow.tenant_id=id(90);},f=>{f.runRow.conversation_id=id(90);},f=>{f.runRow.run_id=id(90);},f=>{f.runRow.request_id=id(90);},
  f=>{f.runRow.projection_sha256='f'.repeat(64);},f=>{f.runRow.request_sha256='f'.repeat(64);},f=>{f.runRow.request.prompt='other canonical request';f.runRow.request_sha256=hash(f.runRow.request);},
  f=>{f.runRow.projection.binding.attemptId=id(90);f.runRow.projection_sha256=hash(f.runRow.projection);},
  f=>{f.runRow.projection.scopes[0].resourceId=id(90);f.runRow.projection_sha256=hash(f.runRow.projection);},
  f=>{f.runRow.projection.createdAt=new Date(NOW+1).toISOString();f.runRow.projection_sha256=hash(f.runRow.projection);},
 ]){const f=fixture();mutate(f);assert.throws(()=>source(f),unavailable);}
});

test('ISSUED comparison requires every receipt field, full seven-field binding and native scalar identity',()=>{
 for(const mutate of [
  f=>{f.issuanceRow.state='CLAIMED';},f=>{f.issuanceRow.tenant_id=id(90);},f=>{f.issuanceRow.conversation_id=id(90);},f=>{f.issuanceRow.run_id=id(90);},
  f=>{f.issuanceRow.issuance_key='f'.repeat(64);},f=>{f.issuanceRow.binding_sha256='f'.repeat(64);},
  f=>{f.issuanceRow.request_sha256='f'.repeat(64);},f=>{f.issuanceRow.expires_at_ms=String(NOW+100001);},f=>{f.issuanceRow.grant_id=id(90);},
  f=>{f.issuanceRow.capability_sha256='f'.repeat(64);},f=>{f.issuanceRow.facts_sha256='f'.repeat(64);},
 ]){const f=fixture();mutate(f);assert.throws(()=>source(f),unavailable);}
 for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence']){
  const f=fixture();f.issuanceRow.binding[field]=field==='writerFence'?2:id(90);f.issuanceRow.binding_sha256=hash(f.issuanceRow.binding);assert.throws(()=>source(f),unavailable);
 }
});

test('active writes require original unexpired execution and an actual active run; historical metadata does not renew it',()=>{
 for(const runState of ['queued','starting','running']){const f=fixture();f.runRow.projection.state=runState;f.runRow.projection_sha256=hash(f.runRow.projection);assert.deepEqual(source(f),f.record);}
 for(const runState of ['completed','failed','cancelled','paused','waiting-for-approval']){const f=fixture();f.runRow.projection.state=runState;f.runRow.projection_sha256=hash(f.runRow.projection);assert.throws(()=>source(f),unavailable);assert.deepEqual(source(f,{activeWrite:false,nowMs:NOW+200000}),f.record);}
 const f=fixture();assert.throws(()=>source(f,{nowMs:NOW+100000}),unavailable);assert.deepEqual(source(f,{activeWrite:false,nowMs:NOW+200000}),f.record);assert.equal(f.record.issued.issuance.expiresAtMs,NOW+100000);
});

test('source projections reject secret-bearing extras, malformed options, getters and proxies',()=>{
 for(const mutate of [f=>{f.issuanceRow.material_ref='SYNTHETIC-FORBIDDEN';},f=>{f.runRow.materialRef='SYNTHETIC-FORBIDDEN';},f=>{f.issuanceRow.binding.proxyCredential='SYNTHETIC-FORBIDDEN';}]){const f=fixture();mutate(f);assert.throws(()=>source(f),unavailable);}
 const f=fixture();for(const options of [{tenantId:id(90)},{activeWrite:'true'},{nowMs:-1},{nowMs:NaN},{nowMs:1.5}])assert.throws(()=>source(f,options),unavailable);
 const getter=Object.defineProperty({...f.runRow},'projection',{enumerable:true,get(){throw Error('MUST_NOT_EVALUATE');}});
 assert.throws(()=>source(f,{runRow:getter}),unavailable);assert.throws(()=>source(f,{issuanceRow:new Proxy(f.issuanceRow,{})}),unavailable);
});

test('private lifecycle decoding is exact and public store read suppresses every CLAIMED record field',()=>{
 const f=fixture(),decoded=decode(f);assert.equal(decoded.state,'CLAIMED');assert.equal(decoded.version,1);assert.equal(decoded.claimedAtMs,NOW);assert.equal(decoded.committedAtMs,null);assert.deepEqual(decoded.record,f.record);
 const publicRead=objectiveCustodyReadState(f.row,{tenantId:f.binding.tenantId});assert.deepEqual(publicRead,{state:'UNKNOWN'});assert.deepEqual(Object.keys(publicRead),['state']);
 f.row.state='COMMITTED';f.row.version='2';f.row.committed_at=new Date(NOW+1).toISOString();assert.equal(decode(f).committedAtMs,NOW+1);assert.deepEqual(objectiveCustodyReadState(f.row,{tenantId:f.binding.tenantId}),{state:'COMMITTED',record:f.record});
});

test('custody scalar, JSON, hash and full-binding mismatches are refused',()=>{
 for(const mutate of [
  f=>{f.row.generation_job_id=id(90);},f=>{f.row.tenant_id=id(90);},f=>{f.row.conversation_id=id(90);},f=>{f.row.run_id=id(90);},
  f=>{f.row.issuance_key='f'.repeat(64);},f=>{f.row.binding_sha256='f'.repeat(64);},f=>{f.row.source_admission_sha256='f'.repeat(64);},
  f=>{f.row.source_request_sha256='f'.repeat(64);},f=>{f.row.facts_sha256='f'.repeat(64);},f=>{f.row.record_sha256='f'.repeat(64);},f=>{f.row.original_expires_at_ms=String(NOW+100001);},
  f=>{f.row.binding.workerId=id(90);},f=>{f.row.record.binding.attemptId=id(90);f.row.record_sha256=hash(f.row.record);},
 ]){const f=fixture();mutate(f);assert.throws(()=>decode(f),unavailable);assert.throws(()=>objectiveCustodyReadState(f.row,{tenantId:f.binding.tenantId}),unavailable);}
 const f=fixture();assert.throws(()=>decodeObjectiveCustodyRow(f.row,{tenantId:id(90)}),unavailable);
});

test('lifecycle version and timestamps do not permit fabricated finality or mutable committed metadata',()=>{
 for(const mutate of [f=>{f.row.state='UNKNOWN';},f=>{f.row.version='2';},f=>{f.row.committed_at=new Date(NOW);},f=>{f.row.claim_fence='not-uuid';},f=>{f.row.claimed_at=new Date('invalid');},
  f=>{f.row.state='COMMITTED';f.row.version='2';},f=>{f.row.state='COMMITTED';f.row.committed_at=new Date(NOW+1);},
  f=>{f.row.state='COMMITTED';f.row.version='2';f.row.committed_at=new Date(NOW-1);},f=>{f.row.claimed_at='2026-10-15';}]){const f=fixture();mutate(f);assert.throws(()=>decode(f),unavailable);}
});

test('integer decoding never rounds a native bigint or accepts alternate representations',()=>{
 for(const value of ['01','1.0','1e0','0x1','',9007199254740992,'9007199254740992',1.5,-1,null]){const f=fixture();f.row.version=value;assert.throws(()=>decode(f),unavailable);}
 for(const value of ['01792065700000','1792065700000.0','9007199254740992',NaN]){const f=fixture();f.issuanceRow.expires_at_ms=value;assert.throws(()=>source(f),unavailable);}
 const f=fixture();f.row.version=1;f.row.original_expires_at_ms=NOW+100000;f.issuanceRow.expires_at_ms=NOW+100000;assert.equal(decode(f).version,1);assert.deepEqual(source(f),f.record);
});

test('row snapshots cannot be changed through borrowed JSON or timestamp objects',()=>{
 const f=fixture(),decoded=decode(f);f.row.record.acceptedRequest.prompt='later mutation';f.row.binding.workerId=id(90);f.row.claimed_at.setTime(NOW+500);
 assert.equal(decoded.record.acceptedRequest.prompt,f.record.acceptedRequest.prompt);assert.equal(decoded.record.binding.workerId,f.binding.workerId);assert.equal(decoded.claimedAtMs,NOW);assert.equal(Object.isFrozen(decoded.record),true);
});

test('immutable column projection derives exact locators and hashes while excluding lifecycle authority',()=>{
 const f=fixture(),input=structuredClone(f.record),columns=objectiveCustodyRecordColumns(input,{tenantId:f.binding.tenantId});
 const {state,claim_fence,version,claimed_at,committed_at,...expected}=f.row;expected.original_expires_at_ms=Number(expected.original_expires_at_ms);
 assert.deepEqual(columns,expected);for(const field of ['state','claim_fence','version','claimed_at','committed_at'])assert.equal(Object.hasOwn(columns,field),false);
 input.acceptedRequest.prompt='later caller change';assert.equal(columns.record.acceptedRequest.prompt,f.record.acceptedRequest.prompt);assert.equal(Object.isFrozen(columns.binding),true);
 assert.throws(()=>objectiveCustodyRecordColumns(f.record,{tenantId:id(90)}),unavailable);
 assert.throws(()=>objectiveCustodyRecordColumns(f.record,{tenantId:'x'.repeat(129)}),unavailable);
});

test('reverse absence gate requires genuine canonical accepted and ISSUED metadata without a custody record',()=>{
 const f=fixture(),lookup={runRow:f.runRow,issuanceRow:f.issuanceRow,binding:f.binding,issuanceKey:f.issued.issuance.issuanceKey,factsSha256:f.issued.factsSha256,tenantId:f.binding.tenantId};
 const result=assertObjectivePostgresLookupSources(lookup);assert.deepEqual(result.accepted,f.accepted);assert.deepEqual(result.issuance,f.issued.issuance);
 assert.deepEqual(Object.keys(result).sort(),['accepted','issuance']);assert.equal(Object.hasOwn(result,'pair'),false);assert.equal(Object.hasOwn(result,'record'),false);
 f.runRow.projection.state='completed';f.runRow.projection_sha256=hash(f.runRow.projection);
 assert.equal(assertObjectivePostgresLookupSources(lookup).issuance.expiresAtMs,NOW+100000,'historical/cleanup metadata preserves the original expiry');
 for(const amend of [v=>({...v,issuanceKey:'f'.repeat(64)}),v=>({...v,factsSha256:'f'.repeat(64)}),v=>({...v,tenantId:id(90)}),
  v=>({...v,binding:{...v.binding,workerId:id(90)}}),v=>({...v,issuanceRow:{...v.issuanceRow,state:'CLAIMED'}}),v=>({...v,runRow:{...v.runRow,request_sha256:'f'.repeat(64)}}),
  v=>({...v,issuanceRow:{...v.issuanceRow,material_ref:'SYNTHETIC-FORBIDDEN'}}),v=>({...v,issuanceRow:null}),v=>({...v,runRow:null})])assert.throws(()=>assertObjectivePostgresLookupSources(amend(lookup)),unavailable);
});

test('custody JSON getters cannot execute before canonical shape checks',()=>{
 const f=fixture();let invoked=false;f.row.binding=Object.defineProperty({...f.binding},'actorId',{enumerable:true,get(){invoked=true;return f.binding.actorId;}});
 assert.throws(()=>decode(f),unavailable);assert.equal(invoked,false);
});
