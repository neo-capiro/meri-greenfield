import test from 'node:test';
import assert from 'node:assert/strict';
import canonicalCatalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import { createHash, randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { createDurableSourceDisabledGateway } from '../index.mjs';
import { createDurableToolDispatch } from '../budget/durable-tool-dispatch.mjs';
import { createPostgresToolBudget } from '../budget/postgres-tool-budget.mjs';
import { fixture, NOW, uuid, limits, operation, requestJson } from './fixtures.mjs';

import { BudgetCommitUncertain } from '../budget/postgres-budget-store.mjs';

// Reuses the original durable-test synthetic fixture with SQL-shaped timestamp/null columns.
// This scripted boundary does not execute SQL or qualify an engine.
function setup() {
  const f = fixture(); const policy = 'a'.repeat(64); const credential = 'synthetic-opaque';
  f.claims.policyRevision = policy; f.claims.scopes[0].policyRevision = policy; f.subject.policyRevision = policy;
  const allocation = { run: Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k => [k,f.binding[k]])),
    manifestSha256:'b'.repeat(64),catalogSha256:canonicalSha256(canonicalCatalog),budgets:{maxTurns:5,maxToolCalls:2,maxRecoveryAttempts:0,maxRuntimeSeconds:10,maxCostMicroUSD:100,maxOutputBytes:65536},
    schedule:{revision:'d'.repeat(64),expiresAt:new Date(NOW+10000).toISOString(),operations:[{operation,chargeMicrousd:10}]} };
  allocation.manifest = {contractVersion:'0.2.0',skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0',prose:{id:'urn:meri:synthetic:budget-prose:1',sha256:'a'.repeat(64)},requiredSources:[{sourceId:'synthetic-source',authority:'authoritative',purpose:'enumeration'}],allowedOperations:[operation],subjectKinds:['personal'],windowBases:['unbounded'],completion:{requireAllSources:true,allowDisclosedPartial:true,negativeClaims:'complete-covered-only',rubric:[{id:'evidence',requirement:'Synthetic budget boundary',evidenceRequired:true}]},approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets:allocation.budgets,versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}};
  allocation.manifestSha256=canonicalSha256(allocation.manifest);
  const context = {invocationId:'trusted-tool-slot',grantId:uuid('8'),binding:f.binding,
    qualificationBinding:{runId:f.binding.runId,attempt:1,workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${'a'.repeat(32)}`,fence:1,policyRevision:policy},
    capabilitySha256:createHash('sha256').update(credential).digest('hex'),allocationSha256:canonicalSha256(allocation)};
  const state = { budget:{cap_micro_usd:100,consumed_micro_usd:0,quarantined:false},
    run:{run_id:f.binding.runId,attempt:1,worker_arn:context.qualificationBinding.workerArn,fence:1,policy_revision:policy},
    allocations:new Map(),bindings:new Map(),reservations:new Map(),model:[],commands:[],releases:[],connections:0,now:NOW };
  state.grant={...state.run,grant_id:context.grantId,state:'ACTIVE',capability_sha256:context.capabilitySha256,expires_at:new Date(NOW+10000)};
  const liabilities = () => [...state.model,...[...state.reservations.values()].map(r=>({...r,kind:'tool',slot:r.invocation_id,consumed_micro_usd:r.charged_micro_usd??0}))];
  const pool = {async connect(){state.connections++;return {async query(sql,p=[]){
    state.commands.push({sql,p});
    if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations')&&state.parkAllocation)await state.allocationGate;
    if(sql==='COMMIT'&&state.parkNextCommit){state.parkNextCommit=false;await state.commitGate;}
    if(sql===state.failAt)throw Error('synthetic SQL loss');
    if(sql==='COMMIT'&&state.beforeCommit)await state.beforeCommit();
    let rows=[];
    if(sql.includes('budget WHERE id=1 FOR UPDATE'))rows=[state.budget];
    else if(sql==='SELECT clock_timestamp() AS now')rows=[{now:new Date(state.now)}];
    else if(sql.startsWith('SELECT * FROM meri_qualification.runs'))rows=[state.run];
    else if(sql.startsWith('SELECT * FROM meri_qualification.grants'))rows=[state.grant];
    else if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations'))rows=state.allocations.has(p[0])?[state.allocations.get(p[0])]:[];
    else if(sql.startsWith('INSERT INTO meri_qualification.tool_run_allocations'))state.allocations.set(p[0],{run_id:p[0],allocation_sha256:p[1],allocation:p[2],max_tool_calls:p[3],max_cost_micro_usd:p[4],started_at:new Date(state.now)});
    else if(sql.startsWith('SELECT * FROM meri_qualification.tool_grant_bindings'))rows=state.bindings.has(p[0])?[state.bindings.get(p[0])]:[];
    else if(sql.startsWith('INSERT INTO meri_qualification.tool_grant_bindings'))state.bindings.set(p[0],{grant_id:p[0],run_id:p[1],facts:p[2]});
    else if(sql.startsWith('SELECT * FROM meri_qualification.tool_reservations'))rows=state.reservations.has(p[0])?[state.reservations.get(p[0])]:[];
    else if(sql.startsWith('SELECT 1 FROM meri_qualification.budget_liabilities'))rows=liabilities().filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN').map(()=>({one:1}));
    else if(sql.includes('AS run_total FROM meri_qualification.budget_liabilities'))rows=[{held:liabilities().filter(r=>r.state==='UNKNOWN').reduce((n,r)=>n+Number(r.hold_micro_usd),0),run_total:liabilities().filter(r=>r.run_id===p[0]).reduce((n,r)=>n+Number(r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd),0)}];
    else if(sql.startsWith('SELECT count(*) AS calls'))rows=[{calls:[...state.reservations.values()].filter(r=>r.run_id===p[0]).length}];
    else if(sql.startsWith('INSERT INTO meri_qualification.tool_reservations')){state.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:p[4],operation:p[5],arguments_sha256:p[6],hold_micro_usd:p[7],max_output_bytes:p[8],state:'UNKNOWN',created_at:new Date(state.now),settled_at:null,charged_micro_usd:null,output_bytes:null});if(state.loseReserveCommit)state.failAt='COMMIT';}
    else if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd'))state.budget.consumed_micro_usd+=Number(p[0]);
    else if(sql.startsWith('UPDATE meri_qualification.tool_reservations SET')){const row=state.reservations.get(p[0]);Object.assign(row,{state:'SETTLED',charged_micro_usd:row.hold_micro_usd,output_bytes:p[1],settled_at:new Date(state.now)});if(state.loseSettleCommit)state.failAt='COMMIT';if(state.parkOnSettle)state.parkNextCommit=true;}
    else if(!['BEGIN','COMMIT','ROLLBACK'].includes(sql)&&!sql.startsWith('SET LOCAL'))throw Error(`Unmodelled SQL ${sql}`);
    return {rows};},release(error){state.releases.push(error);}};}};
  const owner=()=>createPostgresToolBudget({pool,allocationJson:JSON.stringify(allocation)});
  const gateway=()=>createDurableToolDispatch({pool,allocationJson:JSON.stringify(allocation),catalog:{entry:()=>f.entry,discoverable:()=>[f.entry]},authority:f.authority,limits,now:()=>f.state.now,newId:randomUUID,sourceEnabled:true});
  const execute=(changes={})=>gateway().execute(requestJson,credential,JSON.stringify({...context,...changes}));
  const production=()=>createDurableSourceDisabledGateway({pool,allocationJson:JSON.stringify(allocation),authorityPorts:f.ports,limits,now:()=>state.now,newId:randomUUID});
  const bind=()=>{allocation.manifestSha256=canonicalSha256(allocation.manifest);context.allocationSha256=canonicalSha256(allocation);return owner().bindTrustedGrant(JSON.stringify(context));};
  return {f,allocation,context,state,pool,owner,gateway,production,execute,bind,credential};
}

const expected = () => JSON.stringify({operation,argumentsSha256:canonicalSha256({})});
const inspect = t => t.production().readInvocationOutcome(JSON.stringify(t.context),expected());
async function reserved(t) {
  await t.bind();
  await t.owner().forInvocation(JSON.stringify(t.context)).reserve({reservationId:uuid('7'),binding:t.f.binding,
    operation,argumentsSha256:canonicalSha256({}),budgets:t.f.claims.budgets,claims:t.f.claims,deadlineMs:NOW+1000});
}
const writes = t => t.state.commands.filter(({sql})=>/^(INSERT|UPDATE|DELETE)/.test(sql)).length;

test('actual disabled owner exposes readback inertly; execute stays unavailable without SQL',async()=>{
 const t=setup(),d=t.production();assert.equal(typeof d.readInvocationOutcome,'function');assert.equal(t.state.connections,0);
 assert.equal(d.sourceEnabled,false);assert.deepEqual(await d.discover(),[]);
 await assert.rejects(d.execute(requestJson,t.credential,JSON.stringify(t.context)),/UNAVAILABLE/);assert.equal(t.state.connections,0);
});
test('ABSENT is exact immutable observation; a later UNKNOWN row remains possible',async()=>{
 const t=setup();await t.bind();const before=writes(t),r=await inspect(t);
 assert.deepEqual(r,{invocationId:t.context.invocationId,reservationId:null,state:'ABSENT',operation,
  argumentsSha256:canonicalSha256({}),holdMicrousd:null,chargedMicrousd:null,outputBytes:null,observedAtMs:NOW});
 assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.operation));assert.equal(writes(t),before);
 await reserved(t);assert.equal((await inspect(t)).state,'UNKNOWN');assert.equal(t.f.calls.includes('handler'),false);
});
test('unknown reserve ACK readback retains full liability, no replay or automatic dispatch',async()=>{
 const t=setup();await t.bind();t.state.loseReserveCommit=true;
 await assert.rejects(reserved(t),BudgetCommitUncertain);t.state.loseReserveCommit=false;t.state.failAt=undefined;
 const before=writes(t),r=await inspect(t);assert.equal(r.state,'UNKNOWN');assert.equal(r.holdMicrousd,'10');
 assert.equal(r.chargedMicrousd,null);assert.equal(r.outputBytes,null);assert.equal(writes(t),before);
 await assert.rejects(reserved(t),/INVOCATION_ALREADY_USED/);assert.equal(t.state.budget.consumed_micro_usd,0);
});
test('lost settle ACK readback records accounting only and never double charges',async()=>{
 const t=setup();await reserved(t);t.state.loseSettleCommit=true;
 const b=t.owner().forInvocation(JSON.stringify(t.context));await assert.rejects(b.settle({reservationId:uuid('7'),outcome:'completed',outputBytes:1}),BudgetCommitUncertain);
 t.state.loseSettleCommit=false;t.state.failAt=undefined;const before=writes(t),r=await inspect(t);
 assert.equal(r.state,'SETTLED');assert.equal(r.chargedMicrousd,'10');assert.equal(r.outputBytes,1);assert.equal(writes(t),before);
 await assert.rejects(b.settle({reservationId:uuid('7'),outcome:'completed',outputBytes:1}),/SETTLEMENT_ALREADY_RECORDED/);
 assert.equal(t.state.budget.consumed_micro_usd,10);assert.equal(t.f.calls.includes('handler'),false);
});
for(const condition of ['expired','revoked','replaced','quarantined','schedule-expired'])test(`historical ${condition} liability remains observable without authority`,async()=>{
 const t=setup();await reserved(t);
 if(condition==='expired')t.state.grant.expires_at=new Date(NOW-1);
 if(condition==='revoked')t.state.grant.state='REVOKED';
 if(condition==='replaced')t.state.run={...t.state.run,attempt:2,fence:2,worker_arn:t.state.run.worker_arn.replace(/a/g,'b')};
 if(condition==='quarantined')t.state.budget.quarantined=true;
 if(condition==='schedule-expired')t.state.now=NOW+20000;
 const before=writes(t);assert.equal((await inspect(t)).state,'UNKNOWN');assert.equal(writes(t),before);
 await assert.rejects(t.execute({invocationId:'another'}));assert.equal(t.f.calls.includes('handler'),false);
});
for(const [field,value] of [['invocation_id','foreign'],['grant_id',uuid('9')],['run_id',uuid('9')],['reservation_id','bad'],
 ['facts',{}],['operation',{id:'other',version:'0.2.0'}],['arguments_sha256','f'.repeat(64)],['hold_micro_usd','11'],
 ['max_output_bytes','0'],['created_at',new Date(NOW+1)],['charged_micro_usd','10'],['output_bytes',0],['settled_at',new Date(NOW)],['state','NO_DISPATCH']])
 test(`incoherent stored ${field} refuses a historical observation`,async()=>{
 const t=setup();await reserved(t);t.state.reservations.get(t.context.invocationId)[field]=value;const before=writes(t);
 await assert.rejects(inspect(t));assert.equal(writes(t),before);
});
for(const condition of ['allocation','allocation-run','binding','binding-grant','binding-run','grant-capability','grant-policy','missing-binding','pending-grant'])test(`historical ${condition} mismatch refuses even ABSENT`,async()=>{
 const t=setup();await t.bind();const a=t.state.allocations.get(t.context.binding.runId),b=t.state.bindings.get(t.context.grantId);
 if(condition==='allocation')a.allocation_sha256='f'.repeat(64);if(condition==='allocation-run')a.run_id=uuid('9');
 if(condition==='binding')b.facts={};if(condition==='binding-grant')b.grant_id=uuid('9');if(condition==='binding-run')b.run_id=uuid('9');
 if(condition==='grant-capability')t.state.grant.capability_sha256='f'.repeat(64);if(condition==='grant-policy')t.state.grant.policy_revision='f'.repeat(64);
 if(condition==='missing-binding')t.state.bindings.clear();if(condition==='pending-grant')t.state.grant.state='PENDING';
 await assert.rejects(inspect(t));
});
test('closed JSON rejects effectful/non-string/foreign expectations before pool',async()=>{
 const t=setup();let calls=0;const object={toString(){calls++;return expected();}};
 for(const bad of [object,'{}',JSON.stringify({operation,argumentsSha256:'f'.repeat(64),authorized:true})])
  await assert.rejects(t.production().readInvocationOutcome(JSON.stringify(t.context),bad));
 await assert.rejects(t.production().readInvocationOutcome(object,expected()));assert.equal(calls,0);assert.equal(t.state.connections,0);
});
test('read COMMIT uncertainty is propagated without result or automatic retry',async()=>{
 const t=setup();await reserved(t);t.state.failAt='COMMIT';const count=t.state.connections;
 await assert.rejects(inspect(t),BudgetCommitUncertain);assert.equal(t.state.connections,count+1);
 assert.ok(t.state.releases.at(-1) instanceof BudgetCommitUncertain);
});
test('read result is detached from later stored-row mutation',async()=>{
 const t=setup();await reserved(t);const r=await inspect(t);t.state.reservations.get(t.context.invocationId).operation.id='foreign';
 assert.equal(r.operation.id,operation.id);assert.ok(Object.isFrozen(r.operation));
});
