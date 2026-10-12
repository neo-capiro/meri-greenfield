import test from 'node:test';
import assert from 'node:assert/strict';
import canonicalCatalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import { createHash, randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { createDurableSourceDisabledGateway } from '../index.mjs';
import { createDurableToolDispatch } from '../budget/durable-tool-dispatch.mjs';
import { createPostgresToolBudget } from '../budget/postgres-tool-budget.mjs';
import { fixture, NOW, uuid, limits, operation, requestJson } from './fixtures.mjs';

// Deliberate scripted SQL boundary, not a PostgreSQL concurrency/durability fixture.
function setup() {
  const f = fixture(); const policy = 'a'.repeat(64); const credential = 'synthetic-opaque';
  f.claims.policyRevision = policy; f.claims.scopes[0].policyRevision = policy; f.subject.policyRevision = policy;
  const allocation = { run: Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k => [k,f.binding[k]])),
    manifestSha256:'b'.repeat(64),catalogSha256:'c'.repeat(64),budgets:{maxTurns:5,maxToolCalls:2,maxRecoveryAttempts:0,maxRuntimeSeconds:10,maxCostMicroUSD:100,maxOutputBytes:65536},
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
    let rows=[];
    if(sql.includes('budget WHERE id=1 FOR UPDATE'))rows=[state.budget];
    else if(sql==='SELECT clock_timestamp() AS now')rows=[{now:new Date(state.now)}];
    else if(sql.startsWith('SELECT * FROM meri_qualification.runs'))rows=[state.run];
    else if(sql.startsWith('SELECT * FROM meri_qualification.grants'))rows=[state.grant];
    else if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations'))rows=state.allocations.has(p[0])?[state.allocations.get(p[0])]:[];
    else if(sql.startsWith('INSERT INTO meri_qualification.tool_run_allocations'))state.allocations.set(p[0],{run_id:p[0],allocation_sha256:p[1],allocation:p[2],max_tool_calls:p[3],max_cost_micro_usd:p[4],started_at:new Date(state.now)});
    else if(sql.startsWith('SELECT * FROM meri_qualification.tool_grant_bindings'))rows=state.bindings.has(p[0])?[state.bindings.get(p[0])]:[];
    else if(sql.startsWith('INSERT INTO meri_qualification.tool_grant_bindings'))state.bindings.set(p[0],{facts:p[2]});
    else if(sql.startsWith('SELECT * FROM meri_qualification.tool_reservations'))rows=state.reservations.has(p[0])?[state.reservations.get(p[0])]:[];
    else if(sql.startsWith('SELECT 1 FROM meri_qualification.budget_liabilities'))rows=liabilities().filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN').map(()=>({one:1}));
    else if(sql.includes('AS run_total FROM meri_qualification.budget_liabilities'))rows=[{held:liabilities().filter(r=>r.state==='UNKNOWN').reduce((n,r)=>n+Number(r.hold_micro_usd),0),run_total:liabilities().filter(r=>r.run_id===p[0]).reduce((n,r)=>n+Number(r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd),0)}];
    else if(sql.startsWith('SELECT count(*) AS calls'))rows=[{calls:[...state.reservations.values()].filter(r=>r.run_id===p[0]).length}];
    else if(sql.startsWith('INSERT INTO meri_qualification.tool_reservations')){state.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:p[4],operation:p[5],arguments_sha256:p[6],hold_micro_usd:p[7],max_output_bytes:p[8],state:'UNKNOWN'});if(state.loseReserveCommit)state.failAt='COMMIT';}
    else if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd'))state.budget.consumed_micro_usd+=Number(p[0]);
    else if(sql.startsWith('UPDATE meri_qualification.tool_reservations SET')){const row=state.reservations.get(p[0]);Object.assign(row,{state:'SETTLED',charged_micro_usd:row.hold_micro_usd,output_bytes:p[1]});if(state.loseSettleCommit)state.failAt='COMMIT';if(state.parkOnSettle)state.parkNextCommit=true;}
    else if(!['BEGIN','COMMIT','ROLLBACK'].includes(sql)&&!sql.startsWith('SET LOCAL'))throw Error(`Unmodelled SQL ${sql}`);
    return {rows};},release(error){state.releases.push(error);}};}};
  const owner=()=>createPostgresToolBudget({pool,allocationJson:JSON.stringify(allocation)});
  const gateway=()=>createDurableToolDispatch({pool,allocationJson:JSON.stringify(allocation),catalog:{entry:()=>f.entry,discoverable:()=>[f.entry]},authority:f.authority,limits,now:()=>f.state.now,newId:randomUUID,sourceEnabled:true});
  const execute=(changes={})=>gateway().execute(requestJson,credential,JSON.stringify({...context,...changes}));
  const bind=()=>{allocation.manifestSha256=canonicalSha256(allocation.manifest);context.allocationSha256=canonicalSha256(allocation);return owner().bindTrustedGrant(JSON.stringify(context));};
  return {f,allocation,context,state,pool,owner,gateway,execute,bind,credential};
}

test('actual dispatcher uses persistent SQL slot and settles fixed charge once',async()=>{
 const t=setup();await t.bind();const result=JSON.parse(await t.execute());assert.equal(result.data.total,0);
 assert.equal(t.f.calls.filter(x=>x==='handler').length,1);const row=t.state.reservations.get(t.context.invocationId);
 assert.equal(row.state,'SETTLED');assert.equal(row.charged_micro_usd,10);assert.equal(t.state.budget.consumed_micro_usd,10);
 assert.equal(row.arguments_sha256,canonicalSha256({page:1,limit:10}));assert.equal(t.state.commands.filter(x=>x.sql.startsWith('INSERT INTO meri_qualification.tool_reservations')).length,1);
 await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);assert.equal(t.f.calls.filter(x=>x==='handler').length,1);
});
test('lost reserve commit acknowledgement blocks handler and retains UNKNOWN on fresh owner replay',async()=>{
 const t=setup();await t.bind();t.state.loseReserveCommit=true;await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);
 assert.equal(t.f.calls.includes('handler'),false);assert.equal(t.state.reservations.get(t.context.invocationId).state,'UNKNOWN');
 t.state.loseReserveCommit=false;t.state.failAt=undefined;await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);assert.equal(t.f.calls.includes('handler'),false);
});
test('lost settlement acknowledgement and cleanup preserve terminal charge',async()=>{
 const t=setup();await t.bind();t.state.loseSettleCommit=true;await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);
 assert.equal(t.state.reservations.get(t.context.invocationId).state,'SETTLED');assert.equal(t.state.budget.consumed_micro_usd,10);
 t.state.failAt=undefined;await t.owner().forInvocation(JSON.stringify(t.context)).markUncertain(t.state.reservations.get(t.context.invocationId).reservation_id);
 assert.equal(t.state.reservations.get(t.context.invocationId).state,'SETTLED');
});
for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'])test(`trusted ${field} substitution denies before handler`,async()=>{
 const t=setup();await t.bind();const binding={...t.context.binding,[field]:field==='writerFence'?2:field.endsWith('Id')&&field!=='tenantId'&&field!=='actorId'?uuid('9'):'foreign'};
 await assert.rejects(t.execute({binding}));assert.equal(t.f.calls.includes('handler'),false);
});
test('wrong capability and policy mapping refuse before handler',async()=>{
 const t=setup();await t.bind();await assert.rejects(t.execute({capabilitySha256:'e'.repeat(64)}),/ACCESS_DENIED/);
 await assert.rejects(t.execute({qualificationBinding:{...t.context.qualificationBinding,policyRevision:'e'.repeat(64)}}),/ACCESS_DENIED/);assert.equal(t.f.calls.includes('handler'),false);
});
for(const condition of ['expired','revoked','stale','schedule','missing-binding'])test(`${condition} durable admission denies effect`,async()=>{
 const t=setup();await t.bind();if(condition==='expired')t.state.grant.expires_at=new Date(NOW);if(condition==='revoked')t.state.grant.state='REVOKED';if(condition==='stale')t.state.run={...t.state.run,fence:2};if(condition==='schedule')t.state.now=NOW+10001;if(condition==='missing-binding')t.state.bindings.clear();
 await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);assert.equal(t.f.calls.includes('handler'),false);
});
test('shared global model UNKNOWN liability refuses over-cap and allows exact bound',async()=>{
 const t=setup();await t.bind();t.state.budget.consumed_micro_usd=20;t.state.model=[{run_id:uuid('9'),grant_id:uuid('9'),state:'UNKNOWN',hold_micro_usd:71}];
 await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);assert.equal(t.f.calls.includes('handler'),false);
 t.state.model[0].hold_micro_usd=70;await t.execute();assert.equal(t.state.budget.consumed_micro_usd,30);
});
test('shared run model settled and UNKNOWN liability enforce installed run cap',async()=>{
 const t=setup();t.allocation.budgets.maxCostMicroUSD=50;t.context.allocationSha256=canonicalSha256(t.allocation);await t.bind();
 t.state.model=[{run_id:t.context.binding.runId,grant_id:uuid('9'),state:'SETTLED',consumed_micro_usd:20},{run_id:t.context.binding.runId,grant_id:uuid('9'),state:'UNKNOWN',hold_micro_usd:21}];
 await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);t.state.model[1].hold_micro_usd=20;await t.execute();
});
test('narrow capability cost and private tool count cannot be widened',async()=>{
 const t=setup();await t.bind();t.f.claims.budgets.maxCostMicrousd=9;await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);
 t.f.claims.budgets.maxCostMicrousd=100;await t.execute();await t.execute({invocationId:'second'});
 await assert.rejects(t.execute({invocationId:'third'}),/BUDGET_UNCERTAIN/);assert.equal(t.f.calls.filter(x=>x==='handler').length,2);
});
test('missing schedule refuses; trusted JSON rejects object/getter without executing it',()=>{
 const t=setup();t.allocation.schedule.operations=[];assert.throws(t.gateway);
 let touched=0;const bad={get schedule(){touched++;throw Error('private');}};assert.throws(()=>createPostgresToolBudget({pool:t.pool,allocationJson:bad}));assert.equal(touched,0);
});
test('historical exact settlement survives revocation and cleanup does not grant authority',async()=>{
 const t=setup();await t.bind();const bound=t.owner().forInvocation(JSON.stringify(t.context));
 await bound.reserve({reservationId:uuid('7'),binding:t.f.binding,operation,argumentsSha256:canonicalSha256({}),budgets:t.f.claims.budgets,claims:t.f.claims,deadlineMs:NOW+1000});
 t.state.grant.state='REVOKED';await bound.settle({reservationId:uuid('7'),outcome:'completed',outputBytes:1});await bound.markUncertain(uuid('7'));
 assert.equal(t.state.budget.consumed_micro_usd,10);await assert.rejects(t.execute({invocationId:'new'}));
});
test('default source-disabled composition creates no database work or handler call',async()=>{
 const t=setup();const d=createDurableToolDispatch({pool:t.pool,allocationJson:JSON.stringify(t.allocation),catalog:{entry:()=>t.f.entry,discoverable:()=>[]},authority:t.f.authority,limits,now:()=>NOW,newId:()=>uuid('7')});
 await assert.rejects(d.execute(requestJson,t.credential,JSON.stringify(t.context)),/UNAVAILABLE/);assert.equal(t.state.connections,0);assert.equal(t.f.calls.includes('handler'),false);
});

test('actual manifest body/hash/budgets/allowed-operation consistency is mandatory',()=>{
 for(const change of [t=>t.allocation.manifestSha256='f'.repeat(64),t=>t.allocation.budgets={...t.allocation.budgets,maxToolCalls:99},t=>{t.allocation.manifest.allowedOperations=[{id:'other.operation',version:'0.2.0'}];t.allocation.manifestSha256=canonicalSha256(t.allocation.manifest);}]){
  const t=setup();change(t);assert.throws(t.gateway);assert.equal(t.state.connections,0);
 }
});

for(const stage of ['handler','settlement'])test(`private runtime deadline stops parked ${stage} and preserves liability`,async()=>{
 const t=setup();await t.bind();const installed=t.state.allocations.get(t.context.binding.runId);installed.started_at=new Date(NOW-9950);
 let release;const gate=new Promise(resolve=>release=resolve);
 if(stage==='handler')t.f.entry.execute=async()=>{t.f.calls.push('handler');await gate;return JSON.stringify(t.f.output);};
 else {t.state.parkOnSettle=true;t.state.commitGate=gate;}
 const began=performance.now();await assert.rejects(t.execute(),/DEADLINE|BUDGET_UNCERTAIN/);assert.ok(performance.now()-began<1500);
 const row=t.state.reservations.get(t.context.invocationId);assert.ok(row);assert.equal(row.hold_micro_usd,10);assert.ok(['UNKNOWN','SETTLED'].includes(row.state));
 release();await new Promise(resolve=>setImmediate(resolve));assert.equal(t.f.calls.filter(x=>x==='handler').length,1);
});
test('unknown replay with fresh reservation and changed arguments never repeats handler',async()=>{
 const t=setup();await t.bind();t.f.entry.execute=async()=>{t.f.calls.push('handler');throw Error('synthetic output loss');};
 await assert.rejects(t.execute());const first=t.state.reservations.get(t.context.invocationId).reservation_id;
 await assert.rejects(t.gateway().execute(JSON.stringify({operation,arguments:{limit:2}}),t.credential,JSON.stringify(t.context)));
 assert.equal(t.state.reservations.get(t.context.invocationId).reservation_id,first);assert.equal(t.f.calls.filter(x=>x==='handler').length,1);
});

test('canonical entry composes concrete budget and remains inert/unavailable without pool work',async()=>{
 const t=setup();t.allocation.catalogSha256=canonicalSha256(canonicalCatalog);t.context.allocationSha256=canonicalSha256(t.allocation);const options={authorityPorts:t.f.ports,pool:t.pool,allocationJson:JSON.stringify(t.allocation),limits,now:()=>NOW,newId:randomUUID};
 const d=createDurableSourceDisabledGateway(options);assert.equal(d.sourceEnabled,false);assert.match(d.status,/DURABLE_BUDGET/);assert.deepEqual(await d.discover(),[]);
 await assert.rejects(d.execute(requestJson,t.credential,JSON.stringify(t.context)),/UNAVAILABLE/);assert.equal(t.state.connections,0);
 assert.throws(()=>createDurableSourceDisabledGateway({...options,sourceEnabled:true}),/GATEWAY_CONFIGURATION/);
 assert.throws(()=>createDurableSourceDisabledGateway({...options,allocationJson:JSON.stringify({...t.allocation,catalogSha256:'f'.repeat(64)})}),/GATEWAY_CONFIGURATION/);assert.equal(t.state.connections,0);
});

test('replacement attempt retains original UNKNOWN and cannot reuse trusted invocation slot',async()=>{
 const t=setup();await t.bind();t.f.entry.execute=async()=>{t.f.calls.push('handler');throw Error('synthetic unknown');};await assert.rejects(t.execute());
 const old=t.state.reservations.get(t.context.invocationId);assert.equal(old.state,'UNKNOWN');
 t.context.grantId=uuid('9');t.context.binding.attemptId=uuid('a');t.context.binding.workerId=uuid('b');t.context.binding.writerFence=2;t.context.qualificationBinding.attempt=2;t.context.qualificationBinding.fence=2;t.f.state.fence=2;
 t.state.run={...t.state.run,attempt:2,fence:2};t.state.grant={...t.state.grant,...t.state.run,grant_id:t.context.grantId};await t.bind();
 await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);assert.equal(t.state.reservations.get(t.context.invocationId),old);assert.equal(old.state,'UNKNOWN');assert.equal(t.f.calls.filter(x=>x==='handler').length,1);
});
test('narrow private output limit retains UNKNOWN and returns no oversized result',async()=>{
 const t=setup();t.allocation.budgets.maxOutputBytes=1;await t.bind();await assert.rejects(t.execute(),/BUDGET_UNCERTAIN/);
 assert.equal(t.state.reservations.get(t.context.invocationId).state,'UNKNOWN');assert.equal(t.state.budget.consumed_micro_usd,0);
});

for(const expiry of ['grant','schedule'])test(`earlier ${expiry} expiry stops parked handler`,async()=>{
 const t=setup();if(expiry==='schedule')t.allocation.schedule.expiresAt=new Date(NOW+50).toISOString();await t.bind();if(expiry==='grant')t.state.grant.expires_at=new Date(NOW+50);
 let release;const gate=new Promise(resolve=>release=resolve);t.f.entry.execute=async()=>{t.f.calls.push('handler');await gate;return JSON.stringify(t.f.output);};
 const start=performance.now();await assert.rejects(t.execute(),/DEADLINE|BUDGET_UNCERTAIN/);assert.ok(performance.now()-start<1500);assert.equal(t.state.reservations.get(t.context.invocationId).state,'UNKNOWN');release();await new Promise(resolve=>setImmediate(resolve));
});

test('known grant expiry is published before a later allocation SQL read can park',async()=>{
 const t=setup();await t.bind();t.state.grant.expires_at=new Date(NOW+50);let release;t.state.allocationGate=new Promise(resolve=>release=resolve);t.state.parkAllocation=true;
 const start=performance.now();await assert.rejects(t.execute(),/DEADLINE|BUDGET_UNCERTAIN/);assert.ok(performance.now()-start<1500);assert.equal(t.f.calls.includes('handler'),false);
 release();await new Promise(resolve=>setImmediate(resolve));assert.equal(t.f.calls.includes('handler'),false);
});

test('known schedule expiry is published before the first authority port can park',async()=>{
 const t=setup();t.allocation.schedule.expiresAt=new Date(NOW+50).toISOString();await t.bind();let release;const gate=new Promise(resolve=>release=resolve);const identify=t.f.authority.identify;
 t.f.authority={...t.f.authority,async identify(call){await gate;return identify(call);}};
 const initialConnections=t.state.connections;const start=performance.now();await assert.rejects(t.execute(),/DEADLINE/);assert.ok(performance.now()-start<1500);assert.equal(t.state.connections,initialConnections);assert.equal(t.f.calls.includes('handler'),false);
 release();await new Promise(resolve=>setImmediate(resolve));
});
