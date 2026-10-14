/** Next-turn reservation over actual Unix-only PostgreSQL 16: a new prompt in the same conversation after verified completion, capture, retirement and revocation; never a recovery of the old prompt. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';
import {createPostgresConversationStore} from '../postgres-store.mjs';import {createConversationService} from '../service.mjs';import {createNextRunOwner} from '../next-run.mjs';
import {createActionSessionOwner} from '../../action-host/session/owner.mjs';import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';import {versions} from './store-fixture.mjs';
const check=()=>{};
async function fixture(t,{retired=true}={}){const host=process.env.MERI_INSPECTION_TEST_SOCKET,database=process.env.MERI_INSPECTION_TEST_DATABASE;if(host!=='/tmp/meri-prepared-kickoff-pg-20261014/socket'||database!=='meri_inspection_final')throw Error('NEW_OWNED_OPTIONAL_DATABASE_REQUIRED');const pool=new pg.Pool({host,database,user:'postgres',max:6});t.after(()=>pool.end());
 const tenantId='next-run-'+randomUUID(),actorId='actor-'+randomUUID(),conversationId=randomUUID(),clientId=randomUUID(),policyRevision='b'.repeat(64),scopes=[{tenantId,kind:'client',resourceId:clientId,policyRevision}],grantId=randomUUID();
 const contexts=new Map(),store=createPostgresConversationStore({pool}),state={starts:0};
 const sessions=createActionSessionOwner({mode:'process-local',limits:{maxSessions:20,maxRequestMs:3000,maxTtlMs:30000,maxFactBytes:65536},verifyIdentity:async()=>({principal:{tenantId,actorId},identityRevision:'identity1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000}),resolveContext:async({identity,identityCredential})=>{const binding=contexts.get(identityCredential);if(!binding)throw Error('no context');return {identitySha256:hash(identity),binding,scopes,selectedClientId:clientId,contextRevision:'context1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};}});t.after(()=>sessions.close());
 const service=createConversationService({sessions,store,dispatcher:{async start(){state.starts++;},async cancel(){}},versions});
 const retirement={async verifyRetired({binding}){const saved=await store.allocations.read({binding,allocationKey:hash(binding)},check).catch(()=>null);return {physicalStopProven:retired&&saved?.record?.state==='RETIRED'&&saved.record.resource?.physicalStopProven===true};}};
 const revocation={async verifyRevoked({binding}){return {receiptSha256:hash({binding,grantId,revoked:true}),grantIds:[grantId]};}};
 const owner=createNextRunOwner({store,retirement,revocation,versions});
 const run1={tenantId,actorId,conversationId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 async function session(binding){const credential='native-'+randomUUID();contexts.set(credential,binding);return (await sessions.issue({identityCredential:credential,hints:{conversationId}})).credential;}
 const submit=(credential,prompt,requestId=randomUUID())=>service.submit({credential,input:{requestId,prompt}});
 const status=(state,reasonCode=null)=>({eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode}});
 async function complete(binding,final='completed'){await store.append(binding,status('starting'),check);await store.append(binding,status('running'),check);await store.append(binding,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:randomUUID(),text:'turn text'}},check);await store.append(binding,status(final,final==='cancelled'?'USER_CANCELLED':null),check);}
 async function capture(binding){const controlId=randomUUID(),checkpointId=randomUUID(),projection={controlId,intent:'complete',binding},proof={checkpointId,binding,capturedAt:new Date().toISOString(),snapshotSha256:'1'.repeat(64)};await pool.query('INSERT INTO meri_conversations.controls(tenant_id,control_id,conversation_id,run_id,control_sequence,projection,projection_sha256) VALUES($1,$2,$3,$4,(SELECT COALESCE(MAX(control_sequence),0)+1 FROM meri_conversations.controls WHERE tenant_id=$1),$5,$6)',[binding.tenantId,controlId,binding.conversationId,binding.runId,projection,hash(projection)]);await pool.query('INSERT INTO meri_conversations.checkpoints(tenant_id,checkpoint_id,conversation_id,run_id,control_id,proof,proof_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[binding.tenantId,checkpointId,binding.conversationId,binding.runId,controlId,proof,hash(proof)]);return {checkpointId,proofSha256:hash(proof)};}
 async function allocate(binding){const allocationKey=hash(binding),key={binding,allocationKey},expiresAtMs=Date.now()+60000,original={binding,executionKey:allocationKey,executionId:allocationKey,planSha256:'a'.repeat(64),expiresAtMs,versions},intent={...key,original,qualification:{attempt:1,policyRevision},grantIntents:[{grantId,capabilitySha256:'c'.repeat(64),expiresAtMs}],allocationSha256:'d'.repeat(64),taskRequestSha256:'e'.repeat(64),expiresAtMs},resource={taskArn:'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+randomUUID().replaceAll('-',''),clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker',createdAtMs:Date.now()};await store.allocations.claim(intent,check);await store.allocations.record({...key,state:'ALLOCATED',resource},check);return {key,resource};}
 async function retire({key,resource}){await store.allocations.record({...key,state:'RETIRED',resource:{...resource,physicalStopProven:true}},check);}
 const principal={tenantId,actorId};
 return {pool,store,service,owner,sessions,state,run1,scopes,policyRevision,principal,conversationId,session,submit,complete,capture,allocate,retire};
}
test('two prompts in one conversation: the reserved next run continues the conversation-wide sequence base while the wire sequence restarts at 1',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1),first=await f.submit(s1,'first prompt');assert.equal(first.replayed,false);assert.equal(f.state.starts,1);const allocation=await f.allocate(f.run1);
 assert.deepEqual(await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),{binding:f.run1,reserved:false},'a live latest run is bound as is');
 await f.complete(f.run1);await f.capture(f.run1);await f.retire(allocation);
 const selected=await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId});assert.equal(selected.reserved,true);assert.equal(selected.replayed,false);assert.deepEqual(selected.source,f.run1);const target=selected.binding;assert.equal(target.writerFence,2);assert.equal(target.conversationId,f.conversationId);assert.notEqual(target.runId,f.run1.runId);
 const s2=await f.session(target),second=await f.submit(s2,'second prompt');assert.equal(second.replayed,false);assert.deepEqual(second.run.binding,target);assert.equal(second.lastSequence,1);assert.equal(f.state.starts,2);
 const {runs,reservations}=await f.store.nextRuns.listRuns({tenantId:f.run1.tenantId,conversationId:f.conversationId},check);
 assert.deepEqual(runs.map(r=>[r.binding.writerFence,r.state,r.sequenceBase,r.lastSequence]),[[1,'completed',0,5],[2,'queued',5,1]]);assert.deepEqual(reservations,[{source:f.run1,target,state:'ACCEPTED'}]);
 const history=await f.service.history({credential:s2});assert.deepEqual(history.run.binding,target);assert.deepEqual(history.events.map(e=>e.sequence),[1]);assert.equal(history.lastSequence,1);
 assert.equal((await f.submit(s2,'second prompt',second.requestId)).replayed,true,'exact replay of the new prompt is idempotent');
});
test('a pending reservation and a lost acknowledgement recover the same target; changed facts refuse',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1);await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);const checkpoint=await f.capture(f.run1);await f.retire(allocation);
 const a=await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),b=await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId});assert.deepEqual(b.binding,a.binding);assert.equal(b.replayed,true);
 const other={...a.binding,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID()},facts={checkpoint,retirement:{physicalStopProven:true},revocation:{receiptSha256:hash({binding:f.run1,grantId:'x',revoked:true}),grantIds:['g']}};
 const stored=(await f.store.nextRuns.listRuns({tenantId:f.run1.tenantId,conversationId:f.conversationId},check)).reservations[0];
 const replay=await f.store.nextRuns.reserve({source:f.run1,target:other,facts:(await f.store.nextRuns.readTarget(a.binding,check)).facts,scopes:f.scopes,versions,policyRevision:f.policyRevision,reservedAt:new Date().toISOString()},check);assert.deepEqual(replay.target,stored.target);assert.equal(replay.replayed,true,'the stored target wins over a newly proposed one');
 await assert.rejects(f.store.nextRuns.reserve({source:f.run1,target:other,facts,scopes:f.scopes,versions,policyRevision:f.policyRevision,reservedAt:new Date().toISOString()},check),/NEXT_RUN_REPLAY_REFUSED/);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.next_runs WHERE tenant_id=$1',[f.run1.tenantId])).rows[0].n,1);
});
test('the next run needs the latest source completed, captured and retired; cancelled and failed sources do not continue',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1);await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);
 await f.store.append(f.run1,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state:'starting',reasonCode:null}},check);
 assert.deepEqual(await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),{binding:f.run1,reserved:false});
 await f.store.append(f.run1,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state:'running',reasonCode:null}},check);await f.store.append(f.run1,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}},check);
 await assert.rejects(f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),/NEXT_RUN_CHECKPOINT_REQUIRED/);
 const checkpoint=await f.capture(f.run1);await assert.rejects(f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),/NEXT_RUN_RETIREMENT_REQUIRED/);
 const target={...f.run1,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2},facts={checkpoint,retirement:{physicalStopProven:true},revocation:{receiptSha256:'f'.repeat(64),grantIds:['g']}};
 await assert.rejects(f.store.nextRuns.reserve({source:f.run1,target,facts,scopes:f.scopes,versions,policyRevision:f.policyRevision,reservedAt:new Date().toISOString()},check),/NEXT_RUN_RETIREMENT_REQUIRED/,'the journal verifies the retired allocation itself, not the caller claim');
 await assert.rejects(f.owner.selectRun({principal:{tenantId:f.run1.tenantId,actorId:'other'},conversationId:f.conversationId}),/NEXT_RUN_OWNER_REFUSED/);
 await f.retire(allocation);assert.equal((await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})).reserved,true,'once retired the completed source continues');
 const g=await fixture(t),g1=await g.session(g.run1);await g.submit(g1,'first prompt');const gAllocation=await g.allocate(g.run1);await g.complete(g.run1,'cancelled');await g.capture(g.run1);await g.retire(gAllocation);
 await assert.rejects(g.owner.selectRun({principal:g.principal,conversationId:g.conversationId}),/NEXT_RUN_SOURCE_NOT_COMPLETED/);
});
test('the old prompt cannot be recovered through the next run, a completed run takes no new prompt, and the stale session cannot write',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1),first=await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);await f.capture(f.run1);await f.retire(allocation);
 const target=(await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})).binding,s2=await f.session(target);
 await assert.rejects(f.submit(s2,'first prompt',first.requestId),/STALE_WRITER|REQUEST_REPLAY_REFUSED/,'the source request id belongs to the completed run, never to the next one');
 await assert.rejects(f.submit(s1,'another prompt'),/REQUEST_REPLAY_REFUSED/,'a completed run accepts no new request');
 await assert.rejects(f.service.publish({credential:s1,binding:f.run1,event:{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:randomUUID(),text:'late'}}}),/RUN_NOT_WRITABLE/);
 await f.submit(s2,'second prompt');
 await assert.rejects(f.store.nextRuns.reserve({source:f.run1,target:{...target,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID()},facts:(await f.store.nextRuns.readTarget(target,check)).facts,scopes:f.scopes,versions,policyRevision:f.policyRevision,reservedAt:new Date().toISOString()},check),/NEXT_RUN_NOT_LATEST/,'once the next run is accepted its source is no longer the latest run; recovery of the reservation belongs before acceptance');
 assert.deepEqual((await f.owner.currentRun(target)).binding,target);await assert.rejects(f.owner.currentRun(f.run1),/NEXT_RUN_NOT_LATEST/);await assert.rejects(f.owner.currentRun({...target,runId:randomUUID()}),/NEXT_RUN_NOT_LATEST/);
});
test('concurrent selection under the conversation lock yields one reservation',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1);await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);await f.capture(f.run1);await f.retire(allocation);
 const results=await Promise.all([f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),f.owner.selectRun({principal:f.principal,conversationId:f.conversationId}),f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})]);
 assert.equal(new Set(results.map(r=>r.binding.runId)).size,1);assert.equal(results.filter(r=>r.replayed===false).length,1);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.next_runs WHERE tenant_id=$1',[f.run1.tenantId])).rows[0].n,1);
});
test('reservation rows are immutable in SQL and the state cannot regress',async t=>{
 const f=await fixture(t),s1=await f.session(f.run1);await f.submit(s1,'first prompt');const allocation=await f.allocate(f.run1);await f.complete(f.run1);await f.capture(f.run1);await f.retire(allocation);
 const target=(await f.owner.selectRun({principal:f.principal,conversationId:f.conversationId})).binding;
 await assert.rejects(f.pool.query('UPDATE meri_conversations.next_runs SET target_run_id=$2 WHERE tenant_id=$1',[f.run1.tenantId,randomUUID()]),/immutable/);
 await assert.rejects(f.pool.query('DELETE FROM meri_conversations.next_runs WHERE tenant_id=$1',[f.run1.tenantId]),/immutable/);
 const s2=await f.session(target);await f.submit(s2,'second prompt');
 await assert.rejects(f.pool.query("UPDATE meri_conversations.next_runs SET state='RESERVED' WHERE tenant_id=$1",[f.run1.tenantId]),/regress/);
 await assert.rejects(f.pool.query('UPDATE meri_conversations.runs SET sequence_base=-1 WHERE tenant_id=$1',[f.run1.tenantId]));
});
