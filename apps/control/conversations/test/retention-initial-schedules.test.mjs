import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture,routineRequest,binding,clientId} from '../../schedules/test/application-fixture.mjs';
import {versions} from './store-fixture.mjs';
import {contentRows} from './retention-content-fixture.mjs';
import {hash} from '../boundary.mjs';
import {decodeConversationInventoryRows} from '../retention-inventory-decode.mjs';
import {decodeConversationContentRows} from '../retention-content-rows.mjs';
import {enumerateReferences} from '../../retention/inventory.mjs';
import {conversationPurgeRow} from '../../retention/conversation-purge-rows.mjs';

async function prepared(operation){
 const producer=await applicationFixture();
 try{
  let request=routineRequest();
  if(operation!=='schedule_task'){
   const created=await producer.prepare();await producer.approve(created);
   const scheduleId=created.proposal.projection.scheduleId;
   request=operation==='update_scheduled_task'?{scheduleId,...routineRequest()}:{scheduleId,mode:'delete',note:'Explicit delete',running:'leave',runs:[]};
  }
  const result=await producer.prepare(request,operation,'retained-initial-schedule');
  assert.equal(result.status,'approval_required');
  const intent=structuredClone([...producer.preparations.state.rows.values()].find(row=>row.outcome?.result?.proposal?.proposalId===result.proposal.proposalId));
  assert.equal(intent.record.argumentsSha256,hash(request),'the existing producer pins the raw request');
  intent.outcome_purged_at=null;intent.settled_at=new Date(producer.now());
  const release=intent.outcome.release;
  assert.deepEqual(Object.keys(intent.outcome.result).sort(),['proposal','status']);
  const initial={schemaVersion:1,state:'ADMITTED',binding:release.binding,selectedClientId:clientId,policyRevision:release.scopes[0].policyRevision,versions,configurationSha256:'a'.repeat(64),createdAtMs:producer.now()-1,expiresAtMs:producer.now()+60000};
  const conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes:release.scopes,policyRevision:initial.policyRevision,createdAt:new Date(initial.createdAtMs).toISOString()};
  const rows=contentRows();rows['meri_conversations.initial_run_bindings']=[{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:release.binding.runId,generation:1,record:initial,record_sha256:hash(initial)}];
  rows['meri_intents.preparations']=[intent];
  return {subject:{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId,ownerActorId:binding.actorId},
   conversation:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,owner_actor_id:binding.actorId,projection:conversation,projection_sha256:hash(conversation)},
   runs:[],events:[],controls:[],checkpoints:[],completionCheckpoints:[],nextRuns:[],memoryContinuations:[],memoryContextRows:[],memoryCandidates:[],contentRows:rows};
 }finally{producer.close();}
}

for(const operation of ['schedule_task','update_scheduled_task','cancel_scheduled_task'])test(`actual initial ${operation} custody is retained without an accepted run`,async()=>{
 const raw=await prepared(operation);
 decodeConversationContentRows(raw.contentRows,{subject:raw.subject,projection:raw.conversation.projection},new Map());
 const decoded=decodeConversationInventoryRows(raw),references=enumerateReferences(decoded);
 assert.deepEqual(decoded.runs,[]);assert.equal(references.rowTargets.length,3);
 assert.equal(decoded.contentRows.length,2);assert.equal(JSON.stringify(decoded).includes('Summarize authorized activity'),false);
 for(const target of decoded.contentRows)conversationPurgeRow(raw.subject,{className:target.className,target}).verify(raw.contentRows[target.table][0]);
});

test('initial schedule custody requires exact initial binding, scope, owner, expiry and canonical proposal',async()=>{
 const original=await prepared('schedule_task');
 for(const mutate of [
  r=>r.contentRows['meri_conversations.initial_run_bindings']=[],
  r=>r.contentRows['meri_intents.preparations'][0].outcome.release.binding.attemptId='10000000-0000-4000-8000-999999999999',
  r=>r.contentRows['meri_intents.preparations'][0].outcome.release.scopes[0].policyRevision='different',
  r=>r.contentRows['meri_intents.preparations'][0].outcome.result.proposal.projection.owner.actorId='different',
  r=>r.contentRows['meri_intents.preparations'][0].outcome.release.expiresAtMs++,
  r=>r.contentRows['meri_intents.preparations'][0].outcome.result.proposal.status='executed',
  r=>r.contentRows['meri_intents.preparations'][0].outcome.result.request=routineRequest(),
  r=>{const row=r.contentRows['meri_intents.preparations'][0];row.record.operation.id='create_word';row.record_sha256=hash(row.record);},
 ]){
  const raw=structuredClone(original);
  // Put expiry exactly at the retained admission boundary before testing +1.
  raw.contentRows['meri_intents.preparations'][0].outcome.release.expiresAtMs=raw.contentRows['meri_conversations.initial_run_bindings'][0].record.expiresAtMs;
  mutate(raw);assert.throws(()=>decodeConversationInventoryRows(raw),/STORE_CORRUPT|INTENT_JOURNAL_STATE/);
 }
});
