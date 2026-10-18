/** Scripted PostgreSQL protocol only. No live database, Core call or credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {storeFixture,binding as baseBinding,scopes as baseScopes,versions,id} from './store-fixture.mjs';
import {hash} from '../boundary.mjs';
import {assertMemoryProposalReadResult} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';

const at=Date.parse('2026-10-18T12:00:00.000Z'),expiry=at+30000;
const binding={...baseBinding,tenantId:id(9),actorId:id(10)};
const scopes=[{...baseScopes[0],tenantId:binding.tenantId}];
const rowKey=p=>p.slice(0,4).join(':');

function fixture(){
 const base=storeFixture(),rows=new Map(),state={at,suppressed:false,suppressOnGateCall:null,gateCalls:0,commitUnknown:false};
 const pool={async connect(){const c=await base.pool.connect();let snapshot;
  return {async query(sql,p=[]){
   if(sql==='BEGIN')snapshot=structuredClone(rows);
   if(sql==='ROLLBACK'){rows.clear();for(const [key,value] of snapshot)rows.set(key,value);}
   if(sql.includes('meri_conversations.memory_proposal_contexts')){
    if(sql.startsWith('SELECT *')){const row=rows.get(rowKey(p));return {rows:row?[structuredClone(row)]:[]};}
    if(sql.startsWith('INSERT INTO')){
     const key=rowKey(p);if(rows.has(key))throw Object.assign(Error('duplicate'),{code:'23505'});
     rows.set(key,{tenant_id:p[0],conversation_id:p[1],run_id:p[2],key_sha256:p[3],record:structuredClone(p[4]),record_sha256:p[5],expires_at_ms:p[6]});return {rows:[],rowCount:1};
    }
    throw Error('unexpected proposal context SQL');
   }
   const result=await c.query(sql,p);
   if(sql==='COMMIT'&&state.commitUnknown)throw Error('synthetic lost commit acknowledgement');
   return result;
  },release:error=>c.release(error)};
 }};
 const createdAt=new Date(at).toISOString(),run={binding,state:'running',scopes,createdAt,policyRevision:scopes[0].policyRevision,versions},
  request={requestId:id(6),prompt:'synthetic',skill:null,window:null},conversation={conversationId:binding.conversationId,
   owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt,policyRevision:scopes[0].policyRevision};
 base.state.runs.set([binding.tenantId,binding.conversationId,binding.runId].join(':'),{
  tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,
  projection:run,projection_sha256:hash(run),request_id:request.requestId,request,request_sha256:hash(request),
  last_sequence:1,sequence_end:null,hold_control_id:null,hold_completion_id:null});
 base.state.conversations.set([binding.tenantId,binding.conversationId].join(':'),{
  tenant_id:binding.tenantId,conversation_id:binding.conversationId,owner_actor_id:binding.actorId,
  projection:conversation,projection_sha256:hash(conversation)});
 const original={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),
  expiresAtMs:expiry,versions};
 const allocation={binding,allocationKey:original.executionKey,original,allocationSha256:'b'.repeat(64),
  qualification:{attempt:1,policyRevision:scopes[0].policyRevision},grantIntents:[{grantId:id(11),
   capabilitySha256:'c'.repeat(64),expiresAtMs:expiry}],taskRequestSha256:'d'.repeat(64),expiresAtMs:expiry,
  state:'ADMITTED',resource:{taskArn:'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+('e'.repeat(32)),
   clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',
   taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/MeriSynthetic:1',
   containerName:'worker',createdAtMs:at-1000,grantFactsJsons:[],
   launchBinding:{preparationId:id(12),descriptorSha256:'f'.repeat(64),configTreeSha256:'0'.repeat(64),state:'STARTED'}}};
 base.state.allocations.set([binding.tenantId,binding.conversationId,binding.runId].join(':'),{
  tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record:allocation,record_sha256:hash(allocation)});
 const gate={async assertServable(subject){state.gateCalls++;assert.deepEqual(subject,{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId});
  if(state.gateCalls===state.suppressOnGateCall)state.suppressed=true;
  if(state.suppressed)throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}};
 const store=()=>createPostgresConversationStore({pool,now:()=>state.at,retentionGate:gate});
 const task={binding,clientId:id(5),policyRevision:scopes[0].policyRevision,expiresAtMs:expiry};
 const subject={kind:'client',entityType:'client',entityIds:[task.clientId],tenantId:binding.tenantId,
  actorId:binding.actorId,policyRevision:task.policyRevision,scopes,rosterVersionId:null};
 const page={tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',claimsAreApprovedFacts:false,
  scope:{tenantId:binding.tenantId,userId:binding.actorId,clientId:task.clientId},
  candidates:[{id:id(7),status:'pending',approvedFact:false,scope:'client',clientId:task.clientId,
   sourceKind:'explicit_user',createdAt:'2026-10-17T00:00:00.000Z',restricted:false,title:'Draft',
   proposedText:'A pending memory',contentTruncated:false}],nextCursor:'synthetic-next',
  coverage:{firstPage:true,complete:false,reason:'unread_pages_restricted_or_truncated_content'}};
 const key={binding,operation:{id:'memory.list_own_proposals',version:'0.2.0'},policyRevision:task.policyRevision,
  subject,cursor:page.nextCursor};
 const previous={request:{clientId:task.clientId,cursor:null,limit:5},page};
 const record={key,previous,previousSha256:hash(previous),recordedAtMs:at,expiresAtMs:expiry};
 return {base,rows,state,store,task,record,key,pool};
}

test('task-bound journal retains exact page once and survives owner reconstruction',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);
 const first=JSON.parse(await ports.retain({record:f.record})),replay=JSON.parse(await ports.retain({record:f.record}));
 assert.equal(f.rows.size,1);assert.deepEqual(first,replay);assert.equal(first.decision,'retained');
 const loaded=JSON.parse(await f.store().memoryProposalContexts.forTask(f.task).loadPrevious({key:f.key}));
 assert.deepEqual(loaded.record,f.record);assert.equal(loaded.checkedAtMs,f.state.at);assert.equal(f.state.gateCalls,6);
});

test('three-page continuation retains the second page using its durable predecessor',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);
 const second=structuredClone(f.record),firstRow=f.record.previous.page.candidates[0];
 second.previous.request.cursor=f.key.cursor;
 second.previous.page.candidates=[{...firstRow,id:id(8),createdAt:'2026-10-16T00:00:00.000Z'}];
 second.previous.page.coverage.firstPage=false;
 second.previous.page.nextCursor='synthetic-third';
 second.key.cursor=second.previous.page.nextCursor;
 second.previousSha256=hash(second.previous);
 await assert.rejects(ports.retain({record:second}),/MEMORY_CONTEXT_REFUSED/,'page two cannot be invented without the first page');
 await ports.retain({record:f.record});await ports.retain({record:second});
 const loaded=JSON.parse(await f.store().memoryProposalContexts.forTask(f.task).loadPrevious({key:second.key}));
 assert.deepEqual(loaded.record,second);
 const third={...second.previous.page,
  candidates:[{...firstRow,id:id(9),createdAt:'2026-10-15T00:00:00.000Z'}],nextCursor:null};
 const subject={...f.key.subject,authorizationDecisionId:'00000000-0000-4000-8000-000000000000'};
 assert.deepEqual(assertMemoryProposalReadResult(third,{clientId:f.task.clientId,cursor:second.key.cursor,limit:5},
  {subject,previous:loaded.record.previous}),
  {kind:'partial',claimsAreApprovedFacts:false,evidenceReady:false,negativeAssertion:'none'});
});

test('schema-valid ten-row UTF-8 page larger than 64 KiB stays within journal bound',async()=>{
 const f=fixture(),record=structuredClone(f.record),template=record.previous.page.candidates[0];
 record.previous.page.candidates=Array.from({length:10},(_,n)=>({...template,id:id(30-n),
  title:'漢'.repeat(200),proposedText:'漢'.repeat(2000)}));
 record.previous.request.limit=10;
 record.previousSha256=hash(record.previous);
 assert.ok(Buffer.byteLength(JSON.stringify(record),'utf8')>65536);
 const ports=f.store().memoryProposalContexts.forTask(f.task);
 await ports.retain({record});assert.deepEqual(JSON.parse(await ports.loadPrevious({key:f.key})).record,record);
});

test('replay refuses different content, even with a recomputed previous hash',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);await ports.retain({record:f.record});
 const next=structuredClone(f.record);next.previous.page.candidates[0].title='Changed';next.previousSha256=hash(next.previous);
 await assert.rejects(ports.retain({record:next}),/REPLAY_REFUSED/);assert.equal(f.rows.size,1);
 assert.deepEqual(JSON.parse(await ports.loadPrevious({key:f.key})).record,f.record);
});

test('current run, actor/client/policy, allocation, gate and expiry fence both paths',async()=>{
 const mutate=[
  f=>{f.task={...f.task,binding:{...f.task.binding,writerFence:2}};},
  f=>{f.base.state.runs.values().next().value.projection.state='cancelled';},
  f=>{f.base.state.runs.values().next().value.hold_control_id=id(8);},
  f=>{const r=f.base.state.runs.values().next().value;r.projection={...r.projection,scopes:[{...r.projection.scopes[0],resourceId:id(8)}]};r.projection_sha256=hash(r.projection);},
  f=>{const r=f.base.state.runs.values().next().value;r.projection.policyRevision='changed';r.projection_sha256=hash(r.projection);},
  f=>{f.base.state.conversations.values().next().value.owner_actor_id='different';},
  f=>{f.base.state.allocations.values().next().value.record.state='UNKNOWN';},
  f=>{const a=f.base.state.allocations.values().next().value;a.record.resource.launchBinding.state='CLAIMED';a.record_sha256=hash(a.record);},
  f=>{f.state.suppressed=true;},
  f=>{f.state.at=expiry;},
 ];
 for(const change of mutate){const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);await ports.retain({record:f.record});change(f);
  if(f.task.binding.writerFence!==binding.writerFence){const stale=f.store().memoryProposalContexts.forTask(f.task);
   await assert.rejects(stale.loadPrevious({key:f.key}));await assert.rejects(stale.retain({record:f.record}));}
  else {await assert.rejects(ports.loadPrevious({key:f.key}));await assert.rejects(ports.retain({record:f.record}));}
 }
});

test('missing canonical retention gate refuses before pool acquisition',()=>{
 const f=fixture(),unbound=createPostgresConversationStore({pool:f.pool,now:()=>f.state.at});
 assert.throws(()=>unbound.memoryProposalContexts.forTask(f.task),/MEMORY_CONTEXT_CONFIGURATION/);
 assert.equal(f.base.state.calls.length,0);
});

test('suppression after insert withholds receipt and all replay until reopened',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);f.state.suppressOnGateCall=2;
 await assert.rejects(ports.retain({record:f.record}),/RETENTION_SUPPRESSED/);
 assert.equal(f.rows.size,1);await assert.rejects(ports.loadPrevious({key:f.key}),/RETENTION_SUPPRESSED/);
 f.state.suppressed=false;assert.deepEqual(JSON.parse(await ports.loadPrevious({key:f.key})).record,f.record);
});

test('commit uncertainty requires exact readback and never overwrites',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);
 f.state.commitUnknown=true;await assert.rejects(ports.retain({record:f.record}),/STORE_COMMIT_UNKNOWN/);
 assert.equal(f.rows.size,1);f.state.commitUnknown=false;
 const replay=JSON.parse(await ports.retain({record:f.record}));assert.equal(replay.decision,'retained');
 const altered=structuredClone(f.record);altered.previous.page.candidates[0].title='Changed';altered.previousSha256=hash(altered.previous);
 await assert.rejects(ports.retain({record:altered}),/REPLAY_REFUSED/);
});
