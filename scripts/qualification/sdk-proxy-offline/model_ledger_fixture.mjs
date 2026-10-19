/** Qualification SQL boundary only. Actual admission, pricing and settlement
 * remain in the canonical product owners; this fixture is not PostgreSQL proof. */
import {createHash} from 'node:crypto';
import {occurrenceCostFixture,NOW} from '../../../apps/gateway/budget/test/occurrence-cost-scope-fixture.mjs';
import {PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS} from '../../../apps/gateway/model-proxy/product-envelope.mjs';
import {PRODUCT_PROXY_PRICING_REVISION} from '../../../apps/proxy/product/startup-config.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createNativeAllocationAdmission} from '../../../apps/gateway/budget/native-allocation-admission.mjs';

export const SYNTHETIC_KEY='synthetic-offline-sdk-proxy-key-000001';
export const QUALIFICATION_BUDGET_MICRO_USD=250000;
export const STRUCTURED_OUTPUT_SCHEMA_JSON=JSON.stringify({type:'object',properties:{reply:{type:'string'}},
 required:['reply'],additionalProperties:false});
export async function createModelLedgerFixture(){
 const seed=occurrenceCostFixture(),prepared=await seed.attempt(1,{costScope:null,install:false}),now=Date.now();
 seed.advance(now-NOW);
 // New, explicitly synthetic admission: construct matching manifest/allocation,
 // facts and current dates BEFORE the canonical owner persists them. Never
 // mutate a stored original, change its budget, or claim this is its source pin.
 const manifest={...prepared.a.manifest,budgets:{...prepared.a.manifest.budgets,
  maxCostMicroUSD:QUALIFICATION_BUDGET_MICRO_USD}};
 const allocation={...prepared.a,manifest,manifestSha256:canonicalSha256(manifest),budgets:manifest.budgets,
  schedule:{...prepared.a.schedule,expiresAt:new Date(now+60000).toISOString()}};
 const grantIntents=prepared.config.grantIntents.map((intent,index)=>({...intent,
  capabilitySha256:index===1?createHash('sha256').update(SYNTHETIC_KEY).digest('hex'):intent.capabilitySha256,
  expiresAtMs:now+50000}));
 const allocationJson=JSON.stringify(allocation),facts=prepared.facts.map((fact,index)=>({...fact,
  capabilitySha256:grantIntents[index].capabilitySha256,allocationSha256:canonicalSha256(allocation)}));
 await createNativeAllocationAdmission({...prepared.config,allocationJson,grantIntents,now:()=>seed.now()})
  .admit({taskArn:prepared.taskArn});
 const selected=facts[1];
 const pricing={modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',
  revision:PRODUCT_PROXY_PRICING_REVISION,validUntilMs:now+120000,
  actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,
  maxInputTokens:PRODUCT_MAX_INPUT_TOKENS,maxOutputTokens:PRODUCT_MAX_OUTPUT_TOKENS};
 const config={pool:seed.pool,allocationJson,
  grantFactsJsons:facts.map(JSON.stringify),modelGrantId:selected.grantId,
  selectedClientId:prepared.modelConfig.selectedClientId,pricing,now:Date.now,
  limits:{maxRequestMs:3000,maxFactBytes:131072},
  async checkCurrentConversation(){const at=Date.now();return {identitySha256:'a'.repeat(64),
   binding:selected.binding,scopes:[{kind:'client',tenantId:selected.binding.tenantId,
    resourceId:prepared.modelConfig.selectedClientId,policyRevision:selected.qualificationBinding.policyRevision}],
   selectedClientId:prepared.modelConfig.selectedClientId,contextRevision:'b'.repeat(64),
   checkedAtMs:at,expiresAtMs:at+10000};}};
 return {seed,selected,config,syncClock(){seed.advance(Date.now()-seed.now());},
  snapshot(){return {syntheticAllocation:true,maxCostMicroUSD:QUALIFICATION_BUDGET_MICRO_USD,
   allocationSha256:canonicalSha256(allocation),manifestSha256:canonicalSha256(manifest),
   requests:[...seed.state().requests.values()].map(r=>({requestId:r.request_id,
   state:r.state,holdMicroUSD:r.hold_micro_usd,actualMicroUSD:r.actual_micro_usd,
   inputTokens:r.input_tokens,maxOutputTokens:r.max_output_tokens})),
   consumedMicroUSD:seed.state().budget.consumed_micro_usd,
   quarantined:seed.state().budget.quarantined,
   reservationInserts:seed.queries.filter(q=>q.sql.startsWith('INSERT INTO meri_product_budget.requests(')).length,
   settlementUpdates:seed.queries.filter(q=>q.sql.startsWith('UPDATE meri_product_budget.requests SET')).length};}};
}
