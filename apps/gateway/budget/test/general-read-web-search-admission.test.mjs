/** SCRUM-237: the configured primary search is priced from its own measured admission (never the 1 µUSD
 * DuckDuckGo assumption), the receiving contract accepts the producer's rows, and the absent case keeps
 * today's Core/DDG behaviour. Synthetic evidence only: no AWS call, credential, network or database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPrimaryWebSearch} from '../../sources/public-web/primary-search.mjs';
import {composeGeneralReadAllocation,generalReadTariff} from '../general-read-allocation.mjs';
import {GENERAL_READ_PAID_SEARCH_PROFILE_VERSION,GENERAL_READ_PROFILE_VERSION,webSearchCharge} from '../general-read-manifest.mjs';
import {GENERAL_READ_TARIFF_ASSUMPTION_KEYS,GENERAL_READ_TARIFFS,WEB_SEARCH_ADMISSION} from '../general-read-tariffs.mjs';
import {GENERAL_READ_DEFAULT_RUN_BUDGETS} from '../general-read-manifest.mjs';

const run={tenantId:'tenant',actorId:'actor',conversationId:'11111111-1111-4111-8111-111111111111',runId:'22222222-2222-4222-8222-222222222222'};
const reads=[{id:'search_public_web',version:'0.2.0'},{id:'describe_capiro_data',version:'0.2.0'},{id:'find_path_to',version:'0.2.0'}];
const evidence=id=>({id,...GENERAL_READ_TARIFF_ASSUMPTION_KEYS[id],coreSourceCommit:'a'.repeat(40),coreImageDigest:`sha256:${'b'.repeat(64)}`,configurationSha256:'e'.repeat(64)});
const compose=overrides=>composeGeneralReadAllocation({run,operations:reads,runBudgets:GENERAL_READ_DEFAULT_RUN_BUDGETS,
 catalogSha256:'c'.repeat(64),scheduleRevision:'d'.repeat(64),expiresAt:'2026-10-29T06:00:00.000Z',...overrides});
const chargeOf=(allocation,id)=>allocation.schedule.operations.find(row=>row.operation.id===id).chargeMicrousd;
const refused=(work,code)=>assert.throws(work,error=>error.code===code||error.message===code);
const ENDPOINT='https://meri-preview-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp';

test('the receiving contract accepts the primary producer output, including null metadata',()=>{
 const rows={isError:false,content:[{type:'text',text:JSON.stringify({results:[
  {text:'Current release notes',url:'https://public.example.invalid/a%20b?x=1',title:'Release'},
  {text:'No title and no date from the index',url:'https://public.example.invalid/b'}]})}]};
 const primary=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',toolName:'WebSearch-tool-abc123',
  now:()=>1761700000000,credentials:async()=>({accessKeyId:'A',secretAccessKey:'B'}),
  fetchImpl:async()=>Response.json({jsonrpc:'2.0',id:'1',result:rows})});
 return primary.search({query:'latest release',limit:5,deadlineMs:1761700000000+5000}).then(output=>{
  assert.equal(output.provider,'agentcore-web-search');
  assert.equal(output.results[1].title,null);
  assert.equal(output.results[1].publishedAt,null);
  const contract=resolveOperationContract({id:'search_public_web',version:'0.2.0'});
  // The exact producer output now validates against the frozen receiving contract.
  assert.deepEqual(contract.assertOutput(output,{request:{query:'latest release',limit:5}}),output);
  // A truncated/foreign locator or a mislabelled provider is still refused.
  for(const bad of [
   {...output,results:[{...output.results[0],url:`https://public.example.invalid/${'a'.repeat(2100)}`}]},
   {...output,provider:'tavily',results:[{...output.results[0],source:'tavily'}]},
   {...output,results:[{...output.results[0],title:'x'.repeat(181)}]}]){
   assert.throws(()=>contract.assertOutput(bad,{request:{query:'q',limit:5}}));
  }
 });
});

test('without a configured primary target the Core/DuckDuckGo price is unchanged',()=>{
 const {allocation:a}=compose({assumptions:[evidence('webSearchProviderDuckDuckGo')]});
 assert.equal(a.manifest.profileVersion,GENERAL_READ_PROFILE_VERSION);
 assert.equal(a.manifest.tariffAssumptions.map(item=>item.id).join(),'webSearchProviderDuckDuckGo');
 assert.equal(chargeOf(a,'search_public_web'),1);
 assert.equal(Object.hasOwn(a.manifest,'webSearchAdmission'),false);
 assert.equal(GENERAL_READ_TARIFFS['search_public_web@0.2.0'].chargeMicrousd,1);
});

test('a configured primary target reserves unit × configured attempts before any paid dispatch',()=>{
 const single=compose({webSearchAdmission:{provider:WEB_SEARCH_ADMISSION.provider,unitMicroUsd:7005,maxAttempts:1},
  assumptions:[evidence('webSearchProviderAgentCore')]}).allocation;
 assert.equal(single.manifest.profileVersion,GENERAL_READ_PAID_SEARCH_PROFILE_VERSION);
 assert.deepEqual(single.manifest.tariffAssumptions.map(item=>item.id),['webSearchProviderAgentCore'],
  'the DuckDuckGo assumption is replaced for the paid provider, never combined with it');
 assert.equal(chargeOf(single,'search_public_web'),7005);
 // Two attempts is the source ceiling and therefore the reserved hold for a retried call.
 const double=compose({webSearchAdmission:{provider:WEB_SEARCH_ADMISSION.provider,unitMicroUsd:7005,maxAttempts:2},
  assumptions:[evidence('webSearchProviderAgentCore')]}).allocation;
 assert.equal(chargeOf(double,'search_public_web'),14010);
 assert.equal(double.manifest.webSearchAdmission.maxAttempts,2);
 assert.equal(chargeOf(double,'describe_capiro_data'),1,'other reads keep their own tariffs');
 // The producer's own admission facts are the same numbers the budget owner reserves.
 const producer=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',toolName:'WebSearch',credentials:async()=>({accessKeyId:'A',secretAccessKey:'B'}),
  fetchImpl:async()=>Response.json({jsonrpc:'2.0',id:'1',result:{isError:false,content:[{type:'text',text:'{"results":[]}'}]}})});
 assert.equal(producer.admission.unitMicroUsd,7005);
 assert.equal(producer.admission.maxMicroUsd,7005,'the default producer submits one billable attempt');
 assert.equal(createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',toolName:'WebSearch',maxAttempts:2,credentials:async()=>({accessKeyId:'A',secretAccessKey:'B'}),
  fetchImpl:async()=>Response.json({jsonrpc:'2.0',id:'1',result:{isError:false,content:[{type:'text',text:'{"results":[]}'}]}})}).admission.maxMicroUsd,14010);
});

test('a paid primary read is never priced by the free DuckDuckGo assumption',()=>{
 // Holding only the Core/DDG evidence cannot price the search once the primary is configured.
 refused(()=>compose({webSearchAdmission:{provider:'agentcore-web-search',unitMicroUsd:7005,maxAttempts:1},
  assumptions:[evidence('webSearchProviderDuckDuckGo')]}),'INVALID_TARIFF_ASSUMPTION');
 // With the free assumption alone the paid search is excluded rather than charged 1 µUSD.
 assert.equal(generalReadTariff({id:'search_public_web',version:'0.2.0'},['webSearchProviderAgentCore']),null);
 assert.equal(generalReadTariff({id:'search_public_web',version:'0.2.0'},['webSearchProviderDuckDuckGo']),1);
});

test('malformed admissions, an unknown provider price and a non-search allocation are refused',()=>{
 for(const webSearchAdmission of [
  {provider:'agentcore-web-search',unitMicroUsd:1,maxAttempts:1},
  {provider:'agentcore-web-search',unitMicroUsd:7005,maxAttempts:3},
  {provider:'duckduckgo',unitMicroUsd:7005,maxAttempts:1},
  {provider:'agentcore-web-search',unitMicroUsd:7005},
  {provider:'agentcore-web-search',unitMicroUsd:'7005',maxAttempts:1},
  {provider:'agentcore-web-search',unitMicroUsd:7005,maxAttempts:1,extra:true}]){
  refused(()=>compose({webSearchAdmission,assumptions:[evidence('webSearchProviderAgentCore')]}),'INVALID_WEB_SEARCH_ADMISSION');
 }
 // The admission is only valid with the search read actually allocated.
 refused(()=>compose({operations:[{id:'describe_capiro_data',version:'0.2.0'}],
  webSearchAdmission:{provider:'agentcore-web-search',unitMicroUsd:7005,maxAttempts:1},
  assumptions:[evidence('webSearchProviderAgentCore')]}),'INVALID_GENERAL_READ_MANIFEST');
 assert.equal(webSearchCharge({provider:'agentcore-web-search',unitMicroUsd:7005,maxAttempts:2}),14010);
});

test('the reserved hold fits the run cap and an oversized admission is reported as exhausted',()=>{
 refused(()=>compose({runBudgets:{...GENERAL_READ_DEFAULT_RUN_BUDGETS,maxCostMicroUSD:7005},
  webSearchAdmission:{provider:'agentcore-web-search',unitMicroUsd:7005,maxAttempts:2},
  assumptions:[evidence('webSearchProviderAgentCore')]}),'BUDGET_EXHAUSTED');
 const fits=compose({runBudgets:{...GENERAL_READ_DEFAULT_RUN_BUDGETS,maxCostMicroUSD:14010},
  webSearchAdmission:{provider:'agentcore-web-search',unitMicroUsd:7005,maxAttempts:2},
  assumptions:[evidence('webSearchProviderAgentCore')]}).allocation;
 assert.equal(chargeOf(fits,'search_public_web'),14010);
});
