import test from 'node:test';
import assert from 'node:assert/strict';
// The 0.3 family is composed through its canonical owner, which mounts the canonical Work selection owner that the
// 0.3 lifecycle schema resolves by reference; a locally re-composed ajv would be a second family build that silently
// misses that reference.
import {scheduleToolValidators as current} from '../schedules-0.3/tool-validators.mjs';
import {assertScheduleIntent,snapshotScheduleCall} from '../schedules-0.3/lifecycle-validation.mjs';
import {fixture,validators as legacy,canonicalSha256,NOW,identity} from './schedule-tool-interface-fixtures.mjs';
const families=['federal_award','federal_assistance_award','sam_opportunity','tango_resource','lda_filing','acquisition_revision'];
const selector=()=>({producer:'bizdev.watch.alert.v1',sourceFamily:'federal_award',resourceKey:'33333333-3333-4333-8333-333333333333'});
function sourceFixture(){const f=fixture();f.request.policy.spec.intervals=[];f.request.policy.sourceTrigger=selector();return rehash(f);}
function rehash(f){f.context.scheduleContext.requestSha256=canonicalSha256(f.request);return f;}
const prepare=f=>current.prepare(f.operation,f.request,f.context);

test('each finite source family reaches the real preparation with its exact approved intent/hash and no time trigger',()=>{
 for(const sourceFamily of families){const f=sourceFixture();f.request.policy.sourceTrigger.sourceFamily=sourceFamily;const p=prepare(rehash(f));
  assert.deepEqual(p.intent.configuration.sourceTrigger,f.request.policy.sourceTrigger);
  assert.equal(p.intentSha256,canonicalSha256(p.intent));assert.deepEqual(p.proposal.policy,f.request.policy);
  assert.deepEqual(p.intent.configuration.spec.intervals,[]);assert.equal(p.intent.configuration.runNow,false);
  assert.equal(Object.hasOwn(p.intent.projection,'sourceTrigger'),false,'frozen projection is unchanged');
 }
});
test('legacy ordinary requests and cancellation produce byte-equivalent prepared intents/proposals',()=>{
 for(const op of ['schedule_task','update_scheduled_task','cancel_scheduled_task','list_scheduled_tasks']){
  const f=fixture(op);assert.deepEqual(current.prepare(op,f.request,f.context),legacy.prepare(op,f.request,f.context));
 }
});
test('legacy0.2 refuses the new selector while0.3 refuses unknown/malformed authority-bearing selectors',()=>{
 const f=sourceFixture();assert.throws(()=>legacy.prepare(f.operation,f.request,f.context),{code:'SCHEDULE_TOOL_DATA'});
 for(const change of [s=>s.producer='unapproved.v1',s=>s.sourceFamily='unknown',s=>s.resourceKey='not-a-uuid',s=>s.scopes=[],s=>delete s.resourceKey]){
  const bad=sourceFixture();change(bad.request.policy.sourceTrigger);assert.throws(()=>prepare(rehash(bad)),{code:'SCHEDULE_TOOL_DATA'});
 }
});
test('source-only policy rejects mixed clocks, immediate firing, jitter and ignored skips; absent selector still requires time',()=>{
 for(const change of [p=>p.spec.intervals=[{every:60000,offset:0}],p=>p.spec.cronExpressions=['0 * * * *'],p=>p.runNow=true,p=>p.spec.jitterMs=1000]){
  const f=sourceFixture();change(f.request.policy);assert.throws(()=>prepare(rehash(f)),{code:'SCHEDULE_SOURCE_TRIGGER'});
 }
 for(const sourceTrigger of [null,undefined]){const f=sourceFixture();if(sourceTrigger===undefined)delete f.request.policy.sourceTrigger;else f.request.policy.sourceTrigger=sourceTrigger;
  assert.throws(()=>prepare(rehash(f)),{code:'SCHEDULE_SPEC'});
 }
});
test('changed watch/family cannot reuse the approved immutable intent or detached request hash',()=>{
 const f=sourceFixture(),p=prepare(f),approval={proposalId:p.intent.intentId,commandSha256:p.intentSha256,decision:'approved',decidedAt:new Date(NOW-100).toISOString(),expiresAt:new Date(NOW+1000).toISOString(),approver:identity(),policyRevision:'p1'};
 const call={intent:p.intent,approval,callerIdentity:f.context.scheduleContext.callerIdentity,deadlineMs:NOW+1000};
 snapshotScheduleCall('Execute',call,NOW);
 const changed=structuredClone(call);changed.intent.configuration.sourceTrigger.resourceKey='44444444-4444-4444-8444-444444444444';
 assertScheduleIntent(changed.intent,'tenant');assert.throws(()=>snapshotScheduleCall('Execute',changed,NOW),{code:'SCHEDULE_APPROVAL'});
 f.request.policy.sourceTrigger.sourceFamily='lda_filing';assert.throws(()=>prepare(f),{code:'SCHEDULE_TOOL_BINDING'});
});
