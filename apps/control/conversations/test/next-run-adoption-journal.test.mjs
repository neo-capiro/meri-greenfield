import test from 'node:test';
import assert from 'node:assert/strict';
import {createNextRunAdoptionJournal} from '../next-run-adoption-journal.mjs';
import {hash} from '../boundary.mjs';
import {binding,id,scopes,versions} from './store-fixture.mjs';

const at=1800000000000,oldConfigurationSha256='c'.repeat(64),newConfigurationSha256='d'.repeat(64);
const newVersions={...versions,imageDigest:`sha256:${'f'.repeat(64)}`,sdk:'0.3.296'};
const target={...binding,runId:id(11),attemptId:id(12),workerId:id(13),writerFence:2};
const successor={...binding,runId:id(21),attemptId:id(22),workerId:id(23),writerFence:3};
const originalRecord={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:id(5),policyRevision:'policy1',versions,configurationSha256:oldConfigurationSha256,createdAtMs:at,expiresAtMs:at+60000};
const originalRow={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record:originalRecord,record_sha256:hash(originalRecord)};
const reservation=(source,destination,pins)=>({source,target:destination,facts:{checkpoint:null,noAuthority:{foreclosureSha256:'a'.repeat(64)}},scopes,versions:pins,policyRevision:'policy1',reservedAt:new Date(at+1000).toISOString()});
const nextRow=(source,destination,pins,state)=>{const value=reservation(source,destination,pins);return {tenant_id:binding.tenantId,conversation_id:binding.conversationId,source_run_id:source.runId,target_run_id:destination.runId,reservation:value,reservation_sha256:hash(value),state};};
const first=nextRow(binding,target,versions,'ACCEPTED'),second=nextRow(target,successor,newVersions,'RESERVED');
const runRow=(b,pins)=>{const projection={binding:b,state:'queued',scopes,createdAt:new Date(at+(b.writerFence-1)*3000).toISOString(),policyRevision:'policy1',versions:pins};return {tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,projection,projection_sha256:hash(projection)};};
const adoptionReceipt={schemaVersion:1,source:binding,target,originalAdmissionSha256:originalRow.record_sha256,reservationSha256:first.reservation_sha256,selectedClientId:id(5),scopes,policyRevision:'policy1',fromConfigurationSha256:oldConfigurationSha256,fromVersions:versions,toConfigurationSha256:newConfigurationSha256,toVersions:newVersions,authorityDecisionSha256:'b'.repeat(64),authorityCheckedAtMs:at+1000,authorityExpiresAtMs:at+30000,adoptedAtMs:at+2000,validUntilMs:at+20000};
const adoptionRow={tenant_id:binding.tenantId,conversation_id:binding.conversationId,target_run_id:target.runId,receipt:adoptionReceipt,receipt_sha256:hash(adoptionReceipt)};

function fixture(){
 const state={original:[structuredClone(originalRow)],next:[structuredClone(second),structuredClone(first)],adoptions:[structuredClone(adoptionRow)],runs:[runRow(binding,versions),runRow(target,newVersions)],queries:[],locked:0,missingTable:false};
 const tx=async(key,check,body)=>{assert.equal(key.tenantId,binding.tenantId);assert.equal(key.conversationId,binding.conversationId);state.locked++;check();return body({async query(sql,args){state.queries.push(sql);assert.deepEqual(args.slice(0,2),[binding.tenantId,binding.conversationId]);
  if(sql.includes('initial_run_bindings'))return {rows:structuredClone(state.original)};
  if(sql.includes('next_run_adoptions')){if(state.missingTable)throw Object.assign(Error('relation does not exist'),{code:'42P01'});return {rows:structuredClone(state.adoptions)};}
  if(sql.includes('next_runs'))return {rows:structuredClone(state.next)};
  if(sql.includes('meri_conversations.runs')){assert.equal(args[2][0],binding.runId);return {rows:structuredClone(state.runs.filter(row=>args[2].includes(row.run_id)))};}
  throw Error('unexpected SQL');}});};
 return {state,journal:createNextRunAdoptionJournal({tx})};
}
const check=()=>{};

test('unordered retained rows resolve the adopted target and its inherited successor without a write',async()=>{
 const f=fixture(),adopted=await f.journal.readEffective({binding:target},check),later=await f.journal.readEffective({binding:successor},check);
 assert.equal(adopted.configurationSha256,newConfigurationSha256);assert.deepEqual(adopted.versions,newVersions);
 assert.equal(adopted.transitionSha256,adoptionRow.receipt_sha256);assert.equal(adopted.reservationSha256,first.reservation_sha256);
 assert.equal(later.configurationSha256,newConfigurationSha256);assert.equal(later.transitionSha256,adoptionRow.receipt_sha256);
 assert.equal(later.reservationSha256,second.reservation_sha256);assert.equal(f.state.locked,2);
 assert.equal(f.state.queries.length,8);assert.ok(f.state.queries.every(sql=>sql.startsWith('SELECT ')));
});

test('original descriptor remains exact after an adopted successor',async()=>{
 const f=fixture(),old=await f.journal.readEffective({binding},check);
 assert.equal(old.configurationSha256,oldConfigurationSha256);assert.deepEqual(old.versions,versions);
 assert.equal(old.transitionSha256,null);assert.equal(old.reservationSha256,null);
});

test('missing proposed table, absent original and unknown target fail closed',async()=>{
 const f=fixture();f.state.missingTable=true;await assert.rejects(f.journal.readEffective({binding:target},check),{code:'42P01'});
 f.state.missingTable=false;f.state.original=[];await assert.rejects(f.journal.readEffective({binding:target},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
 f.state.original=[structuredClone(originalRow)];await assert.rejects(f.journal.readEffective({binding:{...target,runId:id(99)}},check));
});

test('forged row hash, broken chain, duplicate adoption and changed actor refuse',async()=>{
 const f=fixture();f.state.next[1].reservation_sha256='0'.repeat(64);
 await assert.rejects(f.journal.readEffective({binding:target},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
 f.state.next[1]=structuredClone(first);f.state.next[0].reservation.source={...target,runId:id(99)};
 await assert.rejects(f.journal.readEffective({binding:successor},check));
 f.state.next[0]=structuredClone(second);const conflicting={...adoptionReceipt,toConfigurationSha256:'e'.repeat(64)};
 f.state.adoptions.push({...adoptionRow,receipt:conflicting,receipt_sha256:hash(conflicting)});
 await assert.rejects(f.journal.readEffective({binding:target},check),{code:'EFFECTIVE_ADMISSION_HOLD'});
 f.state.adoptions.pop();await assert.rejects(f.journal.readEffective({binding:{...target,actorId:'other-actor'}},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
});

test('accepted projection must carry adopted pins; reserved target cannot have a run',async()=>{
 const f=fixture();f.state.runs[1].projection.versions=versions;f.state.runs[1].projection_sha256=hash(f.state.runs[1].projection);
 await assert.rejects(f.journal.readEffective({binding:target},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
 f.state.runs[1]=runRow(target,newVersions);f.state.runs.push(runRow(successor,newVersions));
 await assert.rejects(f.journal.readEffective({binding:successor},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
});

test('an accepted target cannot be adopted after its saved creation instant',async()=>{
 const f=fixture(),accepted=f.state.runs[1];accepted.projection.createdAt=new Date(at+1500).toISOString();accepted.projection_sha256=hash(accepted.projection);
 await assert.rejects(f.journal.readEffective({binding:target},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
 accepted.projection.createdAt=new Date(adoptionReceipt.adoptedAtMs).toISOString();accepted.projection_sha256=hash(accepted.projection);
 await assert.rejects(f.journal.readEffective({binding:target},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
});

test('historical original remains readable when a later descendant is corrupt',async()=>{
 const f=fixture();f.state.next[0].reservation_sha256='0'.repeat(64);f.state.runs[1].projection_sha256='0'.repeat(64);
 const old=await f.journal.readEffective({binding},check);
 assert.equal(old.configurationSha256,oldConfigurationSha256);assert.equal(old.transitionSha256,null);
});
