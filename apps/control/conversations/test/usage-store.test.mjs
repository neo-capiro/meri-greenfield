/** Existing store/transaction over synthetic SQL rows. Native PG is a separate root gate. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {storeFixture,binding,scopes,versions,id} from './store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {sdkUsageSnapshot} from '../usage.mjs';
const check=()=>{},at='2026-10-23T00:00:00.000Z';
const result=(session=id(50),inputTokens=100)=>({type:'result',session_id:session,total_cost_usd:inputTokens/1000,modelUsage:{'us.anthropic.claude-sonnet-4-6':{inputTokens,outputTokens:20,cacheReadInputTokens:200,cacheCreationInputTokens:40,webSearchRequests:0,costUSD:inputTokens/1000,provider:'bedrock',costBasis:'list'}}});
const payload=(r=result())=>({usage:sdkUsageSnapshot(r),toolsUsed:{tools:[{tool:'Read',toolUseId:'toolu_test',outcome:'completed',durationMs:null}],omitted:0}});
function fixture(){const f=storeFixture(),store=createPostgresConversationStore({pool:f.pool}),run={binding,state:'queued',scopes,createdAt:at,policyRevision:'policy1',versions};
 const input={run,request:{requestId:id(6),prompt:'Hello',skill:null,window:null},conversation:{conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt:at,policyRevision:'policy1'},event:{contractVersion:'0.1.0',eventId:id(7),binding,sequence:1,createdAt:at,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}};
 const start=async()=>{await store.accept(input,check);for(const [n,state] of [[8,'starting'],[9,'running']])await store.append(binding,{eventId:id(n),createdAt:at,type:'run.status',data:{state,reasonCode:null}},check);};
 return {...f,store,input,start,record:(input=payload(),b=binding,s=scopes,lineage)=>store.recordUsage({binding:b,scopes:s,input,lineage},check),saved:()=>f.state.runs.values().next().value};
}
test('one run row owns exact accounting replay across owner reconstruction; changed payload refuses',async()=>{
 const f=fixture();await f.start();assert.deepEqual(await f.record(),{status:'recorded',reason:null,replayed:false});
 const first=structuredClone(f.saved().sdk_usage);assert.equal(first.chargeMicroUsd,100000);assert.equal(first.toolsUsed.tools[0].tool,'Read');assert.equal(first.parentRunId,null);
 const fresh=createPostgresConversationStore({pool:f.pool});assert.equal((await fresh.recordUsage({binding,scopes,input:payload()},check)).replayed,true);
 await assert.rejects(f.record(payload(result(id(50),101))),/SDK_USAGE_REPLAY_REFUSED/);
 assert.deepEqual(f.saved().sdk_usage,first);assert.equal(f.state.calls.filter(s=>s.startsWith('UPDATE meri_conversations.runs SET sdk_usage=')).length,1);
});
test('unknown commit does not double debit; exact retry recovers the original row',async()=>{
 const f=fixture();await f.start();f.state.commitUnknown=true;await assert.rejects(f.record(),/SDK_USAGE_COMMIT_UNKNOWN/);f.state.commitUnknown=false;
 assert.equal((await f.record()).replayed,true);assert.equal(f.state.calls.filter(s=>s.startsWith('UPDATE meri_conversations.runs SET sdk_usage=')).length,1);
});

test('provider mismatch persists as unavailable and exact recovery never replaces the evidence',async()=>{
 const f=fixture();await f.start();const input=payload();
 input.usage.models['us.anthropic.claude-sonnet-4-6'].provider='firstParty';
 f.state.commitUnknown=true;await assert.rejects(f.record(input),/SDK_USAGE_COMMIT_UNKNOWN/);f.state.commitUnknown=false;
 const saved=structuredClone(f.saved().sdk_usage);
 assert.equal(saved.reason,'configuration_mismatch');assert.equal(f.saved().sdk_charge_micro_usd,null);
 assert.equal(saved.cumulative.models['us.anthropic.claude-sonnet-4-6'].provider,'firstParty');
 const fresh=createPostgresConversationStore({pool:f.pool});
 assert.deepEqual(await fresh.recordUsage({binding,scopes,input},check),{status:'unavailable',reason:'configuration_mismatch',replayed:true});
 await assert.rejects(f.record(payload()),/SDK_USAGE_REPLAY_REFUSED/);
 assert.deepEqual(f.saved().sdk_usage,saved);
 assert.equal(f.state.calls.filter(s=>s.startsWith('UPDATE meri_conversations.runs SET sdk_usage=')).length,1);
});
test('canonical binding and scope changes cannot record usage or read another tenant policy',async()=>{
 for(const change of [{tenantId:'other'},{actorId:'other'},{conversationId:id(70)},{runId:id(71)},{attemptId:id(72)},{workerId:id(73)},{writerFence:2}]){
  const f=fixture();await f.start();await assert.rejects(f.record(payload(),{...binding,...change}));await assert.rejects(f.store.readModelPolicy({...binding,...change},check));assert.equal(f.saved().sdk_usage,undefined);
 }
 const f=fixture();await f.start();await assert.rejects(f.record(payload(),binding,[{...scopes[0],resourceId:id(80)}]),/STALE_WRITER/);
});

test('policy reads need only the canonical columns and no row-lock write privilege',async()=>{
 const f=fixture();await f.start();const policy=await f.store.readModelPolicy(binding,check);
 assert.equal(policy.maxTurns,20);
 const reads=f.state.calls.filter(sql=>sql.includes('FROM meri_settings.tenant_settings'));
 assert.equal(reads.length,2,'admission and bound run policy read both use the canonical owner');
 assert.ok(reads.every(sql=>sql==='SELECT monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd FROM meri_settings.tenant_settings WHERE tenant_id=$1'));
});
test('missing SDK result is explicit unavailable on the existing run, never free',async()=>{
 const f=fixture();await f.start();assert.deepEqual(await f.record({usage:null,toolsUsed:{tools:[],omitted:0}}),{status:'unavailable',reason:'result_unavailable',replayed:false});assert.equal(f.saved().sdk_charge_micro_usd,null);
});
test('new admission refuses missing/malformed policy and cap cutoff, while historical replay remains readable',async()=>{
 for(const [policy,spent,code] of [[null,'0','MODEL_SETTINGS_UNAVAILABLE'],[{monthly_cap_micro_usd:null,sdk_max_turns:20,sdk_max_budget_micro_usd:2000000},'0','MODEL_SETTINGS_UNAVAILABLE'],[{monthly_cap_micro_usd:100,sdk_max_turns:20,sdk_max_budget_micro_usd:2000000},'100','TENANT_MONTHLY_CAP_REACHED'],[{monthly_cap_micro_usd:100,sdk_max_turns:20,sdk_max_budget_micro_usd:2000000},'101','TENANT_MONTHLY_CAP_REACHED']]){
  const f=fixture();f.state.modelPolicy=policy;f.state.spent=spent;await assert.rejects(f.store.accept(f.input,check),new RegExp(code));assert.equal(f.state.runs.size,0);
 }
 const f=fixture();f.state.spent='99999999';await f.store.accept(f.input,check);f.state.modelPolicy=null;assert.equal((await f.store.accept(f.input,check)).replayed,true);
});
test('resume/fork use only the exact persisted parent cumulative snapshot; rewind stays unavailable',async()=>{
 for(const mode of ['resume','fork','rewind']){
  const f=fixture();await f.start();await f.record();const parent=structuredClone(f.saved()),target={...binding,runId:id(60),attemptId:id(61),workerId:id(62),writerFence:2};
  const r={...parent,run_id:target.runId,request_id:id(63),request:{...parent.request,requestId:id(63)},projection:{...parent.projection,binding:target},sdk_usage:null,sdk_usage_sha256:null,sdk_charge_micro_usd:null};r.request_sha256=hash(r.request);r.projection_sha256=hash(r.projection);f.state.runs.set([target.tenantId,target.conversationId,target.runId].join(':'),r);
  const lineage={mode:mode==='rewind'?'resume':mode,checkpoint:{binding,sessionId:id(50)},resumeSessionAt:mode==='rewind'?'message-synthetic':null};
  const usage=payload(result(mode==='fork'?id(51):id(50),150));
  const receipt=await f.store.recordUsage({binding:target,scopes,input:usage,lineage},check);assert.equal(receipt.status,mode==='rewind'?'unavailable':'recorded');assert.equal(r.sdk_charge_micro_usd,mode==='rewind'?null:50000);assert.equal(r.sdk_usage.parentRunId,binding.runId);
 }
});

// ---- distinct external provider facts ride the same one-run usage row ----
const external=(outcome='completed',attempts=1)=>({provider:'agentcore-web-search',attempts,estimateMicroUsd:7005*attempts,
 billedMicroUsd:null,outcome,calls:[{provider:'agentcore-web-search',attempts,outcome,estimateMicroUsd:7005*attempts,billedMicroUsd:null}],truncated:false});
const withExternal=(facts=external())=>({...payload(),externalSearch:facts});

test('external provider facts persist as distinct JSON beside the SDK snapshot and replay exactly',async()=>{
 const f=fixture();await f.start();
 assert.deepEqual(await f.record(withExternal()),{status:'recorded',reason:null,replayed:false});
 const saved=structuredClone(f.saved().sdk_usage);
 assert.equal(saved.externalSearch.provider,'agentcore-web-search');
 assert.equal(saved.externalSearch.attempts,1);
 assert.equal(saved.externalSearch.estimateMicroUsd,7005);
 assert.equal(saved.externalSearch.billedMicroUsd,null,'no billed cost is invented');
 assert.equal(saved.chargeMicroUsd,100000,'the SDK charge is unchanged by external facts');
 assert.equal(saved.cumulative.sdkEstimateUsd,0.1,'the cumulative SDK snapshot keeps its own estimate');
 assert.equal(saved.toolsUsed.tools[0].tool,'Read');
 // Exact replay from a reconstructed owner returns the same receipt and writes nothing.
 const fresh=createPostgresConversationStore({pool:f.pool});
 assert.equal((await fresh.recordUsage({binding,scopes,input:withExternal()},check)).replayed,true);
 // Changed external facts are a changed payload for the same run row.
 await assert.rejects(f.record(withExternal(external('unknown'))),/SDK_USAGE_REPLAY_REFUSED/);
 await assert.rejects(f.record(withExternal(external('completed',2))),/SDK_USAGE_REPLAY_REFUSED/);
 assert.deepEqual(f.saved().sdk_usage,saved);
 assert.equal(f.state.calls.filter(s=>s.startsWith('UPDATE meri_conversations.runs SET sdk_usage=')).length,1);
});

test('an unobserved submission is recorded as unknown with no billed zero, and absence stays absent',async()=>{
 const f=fixture();await f.start();await f.record(withExternal(external('unknown')));
 const saved=f.saved().sdk_usage;
 assert.equal(saved.externalSearch.outcome,'unknown');
 assert.equal(saved.externalSearch.billedMicroUsd,null);
 assert.equal(saved.chargeMicroUsd,100000,'unknown external spend never enters the SDK charge');
 const g=fixture();await g.start();await g.record();
 assert.equal(Object.hasOwn(g.saved().sdk_usage,'externalSearch'),false,'historical rows keep their exact shape');
 // Malformed facts are refused before any write.
 const h=fixture();await h.start();
 await assert.rejects(h.record(withExternal({...external(),billedMicroUsd:0})),/RUNTIME_USAGE_REFUSED/);
 await assert.rejects(h.record(withExternal({...external(),attempts:-1})),/RUNTIME_USAGE_REFUSED/);
 assert.equal(h.saved().sdk_usage,undefined);
});
