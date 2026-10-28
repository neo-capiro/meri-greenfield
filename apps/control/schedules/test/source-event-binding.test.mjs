// MB-05 binding approval: the REAL binding owner over the REAL schedule owner and the scripted
// 0007 SQL. The approved trigger is the closed field on the schedule's acknowledged IMMUTABLE
// intent (the public slot M5 owns); everything here is synthetic local source — no model, provider,
// database, network or browser is contacted, and this suite is not a PostgreSQL qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceEventFixture, ids, sourceEvent, harnessIds, otherResourceKey, sourceTrigger, approvedIntent, NOW,
} from './source-event-fixture.mjs';
import {createSourceEventBinding} from '../source-event-binding.mjs';
import {updateIntent, cancelIntent, createIntent, ownerBinding} from './scheduled-dispatch-harness.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createScheduleLifecycle} from '../schedule-lifecycle.mjs';
import {createRoutinesApplication} from '../application-http.mjs';

const pair = (h, changes = {}) => ({
  tenantId: 'tenant-a', scheduleId: harnessIds.schedule, producer: 'bizdev.watch.alert.v1',
  sourceFamily: 'federal_award', resourceKey: ids.watch, ...changes,
});
const refused = async (run, code) => {
  await assert.rejects(run, error => error.code === code);
};

test('an ordinary acknowledged cron is not an approval: binding fails closed and writes nothing', async () => {
  const h = await sourceEventFixture({approval: 'absent'});
  await refused(() => h.binding.bind(pair(h)), 'SOURCE_EVENT_TRIGGER_UNAPPROVED');
  assert.equal(h.bindingRow(), null);
  // Nothing can be read either, and an event for that pair has no authority at all.
  assert.equal(await h.binding.lookup(pair(h)), null);
  assert.equal(await h.binding.read(pair(h)), null);
  const event = sourceEvent();
  h.authorize(event);
  assert.deepEqual({disposition: (await h.receive(event)).disposition, code: (await h.receive(event)).code},
    {disposition: 'REFUSED', code: 'SOURCE_EVENT_BINDING_ABSENT'});
  assert.equal(h.temporal.calls.start, 0);
});

test('a trigger approved for a different pair approves only that pair', async () => {
  const h = await sourceEventFixture({approval: 'mismatched'});
  // The intended pair is not approved at all; the pair the schedule IS approved for binds, and only it.
  await refused(() => h.binding.bind(pair(h)), 'SOURCE_EVENT_TRIGGER_UNAPPROVED');
  assert.equal(h.bindingRow().resource_key, otherResourceKey);
  const other = await h.binding.bind(pair(h, {resourceKey: otherResourceKey}));
  assert.equal(other.created, false);
  assert.equal(h.fixture.bindings.size, 1);
  assert.equal(await h.binding.lookup(pair(h)), null);
  assert.equal((await h.binding.lookup(pair(h, {resourceKey: otherResourceKey}))).scheduleId, harnessIds.schedule);
  // A different family or producer is likewise not approved by this schedule.
  await refused(() => h.binding.bind(pair(h, {sourceFamily: 'sam_opportunity'})), 'SOURCE_EVENT_TRIGGER_UNAPPROVED');
  await refused(() => h.binding.bind(pair(h, {producer: 'mailbox.v1'})), 'SOURCE_EVENT_TRIGGER_UNAPPROVED');
  assert.equal(h.fixture.bindings.size, 1);
  // And the event for the unapproved pair has no authority at all.
  const event = sourceEvent();
  h.authorize(event);
  assert.equal((await h.receive(event)).code, 'SOURCE_EVENT_BINDING_ABSENT');
  assert.equal(h.temporal.calls.start, 0);
});

test('the approved trigger is closed: an extra field is refused by the canonical lifecycle owner, not ignored', async () => {
  const h = await sourceEventFixture({approval: 'widened', acknowledgeInitial: false});
  // The refusal is the 0.3 lifecycle owner's own shape refusal for the config's closed selector — the binding does not
  // re-label it, and nothing is written or readable as an approval.
  await refused(() => h.acknowledge(createIntent()), 'SCHEDULE_DATA');
  assert.equal(h.bindingRow(), null);
  assert.equal(await h.binding.lookup(pair(h)), null);
});

test('only the acknowledged generation is bound, and a caller-supplied generation is not authority', async () => {
  const h = await sourceEventFixture();
  const stored = await h.binding.bind(pair(h, {generation: 7}));
  assert.equal(stored.created, false);
  assert.equal(stored.binding.generation, 1);
  assert.equal(Number(h.bindingRow().generation), 1);
  // Idempotent replay of the same approved generation appends nothing.
  const replay = await h.binding.bind(pair(h));
  assert.equal(replay.created, false);
  assert.equal(h.fixture.bindings.size, 1);
});

test('a later approved generation appends its own row and never retargets the older binding', async () => {
  const h = await sourceEventFixture();
  await h.binding.bind(pair(h));
  await h.acknowledge(updateIntent());
  const second = await h.binding.bind(pair(h));
  assert.equal(second.created, false);
  assert.equal(second.binding.generation, 2);
  // Append-only index keyed by generation: both rows exist, newest first.
  const rows = await h.store.readBinding(pair(h), () => {});
  assert.deepEqual(rows.map(row => row.generation), [2, 1]);
  // The read for the routine returns the CURRENT approved generation only, and the producer-facing
  // lookup confirms it against the canonical owner.
  assert.equal((await h.binding.read(pair(h))).generation, 2);
  assert.equal((await h.binding.lookup(pair(h))).generation, 2);
  // A crash/ACK-loss read is derivable only from the exact acknowledged generation.
  assert.deepEqual((await h.store.readBinding({...pair(h), generation: 1}, () => {})).map(r => r.generation), [2, 1]);
  // The older generation's event is stale, not silently re-targeted to the newer approval.
  const event = sourceEvent();
  h.authorize(event);
  assert.deepEqual({disposition: (await h.receive(event)).disposition, code: (await h.receive(event)).code},
    {disposition: 'REFUSED', code: 'SOURCE_EVENT_BINDING_STALE'});
  assert.equal(h.temporal.calls.start, 0);
});

test('a paused or deleted routine leaves no current approval, and no event can be dispatched', async () => {
  const paused = await sourceEventFixture();
  await paused.binding.bind(pair(paused));
  await paused.acknowledge(cancelIntent({mode: 'pause'}));
  assert.equal(await paused.binding.lookup(pair(paused)), null);
  const event = sourceEvent();
  paused.authorize(event);
  const result = await paused.receive(event);
  assert.equal(result.dispatched, false);
  assert.equal(paused.temporal.calls.start, 0);
  assert.equal(paused.runCount(), 0);
  // The stored row is retained as lineage: this is an orphaned approval, not a rewritten one.
  assert.equal(paused.fixture.bindings.size, 1);
});

test('two current approvals for one pair refuse ambiguity instead of choosing one', async () => {
  const h = await sourceEventFixture();
  await h.binding.bind(pair(h));
  const store = h.store;
  const duplicated = {
    ...store,
    readBinding: async (value, check) => {
      const rows = await store.readBinding(value, check);
      return rows.length ? [...rows, {...rows[0]}] : rows;
    },
  };
  const binding = createSourceEventBinding({scheduleOwner: h.scheduleOwner, store: duplicated, now: () => 1});
  await refused(() => binding.lookup(pair(h)), 'SOURCE_EVENT_BINDING_CONFLICT');
  // The ordinary store still answers with the single approved row.
  assert.equal((await h.binding.lookup(pair(h))).scheduleId, harnessIds.schedule);
});

const replacement = () => {
  const original=approvedIntent();
  return {...original,intentId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',projection:{...original.projection,
    scheduleId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',temporalScheduleId:'application/replacement'}};
};

for(const state of ['ACKNOWLEDGED','CLAIMED','DISPATCHING','UNKNOWN'])
test(`another ${state} routine for the pair refuses before a new durable claim`,async()=>{
  const h=await sourceEventFixture({acknowledgeInitial:false});
  const first=ownerBinding(approvedIntent());
  await h.scheduleOwner.claim(first,()=>{});
  if(state!=='CLAIMED')await h.scheduleOwner.markDispatching(first,()=>{});
  if(state==='ACKNOWLEDGED')await h.scheduleOwner.commitKnown(first,()=>{});
  if(state==='UNKNOWN')await h.scheduleOwner.markUnknown(first,()=>{});
  const next=replacement();
  await refused(()=>h.scheduleOwner.claim(ownerBinding(next),()=>{}),'SCHEDULE_SOURCE_CONFLICT');
  assert.equal(h.schedules.state.intents.size,1);
  assert.equal(h.schedules.state.projections.has(`tenant-a:${next.projection.scheduleId}`),false);
  assert.equal(h.temporal.calls.start,0);
});

for(const mode of ['pause','delete'])
test(`a ${mode} predecessor permits generation1 replacement and retains both immutable bindings`,async()=>{
  const h=await sourceEventFixture();
  await h.acknowledge(cancelIntent({mode}));
  const next=replacement();
  await h.acknowledge(next);
  const rows=await h.store.readBinding(pair(h),()=>{});
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(row=>row.generation),[1,1]);
  assert.equal((await h.binding.lookup(pair(h))).scheduleId,next.projection.scheduleId);
  assert.equal((await h.binding.bind(pair(h,{scheduleId:next.projection.scheduleId}))).created,false);
  assert.equal(h.fixture.bindings.size,2);
});

test('the real claim conflict becomes409/NOT_DISPATCHED and never reaches Temporal',async()=>{
  const h=await sourceEventFixture();
  const next=replacement();let effects=0;
  const connection={withDeadline:(_time,fn)=>fn(),withAbortSignal:(_signal,fn)=>fn()};
  const lifecycle=createScheduleLifecycle({scheduleOwner:h.scheduleOwner,clock:()=>NOW,
    scheduleClient:{connection,create:async()=>{effects++;throw Error('must not dispatch');}},workflowClient:{connection},
    authorize:async({binding})=>({authorized:true,bindingSha256:binding.bindingSha256,callerIdentity:binding.callerIdentity,expiresAtMs:NOW+10000})});
  const request={intent:next,callerIdentity:next.projection.owner,deadlineMs:NOW+9000,
    approval:{proposalId:next.intentId,commandSha256:canonicalSha256(next),decision:'approved',approver:next.projection.owner,
      policyRevision:'policy-a',decidedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+9000).toISOString()}};
  const unavailable=async()=>{throw Error('unexpected route');};
  const http=createRoutinesApplication({now:()=>NOW,limits:{maxRequestMs:10000,maxRequestBytes:10000,maxResponseBytes:10000},
    service:{prepare:unavailable,list:unavailable,reconcile:unavailable,consentReview:unavailable,consentApprove:unavailable,approve:()=>lifecycle.execute(request)}});
  const response=await http.handle(new Request('http://local.invalid/api/routines/approve',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'}));
  assert.equal(response.status,409);
  assert.deepEqual(await response.json(),{error:{code:'SCHEDULE_APPROVAL_REFUSED',outcome:'NOT_DISPATCHED'}});
  assert.equal(effects,0);assert.equal(h.schedules.state.intents.size,1);
});
