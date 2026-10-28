import test from 'node:test';
import assert from 'node:assert/strict';
import {projectJobEconomics,projectWholeJobs,occupiedCapacity,jobCostCategories} from '../job-economics.mjs';
import {usageOverviewPeriods} from '../../../../../packages/contracts/conversation-usage/overview-protocol.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';

const observedAt='2026-10-27T12:00:00.000Z',periods=usageOverviewPeriods(Date.parse(observedAt));
const row=(overrides={})=>({period:'day',state:'completed',recording:'recorded',lineage:'root',attempts:'1',charge:'40',
 inputTokens:'100',outputTokens:'50',cacheReadInputTokens:'10',cacheCreationInputTokens:'5',
 webSearchRequests:'0',toolInvocations:'2',toolFailures:'0',...overrides});
const dayOf=result=>result.periods.find(p=>p.kind==='day');

test('completed-attempt cost is the exact recorded charge over completed attempts with recorded accounting',()=>{
 const day=dayOf(projectJobEconomics({periods,rows:[
  row({state:'completed',attempts:'2',charge:'40'}),
  row({state:'failed',attempts:'1',charge:'10'}),
  row({state:'cancelled',attempts:'1',charge:'0'}),
 ]}));
 // The charge is an SDK list-price estimate, not a measured cost, and never a complete-job number.
 assert.equal(day.completedAttempts.status,'estimated');
 assert.equal(day.completedAttempts.chargeBasis,'sdk-list-estimate');
 assert.equal(day.completedAttempts.jobIdentity,'not-a-job-denominator');
 assert.equal(day.completedAttempts.attempts,2);
 assert.equal(day.completedAttempts.knownChargeMicroUsd,40);
 assert.equal(day.completedAttempts.microUsdPerCompletedAttempt,20);
 assert.equal(day.partialOrFailed.status,'estimated');
 assert.equal(day.partialOrFailed.recordedAttempts,2);
 assert.equal(day.partialOrFailed.knownChargeMicroUsd,10);
 assert.equal(day.partialOrFailed.microUsdPerRecordedAttempt,5);
 // Every recorded attempt, successful or not, stays in the liability view.
 assert.equal(day.liability.recordedAttempts,4);
 assert.equal(day.liability.knownChargeMicroUsd,50);
 assert.equal(day.liability.microUsdPerRecordedAttempt,12.5);
});

test('failed and cancelled attempts stay separate from the completed-attempt denominator',()=>{
 const day=dayOf(projectJobEconomics({periods,rows:[
  row({state:'completed',attempts:'2',charge:'40'}),
  row({state:'failed',attempts:'1',charge:'10'}),
  row({state:'cancelled',attempts:'1',charge:'0'}),
 ]}));
 assert.equal(day.attempts,4);
 assert.equal(day.states.completed,2);assert.equal(day.states.failed,1);assert.equal(day.states.cancelled,1);
 assert.equal(day.recorded.completed,2);assert.equal(day.recorded.failed,1);assert.equal(day.recorded.cancelled,1);
});

test('unavailable and never-recorded accounting are not priced as zero and not merged into the rate',()=>{
 const zero={inputTokens:'0',outputTokens:'0',cacheReadInputTokens:'0',cacheCreationInputTokens:'0',webSearchRequests:'0',toolInvocations:'0',toolFailures:'0'};
 const day=dayOf(projectJobEconomics({periods,rows:[
  row({state:'completed',recording:'recorded',attempts:'2',charge:'40'}),
  row({state:'completed',recording:'unavailable',attempts:'1',charge:'0',...zero}),
  row({state:'failed',recording:'not-recorded',attempts:'1',charge:'0',...zero}),
 ]}));
 assert.equal(day.completedAttempts.attempts,2);
 assert.equal(day.completedAttempts.knownChargeMicroUsd,40);
 assert.equal(day.completedAttempts.microUsdPerCompletedAttempt,20);
 assert.equal(day.completedAttempts.attemptsWithoutRecordedUsage,1);
 assert.equal(day.recording.unavailable,1);assert.equal(day.recording.notRecorded,1);
 assert.equal(day.knownChargeMicroUsd,40);
 // The unavailable and never-recorded attempts stay in liability but carry no invented charge.
 assert.equal(day.liability.unavailableAttempts,1);assert.equal(day.liability.notRecordedAttempts,1);
 assert.equal(day.liability.microUsdPerRecordedAttempt,20);
});

test('recorded lineage separates root, fork and resume threads using the binding writerFence',()=>{
 const day=dayOf(projectJobEconomics({periods,rows:[
  row({state:'completed',lineage:'root',attempts:'2',charge:'40'}),
  row({state:'completed',lineage:'fork',attempts:'1',charge:'10'}),
  row({state:'completed',lineage:'resume',attempts:'3',charge:'30'}),
 ]}));
 assert.equal(day.lineage.root.attempts,2);assert.equal(day.lineage.root.chargeMicroUsd,40);
 assert.equal(day.lineage.fork.attempts,1);assert.equal(day.lineage.fork.chargeMicroUsd,10);
 assert.equal(day.lineage.resume.attempts,3);assert.equal(day.lineage.resume.chargeMicroUsd,30);
 assert.equal(day.lineage['unknown-lineage'].attempts,0);
 assert.match(day.lineage.basis,/writerFence 1 = fork/u);
});

test('conversation threads are a separate period observation and are never additive with attempts',()=>{
 const withThreads=dayOf(projectJobEconomics({periods,rows:[row({attempts:'4',charge:'40'})],threadRows:[{period:'day',threads:'3',attempts:'4'}]}));
 assert.equal(withThreads.conversationThreads.status,'measured');
 assert.equal(withThreads.conversationThreads.threads,3);
 assert.equal(withThreads.conversationThreads.attempts,4);
 assert.equal(withThreads.attempts,4);
 // A thread count above the attempt count is not a real observation and is refused, not published.
 assert.throws(()=>projectJobEconomics({periods,rows:[row()],threadRows:[{period:'day',threads:'3',attempts:'1'}]}),/USAGE_OVERVIEW_CORRUPT/u);
 const withoutThreads=dayOf(projectJobEconomics({periods,rows:[row()]}));
 assert.equal(withoutThreads.conversationThreads.status,'unavailable');
 assert.equal(withoutThreads.conversationThreads.threads,null);
});

// Whole-job objective rows, shaped exactly as the production statement returns them, with real canonical
// digests and the canonical continuation owner's custody verdict so the links resolve as they do over rows.
const jobRequest=tag=>({requestId:`synthetic-${tag}`,prompt:`synthetic ${tag}`,work:{entry:'start-work',jobKind:'audit',deliverables:[],dependencies:[]}});
const controlId='00000000-0000-4000-8000-0000000002a1';
const resumeOf=tag=>({mode:'resume',parentSha256:canonicalSha256(jobRequest(tag))});
const revision=(tag,overrides={})=>({requestSha256:canonicalSha256(jobRequest(tag)),state:'completed',entry:'start-work',jobKind:'audit',
 recording:'recorded',charge:'10',closure:'published',childAssignments:'0',childResults:'0',unresolvedSuccessors:'0',
 steerControlId:null,steerSequence:null,steerInputSha256:null,mode:null,parentSha256:null,...overrides});
const wholeJob=rows=>projectWholeJobs({rows});

test('a job is the root Work objective across its continuations, never one completed run',()=>{
 const whole=wholeJob([revision('r',{charge:'10',steerControlId:controlId,steerSequence:'1',steerInputSha256:'a'.repeat(64)}),
  revision('c1',{state:'running',charge:'5',...resumeOf('r')})]);
 // The objective is partial because its continuation is still in flight; the completed root never promotes it.
 assert.equal(whole.states.successful.jobs,0);assert.equal(whole.states.partial.jobs,1);
 assert.equal(whole.jobs,1);assert.equal(whole.attempts,2);assert.equal(whole.revisions,2);
 assert.equal(whole.tails,1);assert.equal(whole.steerRevisions,1);
 assert.equal(whole.states.partial.knownChargeMicroUsd,15);assert.equal(whole.states.partial.attempts,2);
 assert.match(whole.basis,/canonical ROOT Work\/Delegate objectives/u);assert.match(whole.window,/month window/u);
});

test('a completed revision without the completion producer published capture stays unclosed, not successful',()=>{
 const none=wholeJob([revision('r',{charge:'10',closure:'none'})]);
 assert.equal(none.states.successful.jobs,0);assert.equal(none.states.unclosed.jobs,1);
 assert.equal(none.settledRevisions,0);assert.equal(none.closurePending,1);
 // A capture that began and never published is equally unclosed.
 assert.equal(wholeJob([revision('r',{closure:'capture-pending'})]).states.unclosed.jobs,1);
});

test('an unresolved successor or an unsettled child receipt keeps the objective unclosed',()=>{
 const successor=wholeJob([revision('r',{unresolvedSuccessors:'1'})]);
 assert.equal(successor.states.unclosed.jobs,1);assert.equal(successor.unresolvedSuccessors,1);
 const child=wholeJob([revision('r',{childAssignments:'2',childResults:'1'})]);
 assert.equal(child.states.unclosed.jobs,1);assert.equal(child.unsettledChildren,1);
});

test('published completions close the objective; failed and cancelled keep their own terminal state',()=>{
 const successful=wholeJob([revision('r'),revision('c',{...resumeOf('r')})]);
 assert.equal(successful.states.successful.jobs,1);assert.equal(successful.states.successful.attempts,2);
 assert.equal(successful.settledRevisions,2);assert.equal(successful.microUsdPerSuccessfulJob,20);
 assert.equal(successful.coverage.jobsWithRecordedUsage,1);assert.equal(successful.coverage.jobsWithUnavailableUsage,0);
 assert.equal(wholeJob([revision('r',{state:'failed',closure:'none'})]).states.failed.jobs,1);
 assert.equal(wholeJob([revision('r',{state:'cancelled',closure:'none'})]).states.cancelled.jobs,1);
 // An objective with any revision lacking recorded accounting is counted as unavailable, never as zero cost.
 const unavailable=wholeJob([revision('r'),revision('c',{recording:'unavailable',charge:'0',...resumeOf('r')})]);
 assert.equal(unavailable.coverage.jobsWithUnavailableUsage,1);assert.equal(unavailable.microUsdPerSuccessfulJob,10);
});

test('two continuations of one root leave two current revisions, a fork heads its own objective and an outside-window root is excluded',()=>{
 const continuations=wholeJob([revision('r'),revision('f1',{...resumeOf('r')}),
  revision('f2',{state:'cancelled',charge:'4',closure:'none',...resumeOf('r')})]);
 assert.equal(continuations.jobs,1);assert.equal(continuations.tails,2);assert.equal(continuations.states.partial.jobs,1);assert.equal(continuations.states.successful.jobs,0);
 const failed=wholeJob([revision('r'),revision('f',{state:'failed',charge:'4',closure:'none',...resumeOf('r')})]);
 assert.equal(failed.states.failed.jobs,1);
 // A fork is a new logical prompt: its verified custody names the source revision, but it starts its own
 // objective, so the source revision stays one successful job and the fork is a second one.
 const fork=wholeJob([revision('r'),revision('f',{...resumeOf('r'),mode:'fork'})]);
 assert.equal(fork.jobs,2);assert.equal(fork.states.successful.jobs,2);assert.equal(fork.tails,2);
 assert.equal(fork.coverage.revisionsWithRootOutsideWindow,0);assert.equal(fork.microUsdPerSuccessfulJob,10);
 // A continuation whose root revision is outside the window is excluded and counted, never a job.
 const outside=wholeJob([revision('o',{...resumeOf('absent-root')})]);
 assert.equal(outside.jobs,0);assert.equal(outside.attempts,0);assert.equal(outside.coverage.revisionsWithRootOutsideWindow,1);
 assert.equal(outside.microUsdPerSuccessfulJob,null);assert.match(outside.coverage.windowEdge,/is not read/u);
});

test('a continuation cycle, a duplicated revision, a malformed closure and a malformed custody verdict are refused, never published',()=>{
 assert.throws(()=>wholeJob([revision('a',{...resumeOf('b')}),revision('b',{...resumeOf('a')})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r'),revision('r')]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{closure:'assumed'})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{recording:'unavailable',charge:'3'})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{childAssignments:'1',childResults:'2'})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{entry:'chat'})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{steerSequence:'1',steerInputSha256:'not-a-digest'})]),/USAGE_OVERVIEW_CORRUPT/u);
 // The custody verdict is the canonical owner's: an invented mode, a source digest without its mode, a mode
 // without its source digest and a steer control that is not a control identifier are each refused.
 assert.throws(()=>wholeJob([revision('r',{steerSequence:'1',steerInputSha256:'a'.repeat(64)})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{steerControlId:'not-a-control',steerSequence:'1',steerInputSha256:'a'.repeat(64)})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{mode:'continue',parentSha256:canonicalSha256(jobRequest('x'))})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{mode:'resume'})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{parentSha256:canonicalSha256(jobRequest('x'))})]),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>wholeJob([revision('r',{...resumeOf('r'),parentSha256:'short'})]),/USAGE_OVERVIEW_CORRUPT/u);
});

test('cost is estimated, verification is unresolved and known inclusions cite the recorded source',()=>{
 assert.equal(jobCostCategories.cost,'estimated');
 assert.equal(jobCostCategories.providerBilledMicroUsd,'unresolved');
 assert.equal(jobCostCategories.reasoningTokens,'inside-another-counter');
 assert.equal(jobCostCategories.subagentCost,'inside-another-counter');
 assert.equal(jobCostCategories.compactionCost,'inside-another-counter');
 assert.equal(jobCostCategories.verificationCost,'unresolved');
 assert.equal(jobCostCategories.infrastructureCost,'unresolved');
 assert.equal(jobCostCategories.retryCost,'unresolved');
 assert.equal(jobCostCategories.fallbackCost,'unresolved');
 assert.equal(jobCostCategories.extractionCost,'unresolved');
});

test('occupied Activity worker capacity is unavailable and activity capacity is unresolved, never invented',()=>{
 assert.equal(jobCostCategories.activityCapacity,'unresolved');
 assert.equal(occupiedCapacity.status,'unavailable');
 assert.match(occupiedCapacity.reason,/configured ceiling, not measured capacity/u);
});

test('refuses a charge on an unavailable row instead of publishing it',()=>{
 assert.throws(()=>projectJobEconomics({periods,rows:[row({recording:'unavailable',charge:'1'})]}),/USAGE_OVERVIEW_CORRUPT/u);
});

test('refuses duplicate cohort keys',()=>{
 assert.throws(()=>projectJobEconomics({periods,rows:[row(),row()]}),/USAGE_OVERVIEW_CORRUPT/u);
});

test('refuses a lineage outside the four proven classes',()=>{
 assert.throws(()=>projectJobEconomics({periods,rows:[row({lineage:'child'})]}),/USAGE_OVERVIEW_CORRUPT/u);
});

test('refuses a never-recorded non-root because parentRunId only exists on a recorded row',()=>{
 assert.throws(()=>projectJobEconomics({periods,rows:[row({recording:'not-recorded',lineage:'fork',charge:'0'})]}),/USAGE_OVERVIEW_CORRUPT/u);
});

test('refuses tool failures above tool invocations',()=>{
 assert.throws(()=>projectJobEconomics({periods,rows:[row({toolInvocations:'1',toolFailures:'2'})]}),/USAGE_OVERVIEW_CORRUPT/u);
});

test('refuses a zero-attempt cohort',()=>{
 assert.throws(()=>projectJobEconomics({periods,rows:[row({attempts:'0'})]}),/USAGE_OVERVIEW_CORRUPT/u);
});

test('refuses a duplicate or unknown thread period instead of publishing it',()=>{
 const rows=[row()];
 assert.throws(()=>projectJobEconomics({periods,rows,threadRows:[{period:'day',threads:'1',attempts:'1'},{period:'day',threads:'1',attempts:'1'}]}),/USAGE_OVERVIEW_CORRUPT/u);
 assert.throws(()=>projectJobEconomics({periods,rows,threadRows:[{period:'year',threads:'1',attempts:'1'}]}),/USAGE_OVERVIEW_CORRUPT/u);
});
