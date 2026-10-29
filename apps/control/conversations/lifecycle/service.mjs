/** Opt-in controls compose current authorization through the existing service. */
import {randomUUID} from 'node:crypto';
import {assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {assertLifecycleCommand,assertLifecycleReceipt,assertWorkerControl,assertContinuationEnvelope,assertCheckpointInspectionRequest,assertCheckpointInspectionReceipt,assertForkBootstrapReceipt,workerActionForIntent} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {continuesSession} from '../../../../packages/contracts/session-continuity.mjs';
import {bounded,same,hash,fail,validateShape,own,uuid,data} from '../boundary.mjs';
import {assertChildDispatchRequest,assertChildSettleRequest} from './child-assignments.mjs';
/** Trusted worker HTTP only: a runner's page of durable controls read with its verified task authority instead of an opaque
 * session. Not a run-owner operation, so neither the generic worker dispatch nor product HTTP can reach it. */
export const taskControlPage=Symbol('taskControlPage');
const controlPage=(rows,after)=>({controls:rows.filter(p=>p.command&&p.state==='PENDING').map(p=>({controlSequence:p.controlSequence,commandSha256:p.commandSha256,command:p.command})),nextControlSequence:rows.at(-1)?.controlSequence??after});
const contextHash=saved=>hash({window:saved.request.window,skill:saved.request.skill,scopes:saved.run.scopes});
const receipt=(p,replayed=p.replayed)=>assertLifecycleReceipt({controlId:p.input.controlId,intent:p.input.intent,sourceBinding:p.sourceBinding,inputSha256:hash(p.input),state:p.state,checkpointId:p.checkpointId,targetBinding:p.target?.binding??null,admissionReceiptId:p.target?.admissionReceiptId??null,retirementReceiptId:p.retirement?.retirementReceiptId??null,replayed});
import {loadWithLifecycle} from '../service.mjs';
import {assertNativeSessionCapture,assertNativeConversationScope} from '../../../../packages/contracts/runtime-0.2/session.mjs';
import {authenticatedCurrentState} from '../../action-host/session/owner.mjs';
export function createConversationLifecycleService({service,store,dispatcher,reconcileOriginal,nativeAdmission,approvals,sessions,retention,now=Date.now,newId=randomUUID,maxRequestMs=3000}){
 const journal=store?.lifecycle,readCurrent=authenticatedCurrentState(sessions);
 if(['authenticateSession','readCurrentState'].some(k=>typeof sessions?.[k]!=='function')||['loadForExecution','publish'].some(k=>typeof service?.[k]!=='function')||typeof store?.read!=='function'||retention!==null&&typeof retention?.assertServable!=='function'||['begin','change','get','controls','claim','dispatchChild','settleChild','captureSession','readSessionCapture','execution','continuation','cancel','readStopFence'].some(k=>typeof journal?.[k]!=='function')||['signal','cancel'].some(k=>typeof dispatcher?.[k]!=='function')||typeof reconcileOriginal!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('LIFECYCLE_CONFIGURATION');
 const event=(type,data)=>({contractVersion:'0.1.0',eventId:newId(),createdAt:new Date(now()).toISOString(),type,data});
 /** Every lifecycle operation reads the conversation between two complete session observations and two retention checks, the gated
  * read the conversation service's history applies; cancellation skips retention so a suppressed subject can still be stopped without
  * any content release. One observation is one owner resolve (identity, membership, context, membership): the history read used a
  * back-to-back authenticate + current-state pair at each end, and this operation another pair before it, so each was a repeat. */
 async function operation(credential,signal,body,{cleanup=false}={}){let cutoff=now()+maxRequestMs;const timer=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:code=>Object.assign(new Error(code),{code})}),life={...timer,deadline:()=>cutoff,limitDeadline(next){cutoff=Math.min(cutoff,next);timer.limitDeadline(cutoff);}};let pinned;
  async function observe(active){
   const started=now(),deadlineMs=started+maxRequestMs;let authentication,current;
   if(readCurrent)({authentication,current}=bounded(await active.run(signal=>readCurrent({credential,signal,deadlineMs}))));
   else{authentication=bounded(await active.run(signal=>sessions.authenticateSession({credential,signal,deadlineMs})));current=bounded(await active.run(signal=>sessions.readCurrentState({authentication,signal,deadlineMs})));}
   if(current.authenticationSha256!==hash(authentication)||['tenantId','actorId','conversationId','runId'].some(k=>authentication.principal?.[k]!==current.binding?.[k]))fail('SESSION_REFUSED');validateShape('RunBinding',current.binding);
   if(!Array.isArray(current.scopes)||!current.scopes.length||current.scopes.length>100)fail('SCOPE_REFUSED');for(const scope of current.scopes){validateShape('Scope',scope);if(scope.tenantId!==current.binding.tenantId)fail('SCOPE_REFUSED');}
   if(new Set(current.scopes.map(hash)).size!==current.scopes.length||new Set(current.scopes.map(s=>s.policyRevision)).size!==1)fail('SCOPE_REFUSED');
   assertNativeConversationScope({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId});
   const at=now();for(const r of [authentication,current])if(!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=at)fail('SESSION_REFUSED');active.limitDeadline(Math.min(authentication.expiresAtMs,current.expiresAtMs));
   return data({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId});
  }
  const servable=async(active,{binding})=>{if(retention&&!cleanup){await active.run(()=>retention.assertServable({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId}));active.check();}};
  async function fresh(active=life){
   const before=await observe(active);await servable(active,before);
   // An admitted conversation has no run row until its first input is accepted: that is "no saved turns yet" (404), not corruption.
   const saved=bounded(await active.run(()=>(cleanup||typeof store.readOptional!=='function'?store.read:store.readOptional)(before.binding,{after:0,limit:1},active.check)),2097152);if(saved===null)fail('NOT_FOUND');if(!same(saved.run.scopes,before.scopes))fail('SCOPE_REFUSED');
   const after=await observe(active);if(!same(after,before))fail('SESSION_CHANGED');if(!same(after.binding,saved.run.binding))fail('SESSION_REFUSED');await servable(active,after);
   const selected={binding:saved.run.binding,scopes:saved.run.scopes,versions:saved.run.versions,request:saved.request,selectedClientId:after.selectedClientId};if(pinned&&!same(pinned,selected))fail('SESSION_CHANGED');pinned??=selected;active.check();return {...saved,selectedClientId:after.selectedClientId};
  }
  try{return await body(await fresh(),life,fresh);}finally{life.close();}
 }
 async function effect(life,fresh,fn){await fresh();const result=await life.run(signal=>fn(signal));await fresh();return result===undefined?undefined:bounded(result,2097152);}
 async function proposal(id,saved,life,fresh){if(typeof approvals?.read!=='function')fail('APPROVAL_OWNER_UNAVAILABLE');const p=await effect(life,fresh,signal=>approvals.read({proposalId:id,binding:saved.run.binding,scopes:saved.run.scopes,signal}));assertProposalIntegrity(p);
  if(p.proposalId!==id||['tenantId','actorId','conversationId','runId'].some(k=>p.command.binding[k]!==saved.run.binding[k])||!same(p.command.scopes,saved.run.scopes)||Date.parse(p.expiresAt)<=now())fail('APPROVAL_REFUSED');return p;}
 async function proof(id,expected,saved,life,fresh){const retained=await effect(life,fresh,()=>journal.readSessionCapture({checkpointId:id,binding:saved.run.binding,scopes:saved.run.scopes,selectedClientId:saved.selectedClientId},life.check));
  const p=assertNativeSessionCapture(retained.proof);
  if(p.checkpointId!==id||p.checkpointSha256!==expected||!same(p.sdkSession.binding,saved.run.binding)||!same(p.scopes,saved.run.scopes)||!same(p.versions,saved.run.versions)||p.sourceRequestSha256!==hash(saved.request)||p.contextSha256!==contextHash(saved)||p.lastEventSequence>saved.lastSequence)fail('CHECKPOINT_REFUSED');return p;
 }
 async function control({credential,input,signal}){const i=assertLifecycleCommand(input);return operation(credential,signal,async(saved,life,fresh)=>{
  const b=saved.run.binding,scopes=saved.run.scopes;let approval=null,command=null;
  if(['resume','fork'].includes(i.intent)){
   if(typeof sessions.verifyTransition!=='function'||typeof journal.requireTransitionAuthority!=='function'||typeof nativeAdmission?.admit!=='function'||i.intent==='resume'&&typeof nativeAdmission?.retire!=='function')fail('LIFECYCLE_OWNER_UNAVAILABLE');
   journal.requireTransitionAuthority();
  }
  if(i.intent==='approval.wait')approval=await proposal(i.proposalId,saved,life,fresh);
  // A clarifying answer is one more live control: it is delivered to the suspended question callback, not a pause.
  if(['steer','pause','approval.wait','answer'].includes(i.intent))command=assertWorkerControl({controlId:i.controlId,action:workerActionForIntent(i.intent),binding:b,contextSha256:contextHash(saved),...(i.intent==='steer'?{prompt:i.text}:{}),...(i.intent==='answer'?{questionId:i.questionId,answers:i.answers}:{}),...(approval?{proposalId:approval.proposalId,proposalSha256:hash(approval)}:{})});
  let p=await life.run(()=>journal.begin({binding:b,scopes,selectedClientId:saved.selectedClientId,input:i,command,approval},life.check));await fresh();
  if(p.replayed)return receipt(p,true); // Dispatch/UNKNOWN are durable barriers, never a second input submission.
  let committed=null,commitAttempted=false,transitionSha256;
  async function transition(purpose,active=life){if(typeof sessions.verifyTransition!=='function'||!committed)fail('LIFECYCLE_TRANSITION_REFUSED');const started=now(),facts=bounded(await active.run(signal=>sessions.verifyTransition({credential,...committed,purpose,signal,deadlineMs:active.deadline()})));own(facts,['checkedAtMs','expiresAtMs','transitionSha256']);if(!Number.isSafeInteger(facts.checkedAtMs)||facts.checkedAtMs<started||facts.checkedAtMs>now()||!Number.isSafeInteger(facts.expiresAtMs)||facts.expiresAtMs<=now()||typeof facts.transitionSha256!=='string'||!/^[a-f0-9]{64}$/u.test(facts.transitionSha256)||transitionSha256&&facts.transitionSha256!==transitionSha256)fail('LIFECYCLE_TRANSITION_REFUSED');transitionSha256??=facts.transitionSha256;active.limitDeadline(facts.expiresAtMs);active.check();return facts;}
  async function transitionEffect(purpose,fn){await transition(purpose);const result=await life.run(signal=>fn(signal,life.deadline()));await transition(purpose);return result;}
  function reconciliationLife(){let cutoff=Math.min(life.deadline(),now()+maxRequestMs);const timer=createOperationLifetime({deadlineMs:cutoff,now,errorFactory:code=>Object.assign(new Error(code),{code})});return {...timer,deadline:()=>cutoff,limitDeadline(next){cutoff=Math.min(cutoff,next);timer.limitDeadline(cutoff);}};}
  async function readApplied(){if(!commitAttempted||!committed)return null;const readback=reconciliationLife();try{await transition('receipt-readback',readback);const saved=await readback.run(()=>journal.get({binding:b,scopes,selectedClientId:savedClientId,controlId:i.controlId},readback.check));if(saved.state!=='APPLIED'||!same(saved.input,i)||!same(saved.target?.binding,committed.targetBinding)||saved.target?.admissionReceiptId!==committed.admissionReceiptId||saved.retirement?.retirementReceiptId!==committed.retirementReceiptId&&committed.retirementReceiptId!==null)fail('LIFECYCLE_TRANSITION_REFUSED');await transition('receipt-readback',readback);return saved;}finally{readback.close();}}
  const savedClientId=saved.selectedClientId;
  try{
   if(command){await effect(life,fresh,signal=>dispatcher.signal({binding:b,command,signal}));return receipt(p);}
   p=await life.run(()=>journal.change({binding:b,scopes,selectedClientId:saved.selectedClientId,controlId:i.controlId,from:'PENDING',to:'DISPATCHING'},life.check));await fresh();
   const retained=i.intent==='resume'?await life.run(()=>journal.readSessionCapture({binding:b,scopes,selectedClientId:saved.selectedClientId,checkpointId:i.checkpointId},life.check)):null;
   if(retained&&retained.proof.checkpointSha256!==i.checkpointSha256)fail('CHECKPOINT_REFUSED');const verified=await proof(i.checkpointId,i.checkpointSha256,saved,life,fresh);
   if(retained&&(!same(verified.sdkSession,retained.proof.sdkSession)||verified.sourceRequestSha256!==retained.proof.sourceRequestSha256||verified.contextSha256!==retained.proof.contextSha256))fail('CHECKPOINT_REFUSED');
   if(i.intent==='resume'&&saved.run.state==='waiting-for-approval'){
    if(!retained.approval||typeof approvals?.readDecision!=='function')fail('APPROVAL_REFUSED');const a=await proposal(retained.approval.proposalId,saved,life,fresh);if(hash(a)!==hash(retained.approval))fail('APPROVAL_REFUSED');
    // The decision owner answers null for an undecided proposal (Core P-INT-10 `approval/decision`): no approval, a typed refusal.
    const d=await effect(life,fresh,signal=>approvals.readDecision({proposalId:a.proposalId,commandSha256:a.commandSha256,binding:b,signal}));if(d===null)fail('APPROVAL_REFUSED');validateShape('ApprovalDecision',d);
    if(d.decision!=='approved'||d.proposalId!==a.proposalId||d.commandSha256!==a.commandSha256||!same(d.approver,a.requiredApprover)||d.policyRevision!==saved.run.policyRevision||Date.parse(d.expiresAt)<=now()||Date.parse(d.decidedAt)>now())fail('APPROVAL_REFUSED');
   }
   if(i.intent==='resume'&&typeof dispatcher.continued!=='function')fail('TEMPORAL_LIFECYCLE_UNAVAILABLE');
   if(typeof nativeAdmission?.admit!=='function'||i.intent==='resume'&&typeof nativeAdmission?.retire!=='function')fail('NATIVE_ADMISSION_UNAVAILABLE');let retirement=null;
   if(i.intent==='resume'){retirement=await effect(life,fresh,signal=>nativeAdmission.retire({controlId:i.controlId,binding:b,sdkSession:verified.sdkSession,scopes,selectedClientId:saved.selectedClientId,signal}));own(retirement,['binding','retirementReceiptId','expiresAtMs']);uuid(retirement.retirementReceiptId);if(!same(retirement.binding,b)||!Number.isSafeInteger(retirement.expiresAtMs)||retirement.expiresAtMs<=now())fail('NATIVE_ADMISSION_REFUSED');life.limitDeadline(retirement.expiresAtMs);}
   const admission=await effect(life,fresh,signal=>nativeAdmission.admit({controlId:i.controlId,mode:i.intent,sourceBinding:b,sdkSession:verified.sdkSession,checkpointSha256:i.checkpointSha256,request:saved.request,scopes,selectedClientId:saved.selectedClientId,versions:saved.run.versions,signal}));own(admission,['binding','scopes','selectedClientId','admissionReceiptId','targetSessionId','expiresAtMs'],['versions','bootstrap']);validateShape('RunBinding',admission.binding);uuid(admission.admissionReceiptId);
   const targetVersions=admission.versions??saved.run.versions;validateShape('RuntimeVersions',targetVersions);
   if(!continuesSession(saved.run.versions,targetVersions))fail('NATIVE_ADMISSION_REFUSED');
   if(i.intent==='fork'){assertForkBootstrapReceipt(admission.bootstrap,{controlId:i.controlId,sourceBinding:b,targetBinding:admission.binding,selectedClientId:saved.selectedClientId});uuid(admission.targetSessionId);if(admission.targetSessionId===verified.sdkSession.key.sessionId)fail('NATIVE_ADMISSION_REFUSED');}
   assertNativeConversationScope({binding:admission.binding,scopes:admission.scopes,selectedClientId:admission.selectedClientId});if(i.intent==='resume'&&admission.bootstrap!==undefined)fail('NATIVE_ADMISSION_REFUSED');if(admission.selectedClientId!==saved.selectedClientId||!same(admission.scopes,scopes)||!Number.isSafeInteger(admission.expiresAtMs)||admission.expiresAtMs<=now())fail('NATIVE_ADMISSION_REFUSED');life.limitDeadline(admission.expiresAtMs);
   const proposed={...p,target:admission,retirement};receipt(proposed);const t=admission.binding,continuation=assertContinuationEnvelope({kind:'native-session',mode:i.intent,controlId:i.controlId,sdkSession:verified.sdkSession,...(verified.files===undefined?{}:{files:verified.files}),versions:verified.versions,scopes,sourceRequestSha256:hash(saved.request),contextSha256:contextHash(saved),targetSessionId:admission.targetSessionId});
   const createdAt=new Date(now()).toISOString(),run={...saved.run,binding:t,versions:targetVersions,state:'queued',createdAt},request={...saved.request,requestId:newId()},conversation={conversationId:t.conversationId,owner:{tenantId:t.tenantId,actorId:t.actorId},scopes,createdAt,policyRevision:run.policyRevision};const queued={...event('run.status',{state:'queued',reasonCode:null}),binding:t,scopes,sequence:1};
   p=await life.run(signal=>journal.continuation({binding:b,scopes,selectedClientId:saved.selectedClientId,controlId:i.controlId,admission,retirement,proof:verified,conversation,run,request,continuation,event:queued,signal,deadlineMs:life.deadline()},life.check));
   committed={controlId:i.controlId,sourceBinding:b,targetBinding:t,admissionReceiptId:admission.admissionReceiptId,retirementReceiptId:retirement?.retirementReceiptId??null};
   await transitionEffect('dispatch-start',(signal,deadlineMs)=>dispatcher.start({binding:t,signal,deadlineMs}));
   if(i.intent==='resume')await transitionEffect('dispatch-continued',(signal,deadlineMs)=>dispatcher.continued({binding:b,input:{controlId:i.controlId,sourceRunId:b.runId,targetRunId:t.runId,admissionReceiptId:admission.admissionReceiptId,retirementReceiptId:retirement.retirementReceiptId},signal,deadlineMs}));
   await transition('commit-applied');commitAttempted=true;
   if(typeof journal.finishTransition!=='function')fail('LIFECYCLE_TRANSITION_REFUSED');
   p=await life.run(signal=>journal.finishTransition({sourceBinding:b,controlId:i.controlId,deadlineMs:life.deadline(),signal},life.check));
   await transition('receipt-readback');return receipt(p);
  }catch(error){
   try{const applied=await readApplied();if(applied)return receipt(applied);}catch{}
   // Recording uncertainty confers no authority and must survive an aborted outer
   // effect lifetime. The state predicate preserves an already committed APPLIED.
   const cleanup=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,errorFactory:code=>Object.assign(new Error(code),{code})});
   try{await cleanup.run(()=>journal.change({binding:b,scopes,selectedClientId:saved.selectedClientId,controlId:i.controlId,from:'DISPATCHING',to:'UNKNOWN'},cleanup.check));}catch{}finally{cleanup.close();}
   throw Object.assign(new Error('LIFECYCLE_EFFECT_UNKNOWN'),{code:'LIFECYCLE_EFFECT_UNKNOWN',outcome:'UNKNOWN'});
  }
 });}
 async function nextControls({credential,binding,after=0,signal}){return operation(credential,signal,async(saved,life,fresh)=>{if(!same(binding,saved.run.binding))fail('STALE_WRITER');const rows=await life.run(()=>journal.controls({binding,scopes:saved.run.scopes,selectedClientId:saved.selectedClientId,after},life.check));await fresh();return controlPage(rows,after);});}
 // The journal re-reads the run row for this exact binding and scopes and pins every control to it and the selected client.
 async function controlsForTask({binding,scopes,selectedClientId,after=0,signal}){assertNativeConversationScope({binding,scopes,selectedClientId});
  const life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal,errorFactory:code=>Object.assign(new Error(code),{code})});
  try{const rows=await life.run(()=>journal.controls({binding,scopes,selectedClientId,after},life.check));life.check();return bounded(controlPage(rows,after),2097152);}finally{life.close();}}
 async function claimControl({credential,binding,input,signal}){const i=bounded(input);own(i,['controlId','commandSha256']);return operation(credential,signal,async(saved,life,fresh)=>{if(!same(binding,saved.run.binding))fail('STALE_WRITER');const result=await life.run(()=>journal.claim({binding,scopes:saved.run.scopes,selectedClientId:saved.selectedClientId,...i},life.check));await fresh();const p=result.projection;return result.claimed?{claimed:true,control:{controlSequence:p.controlSequence,commandSha256:p.commandSha256,command:p.command}}:{claimed:false,receipt:receipt(p)};});}
 /** Child assignment custody: the assignment is persisted before the SDK Agent call is admitted and the child result
  * receipt before the parent is acknowledged. Both run under the run's own credential and re-check current authority
  * after the durable write, exactly like the other lifecycle operations; neither mints a session or a Core admission. */
 async function dispatchChild({credential,binding,input,signal}){const i=assertChildDispatchRequest(bounded(input));return operation(credential,signal,async(saved,life,fresh)=>{if(!same(binding,saved.run.binding))fail('STALE_WRITER');const value=await life.run(()=>journal.dispatchChild({binding,scopes:saved.run.scopes,input:i},life.check));await fresh();return bounded(value,2097152);});}
 async function settleChild({credential,binding,input,signal}){const i=assertChildSettleRequest(bounded(input));return operation(credential,signal,async(saved,life,fresh)=>{if(!same(binding,saved.run.binding))fail('STALE_WRITER');const value=await life.run(()=>journal.settleChild({binding,scopes:saved.run.scopes,input:i},life.check));await fresh();return bounded(value,2097152);});}
 async function ackControl({credential,binding,input,signal}){const i=bounded(input);own(i,['controlId','commandSha256','outcome'],['sdkUserMessageId']);if(!['APPLIED','UNKNOWN'].includes(i.outcome))fail('LIFECYCLE_INPUT_REFUSED');return operation(credential,signal,async(saved,life,fresh)=>{if(!same(binding,saved.run.binding))fail('STALE_WRITER');const p=await life.run(()=>journal.get({binding,scopes:saved.run.scopes,selectedClientId:saved.selectedClientId,controlId:i.controlId},life.check));if(!p||p.commandSha256!==i.commandSha256||p.state==='PENDING'||p.state==='APPLIED'&&i.outcome!=='APPLIED'||i.outcome==='APPLIED'&&(p.input.intent==='steer'?i.sdkUserMessageId!==i.controlId:p.input.intent!=='answer'))fail('LIFECYCLE_ACK_REFUSED');const next=await life.run(()=>journal.change({binding,scopes:saved.run.scopes,selectedClientId:saved.selectedClientId,controlId:i.controlId,from:p.state,to:i.outcome},life.check));await fresh();return receipt(next);});}
 async function recordCheckpoint({credential,binding,input,signal}){const i=bounded(input);own(i,['controlId','sessionId']);uuid(i.controlId);uuid(i.sessionId);return operation(credential,signal,async(saved,life,fresh)=>{if(!same(binding,saved.run.binding))fail('STALE_WRITER');
  const p=await life.run(()=>journal.captureSession({binding,scopes:saved.run.scopes,selectedClientId:saved.selectedClientId,...i,events:[event('checkpoint.verified',{checkpointId:binding.runId}),event('run.status',{state:'paused',reasonCode:'CONTROL_CHECKPOINTED'})]},life.check));await fresh();return receipt(p);
 });}
 async function inspectCheckpoint({credential,input,signal}){const i=assertCheckpointInspectionRequest(input);return operation(credential,signal,async(saved,life,fresh)=>{
  const retained=await life.run(()=>journal.readSessionCapture({binding:saved.run.binding,scopes:saved.run.scopes,selectedClientId:saved.selectedClientId,checkpointId:i.checkpointId},life.check));await fresh();
  const verified=await proof(i.checkpointId,retained.proof.checkpointSha256,saved,life,fresh);if(!same(retained.proof,verified))fail('CHECKPOINT_REFUSED');await fresh();
  return assertCheckpointInspectionReceipt({checkpointId:i.checkpointId,checkpointSha256:verified.checkpointSha256,sourceBinding:saved.run.binding,lastEventSequence:verified.lastEventSequence});
 });}
 async function loadForExecution(args){
  // The basic load already checks identity, membership, current binding and retention before its reads and immediately
  // before release. Keep the lifecycle's read-only journal verification inside that same lifetime, without nesting
  // another history operation and repeating its Core authorization checks for every lifecycle fresh pass.
  if(typeof service[loadWithLifecycle]==='function')return service[loadWithLifecycle](args,(current,check)=>journal.execution(current,check));
  // Injected legacy services keep the original independently gated path.
  const saved=await service.loadForExecution(args);return operation(args.credential,args.signal,async(current,life,fresh)=>{if(!same(current.run.binding,args.binding))fail('STALE_WRITER');const extra=await life.run(()=>journal.execution({binding:args.binding,scopes:current.run.scopes,selectedClientId:current.selectedClientId},life.check));await fresh();if(extra&&saved.nextTurn)fail('EXECUTION_LINEAGE_AMBIGUOUS');return extra?{...saved,...extra}:{...saved};});}
 /** Stop answers the durable stop fence: once the cancellation is committed (or the run is already terminal) and the caller is still
  * authorized, it returns the run's terminal state. A lost fence acknowledgement that the readback cannot prove remains UNKNOWN.
  * Every Stop, including a repeat after restart, starts Temporal cancellation and invocation cleanup independently under
  * their own bounded lifetime. The answer does not claim the Runtime session has stopped.
  * The execution owner records stopping before the external effect; an unknown Stop remains fenced and cannot release a next turn.
  * A previously settled run is never stopped again, so its warm session may safely serve a later run. */
 async function cancel({credential,signal}){return operation(credential,signal,async(saved,life,fresh)=>{const terminal=s=>['completed','failed','cancelled'].includes(s),unknown=()=>Object.assign(new Error('LIFECYCLE_STOP_UNKNOWN'),{code:'LIFECYCLE_STOP_UNKNOWN',outcome:'UNKNOWN'});let state=saved.run.state;
  if(!terminal(state)){
   await fresh();
   // Once authorized, disconnect cannot discard an acknowledged terminal write. Keep the original verified authority deadline.
   const fence=createOperationLifetime({deadlineMs:life.deadline(),now,errorFactory:unknown});
   const cancellation=event('run.status',{state:'cancelled',reasonCode:'USER_CANCELLED'});
   try{await fence.run(()=>journal.cancel(saved.run.binding,cancellation,fence.check,saved.run.scopes));state='cancelled';}
   catch{
    // A lost commit acknowledgement is resolved using only the original verified binding,
    // scopes, and this write's event ID. Session revocation cannot suppress stop cleanup
    // after the journal proves a terminal fence, but it still prevents success to the caller.
    const readback=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,errorFactory:unknown});let current;
    try{current=await readback.run(()=>journal.readStopFence({binding:saved.run.binding,scopes:saved.run.scopes,eventId:cancellation.eventId},readback.check));}catch{throw unknown();}finally{readback.close();}
    if(!terminal(current.state)||current.cancelCommitted&&current.state!=='cancelled')throw unknown();state=current.state;
   }finally{fence.close();}
  }
  // The authenticated terminal fence authorizes stop-only cleanup even if this request disconnects during either effect. It runs
  // under its own lifetime and settles after the answer; its owners above record the outcome.
  const cleanup=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,errorFactory:unknown});
  void Promise.allSettled([
   cleanup.run(signal=>dispatcher.cancel({binding:saved.run.binding,signal})),
   cleanup.run(()=>reconcileOriginal({binding:saved.run.binding})),
  ]).finally(()=>cleanup.close());
  try{await fresh();}catch{throw unknown();}return {state};},{cleanup:true});}
 return Object.freeze({...service,cancel,control,inspectCheckpoint,nextControls,claimControl,ackControl,recordCheckpoint,dispatchChild,settleChild,loadForExecution,[taskControlPage]:controlsForTask});
}
