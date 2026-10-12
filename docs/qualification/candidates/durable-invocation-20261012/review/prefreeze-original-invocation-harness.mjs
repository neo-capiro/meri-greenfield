// Inert independent SQL-script boundary; no pg import, socket or database execution.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root,'explicit source root required');
const load=path=>import(pathToFileURL(`${root}/${path}`));
export const {canonicalSha256}=await load('packages/contracts/validate.mjs');
export const {fixture,NOW,uuid,operation,limits,requestJson}=await load('apps/gateway/test/fixtures.mjs');
export const {createPostgresToolBudget}=await load('apps/gateway/budget/postgres-tool-budget.mjs');
export const {createDurableSourceDisabledGateway}=await load('apps/gateway/index.mjs');
const catalog=(await import(pathToFileURL(`${root}/packages/contracts/retrieval-0.2/catalog.json`),{with:{type:'json'}})).default;
const {createDurableToolDispatch}=await load('apps/gateway/budget/durable-tool-dispatch.mjs');
export const {BudgetCommitUncertain}=await load('apps/gateway/budget/postgres-budget-store.mjs');
export function harness() {
  const f=fixture(),policy='a'.repeat(64),credential='synthetic-outcome';
  f.claims.policyRevision=policy; f.claims.scopes[0].policyRevision=policy; f.subject.policyRevision=policy;
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
      capability_sha256:invocation.capabilitySha256,state:'ACTIVE',expires_at:new Date(NOW+10000)},allocation:null,grantBinding:null,reservations:new Map(),produced:new Map(),model:[]};
  let chain=Promise.resolve(),clock=NOW,lose=false,failQuery=null,park=null,stageLoss=null,stagePark=null;
  const commands=[],releases=[];
  const pool={async connect(){let local,unlock,stage='read';return {
    async query(sql,p=[]){
      commands.push({sql,p});const rows=values=>({rows:values,rowCount:values.length});
      if(failQuery&&sql.includes(failQuery))throw Error('SYNTHETIC_QUERY_FAILURE');
      if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return rows([]);
      if(sql.includes('budget WHERE id=1 FOR UPDATE')){const previous=chain;chain=new Promise(r=>{unlock=r;});await previous;local=structuredClone(state);return rows([local.budget]);}
      if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(clock)}]);
      if(sql==='COMMIT'){state=local;local=null;if(stagePark&&stagePark.stage===stage){const p=stagePark;stagePark=null;p.reached();await p.wait;}if(stageLoss===stage){stageLoss=null;throw Error('SYNTHETIC_COMMIT_ACK_LOSS');}if(lose){lose=false;throw Error('SYNTHETIC_COMMIT_ACK_LOSS');}return rows([]);}
      if(sql==='ROLLBACK'){local=null;return rows([]);}
      if(park&&sql.includes(park.pattern)){park.reached();await park.wait;}
      if(sql.startsWith('SELECT * FROM meri_qualification.runs'))return rows(local.run?[local.run]:[]);
      if(sql.startsWith('SELECT * FROM meri_qualification.grants'))return rows(local.grant?[local.grant]:[]);
      if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations'))return rows(local.allocation?[local.allocation]:[]);
      if(sql.startsWith('SELECT * FROM meri_qualification.tool_grant_bindings'))return rows(local.grantBinding?[local.grantBinding]:[]);
      if(sql.startsWith('SELECT * FROM meri_qualification.tool_invocations'))return rows([...local.produced.values()].filter(r=>sql.includes('producer_key_sha256')?r.run_id===p[0]&&r.producer_key_sha256===p[1]:r.invocation_id===p[0]));
      if(sql.startsWith('INSERT INTO meri_qualification.tool_invocations')){stage='prepare';const names=sql.match(/tool_invocations\(([^)]+)\)/)[1].split(',').map(x=>x.trim());const row=Object.fromEntries(names.map((n,k)=>[n,structuredClone(p[k])]));Object.assign(row,{created_at:new Date(clock),deadline_ms:String(row.deadline_ms),reservation_id:null,arguments_sha256:null,completion:null});assert.ok(!local.produced.has(row.invocation_id),'duplicate invocation id');assert.ok(![...local.produced.values()].some(r=>r.run_id===row.run_id&&r.producer_key_sha256===row.producer_key_sha256),'duplicate producer key');local.produced.set(row.invocation_id,row);return rows([]);}
      if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET')){const row=local.produced.get(p[0]);assert.ok(row,'produced row required');if(sql.includes('completion=')){stage='marker';row.completion=structuredClone(p[1]);}else{stage='reserve';row.reservation_id=p[1];row.arguments_sha256=p[2];}return rows([]);}
      if(sql.startsWith('SELECT * FROM meri_qualification.tool_reservations'))return rows(local.reservations.has(p[0])?[local.reservations.get(p[0])]:[]);
      if(sql.startsWith('INSERT INTO meri_qualification.tool_run_allocations')){local.allocation={run_id:p[0],allocation_sha256:p[1],allocation:structuredClone(p[2]),max_tool_calls:String(p[3]),max_cost_micro_usd:String(p[4]),started_at:new Date(clock)};return rows([]);}
      if(sql.startsWith('INSERT INTO meri_qualification.tool_grant_bindings')){local.grantBinding={grant_id:p[0],run_id:p[1],facts:structuredClone(p[2])};return rows([]);}
      if(sql.startsWith('SELECT 1 FROM meri_qualification.budget_liabilities'))return rows([...local.reservations.values(),...local.model].filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN').map(()=>({one:1})));
      if(sql.includes(' AS run_total')){const rs=[...local.reservations.values(),...local.model];return rows([{held:String(rs.filter(r=>r.state==='UNKNOWN').reduce((a,r)=>a+BigInt(r.hold_micro_usd),0n)),run_total:String(rs.filter(r=>r.run_id===p[0]).reduce((a,r)=>a+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:(r.charged_micro_usd??r.consumed_micro_usd)),0n))}]);}
      if(sql.startsWith('SELECT count(*) AS calls'))return rows([{calls:String([...local.reservations.values()].filter(r=>r.run_id===p[0]).length)}]);
      if(sql.startsWith('INSERT INTO meri_qualification.tool_reservations')){stage='reserve';assert.ok(!local.reservations.has(p[0]),'duplicate reservation');local.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:structuredClone(p[4]),operation:structuredClone(p[5]),arguments_sha256:p[6],hold_micro_usd:String(p[7]),max_output_bytes:String(p[8]),state:'UNKNOWN',charged_micro_usd:null,output_bytes:null,created_at:new Date(clock),settled_at:null});return rows([]);}
      if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd')){stage='settle';local.budget.consumed_micro_usd=String(BigInt(local.budget.consumed_micro_usd)+BigInt(p[0]));return rows([]);}
      if(sql.startsWith('UPDATE meri_qualification.tool_reservations SET')){const row=local.reservations.get(p[0]);Object.assign(row,{state:'SETTLED',charged_micro_usd:row.hold_micro_usd,output_bytes:String(p[1]),settled_at:new Date(clock)});return rows([]);}
      throw Error(`UNSUPPORTED_SCRIPTED_QUERY:${sql}`);
    },release(error){releases.push(error);unlock?.();}
  };}};
  const json=()=>JSON.stringify(invocation),expected={operation,argumentsSha256:canonicalSha256({review:true})};
  const owner=()=>createPostgresToolBudget({pool,allocationJson:JSON.stringify(allocation),now:()=>f.state.now});
  const gateway=()=>createDurableSourceDisabledGateway({pool,allocationJson:JSON.stringify(allocation),authorityPorts:f.ports,limits,now:()=>f.state.now,newId:randomUUID});
  const enabledGateway=()=>createDurableToolDispatch({pool,allocationJson:JSON.stringify(allocation),catalog:{entry:()=>f.entry,discoverable:()=>[f.entry]},authority:f.authority,limits,now:()=>f.state.now,newId:randomUUID,sourceEnabled:true});
  const producer={namespace:'review-sdk',executionId:'synthetic-original-execution'};
  const context=()=>{const {invocationId,...facts}=invocation;return facts;};
  const delivery=(deliveryId='synthetic-stable-delivery')=>JSON.stringify({context:context(),producer,deliveryId});
  const controller=async(disabled=false)=>{const {bindToolInvocationControl,createToolInvocationControl}=await load('apps/control/tool-invocations.mjs');return disabled?createToolInvocationControl({gatewayOptions:{pool,allocationJson:JSON.stringify(allocation),authorityPorts:f.ports,limits,now:()=>f.state.now,newId:randomUUID},contextJson:JSON.stringify(context()),producerJson:JSON.stringify(producer)}):bindToolInvocationControl({gateway:enabledGateway(),contextJson:JSON.stringify(context()),producerJson:JSON.stringify(producer)});};
  const reserve=()=>owner().forInvocation(json()).reserve({reservationId:uuid('7'),binding:f.binding,operation,argumentsSha256:expected.argumentsSha256,budgets:f.claims.budgets,claims:f.claims,deadlineMs:NOW+5000});
  const settle=()=>owner().forInvocation(json()).settle({reservationId:uuid('7'),outcome:'completed',outputBytes:7});
  return {f,invocation,allocation,enabledGateway,producer,context,delivery,controller,expected,pool,owner,gateway,reserve,settle,commands,releases,credential,json,operations:catalog.operations,
    state:()=>state,row:()=>state.reservations.get(invocation.invocationId),setClock:value=>{clock=value;f.state.now=value;},loseCommit:()=>{lose=true;},
    loseStage:value=>{stageLoss=value;},
    parkCommit(stage){let resume,reached;const ready=new Promise(r=>{reached=r;});const wait=new Promise(r=>{resume=r;});stagePark={stage,wait,reached};return {ready,resume};},
    failAt:pattern=>{failQuery=pattern;},bind:()=>owner().bindTrustedGrant(json()),
    read:()=>gateway().readInvocationOutcome(json(),JSON.stringify(expected)),
    parkAt(pattern){let resume,reached;const ready=new Promise(r=>{reached=r;});const wait=new Promise(r=>{resume=r;});park={pattern,wait,reached};return {ready,resume:()=>{park=null;resume();}};}};
}
