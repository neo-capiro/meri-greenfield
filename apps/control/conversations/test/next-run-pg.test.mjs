/** Next-turn reservation over actual Unix-only PostgreSQL 16: a new prompt in the same conversation after verified completion, capture and settled invocation; never a recovery of the old prompt. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';
import {createPostgresConversationStore} from '../postgres-store.mjs';import {createConversationService} from '../service.mjs';import {createNextRunOwner} from '../next-run.mjs';
import {createActionSessionOwner} from '../../action-host/session/owner.mjs';import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';import {createExecutionBinding} from '../execution-boundary.mjs';
import {versions} from './store-fixture.mjs';
const check=()=>{};
async function fixture(t){const host=process.env.MERI_INSPECTION_TEST_SOCKET,database=process.env.MERI_INSPECTION_TEST_DATABASE;if(host!=='/tmp/meri-prepared-kickoff-pg-20261014/socket'||database!=='meri_inspection_final')throw Error('NEW_OWNED_OPTIONAL_DATABASE_REQUIRED');const pool=new pg.Pool({host,database,user:'postgres',max:6});t.after(()=>pool.end());
 const tenantId='next-run-'+randomUUID(),actorId='actor-'+randomUUID(),conversationId=randomUUID(),clientId=randomUUID(),policyRevision='b'.repeat(64),scopes=[{tenantId,kind:'client',resourceId:clientId,policyRevision}];
 const contexts=new Map(),store=createPostgresConversationStore({pool}),state={starts:0};
 const sessions=createActionSessionOwner({mode:'process-local',limits:{maxSessions:20,maxRequestMs:3000,maxTtlMs:30000,maxFactBytes:65536},verifyIdentity:async()=>({principal:{tenantId,actorId},identityRevision:'identity1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000}),resolveContext:async({identity,identityCredential})=>{const binding=contexts.get(identityCredential);if(!binding)throw Error('no context');return {identitySha256:hash(identity),binding,scopes,selectedClientId:clientId,contextRevision:'context1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};}});t.after(()=>sessions.close());
 const service=createConversationService({sessions,store,dispatcher:{async start(){state.starts++;},async cancel(){}},versions});
 const owner=createNextRunOwner({store,versions});
 await pool.query('INSERT INTO meri_settings.tenant_settings(tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd) VALUES($1,1,$2,$3,clock_timestamp(),$4,100000000)',[tenantId,{},hash({}),actorId]);
 const run1={tenantId,actorId,conversationId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const fences=new Map();
 async function session(binding){const credential='native-'+randomUUID();contexts.set(credential,binding);const issued=(await sessions.issue({identityCredential:credential,hints:{conversationId}})).credential;fences.set(issued,binding.writerFence);return issued;}
 // A conversation's first run is admitted through its initial input (service.allocateInput, migrations 0016/0017) before submit; a reserved
 // next run is submitted directly.
 async function submit(credential,prompt,requestId=randomUUID()){const input={requestId,prompt};if(fences.get(credential)===1)await service.allocateInput({credential,input});return service.submit({credential,input});}
 const status=(state,reasonCode=null)=>({eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode}});
 async function complete(binding,final='completed'){await store.append(binding,status('starting'),check);await store.append(binding,status('running'),check);await store.append(binding,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:randomUUID(),text:'turn text'}},check);if(final==='completed')await capture(binding);else await store.append(binding,status(final,final==='cancelled'?'USER_CANCELLED':null),check);}
 async function capture(binding){const key={binding,scopes,selectedClientId:clientId},old=await store.completions.read(key,check);if(old?.state==='PUBLISHED')return {checkpointId:old.checkpointId,proofSha256:hash(old.proof)};const saved=await store.read(binding,{},check);if(saved.run.state!=='running')return null;const p=await store.completions.begin({...key,completionId:randomUUID(),checkpointId:randomUUID()},check);
  const object={objectId:randomUUID(),versionId:'synthetic-immutable-v1',sha256:'1'.repeat(64),bytes:10,scopes},workspace={contractVersion:'0.1.0',manifestId:randomUUID(),binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt:new Date().toISOString()},checkpoint={contractVersion:'0.1.0',checkpointId:p.checkpointId,parentCheckpointId:null,binding,sessionId:randomUUID(),opaqueSession:object,workspace,workspaceSha256:hash(workspace),versions,lastEventSequence:p.captureSequence,scopes,createdAt:new Date().toISOString(),durableReceiptId:randomUUID()},proof={checkpoint,checkpointSha256:hash(checkpoint),sourceRequestSha256:p.sourceRequestSha256,contextSha256:p.contextSha256,resumeSessionAt:randomUUID(),readReceiptId:randomUUID()};
  const events=[{contractVersion:'0.1.0',eventId:p.verifiedEventId,createdAt:new Date().toISOString(),type:'checkpoint.verified',data:{checkpointId:p.checkpointId}},{contractVersion:'0.1.0',eventId:p.completedEventId,createdAt:new Date().toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}}];await store.completions.publish({...key,completionId:p.completionId,proof,events},check);return {checkpointId:p.checkpointId,proofSha256:hash(proof)};}
 async function allocate(binding){const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:'next-turn'},expiresAtMs:Date.now()+60000,runtimeSessionId:'conversation-'+hash({tenantId,actorId,conversationId})});await store.executions.claim(identity,check);return {binding};}
 async function settle({binding}){const saved=await store.executions.read(binding,check);return store.executions.record({binding,executionId:hash(binding),phase:'settled',native:{state:saved.run.state}},check);}
 const principal={tenantId,actorId};
 return {pool,store,service,owner,sessions,state,run1,scopes,policyRevision,principal,conversationId,session,submit,complete,capture,allocate,settle};
}
test('two prompts in one conversation: the reserved next run continues the conversation-wide sequence base while the wire sequence restarts at 1',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1),first=await f.submit(s1,'first prompt');assert.equal(first.replayed,false);assert.equal(f.state.starts,1);const allocation=await f.allocate(f.run1);
 assert.deepEqual(await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),{binding:f.run1,reserved:false},'a live latest run is bound as is');
 await f.complete(f.run1);await f.capture(f.run1);await f.settle(allocation);
 const selected=await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId});assert.equal(selected.reserved,true);assert.equal(selected.replayed,false);assert.deepEqual(selected.source,f.run1);const target=selected.binding;assert.equal(target.writerFence,2);assert.equal(target.conversationId,f.conversationId);assert.notEqual(target.runId,f.run1.runId);
 const s2=await f.session(target),second=await f.submit(s2,'second prompt');assert.equal(second.replayed,false);assert.deepEqual(second.run.binding,target);assert.equal(second.lastSequence,1);assert.equal(f.state.starts,2);
 const {runs,reservations}=await f.store.nextRuns.listRuns({tenantId:f.run1.tenantId,conversationId:f.conversationId},check);
 assert.deepEqual(runs.map(r=>[r.binding.writerFence,r.state,r.sequenceBase,r.lastSequence]),[[1,'completed',0,6],[2,'queued',6,1]]);assert.deepEqual(reservations,[{source:f.run1,target,state:'ACCEPTED'}]);
 const history=await f.service.history({credential:s2});assert.deepEqual(history.run.binding,target);assert.deepEqual(history.events.map(e=>e.sequence),[1]);assert.equal(history.lastSequence,1);
 assert.equal((await f.submit(s2,'second prompt',second.requestId)).replayed,true,'exact replay of the new prompt is idempotent');
});
test('a pending reservation recovers the same target; changed facts refuse',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1);await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);const checkpoint=await f.capture(f.run1);await f.settle(allocation);
 const a=await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),b=await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId});assert.deepEqual(b.binding,a.binding);assert.equal(b.replayed,true);
 const other={...a.binding,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID()},facts={checkpoint,execution:{recordSha256:'f'.repeat(64)}};
 const stored=(await f.store.nextRuns.listRuns({tenantId:f.run1.tenantId,conversationId:f.conversationId},check)).reservations[0];
 const replay=await f.store.nextRuns.reserve({source:f.run1,target:other,facts:(await f.store.nextRuns.readTarget(a.binding,check)).facts,scopes:f.scopes,versions,policyRevision:f.policyRevision,reservedAt:new Date().toISOString()},check);assert.deepEqual(replay.target,stored.target);assert.equal(replay.replayed,true,'the stored target wins over a newly proposed one');
 await assert.rejects(f.store.nextRuns.reserve({source:f.run1,target:other,facts,scopes:f.scopes,versions,policyRevision:f.policyRevision,reservedAt:new Date().toISOString()},check),/NEXT_RUN_REPLAY_REFUSED/);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.next_runs WHERE tenant_id=$1',[f.run1.tenantId])).rows[0].n,1);
});
test('genuine completion and invocation settlement are mandatory; claimed failed/cancelled runs stay fenced until settled',async t=>{
 const missing=await fixture(t);await missing.submit(await missing.session(missing.run1),'no checkpoint');for(const state of ['starting','running','completed'])await missing.store.append(missing.run1,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},check);await assert.rejects(missing.owner.selectRun({principal:missing.principal,conversationId:missing.conversationId}),/NEXT_RUN_CHECKPOINT_REQUIRED/);
 const f=await fixture(t);await f.submit(await f.session(f.run1),'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);
 await assert.rejects(f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),/NEXT_RUN_EXECUTION_UNSETTLED/);
 await f.settle(allocation);assert.equal((await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})).reserved,true);
 for(const final of ['cancelled','failed']){const g=await fixture(t);await g.submit(await g.session(g.run1),'unsuccessful turn');await g.allocate(g.run1);await g.complete(g.run1,final);await assert.rejects(g.owner.selectRun({principal:g.principal,conversationId:g.conversationId}),/NEXT_RUN_EXECUTION_UNSETTLED/);}
});

test('the old prompt cannot be recovered through the next run, a completed run takes no new prompt, and the stale session cannot write',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1),first=await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);await f.capture(f.run1);await f.settle(allocation);
 const target=(await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})).binding,s2=await f.session(target);
 await assert.rejects(f.submit(s2,'first prompt',first.requestId),/STALE_WRITER|REQUEST_REPLAY_REFUSED/,'the source request id belongs to the completed run, never to the next one');
 await assert.rejects(f.submit(s1,'another prompt'),/REQUEST_REPLAY_REFUSED/,'a completed run accepts no new request');
 await assert.rejects(f.service.publish({credential:s1,binding:f.run1,event:{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:randomUUID(),text:'late'}}}),/RUN_NOT_WRITABLE/);
 await f.submit(s2,'second prompt');
 await assert.rejects(f.store.nextRuns.reserve({source:f.run1,target:{...target,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID()},facts:(await f.store.nextRuns.readTarget(target,check)).facts,scopes:f.scopes,versions,policyRevision:f.policyRevision,reservedAt:new Date().toISOString()},check),/NEXT_RUN_NOT_LATEST/,'once the next run is accepted its source is no longer the latest run; recovery of the reservation belongs before acceptance');
 assert.deepEqual((await f.owner.currentRun(target)).binding,target);await assert.rejects(f.owner.currentRun(f.run1),/NEXT_RUN_NOT_LATEST/);await assert.rejects(f.owner.currentRun({...target,runId:randomUUID()}),/NEXT_RUN_NOT_LATEST/);
});
test('concurrent selection under the conversation lock yields one reservation',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1);await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);await f.capture(f.run1);await f.settle(allocation);
 const results=await Promise.all([f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})]);
 assert.equal(new Set(results.map(r=>r.binding.runId)).size,1);assert.equal(results.filter(r=>r.replayed===false).length,1);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.next_runs WHERE tenant_id=$1',[f.run1.tenantId])).rows[0].n,1);
});
test('reservation rows are immutable in SQL and the state cannot regress',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1);await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);await f.capture(f.run1);await f.settle(allocation);
 const target=(await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})).binding;
 await assert.rejects(f.pool.query('UPDATE meri_conversations.next_runs SET target_run_id=$2 WHERE tenant_id=$1',[f.run1.tenantId,randomUUID()]),/immutable/);
 await assert.rejects(f.pool.query('DELETE FROM meri_conversations.next_runs WHERE tenant_id=$1',[f.run1.tenantId]),/immutable/);
 const s2=await f.session(target);await f.submit(s2,'second prompt');
 await assert.rejects(f.pool.query("UPDATE meri_conversations.next_runs SET state='RESERVED' WHERE tenant_id=$1",[f.run1.tenantId]),/regress/);
 await assert.rejects(f.pool.query('UPDATE meri_conversations.runs SET sequence_base=-1 WHERE tenant_id=$1',[f.run1.tenantId]));
});


test('actual COMMIT acknowledgment loss preserves one reserved target without redispatch',async t=>{
 const f=await fixture(t);await f.submit(await f.session(f.run1),'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);await f.settle(allocation);const r={source:f.run1,target:{...f.run1,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2},facts:{checkpoint:await f.store.nextRuns.latestCheckpoint(f.run1,check),execution:await f.store.nextRuns.settlement(f.run1,check)},scopes:f.scopes,versions,policyRevision:f.policyRevision,reservedAt:new Date().toISOString()};let lose=true;
 const pool={async connect(){const client=await f.pool.connect();return {async query(...args){const result=await client.query(...args);if(args[0]==='COMMIT'&&lose){lose=false;throw Error('lost acknowledgment after actual COMMIT');}return result;},release:error=>client.release(error)};}};
 const unknown=createPostgresConversationStore({pool}),input={source:r.source,target:r.target,facts:r.facts,scopes:r.scopes,versions:r.versions,policyRevision:r.policyRevision,reservedAt:r.reservedAt};await assert.rejects(unknown.nextRuns.reserve(input,check),/STORE_COMMIT_UNKNOWN/);assert.deepEqual((await f.store.nextRuns.readTarget(r.target,check)).target,r.target);assert.equal((await f.store.nextRuns.reserve(input,check)).replayed,true);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.next_runs WHERE tenant_id=$1',[f.run1.tenantId])).rows[0].n,1);assert.equal(f.state.starts,1);
});

test('three accepted prompts refuse historical run 2 and SQL protects closed event ranges',async t=>{
 const f=await fixture(t);await f.submit(await f.session(f.run1),'first prompt');let current=f.run1,second;
 for(const prompt of ['second prompt','third prompt']){const allocation=await f.allocate(current);await f.complete(current);await f.settle(allocation);current=(await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})).binding;await f.submit(await f.session(current),prompt);second??=current;}
 await assert.rejects(f.owner.currentRun(second),/NEXT_RUN_NOT_LATEST/);assert.deepEqual((await f.owner.currentRun(current)).binding,current);
 await assert.rejects(f.pool.query('UPDATE meri_conversations.runs SET last_sequence=last_sequence+1 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[second.tenantId,second.conversationId,second.runId]),/closed/);
 const saved=await f.store.nextRuns.execution({binding:current,scopes:f.scopes,selectedClientId:f.scopes[0].resourceId},check);assert.equal(saved.nextTurn.sourceRequest.prompt,'second prompt');assert.equal('continuation' in saved,false);
});
// O97: a stop or an error never erases the conversation. After a failed or cancelled turn the next prompt continues the conversation's
// latest published checkpoint (turn 1's), through the canonical SQL of the next-run owner and journal.
for(const final of ['failed','cancelled'])test(`turn 1 completes and turn 2 is ${final}: turn 3 continues turn 1's checkpoint`,async t=>{
 const f=await fixture(t),select=()=>f.owner.selectRun({principal:f.principal,conversationId:f.conversationId});
 await f.submit(await f.session(f.run1),'first prompt');const first=await f.allocate(f.run1);await f.complete(f.run1);await f.settle(first);const published=await f.capture(f.run1);
 const second=(await select()).binding;await f.submit(await f.session(second),'second prompt');const allocation=await f.allocate(second);await f.complete(second,final);await f.settle(allocation);
 const third=(await select()).binding;assert.equal(third.writerFence,3);await f.submit(await f.session(third),'third prompt');
 const row=(await f.pool.query('SELECT reservation FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3',[third.tenantId,third.conversationId,third.runId])).rows[0];
 assert.deepEqual(row.reservation.facts.checkpoint,published,"the reservation names turn 1's published checkpoint");
 const saved=await f.store.nextRuns.execution({binding:third,scopes:f.scopes,selectedClientId:f.scopes[0].resourceId},check);
 assert.equal(saved.nextTurn.checkpoint.checkpointId,published.checkpointId);assert.deepEqual(saved.nextTurn.checkpoint.binding,f.run1);assert.equal(saved.nextTurn.sourceRequest.prompt,'first prompt');
});
