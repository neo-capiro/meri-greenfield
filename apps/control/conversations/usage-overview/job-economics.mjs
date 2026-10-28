/** Run-level and whole-job accounting over the existing run ledger. No new usage store, budget ledger,
 * reservation, authority layer or scheduler is created: every number below is recorded by
 * postgres-store.recordUsage -> usage.accountSdkUsage on the run row this projection reads.
 *
 * A completed RUN is not a complete JOB, and a job is not inferred from one either. A job is the
 * canonical ROOT Work/Delegate objective — the run whose stored request carries request.work — and it is
 * closed only by the existing completion producer's own rule (wholeJobClosure in ../completion-journal.mjs)
 * applied over that objective's persisted continuation lineage. A child assignment, conversation thread,
 * SDK attempt or one completed run is never a job; an objective whose current revisions are not settled
 * stays `unclosed` and is never counted successful.
 *
 * The measurement basis of every cost category is declared once in the contracts owner
 * (usageOverviewCostCategories), so a category with no counter anywhere stays `unresolved` instead of
 * becoming an invented zero. The charge is the SDK list-price estimate the native cap already owns: an
 * estimate, never an invoice. Only the run `delta` is summed (never `cumulative`, which already
 * includes subagents/compaction and prior resumed/forked usage) so nothing is double counted. */
import {ProductError} from '../../product-access/errors.mjs';
import {uuid} from '../boundary.mjs';
import {overviewStates as OVERVIEW_STATES,
 usageOverviewCounterNames as COUNTER_KEYS,usageOverviewLineageClasses as LINEAGE_CLASSES,usageOverviewLineageBasis as LINEAGE_BASIS,
 usageOverviewCostCategories,usageOverviewDenominators,usageOverviewJobStates,usageOverviewJobWindow,usageOverviewJobWindowEdge} from '../../../../packages/contracts/conversation-usage/overview-protocol.mjs';
import {wholeJobClosure,JOB_REVISION_LIMIT} from '../completion-journal.mjs';

/** No occupied-slot, fleet or provider-quota observation exists in this checkout: a configured shared
 * activity ceiling is not measured capacity, so it stays unavailable rather than being reported as a number. */
export const occupiedCapacity=Object.freeze({status:'unavailable',
 reason:'shared activity execution is a configured ceiling, not measured capacity; no occupied-slot or fleet observation is recorded'});

export const jobCostCategories=usageOverviewCostCategories;
export const jobEconomicsDenominators=usageOverviewDenominators;

const refuse=()=>{throw new ProductError('USAGE_OVERVIEW_CORRUPT');};
const integer=value=>{if(typeof value!=='string'||!/^\d+$/u.test(value)||!Number.isSafeInteger(Number(value)))refuse();return Number(value);};
const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))refuse();return n;};
const count=()=>Object.fromEntries(OVERVIEW_STATES.map(state=>[state,0]));
const rate=(charge,units)=>units===0?null:Number((charge/units).toFixed(6));
const emptyLineage=()=>Object.fromEntries(LINEAGE_CLASSES.map(kind=>[kind,{attempts:0,chargeMicroUsd:0}]));

/** Pure: refuses contradiction instead of publishing a number it cannot stand behind. */
export function projectJobEconomics({periods,rows,threadRows=[]}){
 const values=periods.map(period=>({...period,attempts:0,states:count(),recording:{recorded:0,unavailable:0,notRecorded:0},knownChargeMicroUsd:0,
  counters:Object.fromEntries(COUNTER_KEYS.map(key=>[key,0])),
  recorded:count(),recordedCharge:count(),recordedChargeMicroUsd:0,lineage:emptyLineage()}));
 const seen=new Set();
 for(const row of rows){
  const period=values.find(p=>p.kind===row.period),key=[row.period,row.state,row.recording,row.lineage].join(':');
  if(!period||!OVERVIEW_STATES.includes(row.state)||!['recorded','unavailable','not-recorded'].includes(row.recording)
   ||!LINEAGE_CLASSES.includes(row.lineage)||seen.has(key))refuse();
  seen.add(key);
  const attempts=integer(row.attempts);if(attempts===0)refuse();
  const charge=integer(row.charge),counters=Object.fromEntries(COUNTER_KEYS.map(k=>[k,integer(row[k])]));
  // Accounting exists only on a recorded row: an unavailable or never-recorded run carries no charge and no counter.
  if(row.recording!=='recorded'&&(charge!==0||COUNTER_KEYS.some(k=>counters[k]!==0)))refuse();
  // parentRunId is written inside the recorded sdk_usage row, so a never-recorded run can only be a root.
  if(row.recording==='not-recorded'&&row.lineage!=='root')refuse();
  if(counters.toolFailures>counters.toolInvocations)refuse();
  period.attempts=add(period.attempts,attempts);period.states[row.state]=add(period.states[row.state],attempts);
  const recording=row.recording==='not-recorded'?'notRecorded':row.recording;period.recording[recording]=add(period.recording[recording],attempts);
  period.knownChargeMicroUsd=add(period.knownChargeMicroUsd,charge);
  // Lineage counts every attempt, recorded or not; only the charge needs recorded accounting.
  period.lineage[row.lineage].attempts=add(period.lineage[row.lineage].attempts,attempts);
  if(row.recording!=='recorded')continue;
  period.recorded[row.state]=add(period.recorded[row.state],attempts);period.recordedCharge[row.state]=add(period.recordedCharge[row.state],charge);
  period.recordedChargeMicroUsd=add(period.recordedChargeMicroUsd,charge);
  period.lineage[row.lineage].chargeMicroUsd=add(period.lineage[row.lineage].chargeMicroUsd,charge);
  for(const k of COUNTER_KEYS)period.counters[k]=add(period.counters[k],counters[k]);
 }
 // Thread counts are a separate period-level observation: distinct conversation ids with at least one run
 // created in the period. They are not additive with the cohort attempt counts and never become jobs.
 const threads=new Map();
 for(const row of threadRows){
  const kind=row.period,period=values.find(p=>p.kind===kind);
  if(!period||threads.has(kind))refuse();
  const counted=integer(row.threads),attempts=integer(row.attempts);
  // A thread can never outnumber its attempts and the two observations must agree on the period total.
  if(attempts!==period.attempts||counted>attempts)refuse();
  threads.set(kind,{threads:counted,attempts});
 }
 return {periods:values.map(period=>{
  const completedRecorded=period.recorded.completed,completedCharge=period.recordedCharge.completed;
  const partialRecorded=period.recorded.failed+period.recorded.cancelled,partialCharge=period.recordedCharge.failed+period.recordedCharge.cancelled;
  const thread=threads.get(period.kind)??null;
  return {kind:period.kind,startInclusive:period.startInclusive,endExclusive:period.endExclusive,
   attempts:period.attempts,states:period.states,recording:period.recording,knownChargeMicroUsd:period.knownChargeMicroUsd,
   recorded:period.recorded,
   conversationThreads:thread===null
    ?{status:'unavailable',basis:'distinct-conversation-id-by-run-created-at',threads:null,attempts:null}
    :{status:'measured',basis:'distinct-conversation-id-by-run-created-at',threads:thread.threads,attempts:thread.attempts},
   // Every recorded attempt keeps its known list-price estimate: a rate over only successful runs can
   // never be read as complete-job economics because the liability view retains the whole denominator.
   liability:{chargeBasis:'sdk-list-estimate',recordedAttempts:period.recording.recorded,
    knownChargeMicroUsd:period.recordedChargeMicroUsd,microUsdPerRecordedAttempt:rate(period.recordedChargeMicroUsd,period.recording.recorded),
    unavailableAttempts:period.recording.unavailable,notRecordedAttempts:period.recording.notRecorded},
   // A completed attempt reached `completed` AND has recorded accounting. It is still only an attempt:
   // the whole-job denominators live at tenant level in `wholeJobs`, never inside a period cohort.
   completedAttempts:{status:completedRecorded===0?'unavailable':'estimated',chargeBasis:'sdk-list-estimate',
    jobIdentity:'not-a-job-denominator',attempts:completedRecorded,knownChargeMicroUsd:completedCharge,
    microUsdPerCompletedAttempt:rate(completedCharge,completedRecorded),
    attemptsWithoutRecordedUsage:period.states.completed-completedRecorded},
   // partialOrFailed is failed plus cancelled; this codebase has no separate partial terminal state.
   partialOrFailed:{status:partialRecorded===0?'unavailable':'estimated',chargeBasis:'sdk-list-estimate',
    failedAttempts:period.states.failed,cancelledAttempts:period.states.cancelled,
    recordedAttempts:partialRecorded,knownChargeMicroUsd:partialCharge,microUsdPerRecordedAttempt:rate(partialCharge,partialRecorded)},
   lineage:{basis:LINEAGE_BASIS,...period.lineage},
   counters:period.counters};
 })};
}

/** Whole-job projection over the objective rows the store read in the same snapshot. Each row is one run
 * whose stored request carries request.work, plus the canonical continuation owner's verified verdict on
 * that run's stored continuation (its mode and its source request digest), its completion-producer evidence,
 * its last APPLIED steer control and its child receipt counts. The lineage is reassembled here from those
 * persisted facts alone — no identifier leaves this function — and the closure decision is the completion
 * producer's own rule, never a second opinion invented here. */
export function projectWholeJobs({rows}){
 const states=Object.fromEntries(usageOverviewJobStates.map(state=>[state,{jobs:0,attempts:0,knownChargeMicroUsd:0}]));
 const nodes=[],byDigest=new Map();
 for(const row of rows){
  const digest=row.requestSha256;
  if(typeof digest!=='string'||!/^[a-f0-9]{64}$/u.test(digest)||byDigest.has(digest)||!OVERVIEW_STATES.includes(row.state)
   ||!['recorded','unavailable','not-recorded'].includes(row.recording)
   ||!['published','capture-pending','none'].includes(row.closure))refuse();
  const charge=integer(row.charge),childAssignments=integer(row.childAssignments),childResults=integer(row.childResults);
  // An unavailable or never-recorded revision carries no charge, and a result receipt never precedes its assignment.
  if(row.recording!=='recorded'&&charge!==0)refuse();
  if(childResults>childAssignments)refuse();
  // The objective link is the custody verdict, never a digest rebuilt from the row: the mode and the source
  // request digest are reported together or not at all. A fork's verified custody names its source request,
  // but the canonical prompt-identity owner makes a fork a NEW logical prompt, so it heads its own objective
  // instead of joining the source revision. A stale goal revision cannot close the current objective: the
  // current goal revision is this run's own request digest plus the last APPLIED steer control, reported
  // exactly as the canonical child-assignment revision does (assertRevision in ../lifecycle/child-assignments.mjs),
  // and a control that is not APPLIED is no revision.
  const mode=row.mode??null,source=row.parentSha256??null;
  if(mode!==null&&!['resume','fork'].includes(mode))refuse();
  if(source!==null&&!/^[a-f0-9]{64}$/u.test(source))refuse();
  if((mode===null)!==(source===null))refuse();
  const steer=row.steerSequence===null||row.steerSequence===undefined?null:{controlId:row.steerControlId,inputSha256:row.steerInputSha256,controlSequence:integer(row.steerSequence)};
  if(steer){if(typeof steer.inputSha256!=='string'||!/^[a-f0-9]{64}$/u.test(steer.inputSha256))refuse();
   try{uuid(steer.controlId);}catch{refuse();}}
  const node={digest,state:row.state,entry:row.entry,kind:row.jobKind,recording:row.recording,charge,closure:row.closure,
   childAssignments,childResults,unresolvedSuccessors:integer(row.unresolvedSuccessors),steer,children:[],
   parent:mode==='resume'?source:null};
  byDigest.set(digest,node);nodes.push(node);
 }
 // Link every revision to the run whose stored request digest it continues. A revision whose parent is
 // not in this window (or that continues nothing) heads its own chain.
 for(const node of nodes){
  if(node.parent===null){node.head=true;continue;}
  if(node.parent===node.digest)refuse();
  const parent=byDigest.get(node.parent);
  if(!parent){node.head=true;node.detached=true;}
  else parent.children.push(node);
 }
 let jobs=0,attempts=0,revisions=0,steerRevisions=0,tails=0,settledRevisions=0,closurePending=0,unresolvedSuccessors=0,unsettledChildren=0,
  knownChargeMicroUsd=0,jobsWithRecordedUsage=0,jobsWithUnavailableUsage=0,revisionsWithRootOutsideWindow=0,visited=0;
 const groups=[];
 for(const node of nodes){
  if(!node.head)continue;
  const group=[],stack=[node],seen=new Set();
  while(stack.length){const current=stack.pop();if(seen.has(current.digest))refuse();seen.add(current.digest);group.push(current);
   for(const child of current.children)stack.push(child);}
  visited+=group.length;
  // A chain whose head is itself a continuation of a revision outside the window is not a windowed job.
  if(node.detached){revisionsWithRootOutsideWindow=add(revisionsWithRootOutsideWindow,group.length);continue;}
  if(group.length>JOB_REVISION_LIMIT)refuse();
  groups.push({root:node,group});
 }
 // Any revision left unvisited is a continuation cycle or an unreachable fragment: never publish it.
 if(visited!==nodes.length)refuse();
 for(const {root,group} of groups){
  const closure=wholeJobClosure({entry:root.entry,jobKind:root.kind,revisions:group.map(revision=>({requestSha256:revision.digest,state:revision.state,
   lineage:revision===root?'root':'continuation',tail:revision.children.length===0,steer:revision.steer,closure:revision.closure,accounting:revision.recording,
   children:{assignments:revision.childAssignments,settled:revision.childResults},unresolvedSuccessors:revision.unresolvedSuccessors}))});
  const jobCharge=group.reduce((sum,revision)=>sum+revision.charge,0);
  jobs=add(jobs,1);
  attempts=add(attempts,closure.revisions);
  revisions=add(revisions,closure.revisions);
  steerRevisions=add(steerRevisions,closure.steerRevisions);
  tails=add(tails,closure.tails);
  settledRevisions=add(settledRevisions,closure.settledRevisions);closurePending=add(closurePending,closure.closurePending);
  unresolvedSuccessors=add(unresolvedSuccessors,closure.unresolvedSuccessors);
  unsettledChildren=add(unsettledChildren,closure.unsettledChildren);
  knownChargeMicroUsd=add(knownChargeMicroUsd,jobCharge);
  if(closure.recorded)jobsWithRecordedUsage=add(jobsWithRecordedUsage,1);else jobsWithUnavailableUsage=add(jobsWithUnavailableUsage,1);
  states[closure.state].jobs=add(states[closure.state].jobs,1);
  states[closure.state].attempts=add(states[closure.state].attempts,closure.revisions);
  states[closure.state].knownChargeMicroUsd=add(states[closure.state].knownChargeMicroUsd,jobCharge);
 }
 return {basis:usageOverviewDenominators.sustainedJobs,window:usageOverviewJobWindow,states,
  jobs,attempts,revisions,steerRevisions,tails,settledRevisions,closurePending,unresolvedSuccessors,unsettledChildren,knownChargeMicroUsd,
  microUsdPerSuccessfulJob:rate(states.successful.knownChargeMicroUsd,states.successful.jobs),
  coverage:{jobsWithRecordedUsage,jobsWithUnavailableUsage,revisionsWithRootOutsideWindow,
   chargeAttribution:'whole-job-lineage-at-root-revision-window',windowEdge:usageOverviewJobWindowEdge,
   providerBilledMicroUsd:null,completeJobCost:'estimated'}};
}
