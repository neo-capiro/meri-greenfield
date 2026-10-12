// Inert independent SQL-script boundary; no pg import, socket or database execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root,'explicit source root required');
const load=path=>import(pathToFileURL(`${root}/${path}`));
export const {canonicalSha256}=await load('packages/contracts/validate.mjs');
export const {fixture,NOW,uuid,operation,limits,requestJson}=await load('apps/gateway/test/fixtures.mjs');
const {createPostgresToolBudget}=await load('apps/gateway/budget/postgres-tool-budget.mjs');
const {createDurableSourceDisabledGateway}=await load('apps/gateway/index.mjs');
const catalog=(await import(pathToFileURL(`${root}/packages/contracts/retrieval-0.2/catalog.json`),{with:{type:'json'}})).default;
export const {BudgetCommitUncertain}=await load('apps/gateway/budget/postgres-budget-store.mjs');
export function harness() {
  const f=fixture(),policy='a'.repeat(64),credential='synthetic-outcome';
  f.claims.policyRevision=policy;
  const budgets={maxTurns:5,maxToolCalls:3,maxRecoveryAttempts:0,maxRuntimeSeconds:10,maxCostMicroUSD:100,maxOutputBytes:65536};
  const manifest={contractVersion:'0.2.0',skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0',
    prose:{id:'urn:meri:synthetic:outcome-review:1',sha256:'a'.repeat(64)},requiredSources:[{sourceId:'synthetic-source',authority:'authoritative',purpose:'enumeration'}],
    allowedOperations:[operation],subjectKinds:['personal'],windowBases:['unbounded'],
    completion:{requireAllSources:true,allowDisclosedPartial:true,negativeClaims:'complete-covered-only',rubric:[{id:'evidence',requirement:'Synthetic accounting only',evidenceRequired:true}]},
    approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets,
    versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}};
  const allocation={run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,f.binding[k]])),
    manifest,manifestSha256:canonicalSha256(manifest),catalogSha256:canonicalSha256(catalog),budgets,
    schedule:{revision:'b'.repeat(64),expiresAt:new Date(NOW+10000).toISOString(),operations:[{operation,chargeMicrousd:10}]}};
  const invocation={invocationId:'review-retained-invocation',grantId:uuid('8'),binding:f.binding,
    qualificationBinding:{runId:f.binding.runId,attempt:1,workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${'a'.repeat(32)}`,fence:1,policyRevision:policy},
    capabilitySha256:createHash('sha256').update(credential).digest('hex'),allocationSha256:canonicalSha256(allocation)};
  const q=invocation.qualificationBinding;
  let state={budget:{id:1,cap_micro_usd:'10000000',consumed_micro_usd:'0',quarantined:false},
    run:{run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision},
    grant:{grant_id:invocation.grantId,run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision,
      capability_sha256:invocation.capabilitySha256,state:'ACTIVE',expires_at:new Date(NOW+10000)},allocation:null,grantBinding:null,reservations:new Map()};
  let chain=Promise.resolve(),clock=NOW,lose=false,failQuery=null,park=null;
  const commands=[],releases=[];
  const pool={async connect(){let local,unlock;return {
    async query(sql,p=[]){
      commands.push({sql,p});const rows=values=>({rows:values,rowCount:values.length});
      if(failQuery&&sql.includes(failQuery))throw Error('SYNTHETIC_QUERY_FAILURE');
      if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return rows([]);
      if(sql.includes('budget WHERE id=1 FOR UPDATE')){const previous=chain;chain=new Promise(r=>{unlock=r;});await previous;local=structuredClone(state);return rows([local.budget]);}
      if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(clock)}]);
      if(sql==='COMMIT'){state=local;local=null;if(lose){lose=false;throw Error('SYNTHETIC_COMMIT_ACK_LOSS');}return rows([]);}
      if(sql==='ROLLBACK'){local=null;return rows([]);}
      if(park&&sql.includes(park.pattern)){park.reached();await park.wait;}
      if(sql.startsWith('SELECT * FROM meri_qualification.runs'))return rows(local.run?[local.run]:[]);
      if(sql.startsWith('SELECT * FROM meri_qualification.grants'))return rows(local.grant?[local.grant]:[]);
      if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations'))return rows(local.allocation?[local.allocation]:[]);
      if(sql.startsWith('SELECT * FROM meri_qualification.tool_grant_bindings'))return rows(local.grantBinding?[local.grantBinding]:[]);
      if(sql.startsWith('SELECT * FROM meri_qualification.tool_reservations'))return rows(local.reservations.has(p[0])?[local.reservations.get(p[0])]:[]);
      if(sql.startsWith('INSERT INTO meri_qualification.tool_run_allocations')){local.allocation={run_id:p[0],allocation_sha256:p[1],allocation:structuredClone(p[2]),max_tool_calls:String(p[3]),max_cost_micro_usd:String(p[4]),started_at:new Date(clock)};return rows([]);}
      if(sql.startsWith('INSERT INTO meri_qualification.tool_grant_bindings')){local.grantBinding={grant_id:p[0],run_id:p[1],facts:structuredClone(p[2])};return rows([]);}
      if(sql.startsWith('SELECT 1 FROM meri_qualification.budget_liabilities'))return rows([...local.reservations.values()].filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN').map(()=>({one:1})));
      if(sql.includes(' AS run_total')){const rs=[...local.reservations.values()];return rows([{held:String(rs.filter(r=>r.state==='UNKNOWN').reduce((a,r)=>a+BigInt(r.hold_micro_usd),0n)),run_total:String(rs.filter(r=>r.run_id===p[0]).reduce((a,r)=>a+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:r.charged_micro_usd),0n))}]);}
      if(sql.startsWith('SELECT count(*) AS calls'))return rows([{calls:String([...local.reservations.values()].filter(r=>r.run_id===p[0]).length)}]);
      if(sql.startsWith('INSERT INTO meri_qualification.tool_reservations')){local.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:structuredClone(p[4]),operation:structuredClone(p[5]),arguments_sha256:p[6],hold_micro_usd:String(p[7]),max_output_bytes:String(p[8]),state:'UNKNOWN',charged_micro_usd:null,output_bytes:null,created_at:new Date(clock),settled_at:null});return rows([]);}
      if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd')){local.budget.consumed_micro_usd=String(BigInt(local.budget.consumed_micro_usd)+BigInt(p[0]));return rows([]);}
      if(sql.startsWith('UPDATE meri_qualification.tool_reservations SET')){const row=local.reservations.get(p[0]);Object.assign(row,{state:'SETTLED',charged_micro_usd:row.hold_micro_usd,output_bytes:String(p[1]),settled_at:new Date(clock)});return rows([]);}
      throw Error(`UNSUPPORTED_SCRIPTED_QUERY:${sql}`);
    },release(error){releases.push(error);unlock?.();}
  };}};
  const json=()=>JSON.stringify(invocation),expected={operation,argumentsSha256:canonicalSha256({review:true})};
  const owner=()=>createPostgresToolBudget({pool,allocationJson:JSON.stringify(allocation)});
  const gateway=()=>createDurableSourceDisabledGateway({pool,allocationJson:JSON.stringify(allocation),authorityPorts:f.ports,limits,now:()=>NOW,newId:()=>uuid('7')});
  const reserve=()=>owner().forInvocation(json()).reserve({reservationId:uuid('7'),binding:f.binding,operation,argumentsSha256:expected.argumentsSha256,budgets:f.claims.budgets,claims:f.claims,deadlineMs:NOW+5000});
  const settle=()=>owner().forInvocation(json()).settle({reservationId:uuid('7'),outcome:'completed',outputBytes:7});
  return {f,invocation,allocation,expected,pool,owner,gateway,reserve,settle,commands,releases,credential,json,operations:catalog.operations,
    state:()=>state,row:()=>state.reservations.get(invocation.invocationId),setClock:value=>{clock=value;},loseCommit:()=>{lose=true;},
    failAt:pattern=>{failQuery=pattern;},bind:()=>owner().bindTrustedGrant(json()),
    read:()=>gateway().readInvocationOutcome(json(),JSON.stringify(expected)),
    parkAt(pattern){let resume,reached;const ready=new Promise(r=>{reached=r;});const wait=new Promise(r=>{resume=r;});park={pattern,wait,reached};return {ready,resume:()=>{park=null;resume();}};}};
}
