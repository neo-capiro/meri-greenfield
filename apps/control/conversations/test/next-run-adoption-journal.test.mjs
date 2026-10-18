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
const runRow=(b,pins,transitionSha256=null)=>{const projection={binding:b,state:'queued',scopes,createdAt:new Date(at+(b.writerFence-1)*3000).toISOString(),policyRevision:'policy1',versions:pins};return {tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,projection,projection_sha256:hash(projection),transition_sha256:transitionSha256};};
const adoptionReceipt={schemaVersion:1,source:binding,target,originalAdmissionSha256:originalRow.record_sha256,reservationSha256:first.reservation_sha256,selectedClientId:id(5),scopes,policyRevision:'policy1',fromConfigurationSha256:oldConfigurationSha256,fromVersions:versions,toConfigurationSha256:newConfigurationSha256,toVersions:newVersions,authorityDecisionSha256:'b'.repeat(64),authorityCheckedAtMs:at+1000,authorityExpiresAtMs:at+30000,adoptedAtMs:at+2000,validUntilMs:at+20000};
const adoptionRow={tenant_id:binding.tenantId,conversation_id:binding.conversationId,target_run_id:target.runId,receipt:adoptionReceipt,receipt_sha256:hash(adoptionReceipt)};

function fixture(){
 const state={original:[structuredClone(originalRow)],next:[structuredClone(second),structuredClone(first)],adoptions:[structuredClone(adoptionRow)],runs:[runRow(binding,versions),runRow(target,newVersions,adoptionRow.receipt_sha256)],queries:[],locked:0,missingTable:false};
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
 f.state.runs[1]=runRow(target,newVersions,adoptionRow.receipt_sha256);f.state.runs.push(runRow(successor,newVersions,adoptionRow.receipt_sha256));
 await assert.rejects(f.journal.readEffective({binding:successor},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
});

test('accepted ancestor must carry the exact adopted transition digest',async()=>{
 const f=fixture();f.state.runs[1].transition_sha256=null;
 await assert.rejects(f.journal.readEffective({binding:target},check),{code:'NEXT_RUN_ADOPTION_CORRUPT'});
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

function claimFixture(){
 const foreclosure={binding,allocationKey:hash(binding),state:'FORECLOSED',foreclosure:{eventId:id(91),eventSha256:'a'.repeat(64),state:'failed'}};
 const next=structuredClone(first);next.state='RESERVED';next.reservation.facts.noAuthority.foreclosureSha256=hash(foreclosure);next.reservation_sha256=hash(next.reservation);
 const sourceRun=runRow(binding,versions);sourceRun.projection.state='failed';sourceRun.projection_sha256=hash(sourceRun.projection);
 const state={original:[structuredClone(originalRow)],next:[next],adoptions:[],runs:[sourceRun],allocation:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record:foreclosure,record_sha256:hash(foreclosure)},queries:[],clock:at+2000,coreOffsetMs:-500,coreLifetimeMs:20000,retentionCalls:0,authorityCalls:0,revocationCalls:0,revocationReceipt:null,servable:true,identityRevision:'identity-1',contextRevision:'context-1',afterInsert:null,targetClaimed:false};
 const client={async query(sql,args){state.queries.push(sql);
  if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings'))return {rows:structuredClone(state.original)};
  if(sql.startsWith('SELECT * FROM meri_conversations.next_runs'))return {rows:structuredClone(sql.includes('target_run_id=$3')?state.next.filter(row=>row.target_run_id===args[2]):state.next)};
  if(sql.startsWith('SELECT * FROM meri_conversations.next_run_adoptions'))return {rows:structuredClone(state.adoptions)};
  if(sql.startsWith('SELECT * FROM meri_conversations.runs'))return {rows:structuredClone(sql.includes('run_id=ANY')?state.runs.filter(row=>args[2].includes(row.run_id)):state.runs)};
  if(sql.startsWith('SELECT * FROM meri_conversations.native_allocations'))return {rows:args[2]===binding.runId?[structuredClone(state.allocation)]:[]};
  if(sql.startsWith('INSERT INTO meri_conversations.next_run_adoptions')){if(state.targetClaimed)throw Object.assign(Error('target already claimed'),{code:'DB_ADOPTION_TARGET_CLAIMED'});const row={tenant_id:args[0],conversation_id:args[1],target_run_id:args[2],receipt:args[3],receipt_sha256:args[4]};state.adoptions.push(structuredClone(row));state.afterInsert?.();return {rows:[structuredClone(row)]};}
  throw Error('unexpected SQL: '+sql);
 }};
 const tx=async(key,check,body)=>{assert.deepEqual([key.tenantId,key.conversationId],[binding.tenantId,binding.conversationId]);const snapshot=structuredClone(state.adoptions);try{return await body(client);}catch(error){state.adoptions=snapshot;throw error;}};
 const authority={async readCurrent({target:called,selectedClientId,scopes:calledScopes,policyRevision,deadlineMs}){state.authorityCalls++;assert.deepEqual(called,target);assert.equal(selectedClientId,id(5));assert.deepEqual(calledScopes,scopes);assert.equal(policyRevision,'policy1');assert.ok(deadlineMs>state.clock);const identity={principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:state.identityRevision,checkedAtMs:state.clock+state.coreOffsetMs,expiresAtMs:state.clock+state.coreLifetimeMs};const context={identitySha256:hash(identity),principal:identity.principal,identityRevision:identity.identityRevision,conversationId:binding.conversationId,selectedClientId:id(5),contextRevision:state.contextRevision,checkedAtMs:state.clock+state.coreOffsetMs,expiresAtMs:state.clock+state.coreLifetimeMs};return {identity,context};}};
 const retention={async assertServable(subject){state.retentionCalls++;assert.deepEqual(subject,{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId});if(!state.servable)throw Error('RETENTION_SUPPRESSED');}};
 const revocation={async readRevoked({binding:called,record,receiptSha256,grantIds}){state.revocationCalls++;assert.deepEqual(called,binding);assert.deepEqual(record,state.allocation.record);assert.equal(receiptSha256,state.next[0].reservation.facts.revocation.receiptSha256);assert.deepEqual(grantIds,state.next[0].reservation.facts.revocation.grantIds);return structuredClone(state.revocationReceipt);}};
 const journal=createNextRunAdoptionJournal({tx,now:()=>state.clock,authority,retention,revocation});
 return {state,journal,claim:()=>journal.claim({target,toConfigurationSha256:newConfigurationSha256,toVersions:newVersions},check)};
}

test('reserved failed source adopts once under current facts and exact replay returns the same receipt',async()=>{
 const f=claimFixture(),firstClaim=await f.claim();
 assert.equal(firstClaim.replayed,false);assert.equal(firstClaim.descriptor.configurationSha256,newConfigurationSha256);
 assert.equal(firstClaim.receipt.authorityCheckedAtMs,at+2000);assert.equal(firstClaim.receipt.validUntilMs,at+7000);
 assert.equal(firstClaim.receiptSha256,hash(firstClaim.receipt));assert.equal(f.state.adoptions.length,1);
 assert.equal(f.state.retentionCalls,2);assert.equal(f.state.authorityCalls,2);
 const replay=await f.claim();assert.equal(replay.replayed,true);assert.equal(replay.receiptSha256,firstClaim.receiptSha256);
 assert.equal(f.state.adoptions.length,1);assert.equal(f.state.queries.filter(sql=>sql.startsWith('INSERT ')).length,1);
});

test('claim refuses without trusted ports, target claims or a matching source foreclosure',async()=>{
 const f=claimFixture();
 await assert.rejects(createNextRunAdoptionJournal({tx:async()=>assert.fail('no SQL')}).claim({target,toConfigurationSha256:newConfigurationSha256,toVersions:newVersions},check),{code:'NEXT_RUN_ADOPTION_CONFIGURATION'});
 f.state.targetClaimed=true;await assert.rejects(f.claim(),{code:'DB_ADOPTION_TARGET_CLAIMED'});assert.equal(f.state.adoptions.length,0);
 f.state.targetClaimed=false;f.state.allocation.record_sha256='0'.repeat(64);
 await assert.rejects(f.claim(),{code:'NEXT_RUN_ADOPTION_SOURCE'});assert.equal(f.state.adoptions.length,0);
});

test('post-insert authority or retention change rolls the adoption back',async()=>{
 const changed=claimFixture();changed.state.afterInsert=()=>{changed.state.identityRevision='identity-2';};
 await assert.rejects(changed.claim(),{code:'NEXT_RUN_ADOPTION_AUTHORITY'});assert.equal(changed.state.adoptions.length,0);
 const suppressed=claimFixture();suppressed.state.afterInsert=()=>{suppressed.state.servable=false;};
 await assert.rejects(suppressed.claim(),/RETENTION_SUPPRESSED/u);assert.equal(suppressed.state.adoptions.length,0);
});

test('retired source needs the original capsule and a pure matching revocation read',async()=>{
 const f=claimFixture(),grantId=id(92),receiptSha256='e'.repeat(64);
 const record={original:{binding},state:'RETIRED',resource:{physicalStopProven:true},grantIntents:[{grantId}]};
 f.state.allocation.record=record;f.state.allocation.record_sha256=hash(record);
 f.state.next[0].reservation.facts={checkpoint:null,retirement:{physicalStopProven:true},revocation:{receiptSha256,grantIds:[grantId]}};
 f.state.next[0].reservation_sha256=hash(f.state.next[0].reservation);
 f.state.revocationReceipt={receiptSha256,grantIds:[grantId]};
 const adopted=await f.claim();assert.equal(adopted.replayed,false);assert.equal(f.state.revocationCalls,2);
 const mismatch=claimFixture();mismatch.state.allocation.record=record;mismatch.state.allocation.record_sha256=hash(record);
 mismatch.state.next[0].reservation.facts=structuredClone(f.state.next[0].reservation.facts);mismatch.state.next[0].reservation_sha256=hash(mismatch.state.next[0].reservation);
 mismatch.state.revocationReceipt={receiptSha256:'0'.repeat(64),grantIds:[grantId]};
 await assert.rejects(mismatch.claim(),{code:'NEXT_RUN_ADOPTION_REVOCATION'});assert.equal(mismatch.state.adoptions.length,0);
});

test('cross-host observations are bounded symmetrically and expiry is reduced by skew',async()=>{
 const f=claimFixture();f.state.clock=at+7000;f.state.coreOffsetMs=4000;f.state.coreLifetimeMs=7000;
 const claim=await f.claim();assert.equal(claim.receipt.authorityCheckedAtMs,at+7000);assert.equal(claim.receipt.validUntilMs,at+9000);
 const outside=claimFixture();outside.state.coreOffsetMs=5001;
 await assert.rejects(outside.claim(),{code:'NEXT_RUN_ADOPTION_AUTHORITY'});
});
