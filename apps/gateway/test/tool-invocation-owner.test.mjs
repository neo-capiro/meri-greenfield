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

import { bindToolInvocationControl, createToolInvocationControl } from '../../control/tool-invocations.mjs';

// Inert transactional SQL script: no pg or real SQL, no durability claim.
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
  const state = { produced:new Map(), budget:{cap_micro_usd:100,consumed_micro_usd:0,quarantined:false},
    run:{run_id:f.binding.runId,attempt:1,worker_arn:context.qualificationBinding.workerArn,fence:1,policy_revision:policy},
    allocations:new Map(),bindings:new Map(),reservations:new Map(),model:[],commands:[],releases:[],connections:0,now:NOW };
  state.grant={...state.run,grant_id:context.grantId,state:'ACTIVE',capability_sha256:context.capabilitySha256,expires_at:new Date(NOW+10000)};
  const liabilities=()=>[...state.reservations.values()].map(r=>({...r,consumed_micro_usd:r.charged_micro_usd??0}));
  let locked=Promise.resolve();
  const pool={async connect(){state.connections++;let releaseLock,backup,phase='read';return {
    async query(sql,p=[]){
      state.commands.push({sql,p});let rows=[];
      if(sql.includes('budget WHERE id=1 FOR UPDATE')){
        const previous=locked;locked=new Promise(r=>releaseLock=r);await previous;
        backup=structuredClone({budget:state.budget,allocations:state.allocations,bindings:state.bindings,reservations:state.reservations,produced:state.produced});rows=[state.budget];
      }else if(sql==='SELECT clock_timestamp() AS now')rows=[{now:new Date(state.now)}];
      else if(sql==='COMMIT'){
        if(state.parkPhase===phase){state.entered?.();await state.gate;}
        state.afterCommit?.(phase);releaseLock?.();releaseLock=null;
        if(state.loseAck===phase){state.loseAck=null;throw Error('synthetic lost acknowledgement');}
      }else if(sql==='ROLLBACK'){if(backup)Object.assign(state,backup);releaseLock?.();releaseLock=null;}
      else if(sql.startsWith('SELECT * FROM meri_qualification.runs'))rows=[state.run];
      else if(sql.startsWith('SELECT * FROM meri_qualification.grants'))rows=[state.grant];
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations'))rows=state.allocations.has(p[0])?[state.allocations.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_run_allocations'))state.allocations.set(p[0],{run_id:p[0],allocation_sha256:p[1],allocation:structuredClone(p[2]),max_tool_calls:p[3],max_cost_micro_usd:p[4],started_at:new Date(state.now)});
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_grant_bindings'))rows=state.bindings.has(p[0])?[state.bindings.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_grant_bindings'))state.bindings.set(p[0],{grant_id:p[0],run_id:p[1],facts:structuredClone(p[2])});
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_invocations'))rows=[...state.produced.values()].filter(r=>r.run_id===p[0]&&r.producer_key_sha256===p[1]);
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_invocations')){phase='prepare';state.produced.set(p[0],{invocation_id:p[0],run_id:p[1],producer_key_sha256:p[2],delivery:structuredClone(p[3]),facts:structuredClone(p[4]),raw_request_sha256:p[5],operation:structuredClone(p[6]),deadline_ms:p[7],created_at:new Date(state.now),reservation_id:null,arguments_sha256:null,completion:null});}
      else if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET reservation_id')){phase='claim';Object.assign(state.produced.get(p[0]),{reservation_id:p[1],arguments_sha256:p[2]});}
      else if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET completion')){phase='marker';state.produced.get(p[0]).completion=structuredClone(p[1]);}
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_reservations'))rows=state.reservations.has(p[0])?[state.reservations.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_reservations'))state.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:structuredClone(p[4]),operation:structuredClone(p[5]),arguments_sha256:p[6],hold_micro_usd:p[7],max_output_bytes:p[8],state:'UNKNOWN',created_at:new Date(state.now),charged_micro_usd:null,output_bytes:null,settled_at:null});
      else if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd')){phase='settle';state.budget.consumed_micro_usd+=Number(p[0]);}
      else if(sql.startsWith('UPDATE meri_qualification.tool_reservations SET'))Object.assign(state.reservations.get(p[0]),{state:'SETTLED',charged_micro_usd:state.reservations.get(p[0]).hold_micro_usd,output_bytes:p[1],settled_at:new Date(state.now)});
      else if(sql.startsWith('SELECT 1 FROM meri_qualification.budget_liabilities'))rows=liabilities().filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN');
      else if(sql.includes('AS run_total FROM meri_qualification.budget_liabilities'))rows=[{held:liabilities().filter(r=>r.state==='UNKNOWN').reduce((n,r)=>n+r.hold_micro_usd,0),run_total:liabilities().reduce((n,r)=>n+(r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd),0)}];
      else if(sql.startsWith('SELECT count(*) AS calls'))rows=[{calls:state.reservations.size}];
      else if(sql!=='BEGIN'&&!sql.startsWith('SET LOCAL'))throw Error('unmodelled SQL');
      if(state.afterQuery)await state.afterQuery(sql);
      return {rows};
    },release(error){releaseLock?.();releaseLock=null;state.releases.push(error);}
  };}};
  const {invocationId:ignored,...grantContext}=context;
  const producer={namespace:'trusted-control',executionId:'retained-execution'};
  const gateway=()=>createDurableToolDispatch({pool,allocationJson:JSON.stringify(allocation),catalog:{entry:()=>f.entry,discoverable:()=>[]},authority:f.authority,limits,now:()=>f.state.now,newId:randomUUID,sourceEnabled:true});
  const control=()=>bindToolInvocationControl({gateway:gateway(),contextJson:JSON.stringify(grantContext),producerJson:JSON.stringify(producer)});
  const delivery=(deliveryId='delivery-1')=>JSON.stringify({context:grantContext,producer,deliveryId});
  const execute=(signal)=>control().execute(requestJson,credential,'delivery-1',signal);
  const reconcile=()=>control().reconcile(requestJson,'delivery-1');
  return {f,allocation,context,grantContext,producer,state,pool,gateway,control,delivery,execute,reconcile,credential};
}

const row=t=>[...t.state.produced.values()][0];
const effectCount=t=>t.f.calls.filter(x=>x==='handler').length;
async function ready(){const t=setup();await t.control().bindTrustedGrant();return t;}

test('actual control issues stable durable identity, canonical normalization and completion then accounts once',async()=>{
 const t=await ready();const result=await t.execute();assert.equal(JSON.parse(result).data.total,0);assert.equal(effectCount(t),1);
 assert.match(row(t).invocation_id,/^owned_/);assert.equal(row(t).arguments_sha256,canonicalSha256({page:1,limit:10}));
 assert.notEqual(row(t).arguments_sha256,canonicalSha256({}));assert.ok(row(t).completion.resultSha256);
 const a=await t.reconcile(),b=await t.control().reconcile(requestJson,'delivery-1');assert.equal(a.stage,'SETTLED');assert.deepEqual(a,b);
 assert.equal(a.resultDelivered,false);assert.equal(t.state.budget.consumed_micro_usd,10);
 await assert.rejects(t.execute());assert.equal(effectCount(t),1);
});
for(const phase of ['prepare','claim','marker','settle'])test(`lost ${phase} acknowledgement survives reconstructed owner without duplicate effect/charge`,async()=>{
 const t=await ready();t.state.loseAck=phase;await assert.rejects(t.execute());const id=row(t).invocation_id;
 const result=await t.control().reconcile(requestJson,'delivery-1');assert.equal(row(t).invocation_id,id);
 assert.equal(result.stage,phase==='prepare'?'PREPARED':phase==='claim'?'UNKNOWN':'SETTLED');
 assert.equal(effectCount(t),['marker','settle'].includes(phase)?1:0);
 assert.equal(t.state.budget.consumed_micro_usd,['marker','settle'].includes(phase)?10:0);
 await t.reconcile();assert.equal(t.state.budget.consumed_micro_usd,['marker','settle'].includes(phase)?10:0);
 if(phase!=='prepare'){await assert.rejects(t.execute());assert.equal(effectCount(t),['marker','settle'].includes(phase)?1:0);}
});
test('simultaneous deliveries converge to one producer row and one physical handler',async()=>{
 const t=await ready();const results=await Promise.allSettled([t.execute(),t.execute()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(t.state.produced.size,1);assert.equal(t.state.reservations.size,1);assert.equal(effectCount(t),1);assert.equal(t.state.budget.consumed_micro_usd,10);
});
test('same delivery refuses raw request and original-context substitution',async()=>{
 const t=await ready();await t.gateway().prepareInvocation(t.delivery(),requestJson);
 await assert.rejects(t.control().execute(JSON.stringify({operation,arguments:{limit:1}}),t.credential,'delivery-1'));
 t.grantContext.binding={...t.grantContext.binding,attemptId:uuid('9')};await assert.rejects(t.execute());assert.equal(effectCount(t),0);
});
test('owned namespace cannot bypass producer through legacy execute or forInvocation',async()=>{
 const t=await ready(),p=await t.gateway().prepareInvocation(t.delivery(),requestJson);
 await assert.rejects(t.gateway().execute(requestJson,t.credential,p.invocationJson),/OWNED_INVOCATION_REQUIRED/);
 assert.throws(()=>createPostgresToolBudget({pool:t.pool,allocationJson:JSON.stringify(t.allocation)}).forInvocation(p.invocationJson),/OWNED_INVOCATION_REQUIRED/);
 assert.equal(t.state.reservations.size,0);
});
for(const phase of ['prepare','marker'])test(`abort at ${phase} ACK starts no next transaction/effect; explicit reconciliation remains historical`,async()=>{
 const t=await ready(),controller=new AbortController();let atAbort;
 t.state.afterCommit=p=>{if(p===phase){atAbort=t.state.connections;controller.abort();}};
 await assert.rejects(t.execute(controller.signal));assert.equal(effectCount(t),phase==='prepare'?0:1);
 const commands=t.state.commands.filter(c=>c.sql.startsWith('UPDATE meri_qualification.budget'));assert.equal(commands.length,0);
 assert.ok(t.state.connections<=atAbort+1); // Existing UNKNOWN cleanup may inspect, never settle.
 t.state.afterCommit=null;const result=await t.reconcile();assert.equal(result.stage,phase==='prepare'?'PREPARED':'SETTLED');
});
test('UNKNOWN without completion stays held after revoked/expired replacement and cannot dispatch',async()=>{
 const t=await ready();t.state.loseAck='claim';await assert.rejects(t.execute());t.state.grant.state='REVOKED';t.state.grant.expires_at=new Date(NOW-1);t.state.run.fence=2;t.state.budget.quarantined=true;
 assert.equal((await t.reconcile()).stage,'UNKNOWN');assert.equal(t.state.budget.consumed_micro_usd,0);await assert.rejects(t.execute());assert.equal(effectCount(t),0);
});
test('marker-backed historical reconciliation remains exact once after expiry/revocation/quarantine',async()=>{
 const t=await ready();t.state.loseAck='marker';await assert.rejects(t.execute());t.state.grant.state='REVOKED';t.state.grant.expires_at=new Date(NOW-1);t.state.budget.quarantined=true;
 assert.equal((await t.reconcile()).stage,'SETTLED');assert.equal((await t.reconcile()).stage,'SETTLED');assert.equal(t.state.budget.consumed_micro_usd,10);
});
test('foreign completion facts fail without charging unknown liability',async()=>{
 const t=await ready();t.state.loseAck='marker';await assert.rejects(t.execute());row(t).completion.factsSha256='f'.repeat(64);
 await assert.rejects(t.reconcile());assert.equal(t.state.budget.consumed_micro_usd,0);
});
test('production control factory remains source-disabled, constructing inertly and never ending borrowed pool',async()=>{
 const t=setup(),c=createToolInvocationControl({gatewayOptions:{pool:t.pool,allocationJson:JSON.stringify(t.allocation),authorityPorts:t.f.ports,limits,now:()=>NOW,newId:randomUUID},contextJson:JSON.stringify(t.grantContext),producerJson:JSON.stringify(t.producer)});
 assert.equal(t.state.connections,0);await c.bindTrustedGrant();await assert.rejects(c.execute(requestJson,t.credential,'delivery-1'),/UNAVAILABLE/);
 assert.equal(effectCount(t),0);assert.equal((await c.reconcile(requestJson,'delivery-1')).stage,'PREPARED');
});

test('general owner and actual gateway never expose completion submission or owned bound ports',async()=>{
 const t=await ready();const owner=createPostgresToolBudget({pool:t.pool,allocationJson:JSON.stringify(t.allocation)});
 for(const object of [owner,t.gateway(),t.control()])for(const name of ['forOwnedInvocation','bind','settle','recordCompletion','producer'])assert.equal(Object.hasOwn(object,name),false);
 const p=await t.gateway().prepareInvocation(t.delivery(),requestJson);
 assert.throws(()=>owner.forInvocation(p.invocationJson),/OWNED_INVOCATION_REQUIRED/);
 assert.equal((await t.reconcile()).stage,'PREPARED');assert.equal(row(t).completion,null);assert.equal(t.state.budget.consumed_micro_usd,0);
});


test('abort while first live accounting write parks cannot start terminal write; rollback retains marker for explicit recovery',async()=>{
 const t=await ready(),controller=new AbortController();let entered,release,rolledBack;
 const waiting=new Promise(r=>entered=r),gate=new Promise(r=>release=r),rollback=new Promise(r=>rolledBack=r);
 t.state.afterQuery=async sql=>{if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd')){entered();await gate;}if(sql==='ROLLBACK')rolledBack();};
 const pending=t.execute(controller.signal);await waiting;controller.abort();release();await assert.rejects(pending);await rollback;
 assert.equal(t.state.commands.filter(c=>c.sql.startsWith('UPDATE meri_qualification.tool_reservations SET')).length,0);
 assert.equal(t.state.budget.consumed_micro_usd,0);assert.ok(row(t).completion);
 t.state.afterQuery=null;assert.equal((await t.reconcile()).stage,'SETTLED');assert.equal(t.state.budget.consumed_micro_usd,10);
});
test('expired marker acknowledgement cannot start live settlement but preserves historical completion',async()=>{
 const t=await ready();t.state.afterCommit=phase=>{if(phase==='marker')t.f.state.now=NOW+20000;};
 await assert.rejects(t.execute());assert.equal(t.state.budget.consumed_micro_usd,0);assert.ok(row(t).completion);
 t.state.afterCommit=null;assert.equal((await t.reconcile()).stage,'SETTLED');assert.equal(effectCount(t),1);
});
test('preaborted production delivery performs no SQL and effectful delivery ID is inert',async()=>{
 const t=setup(),controller=new AbortController();controller.abort();await assert.rejects(t.execute(controller.signal));assert.equal(t.state.connections,0);
 let hits=0;assert.throws(()=>t.control().execute(requestJson,t.credential,{toJSON(){hits++;}}));assert.equal(hits,0);assert.equal(t.state.connections,0);
});

test('caller options cannot replace the private canonical owner or producer',()=>{
 const t=setup();let called=0;
 for(const key of ['owner','producer'])assert.throws(()=>createDurableToolDispatch({pool:t.pool,allocationJson:JSON.stringify(t.allocation),[key]:{forInvocation(){called++;},bind(){called++;}},catalog:{entry:()=>t.f.entry,discoverable:()=>[]},authority:t.f.authority,limits,now:()=>NOW,newId:randomUUID,sourceEnabled:true}),/GATEWAY_CONFIGURATION/);
 assert.equal(called,0);assert.equal(t.state.connections,0);
});


test('abort during produced reservation checks cannot start reservation INSERT',async()=>{
 const t=await ready(),controller=new AbortController();let entered,release,rolledBack;
 const waiting=new Promise(r=>entered=r),gate=new Promise(r=>release=r),rollback=new Promise(r=>rolledBack=r);
 t.state.afterQuery=async sql=>{if(sql.startsWith('SELECT count(*) AS calls')){entered();await gate;}if(sql==='ROLLBACK')rolledBack();};
 const pending=t.execute(controller.signal);await waiting;controller.abort();release();await assert.rejects(pending);await rollback;
 assert.equal(t.state.commands.filter(c=>c.sql.startsWith('INSERT INTO meri_qualification.tool_reservations')).length,0);
 assert.equal(t.state.reservations.size,0);assert.equal(effectCount(t),0);
});

test('original retained request deadline stops late marker ACK even while grant and schedule remain current',async()=>{
 const t=await ready();t.state.afterCommit=phase=>{if(phase==='marker')t.f.state.now=Number(row(t).deadline_ms)+1;};
 await assert.rejects(t.execute());assert.equal(t.f.state.now,NOW+limits.maxRequestMs+1);
 assert.ok(t.f.state.now<t.state.grant.expires_at.getTime());assert.equal(t.state.budget.consumed_micro_usd,0);
 assert.equal([...t.state.reservations.values()][0].state,'UNKNOWN');assert.ok(row(t).completion);
 assert.equal(t.state.commands.filter(c=>c.sql.startsWith('UPDATE meri_qualification.budget')).length,0);
 t.state.afterCommit=null;assert.equal((await t.reconcile()).stage,'SETTLED');assert.equal(effectCount(t),1);
});
test('new preparation narrows COMMIT guard to shorter retained grant lifetime',async()=>{
 const t=await ready();t.state.grant.expires_at=new Date(NOW+500);
 t.state.afterCommit=phase=>{if(phase==='prepare')t.f.state.now=NOW+501;};
 await assert.rejects(t.execute());assert.equal(Number(row(t).deadline_ms),NOW+500);
 assert.equal(t.state.reservations.size,0);assert.equal(effectCount(t),0);
 t.state.afterCommit=null;assert.equal((await t.reconcile()).stage,'PREPARED');
});
