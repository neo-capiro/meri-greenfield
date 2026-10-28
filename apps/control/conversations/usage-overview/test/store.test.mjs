import test from 'node:test';import assert from 'node:assert/strict';
import {createUsageOverviewStore,projectUsageOverviewV2,usagePeriods} from '../store.mjs';
import {productFailure} from '../../../product-access/errors.mjs';
import {assertUsageOverviewResponse,assertUsageOverviewResponseV2} from '../../../../../packages/contracts/conversation-usage/overview-validate.mjs';
import {at,principal,facts,response,responseV2,poolFixture,cohortRows,objectiveRows,threadRows,continuationCustody,forkObjectiveRow} from './fixture.mjs';

test('UTC day, ISO week and calendar month boundaries cover leap/year transitions independently',()=>{
 const periods=usagePeriods(Date.parse('2024-03-01T00:00:00.000Z'));
 assert.equal(periods[1].startInclusive,'2024-02-26T00:00:00.000Z');assert.equal(periods[2].endExclusive,'2024-04-01T00:00:00.000Z');
 assert.equal(usagePeriods(Date.parse('2027-01-01T23:59:59.000Z'))[1].startInclusive,'2026-12-28T00:00:00.000Z');
 assert.equal(usagePeriods(Date.parse('2026-11-02T00:00:00.000Z'))[1].startInclusive,'2026-11-02T00:00:00.000Z');
 assert.throws(()=>usagePeriods(NaN));assert.throws(()=>usagePeriods(at+0.5));
});

test('the real production read returns the successor version and strict v2 receiving accepts it',async()=>{
 const f=poolFixture(),store=createUsageOverviewStore({pool:f.pool,now:()=>at,continuationCustody});let checks=0;
 const value=await store.read({principal},()=>checks++);
 assert.equal(value.schemaVersion,'meri.usage-overview/2');
 assert.deepEqual(assertUsageOverviewResponseV2(value),value);
 assert(checks>=4);
 const calls=f.state.calls;
 assert.equal(calls[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 assert.equal(calls.at(-1).sql,'COMMIT');
 // Attempt cohorts, thread counts, admission ledger, current states, tenant policy and the whole-job
 // objective read: six reads of its own in one transaction, plus the canonical continuation owner's own
 // source-control read on this same client once per continued revision, so it sees this read's snapshot.
 // The /1 body still reads exactly the five it always read and touches no custody at all.
 const reads=calls.filter(c=>/^(WITH|SELECT)/.test(c.sql)&&!/^SELECT \* FROM meri_conversations\.controls/u.test(c.sql));
 const custody=calls.filter(c=>c.sql.startsWith('SELECT * FROM meri_conversations.controls'));
 assert.equal(reads.length,6);
 assert.equal(custody.length,objectiveRows.filter(row=>row.continuation!==null).length);
 assert.equal(custody.length,3);
 assert(custody.every(c=>c.args.length===2&&c.args[0]===principal.tenantId));
 assert(reads.every(c=>c.args[0]===principal.tenantId));
 assert.equal(reads[0].args.length,11);assert.equal(reads[1].args.length,11);
 assert.equal(reads[0].args[1],new Date(at).toISOString());
 // The whole-job read is the successor's own, bounded to the admitted month window.
 const objectives=reads.find(c=>c.sql.startsWith('SELECT r.request_sha256'));
 assert(objectives);assert.equal(objectives.args.length,3);
 assert.deepEqual(objectives.args,[principal.tenantId,value.periods[2].startInclusive,new Date(at).toISOString()]);
 // The statement reads the completion producer's own published capture and the persisted run/control
 // lineage; it never invents a closure and never reads a second store.
 assert.match(objectives.sql,/completion_checkpoints/u);assert.match(objectives.sql,/identity->>'sourceRequestSha256'/u);
 assert.match(objectives.sql,/proof->>'kind'='native-session'/u);assert.match(objectives.sql,/\{input,intent\}'='steer'/u);
 assert.match(objectives.sql,/\{input,intent\}' IN \('resume','fork'\)/u);assert.match(objectives.sql,/child_assignments/u);
 assert.match(objectives.sql,/r\.request \? 'work'/u);
 // The current goal revision is the last APPLIED steer control, and the objective link is never rebuilt here:
 // the statement hands the stored continuation pair to the canonical owner and leaves an unverifiable one out.
 assert.match(objectives.sql,/control_id AS "steerControlId"/u);assert.match(objectives.sql,/state'<>'APPLIED'/u);
 assert.doesNotMatch(objectives.sql,/continuation->'sourceRequest'/u);
 // The stored continuation pair is selected under the stored column names the canonical owner reads, so that
 // owner verifies this very row: a digest selected under an alias the owner never reads cannot verify.
 assert.match(objectives.sql,/r\.continuation,r\.continuation_sha256,/u);
 assert.doesNotMatch(objectives.sql,/continuation_sha256 AS/u);
 // A successor is found by the control's OWN target binding — a canonical fork targets another conversation —
 // never by the conversation of the run row that carries the control.
 assert.match(objectives.sql,/t\.conversation_id::text=c\.projection#>>'\{target,binding,conversationId\}'/u);
 assert.doesNotMatch(objectives.sql,/t\.conversation_id=c\.conversation_id/u);
 // Closure is the completion producer's published capture identity alone: no artifact, file or deliverable
 // evidence is required, so an answer-only capture with zero files closes exactly like any other.
 assert.doesNotMatch(objectives.sql,/artifact|files|deliverable/u);
 assert.deepEqual(f.state.releases,[undefined]);
 assert(calls.every(c=>!/^(INSERT|UPDATE|DELETE)/.test(c.sql)));
});

test('the same production read projects the frozen /1 body from the same five-statement snapshot',async()=>{
 const f=poolFixture(),store=createUsageOverviewStore({pool:f.pool,now:()=>at,continuationCustody});
 const value=await store.read({principal,version:'1'},()=>{});
 assert.equal(value.schemaVersion,'meri.usage-overview/1');
 assert.deepEqual(assertUsageOverviewResponse(value),value);
 const day=value.periods[0];
 // The successor query groups by lineage; the /1 projection rolls those groups back up to its own grouping.
 assert.equal(day.attempts,5);assert.equal(day.states.completed,3);assert.deepEqual(day.recording,{recorded:3,unavailable:1,notRecorded:1});
 assert.equal(day.knownChargeMicroUsd,50);assert.equal(day.completedAttemptsWithRecordedUsage,3);assert.equal(day.completedAttemptKnownChargeMicroUsd,50);
 assert.deepEqual(value.periods[2].recording,{recorded:2,unavailable:1,notRecorded:1});
 assert.equal(value.coverage.chargeBasis,'recorded-sdk-estimate');
 const reads=f.state.calls.filter(c=>/^(WITH|SELECT)/.test(c.sql));assert.equal(reads.length,5);
 // The old wire version never reads job custody at all.
 assert(reads.every(c=>!c.sql.startsWith('SELECT r.request_sha256')));
 // A version outside the two closed wire versions is a configuration error, not a third projection.
 await assert.rejects(store.read({principal,version:'3'},()=>{}),e=>productFailure(e)?.code==='PRODUCT_CONFIGURATION');
});

test('attempt, thread and whole-job denominators stay distinct and an unrecorded attempt is not zero cost',async()=>{
 const value=assertUsageOverviewResponseV2(await createUsageOverviewStore({pool:poolFixture().pool,now:()=>at,continuationCustody}).read({principal},()=>{}));
 const day=value.periods[0],month=value.periods[2];
 assert.equal(day.attempts,5);assert.equal(day.states.completed,3);assert.equal(day.states.failed,1);assert.equal(day.states.cancelled,1);
 assert.deepEqual(day.recording,{recorded:3,unavailable:1,notRecorded:1});
 assert.equal(day.completedAttempts.attempts,3);assert.equal(day.completedAttempts.knownChargeMicroUsd,50);
 // Threads are a separate observation, never additive with the attempt cohorts and never jobs.
 assert.deepEqual(day.conversationThreads,{status:'measured',basis:'distinct-conversation-id-by-run-created-at',threads:3,attempts:5});
 // An attempt exists but carries no recorded accounting: the status is unavailable, not a zero cost.
 assert.equal(day.partialOrFailed.failedAttempts,1);assert.equal(day.partialOrFailed.cancelledAttempts,1);
 assert.equal(day.partialOrFailed.recordedAttempts,0);assert.equal(day.partialOrFailed.status,'unavailable');
 assert.equal(day.partialOrFailed.microUsdPerRecordedAttempt,null);
 assert.equal(month.attempts,4);assert.deepEqual(month.recording,{recorded:2,unavailable:1,notRecorded:1});
 assert.equal(month.completedAttempts.attempts,2);assert.equal(month.knownChargeMicroUsd,50);
 assert.equal(value.monthlyAdmission.knownChargeMicroUsd,80);assert.equal(value.monthlyAdmission.remainingKnownMicroUsd,20);
 assert.equal(value.coverage.completeJobCost,'estimated');assert.equal(value.queue.availableCapacity,null);assert.equal(value.queue.physicalConcurrency,null);
 assert.equal(value.jobIdentity.status,'measured');assert.equal(value.occupiedCapacity.status,'unavailable');
 assert.equal(value.categories.activityCapacity,'unresolved');assert.equal(value.categories.verificationCost,'unresolved');
 // Whole jobs are the canonical root Work objectives, separated by state and never additive with attempts.
 const whole=value.wholeJobs;
 assert.equal(whole.basis,value.denominators.sustainedJobs);
 assert.equal(whole.jobs,7);assert.equal(whole.attempts,9);assert.equal(whole.revisions,9);
 assert.deepEqual(whole.states.successful,{jobs:1,attempts:2,knownChargeMicroUsd:65});
 assert.deepEqual(whole.states.partial,{jobs:1,attempts:2,knownChargeMicroUsd:15});
 assert.deepEqual(whole.states.failed,{jobs:1,attempts:1,knownChargeMicroUsd:0});
 assert.deepEqual(whole.states.cancelled,{jobs:1,attempts:1,knownChargeMicroUsd:3});
 assert.deepEqual(whole.states.unclosed,{jobs:3,attempts:3,knownChargeMicroUsd:28});
 assert.equal(whole.tails,7);assert.equal(whole.steerRevisions,1);assert.equal(whole.settledRevisions,7);
 assert.equal(whole.unresolvedSuccessors,1);assert.equal(whole.unsettledChildren,1);
 assert.equal(whole.knownChargeMicroUsd,111);assert.equal(whole.microUsdPerSuccessfulJob,65);
 assert.equal(whole.coverage.jobsWithRecordedUsage,6);assert.equal(whole.coverage.jobsWithUnavailableUsage,1);
 assert.equal(whole.coverage.revisionsWithRootOutsideWindow,1);
 assert.deepEqual(value.jobIdentity.states,['successful','partial','failed','cancelled','unclosed']);
 assert.doesNotMatch(JSON.stringify(value),/synthetic-tenant|synthetic-actor|conversationId|clientId|runId/u);
});

test('empty known zero, absent policy and a reached cap do not invent configured budget or zero unknown costs',()=>{
 const empty=responseV2({rows:[],threadRows:[],currentRows:[],jobRows:[],ledgerRows:[{charge:'0',unavailable:'0'}],policyRows:[]});
 assert.equal(empty.periods[0].attempts,0);assert.equal(empty.policy.status,'unavailable');assert.equal(empty.monthlyAdmission.reached,null);
 assert.equal(empty.periods[0].completedAttempts.status,'unavailable');assert.equal(empty.periods[0].liability.microUsdPerRecordedAttempt,null);
 // An empty tenant publishes zero jobs and zero coverage, never an unavailable-interface invention.
 assert.equal(empty.wholeJobs.jobs,0);assert.equal(empty.wholeJobs.knownChargeMicroUsd,0);assert.equal(empty.wholeJobs.states.successful.jobs,0);
 assert.equal(empty.wholeJobs.microUsdPerSuccessfulJob,null);assert.equal(empty.wholeJobs.coverage.revisionsWithRootOutsideWindow,0);
 assert.equal(responseV2({policyRows:[{revision:1,monthly_cap_micro_usd:null}]}).policy.status,'unavailable');
 const reached=responseV2({ledgerRows:[{charge:'120',unavailable:'2'}]});assert.equal(reached.monthlyAdmission.reached,true);
 assert.equal(reached.monthlyAdmission.remainingKnownMicroUsd,0);assert.equal(reached.monthlyAdmission.unavailableRecordedAttempts,2);
});

test('malformed, unsafe, duplicated and contradictory canonical aggregates fail closed',()=>{
 for(const change of [f=>f.rows[0].charge='-1',f=>f.rows[0].attempts='9007199254740992',f=>f.rows[0].state='invented',f=>f.rows[0].recording='estimated',
  f=>f.rows.push({...f.rows[0]}),f=>f.rows[2].charge='1',f=>f.rows[0].attempts='0',f=>f.currentRows.push({state:'completed',attempts:'1'}),
  f=>{f.ledgerRows=[]},f=>{f.policyRows[0].revision='0'},f=>{f.policyRows[0].monthly_cap_micro_usd='0'},f=>{f.policyRows[0].sdk_max_turns=101},
  f=>f.threadRows.push({period:'day',threads:'1',attempts:'5'}),f=>f.threadRows.push({period:'year',threads:'1',attempts:'1'}),
  f=>f.jobRows[0].charge='-1',f=>f.jobRows[0].closure='assumed',f=>f.jobRows[3].state='invented',f=>f.jobRows.push({...f.jobRows[0]}),
  f=>f.jobRows[0].steerInputSha256='short',f=>{f.jobRows[3].childAssignments='1';f.jobRows[3].childResults='2'},
  f=>{f.jobRows[0].steerControlId='not-a-uuid'},f=>{f.jobRows[1].mode='invented'},f=>{f.jobRows[1].parentSha256='short'},
  f=>{f.jobRows[2].mode='resume'},f=>{f.jobRows[2].parentSha256='0'.repeat(64)},
  f=>{f.rows[0].attempts='9007199254740991';f.rows.push({period:'day',state:'failed',recording:'not-recorded',lineage:'root',attempts:'1',charge:'0'})}]) {
  const f=facts();change(f);assert.throws(()=>projectUsageOverviewV2(f),/USAGE_OVERVIEW_CORRUPT/u);
 }
});

test('aborted reads roll back, uncertain COMMIT remains unavailable UNKNOWN and a fresh reader has no cached principal',async()=>{
 const f=poolFixture();f.state.beforeQuery=sql=>{if(sql.startsWith('WITH'))throw Error('synthetic read failure');};
 await assert.rejects(createUsageOverviewStore({pool:f.pool,now:()=>at,continuationCustody}).read({principal},()=>{}),/USAGE_OVERVIEW_UNAVAILABLE/u);assert.equal(f.state.calls.at(-1).sql,'ROLLBACK');
 const uncertain=poolFixture();uncertain.state.beforeQuery=sql=>{if(sql==='COMMIT')throw Error('synthetic disconnect');};
 await assert.rejects(createUsageOverviewStore({pool:uncertain.pool,now:()=>at,continuationCustody}).read({principal},()=>{}),e=>productFailure(e)?.code==='USAGE_OVERVIEW_UNAVAILABLE'&&productFailure(e)?.outcome==='UNKNOWN');assert(uncertain.state.releases[0]);
 const fresh=poolFixture();await createUsageOverviewStore({pool:fresh.pool,now:()=>at,continuationCustody}).read({principal:{...principal,tenantId:'other-tenant'}},()=>{});
 // Every read of its own is scoped to the reading tenant. The canonical owner's custody read is scoped by the
 // owner itself to the source control's own tenant, which is the only tenant it can read.
 assert(fresh.state.calls.filter(c=>c.args&&!c.sql.startsWith('SELECT * FROM meri_conversations.controls')).every(c=>c.args[0]==='other-tenant'));
 assert(fresh.state.calls.filter(c=>c.sql.startsWith('SELECT * FROM meri_conversations.controls')).every(c=>c.args[0]===principal.tenantId));
});

test('a principal without a tenant is denied before any transaction is opened',async()=>{
 const f=poolFixture();
 await assert.rejects(createUsageOverviewStore({pool:f.pool,now:()=>at,continuationCustody}).read({principal:{}},()=>{}),e=>productFailure(e)?.code==='ACCESS_DENIED');
 assert.equal(f.state.calls.length,0);
});

test('the frozen meri.usage-overview/1 body remains a distinct, separately valid wire version',()=>{
 // Ordinary old-version parity is proven against the same fixture the public receiver test uses.
 assert.equal(response().schemaVersion,'meri.usage-overview/1');
 assert.equal(responseV2().schemaVersion,'meri.usage-overview/2');
 assert.equal(cohortRows.length,9);assert.equal(objectiveRows.length,10);assert.equal(threadRows.length,3);
});

test('a continued revision is linked only through the canonical continuation custody, never from its own jsonb',async()=>{
 const open=f=>createUsageOverviewStore({pool:f.pool,now:()=>at,continuationCustody}).read({principal},()=>{});
 const custodyCalls=f=>f.state.calls.filter(c=>c.sql.startsWith('SELECT * FROM meri_conversations.controls'));
 const linkedPool=poolFixture();
 const linked=assertUsageOverviewResponseV2(await open(linkedPool));
 // The resumed revision joins its source objective and the one whose root is outside the window is counted.
 assert.equal(linked.wholeJobs.states.successful.jobs,1);
 assert.equal(linked.wholeJobs.coverage.revisionsWithRootOutsideWindow,1);
 // The composed canonical owner itself verified one source control per continued revision, in this read's
 // transaction and snapshot: three continued revisions, three source-control reads by the owner.
 assert.equal(custodyCalls(linkedPool).length,3);
 assert(custodyCalls(linkedPool).every(c=>c.args[0]===principal.tenantId));
 // A genuine fork's verified custody reports mode fork and its own NEW conversation as the successor target,
 // so it heads its own objective; a row whose own fields merely claim a fork is still linked by the custody
 // verdict, never by the row it arrived in.
 const forked=poolFixture({jobRows:[{...objectiveRows[0]},forkObjectiveRow]});
 const split=assertUsageOverviewResponseV2(await open(forked));
 assert.equal(split.wholeJobs.jobs,2);assert.equal(split.wholeJobs.states.successful.jobs,2);
 assert.equal(split.wholeJobs.coverage.revisionsWithRootOutsideWindow,0);
 assert.equal(custodyCalls(forked).length,1);
 const claimed=poolFixture({jobRows:[{...objectiveRows[0]},{...objectiveRows[1],mode:'fork'}]});
 const unchanged=assertUsageOverviewResponseV2(await open(claimed));
 assert.equal(unchanged.wholeJobs.jobs,1);assert.equal(unchanged.wholeJobs.states.successful.jobs,1);
 // With no canonical owner composed a continued revision refuses instead of trusting its own row, and the
 // transaction rolls back rather than publishing a link this reader rebuilt for itself.
 const bare=poolFixture();
 await assert.rejects(createUsageOverviewStore({pool:bare.pool,now:()=>at}).read({principal},()=>{}),e=>productFailure(e)?.code==='USAGE_OVERVIEW_CORRUPT');
 assert.equal(bare.state.calls.at(-1).sql,'ROLLBACK');
 // The same refusal for a row that carries the digest only under the alias the owner never reads: the
 // statement selects continuation_sha256, so an aliased row has no custody the owner can verify.
 const resumeRow=objectiveRows[1];
 const aliased=poolFixture({jobRows:[{...objectiveRows[0]},{...resumeRow,continuation_sha256:undefined,continuationSha256:resumeRow.continuation_sha256}]});
 await assert.rejects(createUsageOverviewStore({pool:aliased.pool,now:()=>at,continuationCustody}).read({principal},()=>{}),e=>productFailure(e)?.code==='USAGE_OVERVIEW_CORRUPT');
 assert.equal(aliased.state.calls.at(-1).sql,'ROLLBACK');
 // A stored pair that no longer matches continuation_sha256 is store corruption, never a rebuilt link.
 const tampered=poolFixture({jobRows:[{...objectiveRows[0]},{...resumeRow,continuation_sha256:'0'.repeat(64)}]});
 await assert.rejects(createUsageOverviewStore({pool:tampered.pool,now:()=>at,continuationCustody}).read({principal},()=>{}),e=>productFailure(e)?.code==='USAGE_OVERVIEW_CORRUPT');
 assert.equal(tampered.state.calls.at(-1).sql,'ROLLBACK');
 // A source control the owner cannot read at all leaves the revision unlinkable, and an unknown or
 // not-applied control is not a successor: both refuse instead of publishing a half-verified link.
 const orphaned=poolFixture();orphaned.state.controls.delete(resumeRow.continuation.continuation.controlId);
 await assert.rejects(createUsageOverviewStore({pool:orphaned.pool,now:()=>at,continuationCustody}).read({principal},()=>{}),e=>productFailure(e)?.code==='USAGE_OVERVIEW_CORRUPT');
 assert.equal(orphaned.state.calls.at(-1).sql,'ROLLBACK');
});
