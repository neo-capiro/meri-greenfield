import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertContinuationEnvelope} from '../../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {binding,scopes,versions,id} from '../../test/store-fixture.mjs';
import {createLifecycleJournal} from '../../lifecycle/journal.mjs';
import {projectUsageOverview,projectUsageOverviewV2,usagePeriods} from '../store.mjs';
export const at=Date.parse('2026-10-27T12:00:00.000Z'),principal={tenantId:'synthetic-tenant',actorId:'synthetic-actor',clientIds:[]};
/** The frozen meri.usage-overview/1 request remains the ordinary-parity subject. */
export const request={schemaVersion:'meri.usage-overview/1'};
export const requestV2={schemaVersion:'meri.usage-overview/2'};
/** An ordinary meri.usage-overview/1 body, kept literal so the frozen physical receiver can be proven to
 * accept it byte for byte after the successor version exists. */
export const response=()=>{const[pd,pw,pm]=usagePeriods(at);return {schemaVersion:'meri.usage-overview/1',observedAt:new Date(at).toISOString(),timezone:'UTC',
 policy:{status:'configured',revision:3,monthlyCapMicroUsd:100,maxTurns:12,maxBudgetMicroUsd:20},
 periods:[
  {kind:pd.kind,startInclusive:pd.startInclusive,endExclusive:pd.endExclusive,attempts:1,
   states:{queued:0,starting:0,running:0,'waiting-for-approval':0,paused:0,completed:1,failed:0,cancelled:0},
   recording:{recorded:1,unavailable:0,notRecorded:0},knownChargeMicroUsd:40,completedAttemptsWithRecordedUsage:1,completedAttemptKnownChargeMicroUsd:40},
  {kind:pw.kind,startInclusive:pw.startInclusive,endExclusive:pw.endExclusive,attempts:2,
   states:{queued:0,starting:0,running:0,'waiting-for-approval':0,paused:0,completed:1,failed:1,cancelled:0},
   recording:{recorded:1,unavailable:1,notRecorded:0},knownChargeMicroUsd:40,completedAttemptsWithRecordedUsage:1,completedAttemptKnownChargeMicroUsd:40},
  {kind:pm.kind,startInclusive:pm.startInclusive,endExclusive:pm.endExclusive,attempts:4,
   states:{queued:0,starting:0,running:0,'waiting-for-approval':0,paused:0,completed:2,failed:1,cancelled:1},
   recording:{recorded:2,unavailable:1,notRecorded:1},knownChargeMicroUsd:50,completedAttemptsWithRecordedUsage:2,completedAttemptKnownChargeMicroUsd:50},
 ],
 monthlyAdmission:{startInclusive:pm.startInclusive,knownChargeMicroUsd:80,unavailableRecordedAttempts:1,remainingKnownMicroUsd:20,reached:false},
 queue:{basis:'recorded-run-state',states:{queued:2,starting:0,running:1,'waiting-for-approval':0,paused:0,completed:0,failed:0,cancelled:0},physicalConcurrency:null,availableCapacity:null,capacityStatus:'unavailable'},
 coverage:{attemptPeriodBasis:'run-created-at',admissionPeriodBasis:'sdk-usage-recorded-at',chargeBasis:'recorded-sdk-estimate',providerBilledMicroUsd:null,completeJobCost:'unavailable'}};};
const zeroCounters={inputTokens:'0',outputTokens:'0',cacheReadInputTokens:'0',cacheCreationInputTokens:'0',webSearchRequests:'0',toolInvocations:'0',toolFailures:'0'};
/** Attempt cohorts keyed by the lineage the contracts actually prove: root, fork and resume. */
export const cohortRows=Object.freeze([
 {period:'day',state:'completed',recording:'recorded',lineage:'root',attempts:'2',charge:'40',inputTokens:'200',outputTokens:'100',cacheReadInputTokens:'20',cacheCreationInputTokens:'10',webSearchRequests:'0',toolInvocations:'4',toolFailures:'1'},
 {period:'day',state:'completed',recording:'recorded',lineage:'fork',attempts:'1',charge:'10',inputTokens:'50',outputTokens:'20',cacheReadInputTokens:'0',cacheCreationInputTokens:'0',webSearchRequests:'1',toolInvocations:'2',toolFailures:'0'},
 {period:'day',state:'failed',recording:'unavailable',lineage:'root',attempts:'1',charge:'0',...zeroCounters},
 {period:'day',state:'cancelled',recording:'not-recorded',lineage:'root',attempts:'1',charge:'0',...zeroCounters},
 {period:'week',state:'completed',recording:'recorded',lineage:'root',attempts:'1',charge:'40',inputTokens:'100',outputTokens:'50',cacheReadInputTokens:'10',cacheCreationInputTokens:'5',webSearchRequests:'0',toolInvocations:'2',toolFailures:'0'},
 {period:'week',state:'failed',recording:'unavailable',lineage:'root',attempts:'1',charge:'0',...zeroCounters},
 {period:'month',state:'completed',recording:'recorded',lineage:'root',attempts:'2',charge:'50',inputTokens:'140',outputTokens:'60',cacheReadInputTokens:'20',cacheCreationInputTokens:'10',webSearchRequests:'1',toolInvocations:'3',toolFailures:'0'},
 {period:'month',state:'failed',recording:'unavailable',lineage:'root',attempts:'1',charge:'0',...zeroCounters},
 {period:'month',state:'cancelled',recording:'not-recorded',lineage:'root',attempts:'1',charge:'0',...zeroCounters},
]);
/** One separate period-level row set: distinct conversations, never additive with attempt cohorts. */
export const threadRows=Object.freeze([{period:'day',threads:'3',attempts:'5'},{period:'week',threads:'2',attempts:'2'},{period:'month',threads:'3',attempts:'4'}]);
/** The canonical continuation owner ITSELF — apps/control/conversations/lifecycle/journal.mjs readContinuation
 * — composed exactly as postgres-store.mjs composes it and driven here through nothing but its own SQL
 * transport. The store's statement therefore selects a continued run with the stored column names that owner
 * reads (continuation, continuation_sha256, request, projection), and a continuation digest that is not
 * selected under its stored column name can never verify again: the camelCase alias this suite used to mirror
 * fails the owner here instead of passing silently. The owner opens no transaction of its own and validates
 * no run row, so the run row is never a validated precondition of this read. */
const continuationOwner=createLifecycleJournal({rowRun:()=>{throw Error('the continuation read validates no run row');}});
export const continuationCustody=continuationOwner.readContinuation;
const sourceBinding={...binding,tenantId:principal.tenantId};
const controlScopes=[{...scopes[0],tenantId:sourceBinding.tenantId}],sourceSelectedClientId=controlScopes[0].resourceId;
/** A canonical fork targets ANOTHER conversation; a canonical resume continues in the conversation it came
 * from (same binding, a later writer fence). Two successor targets, both real. */
const resumeTarget={...sourceBinding,runId:id(212),attemptId:id(213),workerId:id(214),writerFence:2};
const forkTarget={...sourceBinding,conversationId:id(211),runId:id(212),attemptId:id(213),workerId:id(214)};
const nativeSession={binding:sourceBinding,key:{projectKey:'synthetic-native-project',sessionId:id(223)},ownerSha256:'c'.repeat(64),entriesCount:1};
const objectiveRequest=(tag,requestId=`synthetic-request-${tag}`)=>({requestId,prompt:`synthetic ${tag}`,
 window:{kind:'day',startInclusive:'2026-10-27T00:00:00.000Z',endExclusive:'2026-10-28T00:00:00.000Z'},skill:'synthetic-skill',
 work:{entry:'start-work',jobKind:'research',deliverables:[],dependencies:[]}});
/** The canonical source control rows the owner's own SQL transport answers with, by control id: its real
 * answers, not a model of them. */
const sourceControls=new Map();
/** One continued revision: the stored pair the statement selects (the continuation jsonb and its digest under
 * the stored column name), the run row the store projects, and — in the same transaction, so the transport
 * sees only this read's own snapshot — the canonical source control row the owner verifies: APPLIED state,
 * the source request/context digests and the native capture proof that pins the stored envelope. */
const continued=(tag,{mode,sourceTag,controlId,target})=>{
 const sourceRequest=objectiveRequest(sourceTag),sourceRequestSha256=canonicalSha256(sourceRequest);
 const contextSha256=canonicalSha256({window:sourceRequest.window,skill:sourceRequest.skill,scopes:controlScopes});
 const stored=assertContinuationEnvelope({kind:'native-session',mode,controlId,sdkSession:nativeSession,versions,scopes:controlScopes,
  sourceRequestSha256,contextSha256,targetSessionId:mode==='fork'?id(216):null});
 const input={controlId,intent:mode,checkpointId:id(219),checkpointSha256:'e'.repeat(64)};
 const projection={input,inputSha256:canonicalSha256(input),sourceBinding,scopes:controlScopes,sourceSelectedClientId,sourceRequest,sourceRequestSha256,contextSha256,
  versions,captureSequence:3,command:null,commandSha256:null,approval:null,state:'APPLIED',checkpointId:sourceBinding.runId,
  proof:{kind:'native-session',sdkSession:nativeSession,checkpointId:sourceBinding.runId,checkpointSha256:canonicalSha256(nativeSession),versions,scopes:controlScopes,sourceRequestSha256,contextSha256,lastEventSequence:3},
  target:{binding:target,scopes:controlScopes,selectedClientId:sourceSelectedClientId,targetSessionId:stored.targetSessionId,versions,admissionReceiptId:id(215)},
  retirement:mode==='resume'?{binding:sourceBinding,retirementReceiptId:id(210)}:null,replayed:false};
 sourceControls.set(controlId,{tenant_id:sourceBinding.tenantId,conversation_id:sourceBinding.conversationId,run_id:sourceBinding.runId,
  control_id:controlId,control_sequence:1,projection,projection_sha256:canonicalSha256(projection)});
 // The successor run's own stored request is the source request under its own request id, exactly as the
 // canonical owner re-derives it when it verifies this row.
 const saved=Object.freeze({continuation:stored,sourceRequest});
 return {request:{...sourceRequest,requestId:`synthetic-request-${tag}`},projection:{binding:target,versions,scopes:controlScopes},
  continuation:saved,continuation_sha256:canonicalSha256(saved),mode:stored.mode,parentSha256:stored.sourceRequestSha256};};
const objective=(tag,overrides={})=>{
 // The run row carries its stored request exactly as the production statement selects it, because the
 // canonical owner re-derives the successor's request identity from it.
 const storedRequest=overrides.request??objectiveRequest(tag);
 return {requestSha256:canonicalSha256(storedRequest),request:storedRequest,state:'completed',entry:'start-work',jobKind:'research',
  recording:'recorded',charge:'40',closure:'published',childAssignments:'0',childResults:'0',unresolvedSuccessors:'0',
  steerControlId:null,steerSequence:null,steerInputSha256:null,continuation:null,mode:null,parentSha256:null,...overrides};};
/** Whole-job objective rows, shaped exactly as the production statement returns them: one row per run whose
 * stored request carries request.work, each continued revision carrying the stored continuation jsonb and its
 * digest under the stored column name the owner reads, beside the mode and source request digest only that
 * owner's verdict on that row produces. */
export const objectiveRows=Object.freeze([
 // one successful objective across a root revision and its resume continuation
 objective('job-1-root',{charge:'40',steerControlId:id(211),steerSequence:'1',steerInputSha256:'1'.repeat(64)}),
 objective('job-1-resume',{charge:'25',...continued('job-1-resume',{mode:'resume',sourceTag:'job-1-root',controlId:id(217),target:resumeTarget})}),
 // one objective whose continuation is still in flight
 objective('job-2-root',{charge:'10'}),
 objective('job-2-tail',{state:'running',charge:'5',...continued('job-2-tail',{mode:'resume',sourceTag:'job-2-root',controlId:id(218),target:resumeTarget})}),
 // a completed revision without the completion producer's published capture: unclosed, never successful
 objective('job-3-root',{charge:'7',closure:'none'}),
 // a completed revision with an unsettled child receipt
 objective('job-4-root',{charge:'9',childAssignments:'2',childResults:'1'}),
 // a completed revision with an unresolved continuation control
 objective('job-5-root',{charge:'12',unresolvedSuccessors:'1'}),
 // terminal states carry their own settlement evidence
 objective('job-6-root',{state:'cancelled',charge:'3',closure:'none'}),
 objective('job-7-root',{state:'failed',recording:'unavailable',charge:'0',closure:'none'}),
 // a continuation whose root revision is outside the window is excluded and counted, never a job
 objective('outside-window',{charge:'4',...continued('outside-window',{mode:'resume',sourceTag:'job-0-root',controlId:id(220),target:resumeTarget})}),
]);
/** The same continuation pair reported as a fork: only the canonical owner's envelope carries the mode, and
 * that fork's own target is another conversation. */
export const forkObjectiveRow=objective('job-1-fork',{charge:'25',...continued('job-1-fork',{mode:'fork',sourceTag:'job-1-root',controlId:id(221),target:forkTarget})});
export function facts(overrides={}){return {periods:usagePeriods(at),observedAt:new Date(at).toISOString(),
 rows:cohortRows.map(row=>({...row})),threadRows:threadRows.map(row=>({...row})),jobRows:objectiveRows.map(row=>({...row})),
 ledgerRows:[{charge:'80',unavailable:'1'}],currentRows:[{state:'queued',attempts:'2'},{state:'running',attempts:'1'}],
 policyRows:[{revision:'3',monthly_cap_micro_usd:'100',sdk_max_turns:12,sdk_max_budget_micro_usd:'20'}],...overrides};}
export const responseV2=overrides=>projectUsageOverviewV2(facts(overrides));
/** The frozen /1 body projected from the same facts, so a test can exercise the /1 route without a pool. */
export const responseV1=overrides=>projectUsageOverview(facts(overrides));
export function poolFixture(overrides={}){
 const state={calls:[],releases:[],facts:facts(overrides),controls:new Map(sourceControls)};
 const client={async query(sql,args){state.calls.push({sql,args});state.beforeQuery?.(sql,args);
  // The canonical continuation owner's own transport, answered with the real source control row for that
  // control id (and with nothing when the caller removed it, so custody failure still refuses the read).
  if(sql.startsWith('SELECT * FROM meri_conversations.controls')){const control=state.controls.get(args[1]);return {rows:control?[control]:[]};}
  if(/^WITH periods[\s\S]*\bruns AS\b/u.test(sql))return {rows:state.facts.rows};
  if(/^WITH periods[\s\S]*COUNT\(DISTINCT r\.conversation_id\)/u.test(sql))return {rows:state.facts.threadRows};
  if(sql.startsWith('SELECT COALESCE'))return {rows:state.facts.ledgerRows};
  if(sql.startsWith('SELECT projection'))return {rows:state.facts.currentRows};
  if(sql.startsWith('SELECT revision'))return {rows:state.facts.policyRows};
  if(sql.startsWith('SELECT r.request_sha256'))return {rows:state.facts.jobRows};return {rows:[]};},release(error){state.releases.push(error);}};
 return {state,pool:{async connect(){return client;}}};
}
