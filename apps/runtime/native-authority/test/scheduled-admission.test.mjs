import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,resolve} from 'node:path';
import {registerHooks} from 'node:module';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createScheduledNativeAdmission} from '../scheduled-admission.mjs';
import {createInitialRunBindingJournal} from '../../../control/conversations/initial-run-binding-journal.mjs';
import {createScheduledDispatch} from '../../../control/schedules/scheduled-dispatch.mjs';
import {occurrenceIdentity} from '../../../control/schedules/scheduled-occurrence.mjs';
import {scheduledAdmissionFixture,instruction,versions} from './scheduled-admission-fixture.mjs';
import {candidateFixture} from '../../test/prepared-candidate-fixture.mjs';
import {createMemoryIssuanceStore} from '../../prepared-run-issuance-store.mjs';
import {capabilityDigest} from '../task-verifier.mjs';
const copy=v=>structuredClone(v),none=()=>{},code=s=>e=>e.code===`SCHEDULE_ADMISSION_${s}`;
const counts=f=>({bindings:f.bindings.size,inputs:f.conversations.allocations.size,runs:f.conversations.state.runs.size,events:[...f.conversations.state.events.values()].flat().length});
const empty={bindings:0,inputs:0,runs:0,events:0};

test('actual binding/input journals admit one immutable occurrence and retain its original timestamp and expiry on replay',async()=>{
 const f=await scheduledAdmissionFixture(),at=f.now(),first=await f.adapter.admit(f.request);
 assert.deepEqual(first,{binding:f.identity.binding,requestSha256:hash(f.input.request),expiresAtMs:at+20000,replayed:false});
 assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:1,events:1});
 const record=await createInitialRunBindingJournal({pool:f.pool,now:f.now,newId:()=>assert.fail('replay must allocate no identity')}).read({binding:first.binding},none);
 assert.equal(record.createdAtMs,at);assert.equal(record.expiresAtMs,first.expiresAtMs);
 assert.equal(record.configurationSha256,f.template.configurationSha256);
 const original=await f.store.initialInputs.read(first.binding,none);assert.equal(original.state,'ACCEPTED');
 assert.equal(original.facts.allocatedAtMs,at);assert.equal(original.facts.expiresAtMs,first.expiresAtMs);
 f.advance(1000);const replay=copy(f.request);for(const key of ['conversation','run','event'])replay.input[key].createdAt=new Date(f.now()).toISOString();
 assert.deepEqual(await createScheduledNativeAdmission(f.options).admit(replay),{...first,replayed:true});
 assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:1,events:1});
 const saved=await f.store.readOptional(first.binding,{after:0,limit:1},none);
 assert.equal(saved.run.createdAt,new Date(at).toISOString());assert.equal(saved.events[0].createdAt,saved.run.createdAt);
 assert.equal(saved.request.prompt,instruction);assert.equal(Object.isFrozen(first.binding),true);
 assert.throws(()=>first.binding.actorId='changed');
 assert.deepEqual(f.policy.calls.map(q=>q.phase),['before_claim','before_accept','before_release','before_claim','before_accept','before_release']);
 for(const q of f.policy.calls){assert.equal(q.selectionSha256,hash(q.selection));assert.equal(q.selection.effectSha256,hash(f.effect));assert.deepEqual(q.selection.versions,versions);}
});

for(const flag of ['loseBindingCommit','loseAcceptanceCommit'])test(`committed ${flag} keeps the same identity/window and recovers through actual owners`,async()=>{
 const f=await scheduledAdmissionFixture(),at=f.now();f.faults[flag]=true;
 await assert.rejects(f.adapter.admit(f.request),code('UNKNOWN'));assert.equal(f.bindings.size,1);
 assert.equal([...f.scheduleSql.state.occurrences.values()][0].state,'OPEN');
 const old=copy([...f.bindings.values()][0]);f.advance(1000);
 const result=await createScheduledNativeAdmission(f.options).admit(f.request);
 assert.equal(result.expiresAtMs,at+20000);assert.equal(result.replayed,flag==='loseAcceptanceCommit');
 assert.deepEqual([...f.bindings.values()][0],old);assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:1,events:1});
});

test('concurrent same-occurrence requests share canonical journal claims and one event',async()=>{
 const f=await scheduledAdmissionFixture();const r=await Promise.all([f.adapter.admit(f.request),createScheduledNativeAdmission(f.options).admit(f.request)]);
 assert.deepEqual(r[0].binding,r[1].binding);assert.deepEqual(r.map(x=>x.replayed).sort(),[false,true]);
 assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:1,events:1});
});

test('allocation schedule and trusted authority bound runtime expiry; replay never renews it',async()=>{
 const f=await scheduledAdmissionFixture();f.policy.expiresAtMs=f.now()+5000;
 const first=await f.adapter.admit(f.request);assert.equal(first.expiresAtMs,f.now()+5000);
 f.advance(1000);f.policy.expiresAtMs=f.now()+60000;const replay=await f.adapter.admit(f.request);assert.equal(replay.expiresAtMs,first.expiresAtMs);
 f.advance(4000);await assert.rejects(f.adapter.admit(f.request),code('BINDING'));assert.equal(f.conversations.state.runs.size,1);
});

for(const [name,change]of [
 ['tenant',q=>q.effect.binding.tenantId='foreign'],['actor',q=>q.input.run.binding.actorId='foreign'],
 ['arbitrary binding',q=>q.input.run.binding.runId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
 ['occurrence key',q=>q.occurrenceKey='a'.repeat(64)],['barrier effect',q=>q.effect.workflowId='other'],
 ['generation',q=>q.occurrence.generation=2],['task',q=>q.occurrence.task.version=2],
 ['scope widening',q=>q.input.run.scopes.push({...q.input.run.scopes[0],resourceId:'another'})],
 ['request identity',q=>q.input.request.requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
 ['instruction',q=>q.input.request.prompt='Unapproved replacement instruction'],['skill',q=>q.input.request.skill={}],
 ['window',q=>q.input.request.window={}],['versions',q=>q.input.run.versions.sdk='other']
])test(`${name} cannot manufacture original native admission`,async()=>{
 const f=await scheduledAdmissionFixture(),request=copy(f.request);change(request);
 await assert.rejects(f.adapter.admit(request));assert.deepEqual(counts(f),empty);assert.equal(f.scheduleSql.state.occurrences.size,0);
});

for(const [name,change]of [
 ['policy',f=>f.template.policyRevision='new-policy'],['client',f=>f.template.selectedClientId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
 ['task version',f=>f.template.task={...f.template.task,version:2}],['destination',f=>f.template.destinationId='ui-guessed-inbox'],
 ['smaller cost',f=>{f.occurrence.projection.maxCostMicrousd--;f.intent.projection.maxCostMicrousd--; }],
 ['unsupported job retry',f=>{f.occurrence.projection.retryLimit=1;f.intent.projection.retryLimit=1;}]
])test(`configured ${name} mismatch never silently broadens or substitutes a profile`,async()=>{
 const f=await scheduledAdmissionFixture();change(f);
 // Mutated occurrence/intents are not authoritative: maintain the actual stored row's integrity for the two budget cases.
 if(name==='smaller cost'||name==='unsupported job retry'){
  const p=[...f.scheduleSql.state.projections.values()][0],i=[...f.scheduleSql.state.intents.values()][0];
  p.projection=copy(f.intent.projection);p.projection_sha256=hash(p.projection);i.intent=copy(f.intent);i.intent_sha256=hash(i.intent);
  f.request.occurrence=f.occurrence;
 }
 await assert.rejects(createScheduledNativeAdmission(f.options).admit(f.request));assert.deepEqual(counts(f),empty);
});

for(const [name,edit]of [
 ['selection digest',r=>r.selectionSha256='d'.repeat(64)],['binding',r=>r.binding={...r.binding,actorId:'other'}],
 ['scopes',r=>r.scopes=[]],['client',r=>r.selectedClientId='another'],['policy',r=>r.policyRevision='another'],
 ['configuration',r=>r.configurationSha256='d'.repeat(64)],['stale',r=>r.checkedAtMs--],['future',r=>r.checkedAtMs++],
 ['expired',r=>r.expiresAtMs=r.checkedAtMs],['extra field',r=>r.unreviewed=true],['denied',r=>r.authorized=false]
])test(`required current-policy receipt rejects ${name} before effects`,async()=>{
 const f=await scheduledAdmissionFixture();f.policy.onAuthorize=q=>{const r={authorized:true,selectionSha256:q.selectionSha256,binding:q.selection.binding,scopes:f.scopes,
  selectedClientId:f.template.selectedClientId,policyRevision:f.template.policyRevision,configurationSha256:f.template.configurationSha256,checkedAtMs:f.now(),expiresAtMs:f.now()+60000};edit(r);return r;};
 await assert.rejects(f.adapter.admit(f.request),code('AUTHORITY'));assert.deepEqual(counts(f),empty);assert.equal(f.scheduleSql.state.occurrences.size,0);
});

test('policy unavailability and unimplemented background authority never have a positive fallback',async()=>{
 const f=await scheduledAdmissionFixture();f.policy.onAuthorize=()=>{throw Error('private policy detail must not escape');};
 await assert.rejects(f.adapter.admit(f.request),e=>e.code==='SCHEDULE_ADMISSION_UNKNOWN'&&!e.message.includes('private'));
 const options={...f.options};delete options.authority;assert.throws(()=>createScheduledNativeAdmission(options),code('CONFIGURATION'));
 assert.deepEqual(counts(f),empty);
});

test('constructor validates trusted profile and ports without opening SQL or invoking accessors',async()=>{
 const f=await scheduledAdmissionFixture();
 for(const change of [o=>o.template.configurationSha256='invalid',o=>o.template.task.manifestSha256='a'.repeat(64),
  o=>o.template.principal.actorId='foreign',o=>o.template.allocationJson='{}',o=>o.maxRequestMs=0,o=>o.runAdmission={}]){
  const options={...f.options,template:copy(f.template)};change(options);assert.throws(()=>createScheduledNativeAdmission(options),code('CONFIGURATION'));
 }
 const store={};Object.defineProperty(store,'initialInputs',{get(){assert.fail('accessor evaluated');}});
 assert.throws(()=>createScheduledNativeAdmission({...f.options,store}),code('CONFIGURATION'));
 assert.throws(()=>createScheduledNativeAdmission({...f.options,store:new Proxy(f.store,{getOwnPropertyDescriptor(){assert.fail('proxy trap evaluated');}})}),code('CONFIGURATION'));
 assert.equal(f.queries.length,0);assert.deepEqual(counts(f),empty);
});

test('a policy proof for a later phase must cover the original pinned expiry, without shortening a replay record',async()=>{
 const f=await scheduledAdmissionFixture(),authorize=f.authority.authorize;
 f.policy.onAuthorize=async q=>{f.policy.onAuthorize=null;const receipt=await authorize(q);f.policy.onAuthorize=async next=>{f.policy.onAuthorize=null;const later=await authorize(next);return {...later,expiresAtMs:f.now()+1000};};return receipt;};
 await assert.rejects(f.adapter.admit(f.request),code('AUTHORITY'));
 assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:0,events:0});assert.equal([...f.bindings.values()][0].record.expiresAtMs,f.now()+20000);
 f.policy.onAuthorize=null;assert.equal((await f.adapter.admit(f.request)).expiresAtMs,f.now()+20000);
});

test('deadline after a binding COMMIT suppresses all later input effects and preserves stable recovery',async()=>{
 const f=await scheduledAdmissionFixture(),at=f.now();f.faults.onCommit=stage=>{if(stage==='binding')f.advance(1000);};
 await assert.rejects(f.adapter.admit({...f.request,deadlineMs:at+1000}));
 assert.deepEqual(counts(f),{bindings:1,inputs:0,runs:0,events:0});
 f.faults.onCommit=null;const recovered=await f.adapter.admit(f.request);assert.equal(recovered.expiresAtMs,at+20000);
});

test('acknowledged schedule changes during policy evaluation are rechecked before effects',async()=>{
 const f=await scheduledAdmissionFixture(),authorize=f.authority.authorize;
 f.policy.onAuthorize=async q=>{f.policy.onAuthorize=null;const receipt=await authorize(q);[...f.scheduleSql.state.projections.values()][0].active_intent='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';return receipt;};
 await assert.rejects(f.adapter.admit(f.request),code('STALE'));assert.deepEqual(counts(f),empty);assert.equal(f.scheduleSql.state.occurrences.size,0);
});

test('a different OPEN occurrence or settled effect cannot be reused as the admission barrier',async()=>{
 for(const mode of ['blocked','settled']){
  const f=await scheduledAdmissionFixture();let occurrence=f.occurrence,identity=f.identity;
  if(mode==='blocked'){occurrence={...f.occurrence,workflowId:'earlier-firing'};identity=occurrenceIdentity(occurrence);}
  await f.scheduleOwner.openOccurrence({tenantId:identity.binding.tenantId,scheduleId:occurrence.projection.scheduleId,generation:occurrence.generation,
   occurrenceKey:identity.occurrenceKey,occurrence,effect:f.effect},none);
  if(mode==='settled')await f.scheduleOwner.settleOccurrence({tenantId:identity.binding.tenantId,occurrenceKey:identity.occurrenceKey,effectSha256:hash(f.effect),state:'REFUSED'},none);
  await assert.rejects(f.adapter.admit(f.request),code('BARRIER'));assert.deepEqual(counts(f),empty);
 }
});

test('expired, cancelled and hostile requests allocate no binding or input',async()=>{
 const f=await scheduledAdmissionFixture(),aborted=new AbortController();aborted.abort();
 await assert.rejects(f.adapter.admit({...f.request,signal:aborted.signal}));
 await assert.rejects(f.adapter.admit({...f.request,deadlineMs:f.now()}));
 const getter={...f.request};Object.defineProperty(getter,'input',{enumerable:true,get(){assert.fail('getter evaluated');}});
 for(const q of [getter,new Proxy(f.request,{}),Object.assign(Object.create({unsafe:true}),f.request)])await assert.rejects(f.adapter.admit(q));
 assert.deepEqual(counts(f),empty);assert.equal(f.queries.length,0);
});

test('cancel during accepted COMMIT or release suppresses receipt and retains original identity for recovery',async()=>{
 for(const phase of ['commit','release']){
  const f=await scheduledAdmissionFixture(),controller=new AbortController();
  if(phase==='commit')f.faults.onCommit=stage=>{if(stage==='accept')controller.abort();};
  else f.faults.onRelease=stage=>{if(stage==='accept')controller.abort();};
  await assert.rejects(f.adapter.admit({...f.request,signal:controller.signal}));
  assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:1,events:1});
  f.faults.onCommit=null;f.faults.onRelease=null;
  assert.equal((await createScheduledNativeAdmission(f.options).admit(f.request)).replayed,true);
 }
});

test('acceptance failure rolls back actual request/event/input acceptance, retaining the stable reservation',async()=>{
 const f=await scheduledAdmissionFixture();f.conversations.faults.afterAccept=true;
 await assert.rejects(f.adapter.admit(f.request));assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:0,events:0});
 assert.equal([...f.conversations.allocations.values()][0].state,'RESERVED');
 f.conversations.faults.afterAccept=false;assert.equal((await f.adapter.admit(f.request)).replayed,false);
 assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:1,events:1});
});

function dispatch(f,runAdmission=f.adapter){return createScheduledDispatch({scheduleOwner:f.scheduleOwner,store:f.store,dispatcher:f.dispatcher,runs:f.runs,authority:f.firingAuthority,
 taskInstructions:{async read(){return {instruction};}},versions,now:f.now,runAdmission});}
test('actual dispatch -> native original journals -> store -> Temporal start uses one prompt and native-eligible durable binding',async()=>{
 const f=await scheduledAdmissionFixture(),owner=dispatch(f),first=await owner.dispatch({occurrence:f.occurrence});
 assert.equal(first.outcome,'DISPATCHED');assert.equal(first.admitted,true);assert.equal(f.temporal.workflows.size,1);
 const record=[...f.bindings.values()][0].record;assert.deepEqual(record.binding,first.binding);
 assert.equal(record.configurationSha256,f.template.configurationSha256);assert.deepEqual(record.versions,versions);
 assert.equal((await f.store.readOptional(first.binding,{after:0,limit:1},none)).request.prompt,instruction);
 assert.equal((await owner.dispatch({occurrence:f.occurrence})).outcome,'DISPATCHED');assert.equal(f.temporal.calls.start,1);
 assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:1,events:1});
});

for(const [name,edit]of [
 ['binding',r=>r.binding={...r.binding,actorId:'foreign'}],['request',r=>r.requestSha256='d'.repeat(64)],
 ['expiry',r=>r.expiresAtMs=0],['replay',r=>r.replayed='yes'],['extra',r=>r.untrusted=true]
])test(`dispatcher rejects malformed native ${name} receipt and keeps barrier OPEN`,async()=>{
 const f=await scheduledAdmissionFixture(),runAdmission={async admit(q){const r=copy(await f.adapter.admit(q));edit(r);return r;}};
 const result=await dispatch(f,runAdmission).dispatch({occurrence:f.occurrence});
 assert.equal(result.outcome,'UNKNOWN');assert.equal(result.admitted,null);assert.equal(f.temporal.calls.start,0);
 assert.equal([...f.scheduleSql.state.occurrences.values()][0].state,'OPEN');assert.equal(f.conversations.state.runs.size,1);
});
test('receipt without real accepted request never starts a workflow',async()=>{
 const f=await scheduledAdmissionFixture(),runAdmission={async admit(q){return {binding:q.effect.binding,requestSha256:hash(q.input.request),expiresAtMs:f.now()+10000,replayed:false};}};
 const result=await dispatch(f,runAdmission).dispatch({occurrence:f.occurrence});assert.equal(result.outcome,'UNKNOWN');assert.equal(f.temporal.calls.start,0);assert.deepEqual(counts(f),empty);
});

test('UNKNOWN after native before_release cannot start its accepted run until the same native proof is recovered',async()=>{
 const f=await scheduledAdmissionFixture(),owner=dispatch(f);
 let unavailable=false;
 f.policy.onAuthorize=q=>{
  if(unavailable||q.phase==='before_release')throw Error('synthetic current native policy unavailable');
  return {authorized:true,selectionSha256:q.selectionSha256,binding:q.selection.binding,scopes:f.scopes,selectedClientId:f.template.selectedClientId,
   policyRevision:f.template.policyRevision,configurationSha256:f.template.configurationSha256,checkedAtMs:f.now(),expiresAtMs:f.now()+60000};
 };
 const first=await owner.dispatch({occurrence:f.occurrence});assert.equal(first.outcome,'UNKNOWN');assert.equal(first.admitted,null);
 assert.equal(f.conversations.state.runs.size,1);assert.equal(f.temporal.calls.start,0);assert.equal(f.policy.calls.length,3);
 unavailable=true;f.advance(1000);
 const second=await owner.dispatch({occurrence:f.occurrence});assert.equal(second.outcome,'UNKNOWN');assert.equal(second.admitted,true);
 assert.equal(f.policy.calls.length,4,'recovery must attempt fresh native admission');assert.equal(f.temporal.calls.start,0);
 assert.equal([...f.scheduleSql.state.occurrences.values()][0].state,'OPEN');
 f.policy.onAuthorize=null;const recovered=await owner.dispatch({occurrence:f.occurrence});assert.equal(recovered.outcome,'DISPATCHED');
 assert.equal(f.temporal.calls.start,1);assert.deepEqual(counts(f),{bindings:1,inputs:1,runs:1,events:1});
 assert.equal([...f.bindings.values()][0].record.createdAtMs,f.now()-1000);
});

test('a legacy bare accepted queued run cannot bypass required original native eligibility on replay',async()=>{
 const f=await scheduledAdmissionFixture();await f.store.accept(f.input,none);
 assert.deepEqual(counts(f),{bindings:0,inputs:0,runs:1,events:1});
 const result=await dispatch(f).dispatch({occurrence:f.occurrence});assert.equal(result.outcome,'UNKNOWN');assert.equal(result.admitted,true);
 assert.equal(f.temporal.calls.start,0);assert.equal(f.bindings.size,0);assert.equal(f.conversations.allocations.size,0);
 assert.equal([...f.scheduleSql.state.occurrences.values()][0].state,'OPEN');
});

test('an already observed started occurrence needs no replacement native proof or second effect',async()=>{
 const f=await scheduledAdmissionFixture(),owner=dispatch(f);assert.equal((await owner.dispatch({occurrence:f.occurrence})).outcome,'DISPATCHED');
 const calls=f.policy.calls.length;f.policy.onAuthorize=()=>{throw Error('synthetic native policy unavailable');};
 assert.equal((await owner.dispatch({occurrence:f.occurrence})).outcome,'DISPATCHED');assert.equal(f.policy.calls.length,calls);assert.equal(f.temporal.calls.start,1);
});

test('actual journal-backed schedule admission is accepted by existing native prepareInitial with the same original window',async()=>{
 // This sparse checkout borrows dependency packages without the workspace @capiro link. Resolve its declared node entry to
 // the exact local canonical validator; no module implementation is replaced. Ordinary installed workspaces use the same file.
 const hook=registerHooks({resolve(specifier,context,next){return specifier==='@capiro/meri-contracts/node'?
  {url:new URL('../../../../packages/contracts/validate.mjs',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
 let createPreparedRunBindings;try{({createPreparedRunBindings}=await import('../../prepared-run-bindings.mjs'));}finally{hook.deregister();}
 const candidate=candidateFixture(),c=candidate.configuration.nativeCandidate,at=candidate.now;
 for(const key of ['workspace','configParentDirectory','secureStorageDirectory'])c.preparationIntent[key]=normalize(c.preparationIntent[key]);
 c.preparationIntent.launchTemplate.command=normalize(c.preparationIntent.launchTemplate.command);
 c.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=c.preparationIntent.secureStorageDirectory;
 c.multiRun={runWindowMs:60000,materialDirectory:resolve('synthetic-schedule-material'),dynamicInitialRuns:true};
 c.runtime.deadlineMs=at+120000;const a=JSON.parse(c.allocationJson);a.schedule.expiresAt=new Date(c.runtime.deadlineMs).toISOString();c.allocationJson=JSON.stringify(a);
 for(const intent of c.grantIntents)intent.expiresAtMs=c.runtime.deadlineMs;
 const f=await scheduledAdmissionFixture({nativeCandidate:c,clockMs:at}),initialBindings=createInitialRunBindingJournal({pool:f.pool,now:f.now});
 const calls={task:0,model:0};
 // Explicit synthetic material producers; native records, preparation and issuance logic are the actual existing owners.
 const capability='synthetic-scheduled-task-grant-0001',proxyCredential='synthetic-scheduled-model-grant-0001';
 const capabilityAuthority={async generate(){calls.task++;return {grantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',capability,materialRef:'synthetic-scheduled-material'};},async retrieve(){return {state:'PRESENT',capability};},async status(){return {state:'ABSENT'};}};
 const modelRows=new Map(),modelGrants={async issue({intent}){const old=modelRows.get(intent.issuanceKey);if(old){assert.deepEqual(Object.fromEntries(Object.keys(intent).map(k=>[k,old[k]])),intent);return old;}
  calls.model++;const receipt={...intent,grantId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',capabilitySha256:capabilityDigest(proxyCredential),proxyCredential};modelRows.set(intent.issuanceKey,receipt);return receipt;}};
 const native=createPreparedRunBindings({configuration:candidate.configuration,pool:f.pool,store:f.store,credentials:{control:candidate.secret.control},
  issuanceStore:createMemoryIssuanceStore(),capabilityAuthority,modelGrants,initialBindings,now:f.now});
 f.template.configurationSha256=native.configurationSha256;
 const receipt=await createScheduledNativeAdmission(f.options).admit(f.request);
 const prepared=await native.prepareInitial({binding:receipt.binding});assert.deepEqual(prepared.original.binding,receipt.binding);assert.equal(prepared.original.expiresAtMs,receipt.expiresAtMs);
 const facts=await native.runIssuance.resolveFacts(prepared.issuance);
 assert.equal(facts.runtime.deadlineMs,receipt.expiresAtMs);assert.equal(facts.preparationIntent.workspace.endsWith(receipt.binding.conversationId),true);
 assert.deepEqual(JSON.parse(facts.allocationJson).run,Object.fromEntries(Object.keys(a.run).map(k=>[k,receipt.binding[k]])));
 assert.deepEqual(await native.prepareInitial({binding:receipt.binding}),prepared);assert.deepEqual(calls,{task:1,model:1});
 assert.equal(f.conversations.state.allocations.size,0,'preparation/issuance never starts an ECS task');
});
