/** Qualification SQL boundary only. Actual admission, pricing and settlement
 * remain in the canonical product owners; this fixture is not PostgreSQL proof. */
import {createHash} from 'node:crypto';
import {occurrenceCostFixture,NOW} from '../../../apps/gateway/budget/test/occurrence-cost-scope-fixture.mjs';
import {PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS} from '../../../apps/gateway/model-proxy/product-envelope.mjs';
import {PRODUCT_PROXY_PRICING_REVISION} from '../../../apps/proxy/product/startup-config.mjs';

export const SYNTHETIC_KEY='synthetic-offline-sdk-proxy-key-000001';
export async function createModelLedgerFixture(){
 const seed=occurrenceCostFixture(),attempt=await seed.attempt(1,{costScope:null});
 const selected={...attempt.facts[1],capabilitySha256:createHash('sha256').update(SYNTHETIC_KEY).digest('hex')};
 const facts=[attempt.facts[0],selected],state=seed.state(),now=Date.now();
 state.grants.get(selected.grantId).capability_sha256=selected.capabilitySha256;
 state.bindings.get(selected.grantId).facts=selected;
 state.allocations.get(selected.binding.runId).started_at=new Date(now-1000);
 seed.advance(now-NOW);
 const pricing={modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',
  revision:PRODUCT_PROXY_PRICING_REVISION,validUntilMs:now+120000,
  actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,
  maxInputTokens:PRODUCT_MAX_INPUT_TOKENS,maxOutputTokens:PRODUCT_MAX_OUTPUT_TOKENS};
 const config={pool:seed.pool,allocationJson:attempt.config.allocationJson,
  grantFactsJsons:facts.map(JSON.stringify),modelGrantId:selected.grantId,
  selectedClientId:attempt.modelConfig.selectedClientId,pricing,now:Date.now,
  limits:{maxRequestMs:3000,maxFactBytes:131072},
  async checkCurrentConversation(){const at=Date.now();return {identitySha256:'a'.repeat(64),
   binding:selected.binding,scopes:[{kind:'client',tenantId:selected.binding.tenantId,
    resourceId:attempt.modelConfig.selectedClientId,policyRevision:selected.qualificationBinding.policyRevision}],
   selectedClientId:attempt.modelConfig.selectedClientId,contextRevision:'b'.repeat(64),
   checkedAtMs:at,expiresAtMs:at+10000};}};
 return {seed,selected,config,syncClock(){seed.advance(Date.now()-seed.now());},
  snapshot(){return {requests:[...seed.state().requests.values()].map(r=>({requestId:r.request_id,
   state:r.state,holdMicroUSD:r.hold_micro_usd,actualMicroUSD:r.actual_micro_usd,
   inputTokens:r.input_tokens,maxOutputTokens:r.max_output_tokens})),
   consumedMicroUSD:seed.state().budget.consumed_micro_usd,
   quarantined:seed.state().budget.quarantined,
   reservationInserts:seed.queries.filter(q=>q.sql.startsWith('INSERT INTO meri_product_budget.requests(')).length,
   settlementUpdates:seed.queries.filter(q=>q.sql.startsWith('UPDATE meri_product_budget.requests SET')).length};}};
}
