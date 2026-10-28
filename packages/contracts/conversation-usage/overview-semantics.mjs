import {usageOverviewPeriods,overviewStates,usageOverviewDenominators,usageOverviewCostCategories,usageOverviewLineageClasses,usageOverviewJobInterface,usageOverviewJobStates,usageOverviewJobWindow,usageOverviewJobWindowEdge,usageOverviewJobDefinition,usageOverviewJobLineage,usageOverviewJobClosure} from './overview-protocol.mjs';
export class UsageOverviewResponseError extends Error{constructor(code){super(code);this.name='UsageOverviewResponseError';this.code=code;}}
export const overviewFail=code=>{throw new UsageOverviewResponseError(code);};
export function assertUsageOverviewSemantics(value){
 const periods=usageOverviewPeriods(Date.parse(value.observedAt));
 for(let i=0;i<3;i++){const p=value.periods[i],expected=periods[i];
  if(p.kind!==expected.kind||p.startInclusive!==expected.startInclusive||p.endExclusive!==expected.endExclusive||
   overviewStates.reduce((total,state)=>total+p.states[state],0)!==p.attempts||Object.values(p.recording).reduce((a,b)=>a+b,0)!==p.attempts||
   p.completedAttemptsWithRecordedUsage>p.states.completed||p.completedAttemptsWithRecordedUsage>p.recording.recorded||p.completedAttemptKnownChargeMicroUsd>p.knownChargeMicroUsd||
   p.recording.recorded===0&&p.knownChargeMicroUsd!==0||p.completedAttemptsWithRecordedUsage===0&&p.completedAttemptKnownChargeMicroUsd!==0)overviewFail('INVALID_USAGE_OVERVIEW');
 }
 const admission=value.monthlyAdmission,cap=value.policy.monthlyCapMicroUsd;
 if(admission.startInclusive!==periods[2].startInclusive||admission.remainingKnownMicroUsd!==(cap===null?null:Math.max(0,cap-admission.knownChargeMicroUsd))||
  admission.reached!==(cap===null?null:admission.knownChargeMicroUsd>=cap)||overviewStates.slice(5).some(state=>value.queue.states[state]!==0))overviewFail('INVALID_USAGE_OVERVIEW');
 return value;
}
const rate=(charge,units)=>units===0?null:Number((charge/units).toFixed(6));
const total=(object,keys)=>keys.reduce((sum,key)=>sum+object[key],0);
const lineageTotal=lineage=>usageOverviewLineageClasses.reduce((sum,name)=>sum+lineage[name].attempts,0);
const same=(actual,expected)=>actual!==null&&typeof actual==='object'&&Object.keys(expected).every(key=>actual[key]===expected[key])&&Object.keys(actual).length===Object.keys(expected).length;
/** Successor-version cross-field checks. Attempts are never promoted into jobs, an unmeasured quantity is
 * never read as zero, and a period whose cohorts, lineages or denominators do not reconcile is refused. */
export function assertUsageOverviewSemanticsV2(value){
 const periods=usageOverviewPeriods(Date.parse(value.observedAt));
 for(let i=0;i<3;i++){const p=value.periods[i],expected=periods[i];
  if(p.kind!==expected.kind||p.startInclusive!==expected.startInclusive||p.endExclusive!==expected.endExclusive||
   total(p.states,overviewStates)!==p.attempts||total(p.recording,['recorded','unavailable','notRecorded'])!==p.attempts||
   total(p.recorded,overviewStates)!==p.recording.recorded||
   p.recorded.completed>p.states.completed||p.recorded.failed>p.states.failed||p.recorded.cancelled>p.states.cancelled||
   lineageTotal(p.lineage)!==p.attempts||
   p.counters.toolFailures>p.counters.toolInvocations)overviewFail('INVALID_USAGE_OVERVIEW');
  if(typeof p.lineage.basis!=='string'||usageOverviewLineageClasses.some(name=>p.lineage[name]===undefined))overviewFail('INVALID_USAGE_OVERVIEW');
  const threads=p.conversationThreads;
  if(threads.status==='unavailable'?(threads.threads!==null||threads.attempts!==null):(threads.attempts!==p.attempts||threads.threads>p.attempts))overviewFail('INVALID_USAGE_OVERVIEW');
  const completed=p.completedAttempts;
  if(completed.attempts!==p.recorded.completed||completed.attemptsWithoutRecordedUsage!==p.states.completed-p.recorded.completed||
   completed.status!==(completed.attempts===0?'unavailable':'estimated')||completed.jobIdentity!=='not-a-job-denominator'||
   completed.microUsdPerCompletedAttempt!==rate(completed.knownChargeMicroUsd,completed.attempts))overviewFail('INVALID_USAGE_OVERVIEW');
  const partial=p.partialOrFailed,partialRecorded=p.recorded.failed+p.recorded.cancelled;
  if(partial.failedAttempts!==p.states.failed||partial.cancelledAttempts!==p.states.cancelled||partial.recordedAttempts!==partialRecorded||
   partial.status!==(partial.recordedAttempts===0?'unavailable':'estimated')||
   partial.microUsdPerRecordedAttempt!==rate(partial.knownChargeMicroUsd,partial.recordedAttempts))overviewFail('INVALID_USAGE_OVERVIEW');
  const liability=p.liability;
  if(liability.recordedAttempts!==p.recording.recorded||liability.unavailableAttempts!==p.recording.unavailable||
   liability.notRecordedAttempts!==p.recording.notRecorded||liability.microUsdPerRecordedAttempt!==rate(liability.knownChargeMicroUsd,liability.recordedAttempts))overviewFail('INVALID_USAGE_OVERVIEW');
 }
 const admission=value.monthlyAdmission,cap=value.policy.monthlyCapMicroUsd;
 if(admission.startInclusive!==periods[2].startInclusive||admission.remainingKnownMicroUsd!==(cap===null?null:Math.max(0,cap-admission.knownChargeMicroUsd))||
  admission.reached!==(cap===null?null:admission.knownChargeMicroUsd>=cap)||overviewStates.slice(5).some(state=>value.queue.states[state]!==0)||
  value.timezone!=='UTC'||value.currency!=='USD'||value.countersCoverage!=='recorded-runs-only'||
  value.occupiedCapacity.status!=='unavailable'||
  value.coverage.providerBilledMicroUsd!==null||value.coverage.completeJobCost!=='estimated'||
  value.queue.capacityStatus!=='unavailable'||value.queue.physicalConcurrency!==null||value.queue.availableCapacity!==null||
  !same(value.denominators,usageOverviewDenominators)||!same(value.categories,usageOverviewCostCategories))overviewFail('INVALID_USAGE_OVERVIEW');
 // The whole-job identity names this owner's closure rule once, and every published job number has to
 // reconcile with the per-state rows, the revision counters and the job-level coverage.
 const identity=value.jobIdentity,whole=value.wholeJobs;
 const zeroed=['attempts','revisions','steerRevisions','tails','settledRevisions','closurePending','unresolvedSuccessors','unsettledChildren','knownChargeMicroUsd'];
 if(identity.status!=='measured'||identity.definition!==usageOverviewJobDefinition||identity.lineage!==usageOverviewJobLineage||
  identity.closure!==usageOverviewJobClosure||identity.owner!==usageOverviewJobInterface.owner||
  identity.states.length!==usageOverviewJobStates.length||usageOverviewJobStates.some((state,index)=>identity.states[index]!==state)||
  whole.basis!==usageOverviewDenominators.sustainedJobs||whole.window!==usageOverviewJobWindow||
  usageOverviewJobStates.some(state=>whole.states[state]===null||typeof whole.states[state]!=='object')||
  usageOverviewJobStates.reduce((sum,state)=>sum+whole.states[state].jobs,0)!==whole.jobs||
  usageOverviewJobStates.reduce((sum,state)=>sum+whole.states[state].attempts,0)!==whole.attempts||
  usageOverviewJobStates.reduce((sum,state)=>sum+whole.states[state].knownChargeMicroUsd,0)!==whole.knownChargeMicroUsd||
  whole.revisions!==whole.attempts||whole.jobs>whole.tails||whole.tails>whole.revisions||
  whole.settledRevisions>whole.revisions||whole.steerRevisions>whole.revisions||
  whole.microUsdPerSuccessfulJob!==rate(whole.states.successful.knownChargeMicroUsd,whole.states.successful.jobs)||
  whole.coverage.jobsWithRecordedUsage+whole.coverage.jobsWithUnavailableUsage>whole.jobs||
  whole.coverage.chargeAttribution!=='whole-job-lineage-at-root-revision-window'||
  whole.coverage.windowEdge!==usageOverviewJobWindowEdge||
  whole.coverage.providerBilledMicroUsd!==null||whole.coverage.completeJobCost!=='estimated'||
  whole.jobs===0&&(zeroed.some(key=>whole[key]!==0)||whole.coverage.jobsWithRecordedUsage!==0||whole.coverage.jobsWithUnavailableUsage!==0))overviewFail('INVALID_USAGE_OVERVIEW');
 return value;
}
