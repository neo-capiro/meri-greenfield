import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {productFailure} from '../product-access/errors.mjs';
import {createPostgresRunOwner} from './run-owner.mjs';
import {runOwnerFixture} from './run-owner.fixture.mjs';
const rejected=error=>productFailure(error)?.code==='CURRENT_RUN_REFUSED';
const rehash=f=>{f.state.runs.forEach(r=>r.projection_sha256=hash(r.projection));f.state.allocation.record_sha256=hash(f.state.allocation.record);f.state.conversation.projection_sha256=hash(f.state.conversation.projection);};
test('current task observation uses a read-only snapshot and ignores model grant/financial state',async()=>{
 const f=runOwnerFixture();f.state.grants=f.state.grants.filter(g=>g.grant_id!==f.modelGrantId);f.state.bound=f.state.bound.filter(g=>g.grant_id!==f.modelGrantId);
 const current=JSON.parse(await createPostgresRunOwner(f.configuration).currentTaskRun(f.binding,{}));
 assert.deepEqual(current,{binding:f.binding,policyRevision:'d'.repeat(64),deadlineMs:f.expiresAtMs,checkedAtMs:f.state.now});
 assert.equal(f.state.calls[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert(!f.state.calls.some(c=>/FOR UPDATE|advisory|tool_run_allocations|\.budget\b|tenant_budgets/u.test(c.sql)));
 assert(f.state.calls.filter(c=>c.sql.includes('.grants')).every(c=>c.args[0]===f.grantId));
});
for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'])test(`foreign ${field} refuses before SQL`,async()=>{
 const f=runOwnerFixture(),b={...f.binding,[field]:field==='writerFence'?2:field.endsWith('Id')&&!['tenantId','actorId'].includes(field)?'99999999-0000-4000-8000-000000000000':'foreign'};
 await assert.rejects(createPostgresRunOwner(f.configuration).currentRun(b,{}),rejected);assert.equal(f.state.calls.length,0);
});
for(const [label,mutate] of Object.entries({
 owner:f=>{f.state.conversation.owner_actor_id='other';},
 scope:f=>{f.state.conversation.projection.scopes[0].resourceId='99999999-0000-4000-8000-000000000000';},
 runHash:f=>{f.state.runs[0].projection_sha256='0'.repeat(64);},
 closedRange:f=>{f.state.runs[0].sequence_end='3';},
 terminal:f=>{f.state.runs[0].projection.state='completed';},
 preparation:f=>{f.state.allocation.record.state='UNKNOWN';},
 allocationHash:f=>{f.state.allocation.record_sha256='0'.repeat(64);},
 qualificationAttempt:f=>{f.state.qualified.attempt=2;},
 qualificationWorker:f=>{f.state.qualified.worker_arn+='foreign';},
 qualificationFence:f=>{f.state.qualified.fence=2;},
 revokedTask:f=>{f.state.grants[0].state='REVOKED';},
 taskDigest:f=>{f.state.grants[0].capability_sha256='0'.repeat(64);},
 malformedExpiry:f=>{f.state.grants[0].expires_at='not a Date';},
 futureGrantExpiry:f=>{f.state.grants[0].expires_at=new Date(f.expiresAtMs+1);},
 changedBinding:f=>{f.state.bound[0].facts.binding.actorId='other';},
 databaseExpiry:f=>{f.state.now=f.expiresAtMs;},
 futureCreation:f=>{f.state.allocation.record.resource.createdAtMs+=1;},
})){test(`current run refuses ${label}`,async()=>{const f=runOwnerFixture(),owner=createPostgresRunOwner(f.configuration);mutate(f);if(!label.endsWith('Hash'))rehash(f);await assert.rejects(owner.currentRun(f.binding,{}));assert.equal(f.state.effects,0);});}
test('latest writer follows canonical ordering and cannot revive a superseded source',async()=>{
 const f=runOwnerFixture(),source=f.state.runs[0],target=structuredClone(source);source.sequence_end='3';
 target.projection.binding={...target.projection.binding,runId:'99999999-0000-4000-8000-000000000000',writerFence:2};target.run_id=target.projection.binding.runId;target.sequence_base='3';f.state.runs.push(target);rehash(f);
 await assert.rejects(createPostgresRunOwner(f.configuration).currentRun(f.binding,{}),rejected);
});
test('guarded session effect holds canonical locks; nested verifier is read-only and escaped callback closes',async()=>{
 const f=runOwnerFixture(),owner=createPostgresRunOwner(f.configuration);let escaped;
 const result=await owner.withCurrentRun({binding:f.binding},async({client,current})=>{escaped=client;assert.equal(current.allocationSha256,'c'.repeat(64));
  assert.equal(JSON.parse(await owner.currentTaskRun(f.binding,{})).binding.runId,f.binding.runId);
  return (await client.query('SELECT synthetic_session_effect')).rows[0];});
 assert.deepEqual(result,{saved:true});assert.equal(f.state.effects,1);
 await assert.rejects(escaped.query('SELECT synthetic_session_effect'),/EFFECT_CLOSED/);assert.equal(f.state.effects,1);
 const locks=f.state.calls.filter(c=>c.sql.endsWith('FOR UPDATE')).map(c=>c.sql.split(' WHERE ')[0]);
 assert.deepEqual(locks.slice(0,6),['SELECT * FROM meri_conversations.conversations','SELECT * FROM meri_conversations.runs','SELECT * FROM meri_conversations.native_allocations','SELECT * FROM meri_product_budget.runs','SELECT * FROM meri_product_budget.grants','SELECT * FROM meri_product_budget.tool_grant_bindings']);
});
test('fresh post-callback grant and clock checks refuse the result',async()=>{
 for(const mutation of [f=>{f.state.grants[0].state='REVOKED';},f=>{f.state.now=f.expiresAtMs;}]){
  const f=runOwnerFixture();await assert.rejects(createPostgresRunOwner(f.configuration).withCurrentRun({binding:f.binding},async()=>{mutation(f);return 'must not release';}));
  assert.equal(f.state.commits,0);assert(f.state.calls.some(c=>c.sql==='ROLLBACK'));
 }
});
test('callback failures and unawaited SQL never commit; port closes after thrown callback',async()=>{
 const f=runOwnerFixture(),owner=createPostgresRunOwner(f.configuration);let escaped;
 await assert.rejects(owner.withCurrentRun({binding:f.binding},async({client})=>{escaped=client;throw Error('foreign callback');}),/STORE_UNAVAILABLE/);
 await assert.rejects(escaped.query('SELECT synthetic_session_effect'),/EFFECT_CLOSED/);assert.equal(f.state.commits,0);
 const g=runOwnerFixture();let release;g.state.onQuery=sql=>sql==='SELECT synthetic_session_effect'?new Promise(resolve=>{release=()=>resolve({rows:[]});}):undefined;
 const pending=createPostgresRunOwner(g.configuration).withCurrentRun({binding:g.binding},async({client})=>{void client.query('SELECT synthetic_session_effect');setImmediate(()=>release());return 'not released';});
 await assert.rejects(pending,/EFFECT_PENDING/);assert.equal(g.state.commits,0);
});
test('commit or release uncertainty never releases a successful callback result',async()=>{
 for(const option of ['commitUnknown','releaseUnknown']){const f=runOwnerFixture();f.state[option]=true;
  await assert.rejects(createPostgresRunOwner(f.configuration).withCurrentRun({binding:f.binding},async()=>({saved:true})),error=>productFailure(error)?.outcome==='UNKNOWN');}
});
test('deadline crossing during acknowledged commit returns uncertainty, never the effect result',async()=>{
 const f=runOwnerFixture();f.state.onQuery=sql=>{if(sql==='COMMIT')f.state.now=f.expiresAtMs;};
 await assert.rejects(createPostgresRunOwner(f.configuration).withCurrentRun({binding:f.binding},async()=>({saved:true})),error=>productFailure(error)?.outcome==='UNKNOWN');
});
