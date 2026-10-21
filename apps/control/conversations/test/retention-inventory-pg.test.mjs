/** Disposable PostgreSQL 16 control for the read-only conversation retention
 * producer. The exact private socket/database guard prevents an accidental
 * connection to a product database. No purge or external service is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {createConversationRetentionInventory} from '../retention-inventory.mjs';
import {assertNextRunReservation} from '../next-run-reservation.mjs';
import {enumerateReferences} from '../../retention/inventory.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {versions} from './store-fixture.mjs';

const SOCKET='/tmp/meri-conv-inventory-pg-20261018/socket';
const DATABASE='meri_conv_inventory_fixture';
const enabled=process.env.MERI_CONV_INVENTORY_PG_SOCKET===SOCKET&&
 process.env.MERI_CONV_INVENTORY_PG_DATABASE===DATABASE;
const check=()=>{};
const at=()=>new Date().toISOString();
const status=state=>({eventId:randomUUID(),createdAt:at(),type:'run.status',data:{state,reasonCode:null}});
const completeSnapshot=owner=>({...owner,sdkSessionEntries:[],selectedOutputs:[],artifactVersions:[],
 nativeJournalRows:[],uploads:[],schedules:[],receipts:[],memoryProposals:[],budgetRuns:[]});
const sorted=value=>[...value].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));

function checkpoint({binding,scopes,checkpointId,captureSequence,sourceRequestSha256,contextSha256}){
 const object={objectId:randomUUID(),versionId:'synthetic-immutable-v1',sha256:'a'.repeat(64),bytes:10,scopes};
 const workspace={contractVersion:'0.1.0',manifestId:randomUUID(),binding,logicalCwd:'/workspace/conversation',
  entries:[],scopes,createdAt:at()};
 const saved={contractVersion:'0.1.0',checkpointId,parentCheckpointId:null,binding,sessionId:randomUUID(),
  opaqueSession:object,workspace,workspaceSha256:hash(workspace),versions,lastEventSequence:captureSequence,
  scopes,createdAt:at(),durableReceiptId:randomUUID()};
 return {checkpoint:saved,checkpointSha256:hash(saved),sourceRequestSha256,contextSha256,
  resumeSessionAt:randomUUID(),readReceiptId:randomUUID()};
}

async function insertMemoryRow(pool,{binding,scopes,clientId,policyRevision},cursor){
 const candidate={id:randomUUID(),status:'pending',approvedFact:false,scope:'client',clientId,
  sourceKind:'explicit_user',createdAt:'2026-10-17T00:00:00.000Z',restricted:false,
  title:'Synthetic draft',proposedText:'Synthetic pending memory',contentTruncated:false};
 const page={tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',
  claimsAreApprovedFacts:false,scope:{tenantId:binding.tenantId,userId:binding.actorId,clientId},
  candidates:[candidate],nextCursor:cursor,
  coverage:{firstPage:true,complete:false,reason:'unread_pages_restricted_or_truncated_content'}};
 const key={binding,operation:{id:'memory.list_own_proposals',version:'0.2.0'},policyRevision,
  subject:{kind:'client',entityType:'client',entityIds:[clientId],tenantId:binding.tenantId,
   actorId:binding.actorId,policyRevision,scopes,rosterVersionId:null},cursor};
 const previous={request:{clientId,cursor:null,limit:5},page};
 const recordedAtMs=Date.now(),record={key,previous,previousSha256:hash(previous),
  recordedAtMs,expiresAtMs:recordedAtMs+60000};
 await pool.query('INSERT INTO meri_conversations.memory_proposal_contexts(tenant_id,conversation_id,run_id,key_sha256,record,record_sha256,expires_at_ms) VALUES($1,$2,$3,$4,$5,$6,$7)',
  [binding.tenantId,binding.conversationId,binding.runId,hash(key),record,hash(record),record.expiresAtMs]);
}

async function fixture(pool){
 const tenantId=randomUUID(),actorId=randomUUID(),conversationId=randomUUID(),
  clientId=randomUUID(),policyRevision='b'.repeat(64),scopes=[{tenantId,kind:'client',resourceId:clientId,policyRevision}];
 const binding={tenantId,actorId,conversationId,runId:randomUUID(),attemptId:randomUUID(),
  workerId:randomUUID(),writerFence:1};
 const store=createPostgresConversationStore({pool}),createdAt=at(),
  conversation={conversationId,owner:{tenantId,actorId},scopes,createdAt,policyRevision},
  run={binding,state:'queued',scopes,createdAt,policyRevision,versions},
  request={requestId:randomUUID(),prompt:'synthetic inventory',skill:null,window:null},
  event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt,scopes,
   type:'run.status',data:{state:'queued',reasonCode:null}};
 await store.accept({conversation,run,request,event},check);
 await store.append(binding,status('starting'),check);
 await store.append(binding,status('running'),check);
 for(let i=0;i<34;i++)await store.append(binding,{eventId:randomUUID(),createdAt:at(),
  type:'message.delta',data:{messageId:randomUUID(),text:`synthetic ${i}`}},check);
 const first=await store.completions.begin({binding,scopes,selectedClientId:clientId,
  completionId:randomUUID(),checkpointId:randomUUID()},check);
 const unpublished=await createConversationRetentionInventory({pool}).inventoryForConversation({
  tenantId,conversationId,ownerActorId:actorId});
 const firstProof=checkpoint({binding,scopes,checkpointId:first.checkpointId,
  captureSequence:first.captureSequence,sourceRequestSha256:first.sourceRequestSha256,
  contextSha256:first.contextSha256});
 await store.completions.publish({binding,scopes,selectedClientId:clientId,completionId:first.completionId,
  proof:firstProof,events:[
   {contractVersion:'0.1.0',eventId:first.verifiedEventId,createdAt:at(),type:'checkpoint.verified',
    data:{checkpointId:first.checkpointId}},
   {contractVersion:'0.1.0',eventId:first.completedEventId,createdAt:at(),type:'run.status',
    data:{state:'completed',reasonCode:null}}]},check);
 const firstLast=(await pool.query('SELECT last_sequence FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',
  [tenantId,conversationId,binding.runId])).rows[0].last_sequence;
 await pool.query('UPDATE meri_conversations.runs SET sequence_end=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',
  [tenantId,conversationId,binding.runId,firstLast]);

 const target={...binding,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2},
  targetRun={...run,binding:target,state:'queued',createdAt:at()},
  targetRequest={...request,requestId:randomUUID(),prompt:'synthetic second turn'},
  targetEvent={...event,eventId:randomUUID(),binding:target,createdAt:at()};
 await pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sequence_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9)',
  [tenantId,conversationId,target.runId,targetRun,hash(targetRun),targetRequest.requestId,
   targetRequest,hash(targetRequest),firstLast]);
 await pool.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,1,$4,$5,$6)',
  [tenantId,conversationId,target.runId,targetEvent.eventId,targetEvent,hash(targetEvent)]);
 const reservation=assertNextRunReservation({source:binding,target,
  facts:{checkpoint:{checkpointId:first.checkpointId,proofSha256:hash(firstProof)},
   retirement:{physicalStopProven:true},revocation:{receiptSha256:'c'.repeat(64),grantIds:[randomUUID()]}},
  scopes,versions,policyRevision,reservedAt:at()});
 await pool.query('INSERT INTO meri_conversations.next_runs(tenant_id,conversation_id,source_run_id,target_run_id,reservation,reservation_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7)',
  [tenantId,conversationId,binding.runId,target.runId,reservation,hash(reservation),'ACCEPTED']);
 await store.append(target,status('starting'),check);
 await store.append(target,status('running'),check);
 const controlId=randomUUID(),contextSha256=hash({window:targetRequest.window,skill:targetRequest.skill,scopes});
 const control=await store.lifecycle.begin({binding:target,scopes,selectedClientId:clientId,
  input:{controlId,intent:'pause'},command:{controlId,action:'pause',binding:target,contextSha256}},check);
 await store.lifecycle.claim({binding:target,scopes,selectedClientId:clientId,controlId,
  commandSha256:control.commandSha256},check);
 const heldProof=checkpoint({binding:target,scopes,checkpointId:randomUUID(),
  captureSequence:control.captureSequence,sourceRequestSha256:control.sourceRequestSha256,
  contextSha256:control.contextSha256});
 await store.lifecycle.checkpoint({binding:target,scopes,selectedClientId:clientId,controlId,
  proof:heldProof,events:[
   {contractVersion:'0.1.0',eventId:randomUUID(),createdAt:at(),type:'checkpoint.verified',
    data:{checkpointId:heldProof.checkpoint.checkpointId}},
   {contractVersion:'0.1.0',eventId:randomUUID(),createdAt:at(),type:'run.status',
    data:{state:'paused',reasonCode:'CONTROL_CHECKPOINTED'}}]},check);
 const memory={binding:target,scopes,clientId,policyRevision};
 for(let i=0;i<34;i++)await insertMemoryRow(pool,memory,`page-${String(i).padStart(2,'0')}`);
 return {subject:{tenantId,conversationId,ownerActorId:actorId},binding,target,firstProof,heldProof,
  unpublished,
  memory,store};
}

test('one PostgreSQL snapshot exhausts conversation rows and memory pages, respects ownership, and refuses corruption',
 {skip:!enabled},async t=>{
 const pool=new pg.Pool({host:SOCKET,database:DATABASE,user:'postgres',max:5,
  connectionTimeoutMillis:3000,options:'-c statement_timeout=5000'});
 t.after(()=>pool.end());
 const server=(await pool.query("SELECT current_setting('listen_addresses') AS listen, current_setting('server_version_num')::int AS version")).rows[0];
 assert.equal(server.listen,'');assert.ok(server.version>=160000&&server.version<170000);
 const f=await fixture(pool),inventory=createConversationRetentionInventory({pool});
 const baseline=await inventory.inventoryForConversation(f.subject);
 assert.equal(baseline.runs.length,2);
 assert.equal(baseline.eventRows.length,44,'39 first-turn events and five second-turn events');
 assert.equal(baseline.controls.length,1);
 assert.equal(baseline.checkpoints.length,1);
 assert.equal(baseline.completionCheckpoints.length,1);
 assert.equal(baseline.nextRuns.length,1);
 assert.equal(baseline.memoryContinuations.length,34,'second memory page is complete');
 assert.deepEqual(new Set(baseline.objectVersions.map(o=>o.objectId)),
  new Set([f.firstProof.checkpoint.opaqueSession.objectId,f.heldProof.checkpoint.opaqueSession.objectId]));
 assert.equal(baseline.nextRuns[0].targetRunId,f.target.runId);
 const enumerated=enumerateReferences(completeSnapshot(baseline));
 assert.deepEqual(sorted(enumerated.rowTargets.filter(target=>target.table==='controls')),
  sorted(baseline.controls.map(({controlId,runId,controlSequence,projectionSha256})=>({
   className:'conversation',table:'controls',controlId,runId,controlSequence,projectionSha256}))));
 assert.deepEqual(sorted(enumerated.rowTargets.filter(target=>target.className==='events')),
  sorted(baseline.eventRows.map(({runId,sequence,eventId,eventSha256})=>({
   className:'events',table:'events',runId,sequence,eventId,eventSha256}))));
 assert.equal(enumerated.rowTargets.some(target=>target.className==='events'&&target.key===f.subject.conversationId),
  false,'no conversation-wide event target may replace exact event rows');
 assert.deepEqual(sorted(enumerated.objects.map(({objectId,versionId,sha256})=>({objectId,versionId,sha256}))),
  sorted(baseline.objectVersions),'planner preserves every owner-reported object version');
 const pending=enumerateReferences(completeSnapshot(f.unpublished));
 assert.equal(f.unpublished.completionCheckpoints.length,1);
 assert.equal(f.unpublished.completionCheckpoints[0].state,'CAPTURING');
 assert.equal(f.unpublished.completionCheckpoints[0].checkpoint,null);
 assert.deepEqual(pending.rowTargets.filter(target=>target.className==='completionCheckpoints'),[{
  className:'completionCheckpoints',checkpointId:f.unpublished.completionCheckpoints[0].checkpointId,
  runId:f.binding.runId,state:'CAPTURING'}]);
 assert.deepEqual(pending.objects,[],'unpublished capture supplies no proven object-version reference');
 for(const subject of [
  {...f.subject,ownerActorId:'foreign-actor'},
  {...f.subject,tenantId:'foreign-tenant'},
  {...f.subject,conversationId:randomUUID()}])
  await assert.rejects(inventory.inventoryForConversation(subject));

 let inserted=false;
 const intercept={async connect(){const c=await pool.connect();return {
  async query(sql,args){const result=await c.query(sql,args);
   if(!inserted&&sql.startsWith('SELECT * FROM meri_conversations.events')){
    inserted=true;await insertMemoryRow(pool,f.memory,'after-snapshot');
   }
   return result;
  },release:error=>c.release(error)};}};
 const frozen=await createConversationRetentionInventory({pool:intercept}).inventoryForConversation(f.subject);
 assert.equal(inserted,true);
 assert.equal(frozen.memoryContinuations.length,34,'late row is absent from the shared RR snapshot');
 assert.equal((await inventory.inventoryForConversation(f.subject)).memoryContinuations.length,35,
  'a later snapshot sees the committed row');

 await pool.query('UPDATE meri_conversations.runs SET projection_sha256=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',
  [f.subject.tenantId,f.subject.conversationId,f.target.runId,'0'.repeat(64)]);
 await assert.rejects(inventory.inventoryForConversation(f.subject),/STORE_CORRUPT/);
});

/** Turn 1 completed, turn 2 (its successor) failed, turn 3 reserved and accepted after it: turn 3's reservation names turn 1's
 * published checkpoint, the conversation's latest (O97), or `forge` replaces that checkpoint's proof digest (the rows are immutable,
 * so a corrupt reservation is written as such). Turns 2 and 3 are inserted as the next-run journal leaves them. */
async function afterFailure(pool,{forge=null}={}){
 const tenantId=randomUUID(),actorId=randomUUID(),conversationId=randomUUID(),
  clientId=randomUUID(),policyRevision='b'.repeat(64),scopes=[{tenantId,kind:'client',resourceId:clientId,policyRevision}];
 const store=createPostgresConversationStore({pool}),createdAt=at(),turn=n=>({tenantId,actorId,conversationId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:n});
 const binding=turn(1),conversation={conversationId,owner:{tenantId,actorId},scopes,createdAt,policyRevision},
  run={binding,state:'queued',scopes,createdAt,policyRevision,versions},request={requestId:randomUUID(),prompt:'synthetic first turn',skill:null,window:null},
  event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 await store.accept({conversation,run,request,event},check);
 for(const state of ['starting','running'])await store.append(binding,status(state),check);
 const first=await store.completions.begin({binding,scopes,selectedClientId:clientId,completionId:randomUUID(),checkpointId:randomUUID()},check);
 const proof=checkpoint({binding,scopes,checkpointId:first.checkpointId,captureSequence:first.captureSequence,sourceRequestSha256:first.sourceRequestSha256,contextSha256:first.contextSha256});
 await store.completions.publish({binding,scopes,selectedClientId:clientId,completionId:first.completionId,proof,events:[
  {contractVersion:'0.1.0',eventId:first.verifiedEventId,createdAt:at(),type:'checkpoint.verified',data:{checkpointId:first.checkpointId}},
  {contractVersion:'0.1.0',eventId:first.completedEventId,createdAt:at(),type:'run.status',data:{state:'completed',reasonCode:null}}]},check);
 const lineage={checkpointId:first.checkpointId,proofSha256:hash(proof)};
 const settled=async b=>{const last=Number((await pool.query('SELECT sequence_base+last_sequence AS e FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[tenantId,conversationId,b.runId])).rows[0].e);
  await pool.query('UPDATE meri_conversations.runs SET sequence_end=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[tenantId,conversationId,b.runId,last]);return last;};
 const next=async(source,target,base,prompt,checkpoint=lineage)=>{const r={...run,binding:target,createdAt:at()},q={...request,requestId:randomUUID(),prompt},e={...event,eventId:randomUUID(),binding:target,createdAt:at()};
  await pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sequence_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9)',[tenantId,conversationId,target.runId,r,hash(r),q.requestId,q,hash(q),base]);
  await pool.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,1,$4,$5,$6)',[tenantId,conversationId,target.runId,e.eventId,e,hash(e)]);
  const reservation=assertNextRunReservation({source,target,facts:{checkpoint,retirement:{physicalStopProven:true},revocation:{receiptSha256:'c'.repeat(64),grantIds:[randomUUID()]}},scopes,versions,policyRevision,reservedAt:at()});
  await pool.query('INSERT INTO meri_conversations.next_runs(tenant_id,conversation_id,source_run_id,target_run_id,reservation,reservation_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7)',[tenantId,conversationId,source.runId,target.runId,reservation,hash(reservation),'ACCEPTED']);
  return reservation;};
 const second=turn(2);await next(binding,second,await settled(binding),'synthetic second turn');
 for(const state of ['starting','running'])await store.append(second,status(state),check);
 await store.append(second,{eventId:randomUUID(),createdAt:at(),type:'run.status',data:{state:'failed',reasonCode:'EXECUTION_FAILED'}},check);
 const third=turn(3);await next(second,third,await settled(second),'synthetic third turn',forge===null?lineage:{...lineage,proofSha256:forge});
 return {subject:{tenantId,conversationId,ownerActorId:actorId},binding,second,third};
}

test("after a failed turn, the next reservation naming the last completed turn's checkpoint is inventoried; a forged one is corrupt",
 {skip:!enabled},async t=>{
 const pool=new pg.Pool({host:SOCKET,database:DATABASE,user:'postgres',max:5,connectionTimeoutMillis:3000,options:'-c statement_timeout=5000'});
 t.after(()=>pool.end());
 const f=await afterFailure(pool),inventory=createConversationRetentionInventory({pool});
 const snapshot=await inventory.inventoryForConversation(f.subject);
 assert.equal(snapshot.runs.length,3);assert.equal(snapshot.completionCheckpoints.length,1);
 assert.deepEqual(snapshot.nextRuns.map(r=>[r.sourceRunId,r.targetRunId]).sort(),[[f.binding.runId,f.second.runId],[f.second.runId,f.third.runId]].sort());
 // A structurally valid reservation whose checkpoint proof is not the published one is refused.
 const forged=await afterFailure(pool,{forge:'d'.repeat(64)});
 await assert.rejects(inventory.inventoryForConversation(forged.subject),/STORE_CORRUPT/);
});
