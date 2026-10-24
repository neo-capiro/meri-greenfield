/** Canonical schedule/conversation journals; only the Core network boundary is scripted. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createNativeRoutineCurrent} from '../routines-run-current.mjs';
import {createRoutinesCoreClient} from '../routines-core-client.mjs';
import {scheduledRunProfileFixture,id} from './scheduled-run-profile-fixture.mjs';

async function fixture({general=false}={}){
 const h=await scheduledRunProfileFixture({agentcore:true,general,allocated:false,occurrenceCap:750});
 const state={firingCalls:0,currentCalls:0,allowed:true,rewrite:r=>r};
 const p=h.occurrence.projection,binding=h.identity.binding;
 const response=()=>({schemaVersion:1,tenantId:binding.tenantId,actorId:binding.actorId,clerkUserId:'synthetic-clerk',tenantSlug:'synthetic',role:'standard_user',scheduleId:p.scheduleId,occurrenceKey:h.identity.occurrenceKey,generation:1,consentId:id(444),binding,scopes:h.scopes,clientIds:general?[]:[h.template.selectedClientId],policyRevision:h.template.policyRevision,limits:{maxCostMicrousd:p.maxCostMicrousd,maxRuntimeSeconds:p.maxRuntimeSeconds,retryLimit:p.retryLimit},checkedAtMs:h.now(),effectExpiresAtMs:h.now()+10000});
 const wires=createRoutinesCoreClient({origin:'https://core.synthetic.invalid',getServiceSecret:async()=> 'synthetic-routine-service-secret',now:h.now,
  nativeCredentials:{nativeCredentialFor(){assert.fail('No unattended bearer');}},fetchImpl:async(url,options)=>{
   state.currentCalls++;assert.equal(url,'https://core.synthetic.invalid/api/internal/routines/current');assert.equal(options.headers.authorization,undefined);
   assert.equal(options.headers['x-internal-service-secret'],'synthetic-routine-service-secret');
   assert.deepEqual(JSON.parse(options.body),{schemaVersion:1,tenantId:binding.tenantId,scheduleId:p.scheduleId,occurrenceKey:h.identity.occurrenceKey,binding});
   return state.allowed?Response.json(state.rewrite(response())):Response.json({error:'refused'},{status:403});
  }});
 const firing={async authorize(q){state.firingCalls++;assert.equal(q.phase,'before_start');assert.deepEqual(q.projection,p);return {authorized:state.allowed,occurrenceKey:h.identity.occurrenceKey,scopes:h.scopes,expiresAtMs:h.now()+1000};}};
 const owner=createNativeRoutineCurrent({configuration:{limits:{requestMs:1000},agentcore:{runWindowMs:60000,policyRevision:h.template.policyRevision}},task:h.template.task,store:h.store,scheduleOwner:h.scheduleOwner,wires,firing,now:h.now});
 return {...h,state,owner,call:()=>({binding,deadlineMs:h.now()+1000})};
}

for(const general of [false,true])test(`native ${general?'General':'client'} routine keeps occurrence runtime and SDK cost caps with fresh Core reads`,async t=>{
 const h=await fixture({general});t.after(h.close);const began=h.now();
 const first=await h.owner.beforeExecution(h.call());assert.equal(first.expiresAtMs,began+20000,'short firing receipt does not replace execution budget');assert.equal(first.maxCostMicroUSD,750);
 const policy=await h.owner.modelPolicy(h.identity.binding,()=>{});assert.equal(policy.maxBudgetMicroUsd,750);
 const observed=await h.owner.forBinding(h.call());assert.equal(observed.record.expiresAtMs,began+10000);assert.equal(observed.record.selectedClientId,general?null:h.template.selectedClientId);
 h.advance(1000);assert.equal((await h.owner.beforeExecution(h.call())).expiresAtMs,began+20000);assert.equal(h.state.firingCalls,2);
 h.state.allowed=false;await assert.rejects(h.owner.beforeExecution(h.call()));await assert.rejects(h.owner.forBinding(h.call()));
});

for(const [label,mutate]of [
 ['generation',r=>({...r,generation:2})],['scope',r=>({...r,scopes:[{...r.scopes[0],resourceId:id(900)}]})],
 ['policy',r=>({...r,policyRevision:'changed'})],['cost limit',r=>({...r,limits:{...r.limits,maxCostMicrousd:751}})],
 ['foreign actor',r=>({...r,actorId:'foreign'})],['expiry',r=>({...r,effectExpiresAtMs:r.checkedAtMs})],['extra authority',r=>({...r,authorized:true})],
])test('routine Core '+label+' mismatch cannot release a profile',async t=>{
 const h=await fixture();t.after(h.close);h.state.rewrite=mutate;await assert.rejects(h.owner.forBinding(h.call()));
});

test('positive changed custody does not fall back to ordinary session authority',async t=>{
 const h=await fixture();t.after(h.close);h.storedOrigin().state='REFUSED';await assert.rejects(h.owner.beforeExecution(h.call()));assert.equal(h.state.firingCalls,0);assert.equal(h.state.currentCalls,0);
});

test('confirmed ordinary conversation leaves its native model policy intact',async t=>{
 const h=await fixture();t.after(h.close);h.scheduleSql.state.occurrences.clear();const policy=await h.store.readModelPolicy(h.identity.binding,()=>{});
 assert.equal(await h.owner.beforeExecution(h.call()),null);assert.deepEqual(await h.owner.modelPolicy(h.identity.binding,()=>{}),policy);assert.equal(h.state.firingCalls,0);
});
