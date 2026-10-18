/** P3 base general-read allocation: tariffs, composition, the closed manifest, skill narrowing, and the aggregate-bytes bound
 * enforced by the real Meri budget owner through the durable dispatch. Nothing here is rendered or enabled. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {familyReads} from '../../../worker/conversation/reads/availability.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {allocation} from '../tool-budget-binding.mjs';
import {GENERAL_READ_DEFAULT_RUN_BUDGETS,assertGeneralReadManifest} from '../general-read-manifest.mjs';
import {GENERAL_READ_TARIFFS} from '../general-read-tariffs.mjs';
import {readFileSync} from 'node:fs';
import {composeGeneralReadAllocation,generalReadTariff,assertSkillNarrowsBase,narrowedSkillBudgets,generalReadTariffProposal} from '../general-read-allocation.mjs';
import {durableFamilyFixture} from '../../general-reads/test/durable-fixture.mjs';
import {familyCase} from '../../general-reads/test/family-cases.mjs';

const reads=familyReads().map(row=>({id:row.operation.id,version:row.operation.version}));
const run={tenantId:'tenant',actorId:'actor',conversationId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222'};
// D016 3: the default integration run profile, 20 turns / 20 tool calls / 900 s / $2.
const preview=GENERAL_READ_DEFAULT_RUN_BUDGETS;
const compose=(overrides={})=>composeGeneralReadAllocation({run,operations:reads,runBudgets:preview,catalogSha256:'c'.repeat(64),scheduleRevision:'d'.repeat(64),expiresAt:'2026-10-18T06:00:00.000Z',...overrides});
const refused=(work,code)=>assert.throws(work,error=>error.code===code||error.message===code);

test('the tariff table covers exactly the 76 registered reads with evidence; only read_client_documents is unpriced',()=>{
 assert.deepEqual(Object.keys(GENERAL_READ_TARIFFS).sort(),reads.map(op=>`${op.id}@${op.version}`).sort());
 for(const [key,t] of Object.entries(GENERAL_READ_TARIFFS)){assert.ok(t.evidence.length>20,key);assert.ok(t.chargeMicrousd===null||Number.isSafeInteger(t.chargeMicrousd)&&t.chargeMicrousd>=1,key);}
 assert.deepEqual(Object.entries(GENERAL_READ_TARIFFS).filter(([,t])=>t.chargeMicrousd===null).map(([k])=>k),['read_client_documents@0.2.0']);
 // Titan Text Embeddings V2: $0.02 per 1M input tokens × 8,192 tokens = 163.84 µUSD per embedding, plus the 1 µUSD floor.
 assert.equal(Math.ceil(8192*0.02),164);
 for(const id of ['search_client_knowledge','search_memory','search_capiro_data'])assert.equal(GENERAL_READ_TARIFFS[`${id}@0.2.0`].chargeMicrousd,165);
});

test('the base allocation follows the run caps (default 20 tool calls, D016 3) and the byte ceilings, and parses as an allocation',()=>{
 assert.deepEqual({...preview},{maxTurns:20,maxToolCalls:20,maxRuntimeSeconds:900,maxCostMicroUSD:2000000});
 const {allocation:a,excluded}=compose();
 assert.equal(a.manifest.budgets.maxToolCalls,20);assert.equal(a.manifest.budgets.maxTurns,20);assert.equal(a.manifest.budgets.maxOutputBytes,1048576);assert.equal(a.manifest.maxAggregateOutputBytes,2097152);
 assert.equal(a.manifest.budgets.maxRecoveryAttempts,0);assert.equal(a.manifest.budgets.maxCostMicroUSD,2000000);
 assert.doesNotThrow(()=>allocation(JSON.stringify(a)));
 assert.deepEqual(excluded.map(op=>op.id).sort(),['read_client_documents','search_capiro_data','search_committee_hearings','search_memory','search_public_web']);
 assert.equal(a.manifest.allowedOperations.length,71);
 // Per-tenant or per-run configuration (D016-A 3) moves the run cap; the base follows it in both directions.
 assert.equal(compose({runBudgets:{...preview,maxToolCalls:1}}).allocation.manifest.budgets.maxToolCalls,1);
 assert.equal(compose({runBudgets:{...preview,maxToolCalls:100}}).allocation.manifest.budgets.maxToolCalls,100);
});

test('the allocation.json tariff proposal is exactly the tariff module, and its entries compose a valid schedule',()=>{
 const file=JSON.parse(readFileSync(new URL('../../../../docs/coordination/proposals/general-reads/allocation-read-tariffs.proposal.json',import.meta.url),'utf8'));
 const proposal=generalReadTariffProposal();assert.deepEqual(file,JSON.parse(JSON.stringify(proposal)));
 assert.equal(proposal.operations.length,71);assert.equal(proposal.assumptionGated.length,4);assert.deepEqual(proposal.excluded.map(e=>e.operation.id),['read_client_documents']);
 for(const entry of proposal.operations)assert.deepEqual(Object.keys(entry),['operation','chargeMicrousd']);
 const full=compose({assumptions:['rerankDisabled','webSearchProviderDuckDuckGo']}).allocation.schedule.operations;
 assert.deepEqual(full,[...proposal.operations,...proposal.assumptionGated.map(({operation,chargeMicrousd})=>({operation,chargeMicrousd}))].sort((x,y)=>`${x.operation.id}@${x.operation.version}`.localeCompare(`${y.operation.id}@${y.operation.version}`)));
 assert.deepEqual(compose().allocation.schedule.operations,proposal.operations);
});

test('Core-configuration assumptions price the conditional reads only when asserted; unknown cost is never priced',()=>{
 const {allocation:a,excluded}=compose({assumptions:['rerankDisabled','webSearchProviderDuckDuckGo']});
 assert.deepEqual(excluded.map(op=>op.id),['read_client_documents']);assert.equal(a.manifest.allowedOperations.length,75);
 assert.equal(generalReadTariff({id:'read_client_documents',version:'0.2.0'},['rerankDisabled','webSearchProviderDuckDuckGo']),null);
 refused(()=>compose({assumptions:['rerankEnabled']}),'INVALID_TARIFF_ASSUMPTION');
});

test('every admitted call fits the run cost cap at the highest tariff, or the allocation is refused',()=>{
 // 20 calls × 165 µUSD = 3,300 µUSD.
 refused(()=>compose({runBudgets:{...preview,maxCostMicroUSD:3299},assumptions:['rerankDisabled']}),'BUDGET_EXHAUSTED');
 assert.doesNotThrow(()=>compose({runBudgets:{...preview,maxCostMicroUSD:3300},assumptions:['rerankDisabled']}));
 // A configured tool-call count is still bounded by the $2 cap: 12,121 × 165 ≤ 2,000,000 < 12,122 × 165.
 assert.doesNotThrow(()=>compose({runBudgets:{...preview,maxToolCalls:12121},assumptions:['rerankDisabled']}));
 refused(()=>compose({runBudgets:{...preview,maxToolCalls:12122},assumptions:['rerankDisabled']}),'BUDGET_EXHAUSTED');
});

test('the allocation parser itself refuses a general-read allocation whose calls at the highest tariff exceed its cost cap',()=>{
 const {allocation:a}=compose({assumptions:['rerankDisabled']});
 const widened=structuredClone(a);for(const b of [widened.budgets,widened.manifest.budgets])b.maxToolCalls=12122;widened.manifestSha256=canonicalSha256(widened.manifest);
 refused(()=>allocation(JSON.stringify(widened)),'BUDGET_EXHAUSTED');
 const repriced=structuredClone(a);repriced.schedule.operations[0].chargeMicrousd=100001;
 refused(()=>allocation(JSON.stringify(repriced)),'BUDGET_EXHAUSTED');
 assert.doesNotThrow(()=>allocation(JSON.stringify(a)));
});

test('the closed general-read manifest refuses widening, writes, recovery and unknown fields',()=>{
 const base=compose().allocation.manifest;
 for(const mutate of [m=>m.budgets.maxToolCalls=0,m=>m.budgets.maxOutputBytes=1048577,m=>m.maxAggregateOutputBytes=2097153,m=>m.maxAggregateOutputBytes=m.budgets.maxOutputBytes-1,
  m=>m.budgets.maxRecoveryAttempts=1,m=>m.extra=true,m=>m.profile='meri.other',m=>m.allowedOperations.push({id:'create_word',version:'0.2.0'}),m=>m.allowedOperations.push({...m.allowedOperations[0]})]){
  const m=structuredClone(base);mutate(m);assert.throws(()=>assertGeneralReadManifest(m));
 }
});

test('a selected skill may only narrow the base; effective budgets are the field-wise minimum',()=>{
 const base=compose({assumptions:['rerankDisabled','webSearchProviderDuckDuckGo']}).allocation.manifest;
 const skill=selectSkill('quick_skill.relationship_brief','1.0.0').manifest;
 const inside={...structuredClone(skill),allowedOperations:skill.allowedOperations.filter(op=>base.allowedOperations.some(b=>b.id===op.id)),budgets:{...skill.budgets,maxToolCalls:1,maxOutputBytes:1024,maxCostMicroUSD:1000,maxRuntimeSeconds:60,maxTurns:1}};
 assert.doesNotThrow(()=>assertSkillNarrowsBase(inside,base));
 refused(()=>assertSkillNarrowsBase({...inside,budgets:{...inside.budgets,maxToolCalls:21}},base),'SKILL_WIDENS_BASE');
 refused(()=>assertSkillNarrowsBase({...inside,allowedOperations:[...inside.allowedOperations,{id:'read_client_documents',version:'0.2.0'}]},base),'SKILL_WIDENS_BASE');
 const narrowed=narrowedSkillBudgets(skill.budgets,base.budgets);for(const k of Object.keys(base.budgets))assert.equal(narrowed[k],Math.min(skill.budgets[k],base.budgets[k]));
});

async function aggregateFixture(){
 // Synthetic capability cost budget above one call, so only the aggregate-bytes bound can refuse the next read.
 const scene=familyCase('tenant-contacts','find_contacts');scene.authority.claims.budgets={...scene.authority.claims.budgets,maxCostMicrousd:1000};
 return durableFamilyFixture(scene,{allocation:({binding,operation,expires,catalogSha256})=>{
  const {allocation:a}=composeGeneralReadAllocation({run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,binding[k]])),operations:[operation],
   runBudgets:{maxTurns:5,maxToolCalls:5,maxRuntimeSeconds:60,maxCostMicroUSD:1000},catalogSha256,scheduleRevision:'d'.repeat(64),expiresAt:new Date(expires).toISOString()});
  // Aggregate equal to one result's hold (1 MiB): any bytes already read this run leave no room for another 1 MiB hold.
  const manifest={...a.manifest,maxAggregateOutputBytes:a.manifest.budgets.maxOutputBytes};
  return {...a,manifest,manifestSha256:canonicalSha256(manifest)};
 }});
}

test('a general-read allocation executes through the real durable dispatch while aggregate read bytes fit',async()=>{
 const f=await aggregateFixture();
 assert.ok(JSON.parse(await f.execute('aggregate:fits')));assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
});

test('the Meri budget owner refuses a read whose hold would exceed the run aggregate read bytes, before any reservation',async()=>{
 const f=await aggregateFixture();
 // An earlier read of this run settled 300 bytes (as the reserve transaction would see it).
 f.state.reservations.set('earlier-read',{invocation_id:'earlier-read',reservation_id:'33333333-3333-4333-8333-333333333333',grant_id:'44444444-4444-4444-8444-444444444444',run_id:f.binding.runId,
  facts:{},operation:f.operation,arguments_sha256:'e'.repeat(64),hold_micro_usd:1,max_output_bytes:1048576,state:'SETTLED',charged_micro_usd:1,output_bytes:300,created_at:new Date(f.now()),settled_at:new Date(f.now())});
 await assert.rejects(f.execute('aggregate:exceeds'));
 assert.deepEqual([...f.state.reservations.keys()],['earlier-read'],'no reservation was made');
 assert.ok(f.state.commands.some(c=>String(c.sql??c).includes('AS read_bytes')),'the aggregate query ran in the reserve transaction');
});
