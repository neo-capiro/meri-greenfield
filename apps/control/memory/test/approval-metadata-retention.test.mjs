/** Synthetic exact-row inventory and guarded purge seam. The central retention owner, allocation and trigger are not bound. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {commandToolValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {hash,subjectKey} from '../../retention/boundary.mjs';
import {planDigest} from '../../retention/purge.mjs';
import {createMemoryApprovalMetadataOwner,MEMORY_COMMAND_OPERATION} from '../approval-metadata.mjs';
import {createMemoryApprovalMetadataRetentionPayloadOwner,MEMORY_APPROVAL_METADATA_ROW_CLASS} from '../approval-metadata-retention-owner.mjs';
import {productFailure} from '../../product-access/errors.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,NOW=1900000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const subject={tenantId:'tenant',kind:'conversation',subjectId:id(1),ownerActorId:'actor'};
async function payload(){
 let retained;
 const owner=createMemoryApprovalMetadataOwner({store:{async insert(value){retained=structuredClone(value);return value;},async read(){return retained;}},
  commandContext:{binding,conversationClientId:id(5)},preparePolicy:async call=>({authorized:true,selectionSha256:call.selectionSha256,binding,
   scopes:[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'current'}],requiredApprover:{tenantId:'tenant',actorId:'actor'},
   proposalExpiresAt:new Date(NOW+60000).toISOString(),checkedAtMs:NOW,expiresAtMs:NOW+1000}),
  retention:{async assertServable(){}},now:()=>NOW,newId:(()=>{let n=100;return()=>id(n++);})(),maxRequestMs:1000});
 const request={content:'Private remembered detail',scope:'personal'},input=commandToolValidators.normalizeCommandToolInput('memory.propose',request,
  {commandContext:{binding,conversationClientId:id(5)}}).input;
 await owner.prepare({operation:MEMORY_COMMAND_OPERATION,action:'memory.propose',binding,request,input,inputSha256:canonicalSha256(input),
  deadlineMs:NOW+1000,signal:undefined});
 return retained;
}
test('memory metadata inventory is exact by tenant, owner, conversation, action and proposal ID; corrupt content fails closed',async()=>{
 const retained=await payload(),pId=retained.record.proposalId,queries=[];
 let corrupt=false,tombstone=false;
 const pool={async connect(){return {async query(sql,values){queries.push({sql,values});if(sql.startsWith('SELECT proposal_id,payload,payload_sha256,payload_purged_at,memory_conversation_id FROM')){
   const matching=sql.includes('ORDER BY proposal_id')?(values[3]===null||values[3]<pId)&&!tombstone:values[3]===pId;
   const answer=values[0]===subject.tenantId&&values[1]===subject.ownerActorId&&values[2]===subject.subjectId&&matching?
    [{proposal_id:pId,payload:tombstone?null:structuredClone(retained),payload_sha256:corrupt?'f'.repeat(64):hash(retained),
     payload_purged_at:tombstone?new Date(NOW).toISOString():null,memory_conversation_id:subject.subjectId}]:[];
   return {rows:answer};}return {rows:[]};},release(){}};}};
 const owner=createMemoryApprovalMetadataRetentionPayloadOwner({pool});
 assert.equal(owner.className,MEMORY_APPROVAL_METADATA_ROW_CLASS);
 assert.deepEqual(await owner.inventoryPage({subject,limit:1}),[pId]);
 assert.deepEqual(await owner.inventoryPage({subject,afterProposalId:pId,limit:1}),[]);
 assert.equal(await owner.present({subject,proposalId:pId}),true);
 assert.equal(await owner.present({subject:{...subject,ownerActorId:'other'},proposalId:pId}),false);
 assert.match(queries.find(q=>q.sql.includes('ORDER BY proposal_id')).sql,/tenant_id=\$1 AND actor_id=\$2/u);
 assert.match(queries.find(q=>q.sql.includes('ORDER BY proposal_id')).sql,/memory_conversation_id=\$3 AND payload IS NOT NULL/u);
 corrupt=true;
 await assert.rejects(owner.inventoryPage({subject,limit:1}),e=>productFailure(e)?.code==='RETENTION_STORE_CORRUPT');
 await assert.rejects(owner.present({subject,proposalId:pId}),e=>productFailure(e)?.code==='RETENTION_STORE_CORRUPT');
 corrupt=false;tombstone=true;
 assert.deepEqual(await owner.inventoryPage({subject,limit:1}),[]);
 assert.equal(await owner.present({subject,proposalId:pId}),false);
});
function plan(proposalId){
 const workflowId='c'.repeat(64),step={workflowId,className:MEMORY_APPROVAL_METADATA_ROW_CLASS,
  target:{className:MEMORY_APPROVAL_METADATA_ROW_CLASS,key:proposalId}};
 const base={subject,subjectKey:subjectKey(subject),suppression:{ledgerSequence:1,entrySha256:'a'.repeat(64)},policyId:'policy',policyVersion:1,
  policySha256:'b'.repeat(64),inventorySha256:'d'.repeat(64),steps:[],rowSteps:[step],blocks:[],state:'PLANNED',plannedAtMs:NOW};
 return {plan:{...base,planSha256:planDigest(base)},workflowId};
}
test('memory metadata redaction preserves the proposal replay fence and requires same-transaction target and suppression generation',async()=>{
 const retained=await payload(),{plan:p,workflowId}=plan(retained.record.proposalId),owner=createMemoryApprovalMetadataRetentionPayloadOwner({pool:{connect(){throw Error('unused');}}});
 const make=({target=true,ownerActorId='actor',generation=1}={})=>{
  const statements=[],projection={state:'SUPPRESSED',ownerActorId,ledgerSequence:generation,entrySha256:'a'.repeat(64),
   purge:{state:'PLANNED',planSha256:p.planSha256,ledgerSequence:2}};
  const client={async query(sql,params=[]){statements.push({sql,params});
   if(sql.startsWith('SELECT owner_actor_id,state'))return {rows:[{owner_actor_id:ownerActorId,state:'SUPPRESSED',ledger_sequence:generation,
    entry_sha256:'a'.repeat(64),projection,projection_sha256:hash(projection)}]};
   if(sql.startsWith('SELECT workflow_id FROM meri_conversations.retention_purge_targets'))return {rows:target?[{workflow_id:workflowId}]:[]};
   if(sql.startsWith('UPDATE meri_commands.approval_metadata SET payload=NULL'))return {rowCount:1};
   if(sql.startsWith('SELECT payload,payload_purged_at FROM meri_commands.approval_metadata'))return {rows:[{payload:null,payload_purged_at:new Date(NOW).toISOString()}]};return {rows:[]};}};
  return {client,statements};
 };
 for(const options of [{target:false},{generation:2},{ownerActorId:'other'}]){
  const blocked=make(options);await assert.rejects(owner.purgeInTransaction({client:blocked.client,plan:p,workflowId}),e=>e?.code?.startsWith('RETENTION_'));
  assert.equal(blocked.statements.some(q=>q.sql.startsWith('UPDATE meri_commands.approval_metadata')),false);
 }
 const passed=make(),result=await owner.purgeInTransaction({client:passed.client,plan:p,workflowId});
 assert.equal(result.state,'EXECUTED');assert.equal(result.deleted,0);assert.equal(result.redacted,1);
 const target=passed.statements.find(q=>q.sql.startsWith('SELECT workflow_id'));assert.match(target.sql,/proposal_id=\$4 .*actor_id=\$7 .*xmin=pg_current_xact_id\(\)::xid/u);
 const update=passed.statements.find(q=>q.sql.startsWith('UPDATE meri_commands.approval_metadata'));
 assert.deepEqual(update.params,[subject.tenantId,subject.ownerActorId,subject.subjectId,retained.record.proposalId]);
 assert.match(update.sql,/SET payload=NULL,payload_purged_at=clock_timestamp\(\)/u);
 assert.match(update.sql,/AND payload IS NOT NULL AND payload_purged_at IS NULL/u);
 assert.equal(passed.statements.some(q=>q.sql.startsWith('DELETE')),false);
});
