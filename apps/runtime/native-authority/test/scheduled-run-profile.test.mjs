import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduledRunProfile} from '../scheduled-run-profile.mjs';
import {allocation} from '../../../gateway/budget/tool-budget-binding.mjs';
import {createNextRunOwner} from '../../../control/conversations/next-run.mjs';
import {scheduledRunProfileFixture,id,hash} from './scheduled-run-profile-fixture.mjs';
const copy=v=>structuredClone(v),code=c=>e=>e.code==='SCHEDULE_RUN_PROFILE_'+c;

test('canonical OPEN origin seals private allocation bytes without changing the approved manifest or budgets',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const before={runs:h.conversations.state.runs.size,inputs:h.conversations.allocations.size,events:h.conversations.state.events.size};
 const result=await h.profile.read(h.call()),sealed=allocation(result.allocationJson),at=h.now();
 assert.equal(result.expiresAtMs,at+20000);assert.equal(result.maxCostMicroUSD,1000);
 assert.deepEqual(result.occurrenceCostScope,{version:1,kind:'schedule-occurrence',occurrenceKey:h.identity.occurrenceKey,originBinding:h.identity.binding,maxCostMicroUSD:2000});
 assert.deepEqual(sealed.run,Object.fromEntries(Object.keys(h.allocation.run).map(k=>[k,h.identity.binding[k]])));
 assert.deepEqual(sealed.manifest,h.allocation.manifest);assert.deepEqual(sealed.budgets,h.allocation.budgets);
 assert.equal(result.allocationSha256,hash(sealed));assert.deepEqual(sealed.occurrenceCostScope,result.occurrenceCostScope);
 assert(Object.isFrozen(result));assert(Object.isFrozen(result.occurrenceCostScope.originBinding));
 assert.deepEqual({runs:h.conversations.state.runs.size,inputs:h.conversations.allocations.size,events:h.conversations.state.events.size},before);
 assert.equal(h.state.originReads,2);
});

test('narrower configured runtime cap does not change the immutable occurrence group cap',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);
 const first=await h.profile.read(h.call()),narrower=await createScheduledRunProfile({...h.configuration,maxCostMicroUSD:75}).read(h.call());
 assert.equal(narrower.maxCostMicroUSD,75);assert.deepEqual(narrower.occurrenceCostScope,first.occurrenceCostScope);
 assert.equal(narrower.allocationSha256,first.allocationSha256);
});

test('actual APPLIED same-work resume shares one origin/cost group and never renews expiry',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const original=await h.profile.read(h.call());
 await h.running();await h.pause();h.advance(1000);const binding=await h.resume();
 const resumed=await h.profile.read(h.call(binding));assert.deepEqual(resumed.occurrenceCostScope,original.occurrenceCostScope);
 assert.equal(resumed.expiresAtMs,original.expiresAtMs);assert.notEqual(resumed.allocationSha256,original.allocationSha256);
 assert.equal(allocation(resumed.allocationJson).run.runId,binding.runId);
 await assert.rejects(h.profile.read(h.call()),code('LINEAGE'));
 h.advance(19000);await assert.rejects(h.profile.read(h.call(binding)),code('EXPIRY'));
});

test('original accepted expiry and explicit shorter issuance expiry both constrain runtime',async t=>{
 const h=await scheduledRunProfileFixture({maxRuntimeSeconds:7});t.after(h.close);const at=h.now();
 assert.equal((await h.profile.read(h.call())).expiresAtMs,at+7000);
 assert.equal((await h.profile.read({...h.call(),expiresAtMs:at+3000})).expiresAtMs,at+3000);
 h.advance(1000);assert.equal((await h.profile.read(h.call())).expiresAtMs,at+7000);
});

test('charge schedule expiry remains an independent earlier bound',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const a=copy(h.allocation);a.schedule.expiresAt=new Date(h.now()+2000).toISOString();
 const result=await createScheduledRunProfile({...h.configuration,allocationJson:JSON.stringify(a)}).read(h.call());
 assert.equal(result.expiresAtMs,h.now()+2000);
});

test('an originally shorter accepted authority window survives later wider policy on resume',async t=>{
 const h=await scheduledRunProfileFixture({authorityWindowMs:5000});t.after(h.close);const at=h.now();
 assert.equal((await h.profile.read(h.call())).expiresAtMs,at+5000);
 await h.running();await h.pause();h.advance(1000);h.policy.expiresAtMs=h.now()+60000;const binding=await h.resume();
 assert.equal((await h.profile.read(h.call(binding))).expiresAtMs,at+5000);
});

test('confirmed absence leaves normal profile unchanged, but disappearing custody is never absence',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);
 assert.equal(await h.profile.read({...h.call(),binding:{...h.identity.binding,conversationId:id(990)}}),null);
 h.state.onRead=n=>{if(n===4)h.scheduleSql.state.occurrences.clear();};
 await assert.rejects(h.profile.read(h.call()));
});

test('a newly appearing origin during absence check cannot select the normal path',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const stored=copy(h.storedOrigin());h.scheduleSql.state.occurrences.clear();
 h.state.onRead=n=>{if(n===2)h.scheduleSql.state.occurrences.set(stored.tenant_id+':'+stored.occurrence_key,stored);};
 await assert.rejects(h.profile.read(h.call()),code('ORIGIN'));
});

for(const state of ['DISPATCHED','REFUSED'])test(state+' custody never grants fresh scheduled profile',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);h.storedOrigin().state=state;
 await assert.rejects(h.profile.read(h.call()),code('ORIGIN'));
});

for(const [label,change]of [
 ['actor',q=>q.binding.actorId='foreign'],['target run',q=>q.binding.runId=id(999)],
 ['scope widening',q=>q.scopes.push({...q.scopes[0],resourceId:id(998)})]
])test(label+' cannot select another work profile',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const q=copy(h.call());change(q);await assert.rejects(h.profile.read(q));
});

for(const [label,change]of [
 ['task id',c=>c.task.taskId=id(998)],['task version',c=>c.task.version++],['selected client',c=>c.selectedClientId=id(997)],
 ['allocation tenant',c=>{const a=JSON.parse(c.allocationJson);a.run.tenantId='foreign';c.allocationJson=JSON.stringify(a);}],
 ['allocation actor',c=>{const a=JSON.parse(c.allocationJson);a.run.actorId='foreign';c.allocationJson=JSON.stringify(a);}]
])test('configured '+label+' mismatch fails closed on positive origin',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const c={...h.configuration,task:copy(h.configuration.task)};change(c);
 await assert.rejects(createScheduledRunProfile(c).read(h.call()));
});

test('rehash of a foreign effect is rejected by canonical custody, not adopted as new origin',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const r=h.storedOrigin();r.effect.binding.actorId='foreign';r.effect_sha256=hash(r.effect);
 await assert.rejects(h.profile.read(h.call()));
});

test('pre-existing private scope must match canonical cap and origin; it cannot silently disappear',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const admitted=await h.profile.read(h.call());
 const c={...h.configuration,allocationJson:admitted.allocationJson};assert.equal((await createScheduledRunProfile(c).read(h.call())).allocationSha256,admitted.allocationSha256);
 const changed=JSON.parse(c.allocationJson);changed.occurrenceCostScope.maxCostMicroUSD--;
 await assert.rejects(createScheduledRunProfile({...c,allocationJson:JSON.stringify(changed)}).read(h.call()),code('SCOPE'));
 h.scheduleSql.state.occurrences.clear();await assert.rejects(createScheduledRunProfile(c).read(h.call()),code('ORIGIN'));
});

for(const state of ['PENDING','DISPATCHING','UNKNOWN'])test('unresolved '+state+' resume never admits a profile',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);await h.running();await h.pause();const binding=await h.resume();
 const row=[...h.conversations.state.controls.values()].find(r=>r.projection.input.intent==='resume');row.projection.state=state;row.projection_sha256=hash(row.projection);
 await assert.rejects(h.profile.read(h.call(binding)),code('LINEAGE'));
});

test('fork and new-prompt work are not adopted as scheduled continuation',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);await h.running();await h.pause();await h.resume();
 const row=[...h.conversations.state.controls.values()].find(r=>r.projection.input.intent==='resume');row.projection.input.intent='fork';row.projection.target.binding.conversationId=id(880);row.projection.target.binding.writerFence=1;row.projection.target.targetSessionId=id(881);row.projection.retirement=null;row.projection.inputSha256=hash(row.projection.input);row.projection_sha256=hash(row.projection);
 await assert.rejects(h.profile.read(h.call()),code('LINEAGE'));
 const g=await scheduledRunProfileFixture({allocated:false});t.after(g.close);await g.cancel();let next=4500;
 const owner=createNextRunOwner({store:g.store,retirement:{verifyRetired(){assert.fail('foreclosed');}},revocation:{verifyRevoked(){assert.fail('foreclosed');}},versions:g.template.versions,now:g.now,newId:()=>id(next++)});
 await owner.selectRun({principal:g.template.principal,conversationId:g.identity.binding.conversationId});await assert.rejects(g.profile.read(g.call()),code('LINEAGE'));
});

test('positive custody with missing original accepted run cannot fall back to normal profile',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);h.conversations.state.runs.clear();await assert.rejects(h.profile.read(h.call()),code('LINEAGE'));
});

test('deadline/cancellation and late canonical reads do not release a profile',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);const cancelled=new AbortController();cancelled.abort();
 await assert.rejects(h.profile.read({...h.call(),signal:cancelled.signal}),code('DEADLINE'));assert.equal(h.state.originReads,0);
 h.state.onRead=()=>h.advance(1000);await assert.rejects(h.profile.read(h.call()),code('DEADLINE'));
});

test('cancellation of a pending read returns no profile and releases the borrowed SQL boundary after it settles',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);let release,started;
 const ready=new Promise(resolve=>started=resolve),blocked=new Promise(resolve=>release=resolve),abort=new AbortController();
 h.state.onRead=async()=>{started();await blocked;};
 const pending=h.profile.read({...h.call(),signal:abort.signal});await ready;abort.abort();
 await assert.rejects(pending,code('CANCELLED'));h.state.onRead=null;release();
 await new Promise(resolve=>setImmediate(resolve));assert.equal((await h.profile.read(h.call())).expiresAtMs,h.now()+20000);
});

test('foreign thrown errors are sanitized without inspecting proxy traps or message getters',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);let touches=0;
 const thrown=new Proxy({}, {get(){touches++;throw Error('private error');},getOwnPropertyDescriptor(){touches++;throw Error('private error');}});
 const reader=createScheduledRunProfile({...h.configuration,scheduleOwner:{async readOccurrenceForConversation(){throw thrown;}}});
 await assert.rejects(reader.read(h.call()),code('REFUSED'));assert.equal(touches,0);
});

test('constructor and request reject proxies/accessors without running them or allocating effects',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);let touches=0;const getter={...h.configuration};Object.defineProperty(getter,'task',{enumerable:true,get(){touches++;return {};}});
 assert.throws(()=>createScheduledRunProfile(getter),code('CONFIGURATION'));
 assert.throws(()=>createScheduledRunProfile(new Proxy({}, {ownKeys(){touches++;return [];}})),code('CONFIGURATION'));
 const store={...h.store};Object.defineProperty(store,'initialInputs',{get(){touches++;return {};}});assert.throws(()=>createScheduledRunProfile({...h.configuration,store}),code('CONFIGURATION'));
 const request={...h.call()};Object.defineProperty(request,'scopes',{enumerable:true,get(){touches++;return [];}});
 await assert.rejects(h.profile.read(request));assert.equal(touches,0);assert.equal(h.state.originReads,0);
});

test('constructor never coerces a non-string configured client identity',async t=>{
 const h=await scheduledRunProfileFixture();t.after(h.close);let coerced=0;
 const selectedClientId={toString(){coerced++;return h.template.selectedClientId;}};
 assert.throws(()=>createScheduledRunProfile({...h.configuration,selectedClientId}),code('CONFIGURATION'));
 assert.equal(coerced,0);assert.equal(h.state.originReads,0);
});
