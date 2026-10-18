/** P3 base general-read allocation: tariffs, composition, the closed manifest, skill narrowing, and the aggregate-bytes bound
 * enforced by the real Meri budget owner through the durable dispatch. Nothing here is rendered or enabled. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {familyReads} from '../../../worker/conversation/reads/availability.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {allocation} from '../tool-budget-binding.mjs';
import {GENERAL_READ_DEFAULT_RUN_BUDGETS,GENERAL_READ_DEFAULT_READ_BYTES,GENERAL_READ_CEILINGS,assertGeneralReadManifest} from '../general-read-manifest.mjs';
import {GENERAL_READ_TARIFFS,GENERAL_READ_TARIFF_ASSUMPTION_KEYS} from '../general-read-tariffs.mjs';
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
/** Synthetic evidence of a measured Core setting (the render supplies the real commit, image digest and configuration digest). */
const evidence=id=>({id,...GENERAL_READ_TARIFF_ASSUMPTION_KEYS[id],coreSourceCommit:'a'.repeat(40),coreImageDigest:`sha256:${'b'.repeat(64)}`,configurationSha256:'e'.repeat(64)});
const both=[evidence('rerankDisabled'),evidence('webSearchProviderDuckDuckGo')];

test('the tariff table covers exactly the 76 registered reads with evidence; only read_client_documents is unpriced',()=>{
 assert.deepEqual(Object.keys(GENERAL_READ_TARIFFS).sort(),reads.map(op=>`${op.id}@${op.version}`).sort());
 for(const [key,t] of Object.entries(GENERAL_READ_TARIFFS)){assert.ok(t.evidence.length>20,key);assert.ok(t.chargeMicrousd===null||Number.isSafeInteger(t.chargeMicrousd)&&t.chargeMicrousd>=1,key);}
 assert.deepEqual(Object.entries(GENERAL_READ_TARIFFS).filter(([,t])=>t.chargeMicrousd===null).map(([k])=>k),['read_client_documents@0.2.0']);
 // Titan Text Embeddings V2: $0.02 per 1M input tokens × 8,192 tokens = 163.84 µUSD per embedding, plus the 1 µUSD floor.
 assert.equal(Math.ceil(8192*0.02),164);
 for(const id of ['search_client_knowledge','search_memory','search_capiro_data'])assert.equal(GENERAL_READ_TARIFFS[`${id}@0.2.0`].chargeMicrousd,165);
});

test('the base allocation takes the run caps as configured (default 20 tool calls, D016 3) and the default read-bytes profile',()=>{
 assert.deepEqual({...preview},{maxTurns:20,maxToolCalls:20,maxRuntimeSeconds:900,maxCostMicroUSD:2000000});
 assert.deepEqual({...GENERAL_READ_DEFAULT_READ_BYTES},{maxOutputBytes:1048576,maxAggregateOutputBytes:2097152});
 const {allocation:a,excluded}=compose();
 assert.equal(a.manifest.budgets.maxToolCalls,20);assert.equal(a.manifest.budgets.maxTurns,20);assert.equal(a.manifest.budgets.maxOutputBytes,1048576);assert.equal(a.manifest.maxAggregateOutputBytes,2097152);
 assert.equal(a.manifest.budgets.maxRecoveryAttempts,0);assert.equal(a.manifest.budgets.maxCostMicroUSD,2000000);assert.equal(Object.hasOwn(a.manifest,'tariffAssumptions'),false);
 assert.doesNotThrow(()=>allocation(JSON.stringify(a)));
 assert.deepEqual(excluded.map(op=>op.id).sort(),['read_client_documents','search_capiro_data','search_committee_hearings','search_memory','search_public_web']);
 assert.equal(a.manifest.allowedOperations.length,71);
 // Per-tenant or per-run configuration (D016-A 3) moves the run cap; the base follows it in both directions.
 assert.equal(compose({runBudgets:{...preview,maxToolCalls:1}}).allocation.manifest.budgets.maxToolCalls,1);
 assert.equal(compose({runBudgets:{...preview,maxToolCalls:100}}).allocation.manifest.budgets.maxToolCalls,100);
});

test('the read-bytes profile is validated and configurable within the structural bounds, not a universal 2 MiB ceiling',()=>{
 const wide=compose({readBytes:{maxOutputBytes:4*1048576,maxAggregateOutputBytes:32*1048576}}).allocation;
 assert.equal(wide.manifest.budgets.maxOutputBytes,4*1048576);assert.equal(wide.manifest.maxAggregateOutputBytes,32*1048576);assert.doesNotThrow(()=>allocation(JSON.stringify(wide)));
 assert.equal(compose({readBytes:{maxOutputBytes:4096,maxAggregateOutputBytes:4096}}).allocation.manifest.maxAggregateOutputBytes,4096);
 for(const readBytes of [{maxOutputBytes:0,maxAggregateOutputBytes:1},{maxOutputBytes:2048,maxAggregateOutputBytes:1024},{maxOutputBytes:GENERAL_READ_CEILINGS.maxOutputBytes+1,maxAggregateOutputBytes:GENERAL_READ_CEILINGS.maxAggregateOutputBytes},
  {maxOutputBytes:1024,maxAggregateOutputBytes:GENERAL_READ_CEILINGS.maxAggregateOutputBytes+1},{maxOutputBytes:1024}])refused(()=>compose({readBytes}),'INVALID_BUDGET_INTEGER');
});

test('the allocation.json tariff proposal is exactly the tariff module, and its entries compose a valid schedule',()=>{
 const file=JSON.parse(readFileSync(new URL('../../../../docs/coordination/proposals/general-reads/allocation-read-tariffs.proposal.json',import.meta.url),'utf8'));
 const proposal=generalReadTariffProposal();assert.deepEqual(file,JSON.parse(JSON.stringify(proposal)));
 assert.equal(proposal.operations.length,71);assert.equal(proposal.assumptionGated.length,4);assert.deepEqual(proposal.excluded.map(e=>e.operation.id),['read_client_documents']);
 assert.deepEqual(Object.keys(proposal.assumptionEvidenceRequired).sort(),['rerankDisabled','webSearchProviderDuckDuckGo']);
 for(const entry of proposal.operations)assert.deepEqual(Object.keys(entry),['operation','chargeMicrousd']);
 const full=compose({assumptions:both}).allocation.schedule.operations;
 assert.deepEqual(full,[...proposal.operations,...proposal.assumptionGated.map(({operation,chargeMicrousd})=>({operation,chargeMicrousd}))].sort((x,y)=>`${x.operation.id}@${x.operation.version}`.localeCompare(`${y.operation.id}@${y.operation.version}`)));
 assert.deepEqual(compose().allocation.schedule.operations,proposal.operations);
});

test('assumption-gated reads are priced only with evidence of the measured Core setting, which travels in the allocation',()=>{
 const {allocation:a,excluded}=compose({assumptions:both});
 assert.deepEqual(excluded.map(op=>op.id),['read_client_documents']);assert.equal(a.manifest.allowedOperations.length,75);
 assert.deepEqual(a.manifest.tariffAssumptions.map(e=>e.id),['rerankDisabled','webSearchProviderDuckDuckGo']);assert.doesNotThrow(()=>allocation(JSON.stringify(a)));
 assert.equal(generalReadTariff({id:'read_client_documents',version:'0.2.0'},['rerankDisabled','webSearchProviderDuckDuckGo']),null);
 // Only the evidence an allocated tariff needs is carried.
 const one=compose({operations:[{id:'search_memory',version:'0.2.0'}],assumptions:both}).allocation.manifest;assert.deepEqual(one.tariffAssumptions.map(e=>e.id),['rerankDisabled']);
 for(const assumptions of [['rerankDisabled'],[{...evidence('rerankDisabled'),configValue:'true'}],[{...evidence('rerankDisabled'),coreImageDigest:'latest'}],[{...evidence('rerankDisabled'),extra:1}],[evidence('rerankEnabled')],[evidence('rerankDisabled'),evidence('rerankDisabled')]])
  refused(()=>compose({assumptions}),'INVALID_TARIFF_ASSUMPTION');
 // Dropping the evidence from an allocation that prices a gated read, or inventing unneeded evidence, is refused by the parser.
 const dropped=structuredClone(a);delete dropped.manifest.tariffAssumptions;dropped.manifestSha256=canonicalSha256(dropped.manifest);refused(()=>allocation(JSON.stringify(dropped)),'INVALID_GENERAL_READ_MANIFEST');
 const invented=structuredClone(compose().allocation);invented.manifest.tariffAssumptions=[evidence('rerankDisabled')];invented.manifestSha256=canonicalSha256(invented.manifest);refused(()=>allocation(JSON.stringify(invented)),'INVALID_GENERAL_READ_MANIFEST');
});

test('admission is one worst-case hold within the run cap (D016 3), never every allowed call at the highest tariff',()=>{
 // 12,122 calls at 165 µUSD exceed $2 in total; per-call reservation and the typed budget-exhausted stop govern that, not admission.
 assert.equal(compose({runBudgets:{...preview,maxToolCalls:12122},assumptions:[evidence('rerankDisabled')]}).allocation.manifest.budgets.maxToolCalls,12122);
 assert.doesNotThrow(()=>compose({runBudgets:{...preview,maxCostMicroUSD:165},assumptions:[evidence('rerankDisabled')]}));
 refused(()=>compose({runBudgets:{...preview,maxCostMicroUSD:164},assumptions:[evidence('rerankDisabled')]}),'BUDGET_EXHAUSTED');
});

test('the allocation parser applies the same one-hold rule',()=>{
 const {allocation:a}=compose({assumptions:[evidence('rerankDisabled')]});
 const widened=structuredClone(a);for(const b of [widened.budgets,widened.manifest.budgets])b.maxToolCalls=12122;widened.manifestSha256=canonicalSha256(widened.manifest);
 assert.doesNotThrow(()=>allocation(JSON.stringify(widened)));
 const repriced=structuredClone(a);repriced.schedule.operations[0].chargeMicrousd=a.budgets.maxCostMicroUSD+1;
 refused(()=>allocation(JSON.stringify(repriced)),'BUDGET_EXHAUSTED');
 assert.doesNotThrow(()=>allocation(JSON.stringify(a)));
});

test('the closed general-read manifest refuses widening, writes, recovery and unknown fields',()=>{
 const base=compose().allocation.manifest;
 for(const mutate of [m=>m.budgets.maxToolCalls=0,m=>m.budgets.maxOutputBytes=GENERAL_READ_CEILINGS.maxOutputBytes+1,m=>m.maxAggregateOutputBytes=GENERAL_READ_CEILINGS.maxAggregateOutputBytes+1,m=>m.maxAggregateOutputBytes=m.budgets.maxOutputBytes-1,
  m=>m.budgets.maxRecoveryAttempts=1,m=>m.extra=true,m=>m.profile='meri.other',m=>m.allowedOperations.push({id:'create_word',version:'0.2.0'}),m=>m.allowedOperations.push({...m.allowedOperations[0]}),m=>m.tariffAssumptions=[]]){
  const m=structuredClone(base);mutate(m);assert.throws(()=>assertGeneralReadManifest(m));
 }
});

test('a selected skill may only narrow the base; effective budgets are the field-wise minimum',()=>{
 const base=compose({assumptions:both}).allocation.manifest;
 const skill=selectSkill('quick_skill.relationship_brief','1.0.0').manifest;
 const inside={...structuredClone(skill),allowedOperations:skill.allowedOperations.filter(op=>base.allowedOperations.some(b=>b.id===op.id)),budgets:{...skill.budgets,maxToolCalls:1,maxOutputBytes:1024,maxCostMicroUSD:1000,maxRuntimeSeconds:60,maxTurns:1}};
 assert.doesNotThrow(()=>assertSkillNarrowsBase(inside,base));
 refused(()=>assertSkillNarrowsBase({...inside,budgets:{...inside.budgets,maxToolCalls:21}},base),'SKILL_WIDENS_BASE');
 refused(()=>assertSkillNarrowsBase({...inside,allowedOperations:[...inside.allowedOperations,{id:'read_client_documents',version:'0.2.0'}]},base),'SKILL_WIDENS_BASE');
 const narrowed=narrowedSkillBudgets(skill.budgets,base.budgets);for(const k of Object.keys(base.budgets))assert.equal(narrowed[k],Math.min(skill.budgets[k],base.budgets[k]));
});

async function aggregateFixture({readBytes}={}){
 // Synthetic capability cost budget above one call, so only the aggregate-bytes bound can refuse the next read.
 const scene=familyCase('tenant-contacts','find_contacts');scene.authority.claims.budgets={...scene.authority.claims.budgets,maxCostMicrousd:1000};
 return durableFamilyFixture(scene,{allocation:({binding,operation,expires,catalogSha256})=>{
  const {allocation:a}=composeGeneralReadAllocation({run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,binding[k]])),operations:[operation],
   runBudgets:{maxTurns:5,maxToolCalls:5,maxRuntimeSeconds:60,maxCostMicroUSD:1000},...(readBytes?{readBytes}:{}),catalogSha256,scheduleRevision:'d'.repeat(64),expiresAt:new Date(expires).toISOString()});
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

test('a narrowed allocation checks and stores the same effective hold, so its own bound never falsely exhausts (dot 6247587388)',async()=>{
 // The capability allows 1 MiB per result; the allocation narrows to 64 KiB per result and per run. One read must fit.
 const f=await aggregateFixture({readBytes:{maxOutputBytes:65536,maxAggregateOutputBytes:65536}});
 assert.equal(f.authority.claims.budgets.maxOutputBytes,1048576);
 assert.ok(JSON.parse(await f.execute('aggregate:narrowed')));const [row]=[...f.state.reservations.values()];
 assert.equal(row.max_output_bytes,65536,'stored hold is the effective one');assert.equal(row.state,'SETTLED');
});

const price={coreSourceCommit:'a'.repeat(40),coreImageDigest:`sha256:${'b'.repeat(64)}`,configurationSha256:'e'.repeat(64)};
// Synthetic prices: vision $2 / $8 per 1M input/output tokens with a 10,000-token one-page input bound; whisper $0.006 per minute
// under a one-hour Core cap. Vision = 10,000×2 + 8,192×8 = 85,536 µUSD; transcription = 60 × 6,000 = 360,000 µUSD.
const documentPricing={vision:{model:'gpt-6-astra',inputMicrousdPerMillionTokens:2000000,outputMicrousdPerMillionTokens:8000000,maxInputTokens:10000,...price},
 transcription:{model:'whisper-1',microusdPerMinute:6000,maxAudioSeconds:3600,...price}};

test('read_client_documents is priced from evidence as text plus the worse paid branch, and allocated only then',()=>{
 const document={id:'read_client_documents',version:'0.2.0'};
 assert.deepEqual(compose({operations:[document,reads[0]]}).excluded.map(op=>op.id),['read_client_documents'],'no evidence, no allocation');
 const {allocation:a,excluded}=compose({documentPricing});assert.equal(excluded.some(op=>op.id==='read_client_documents'),false);
 assert.equal(a.schedule.operations.find(item=>item.operation.id==='read_client_documents').chargeMicrousd,1+360000);
 assert.deepEqual(a.manifest.documentPricing,documentPricing);assert.doesNotThrow(()=>allocation(JSON.stringify(a)));
 // Vision dominates when transcription is capped short: 1 + 85,536.
 assert.equal(compose({documentPricing:{...documentPricing,transcription:{...documentPricing.transcription,maxAudioSeconds:60}}}).allocation.schedule.operations.find(i=>i.operation.id==='read_client_documents').chargeMicrousd,1+85536);
 // Whisper without Core's duration cap stays unpriced; so do unbound or malformed prices.
 for(const bad of [{...documentPricing,transcription:{...documentPricing.transcription,maxAudioSeconds:null}},{...documentPricing,transcription:{...documentPricing.transcription,model:'whisper-2'}},
  {...documentPricing,vision:{...documentPricing.vision,coreImageDigest:'latest'}},{vision:documentPricing.vision}])refused(()=>compose({documentPricing:bad}),'INVALID_DOCUMENT_PRICING');
 const repriced=structuredClone(a);repriced.schedule.operations.find(i=>i.operation.id==='read_client_documents').chargeMicrousd=2;refused(()=>allocation(JSON.stringify(repriced)),'INVALID_CHARGE_SCHEDULE');
 const dropped=structuredClone(a);delete dropped.manifest.documentPricing;dropped.manifestSha256=canonicalSha256(dropped.manifest);refused(()=>allocation(JSON.stringify(dropped)),'INVALID_GENERAL_READ_MANIFEST');
 refused(()=>compose({documentPricing,runBudgets:{...preview,maxCostMicroUSD:360000}}),'BUDGET_EXHAUSTED');
});
