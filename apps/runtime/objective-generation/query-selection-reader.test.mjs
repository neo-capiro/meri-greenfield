/** Existing protected Objective facts plus canonical run/settings; no model issuer or proxy. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createObjectiveQuerySelectionReader} from './query-selection-reader.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../control/conversations/usage.mjs';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,NOW=Date.parse('2026-10-16T12:00:00Z');
function fixture(){
 const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const sourceRequestSha256=hash({requestId:id(5),prompt:'Synthetic first prompt'}),task={grantId:id(6),capabilitySha256:'b'.repeat(64),expiresAtMs:NOW+10000};
 const facts={original:{binding,executionKey:hash(binding),expiresAtMs:task.expiresAtMs},grantId:task.grantId,grantIntents:[task],objectiveGeneration:{sourceAdmission:{generationJobId:id(8)}},objectiveStrategy:{executionSelection:{provider:'bedrock',model:SDK_MODEL_CONFIGURATION.model}}};
 const entry={issuance:{issuanceKey:hash(binding),binding,requestSha256:sourceRequestSha256,expiresAtMs:task.expiresAtMs,grantId:task.grantId,capabilitySha256:task.capabilitySha256,factsSha256:hash(facts)},...facts,factsSha256:hash(facts)};
 const state={at:NOW,entry,ready:true,factReads:0,policyReads:0,onPolicy:null};
 const preparedFacts={available(){return state.ready;},async read(){state.factReads++;return structuredClone(state.entry);}};
 const store={async readModelPolicy(actual,check){assert.deepEqual(actual,binding);state.policyReads++;check();state.onPolicy?.();return {maxTurns:20,maxBudgetMicroUsd:2000000,monthlyCapMicroUsd:10000000};}};
 const options={preparedFacts,store,enabled:true,now:()=>state.at,maxRequestMs:1000},query={binding,sourceRequestSha256};
 return {state,options,query,make:()=>createObjectiveQuerySelectionReader(options)};
}
test('issued Objective selection equals the direct SDK model and uses canonical run policy without a model grant',async()=>{
 const f=fixture(),result=await f.make().read(f.query);
 assert.deepEqual(result,{...f.query,provider:'bedrock',model:SDK_MODEL_CONFIGURATION.model,checkedAtMs:NOW,expiresAtMs:NOW+10000});
 assert.deepEqual([f.state.factReads,f.state.policyReads],[2,1]);assert.equal(f.state.entry.grantIntents.length,1);
});
test('disabled, unavailable or missing owners refuse without effect',async()=>{
 for(const change of [{enabled:false},{preparedFacts:undefined},{store:undefined}]){const f=fixture(),r=createObjectiveQuerySelectionReader({...f.options,...change});assert.equal(r.available(),false);await assert.rejects(r.read(f.query));assert.equal(f.state.factReads+f.state.policyReads,0);}
 const f=fixture();f.state.ready=false;await assert.rejects(f.make().read(f.query));assert.equal(f.state.factReads,0);
});
for(const [name,change] of [
 ['source substitution',f=>{f.query.sourceRequestSha256='d'.repeat(64);}],
 ['legacy proxy input',f=>{f.query.proxyUrl='https://synthetic.invalid';}],
 ['foreign actor',f=>{f.query.binding={...f.query.binding,actorId:'other'};}],
 ['facts digest',f=>{f.state.entry.objectiveStrategy.executionSelection.model='other';}],
 ['unapproved selection',f=>{f.state.entry.objectiveStrategy.executionSelection.model='other';const {issuance,factsSha256,...facts}=f.state.entry;f.state.entry.factsSha256=issuance.factsSha256=hash(facts);}],
 ['expired issuance',f=>{f.state.at=NOW+10000;}],
 ['canonical run refusal',f=>{f.options.store.readModelPolicy=async()=>{throw Error('run revoked');};}],
 ['owner lost during read',f=>{f.state.onPolicy=()=>{f.state.ready=false;};}],
 ['changed facts before release',f=>{f.state.onPolicy=()=>{f.state.entry.original.binding.actorId='changed';};}],
 ['expiry during read',f=>{f.state.onPolicy=()=>{f.state.at=NOW+10001;};}],
 ])test('Objective selection refuses '+name,async()=>{const f=fixture();change(f);await assert.rejects(f.make().read(f.query));});
test('cancellation refuses before any owner read',async()=>{const f=fixture(),c=new AbortController();c.abort();await assert.rejects(f.make().read({...f.query,signal:c.signal}));assert.equal(f.state.factReads+f.state.policyReads,0);});
