/** Scripted PostgreSQL protocol only. No live database, Core call or credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {storeFixture,binding as baseBinding,scopes as baseScopes,versions,id} from './store-fixture.mjs';
import {hash} from '../boundary.mjs';
import {assertMemoryProposalReadResult} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createSuppressionOwner} from '../../retention/suppression.mjs';
import {scanMemoryProposalContextRows} from '../memory-proposal-context-journal.mjs';

const at=Date.parse('2026-10-18T12:00:00.000Z'),expiry=at+30000;
const binding={...baseBinding,tenantId:id(9),actorId:id(10)};
const scopes=[{...baseScopes[0],tenantId:binding.tenantId}];
const rowKey=p=>p.slice(0,4).join(':');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function transitionLock(){let readers=0,writer=false;const pending=[];
 const wake=()=>{for(let i=0;i<pending.length;){const item=pending[i];if(item.write?(readers!==0||writer):writer){i++;continue;}
  pending.splice(i,1);if(item.write)writer=true;else readers++;
  item.resolve(()=>{if(item.write)writer=false;else readers--;wake();});if(item.write)break;}};
 const acquire=write=>new Promise(resolve=>{pending.push({write,resolve});wake();});
 return {shared:()=>acquire(false),async withTransition(_key,fn){const release=await acquire(true);try{return await fn();}finally{release();}}};
}

function fixture(){
 const base=storeFixture(),rows=new Map(),transition=transitionLock(),state={at,suppressed:false,suppressOnGateCall:null,gateCalls:0,commitUnknown:false,
  ledgerHead:{sequence:0,entrySha256:null},projectedSequence:0,sharedPause:null,advanceHeadOnGateCall:null,events:[]};
 const pool={async connect(){const c=await base.pool.connect();let snapshot;
  return {async query(sql,p=[]){
   if(sql==='BEGIN'||sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')snapshot=structuredClone(rows);
   if(sql.startsWith('SELECT pg_advisory_xact_lock_shared')&&p[0]?.startsWith('meri_retention_transition:')){
    this.releaseTransition=await transition.shared();state.events.push('memory-lock');
    if(state.sharedPause){state.sharedPause.entered.resolve();await state.sharedPause.release.promise;}
    return {rows:[]};
   }
   if(sql==='ROLLBACK'){rows.clear();for(const [key,value] of snapshot)rows.set(key,value);}
   if(sql.includes('meri_conversations.memory_proposal_contexts')){
    if(sql.startsWith('SELECT run_id,key_sha256')){const page=[...snapshot.values()].filter(row=>row.tenant_id===p[0]&&row.conversation_id===p[1]&&
      (p[2]===null||row.run_id>p[2]||row.run_id===p[2]&&row.key_sha256>p[3]))
     .sort((a,b)=>a.run_id.localeCompare(b.run_id)||a.key_sha256.localeCompare(b.key_sha256)).slice(0,33)
     .map(row=>structuredClone(row));return {rows:page,rowCount:page.length};}
    if(sql.startsWith('SELECT *')){const row=rows.get(rowKey(p));return {rows:row?[structuredClone(row)]:[]};}
    if(sql.startsWith('INSERT INTO')){
     const key=rowKey(p);if(rows.has(key))throw Object.assign(Error('duplicate'),{code:'23505'});
     rows.set(key,{tenant_id:p[0],conversation_id:p[1],run_id:p[2],key_sha256:p[3],record:structuredClone(p[4]),record_sha256:p[5],expires_at_ms:p[6]});return {rows:[],rowCount:1};
    }
    throw Error('unexpected proposal context SQL');
   }
   const result=sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'||sql.startsWith('SET LOCAL statement_timeout')?{rows:[]}:await c.query(sql,p);
   if(sql==='COMMIT'||sql==='ROLLBACK'){this.releaseTransition?.();this.releaseTransition=null;
    if(sql==='COMMIT')state.events.push('memory-commit');}
   if(sql==='COMMIT'&&state.commitUnknown)throw Error('synthetic lost commit acknowledgement');
   return result;
  },release(error){this.releaseTransition?.();this.releaseTransition=null;c.release(error);}};
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
  if(state.gateCalls===state.advanceHeadOnGateCall){state.ledgerHead={sequence:2,entrySha256:'f'.repeat(64)};
   state.projectedSequence=2;state.suppressed=false;}
  if(state.ledgerHead.sequence>state.projectedSequence)throw Object.assign(Error('RETENTION_RECOVERY_BARRIER'),{code:'RETENTION_RECOVERY_BARRIER'});
  if(state.suppressed)throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}};
 const store=()=>createPostgresConversationStore({pool,now:()=>state.at,retentionGate:gate,
  retentionHead:async()=>({...state.ledgerHead})});
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
 return {base,rows,state,store,task,record,key,pool,transition};
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

test('suppression and release after commit cannot yield an ABA continuation receipt',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);
 f.state.advanceHeadOnGateCall=2;
 await assert.rejects(ports.retain({record:f.record}),/MEMORY_CONTEXT_REFUSED/);
 assert.equal(f.rows.size,1,'the row committed before the later generation');
});

test('commit uncertainty requires exact readback and never overwrites',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);
 f.state.commitUnknown=true;await assert.rejects(ports.retain({record:f.record}),/STORE_COMMIT_UNKNOWN/);
 assert.equal(f.rows.size,1);f.state.commitUnknown=false;
 const replay=JSON.parse(await ports.retain({record:f.record}));assert.equal(replay.decision,'retained');
 const altered=structuredClone(f.record);altered.previous.page.candidates[0].title='Changed';altered.previousSha256=hash(altered.previous);
 await assert.rejects(ports.retain({record:altered}),/REPLAY_REFUSED/);
});

test('retention inventory lists every exact continuation row including expired rows and refuses corruption',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);
 await ports.retain({record:f.record});
 const subject={tenantId:f.task.binding.tenantId,conversationId:f.task.binding.conversationId};
 f.state.at=expiry+1;
 assert.deepEqual(await f.store().memoryProposalContexts.inventoryForConversation(subject),
  [{runId:f.task.binding.runId,keySha256:hash(f.key)}]);
 const stored=[...f.rows.values()][0];stored.record_sha256='0'.repeat(64);
 await assert.rejects(f.store().memoryProposalContexts.inventoryForConversation(subject),/MEMORY_CONTEXT_REFUSED/);
 await assert.rejects(f.store().memoryProposalContexts.inventoryForConversation({...subject,extra:1}));
});

test('continuation row scanner uses the caller snapshot and checks each page',async()=>{
 const f=fixture(),ports=f.store().memoryProposalContexts.forTask(f.task);
 await ports.retain({record:f.record});
 const subject={tenantId:f.task.binding.tenantId,conversationId:f.task.binding.conversationId};
 const c=await f.pool.connect();let checks=0;const validated=[];
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.deepEqual(await scanMemoryProposalContextRows(c,subject,()=>{checks++;},row=>validated.push(row)),
   [{runId:f.task.binding.runId,keySha256:hash(f.key)}]);
  assert.equal(checks,2);
  assert.deepEqual(validated.map(row=>({runId:row.run_id,keySha256:row.key_sha256})),
   [{runId:f.task.binding.runId,keySha256:hash(f.key)}]);
  await c.query('COMMIT');
 }finally{c.release();}
});

test('retention inventory walks the next exact page after 32 rows',async()=>{
 const f=fixture(),subject={tenantId:f.task.binding.tenantId,conversationId:f.task.binding.conversationId};
 const expected=[];
 for(let n=0;n<35;n++){
  const record=structuredClone(f.record),cursor=`inventory-${n}`;
  record.key.cursor=cursor;record.previous.page.nextCursor=cursor;
  record.previousSha256=hash(record.previous);
  const keySha256=hash(record.key),runId=f.task.binding.runId;
  f.rows.set([subject.tenantId,subject.conversationId,runId,keySha256].join(':'),{
   tenant_id:subject.tenantId,conversation_id:subject.conversationId,run_id:runId,key_sha256:keySha256,
   record,record_sha256:hash(record),expires_at_ms:expiry});
  expected.push({runId,keySha256});
 }
 expected.sort((a,b)=>a.keySha256.localeCompare(b.keySha256));
 assert.deepEqual(await f.store().memoryProposalContexts.inventoryForConversation(subject),expected);
});

test('suppression ledger append serializes with continuation commit in both interleavings',async()=>{
 const make=()=>{const f=fixture(),subject={tenantId:f.task.binding.tenantId,kind:'conversation',
  subjectId:f.task.binding.conversationId,ownerActorId:f.task.binding.actorId};let projection=null;
  const journal={withTransition:(key,fn)=>f.transition.withTransition(key,fn),
   async get(){return projection;},async set(_key,row){projection=row;f.state.projectedSequence=row.ledgerSequence;
    f.state.suppressed=row.state==='SUPPRESSED';return row;}};
  const ledger={async append(){if(f.state.appendPause){f.state.appendPause.entered.resolve();await f.state.appendPause.release.promise;}
    f.state.events.push('ledger-append');f.state.ledgerHead={sequence:1,entrySha256:'f'.repeat(64)};
    return {atMs:f.state.at,sequence:1,entrySha256:'f'.repeat(64)};}};
  const owner=createSuppressionOwner({journal,ledger,ownership:{async ownerOf(){return subject.ownerActorId;}},
   serving:{isEnabled:()=>true,disable(){}},now:()=>f.state.at});
  return {f,subject,owner,principal:{tenantId:subject.tenantId,actorId:subject.ownerActorId}};
 };
 {
  const {f,subject,owner,principal}=make(),ports=f.store().memoryProposalContexts.forTask(f.task);
  f.state.sharedPause={entered:deferred(),release:deferred()};
  const retained=ports.retain({record:f.record});await f.state.sharedPause.entered.promise;
  const suppression=owner.suppress({principal,subject,reason:'owner request'});
  await new Promise(setImmediate);assert.ok(!f.state.events.includes('ledger-append'));
  f.state.sharedPause.release.resolve();await Promise.allSettled([retained,suppression]);
  assert.equal(f.rows.size,1);assert.ok(f.state.events.indexOf('memory-commit')<f.state.events.indexOf('ledger-append'));
 }
 {
  const {f,subject,owner,principal}=make(),ports=f.store().memoryProposalContexts.forTask(f.task);
  f.state.appendPause={entered:deferred(),release:deferred()};
  const suppression=owner.suppress({principal,subject,reason:'owner request'});await f.state.appendPause.entered.promise;
  const retained=ports.retain({record:f.record});await new Promise(setImmediate);
  assert.equal(f.rows.size,0,'no physical insert while the authoritative append is pending');
  f.state.appendPause.release.resolve();await suppression;
  await assert.rejects(retained);assert.equal(f.rows.size,0);
 }
});
