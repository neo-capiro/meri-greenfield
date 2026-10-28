/** Foreground routines over the canonical preparation journal, native context and approved schedule lifecycle.
 * Explicit human approval is derived here; stored proposals and replay keys never confer authority. Resources are borrowed. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {scheduleToolValidators as validators,validateToolShape,assertScheduleIntent,ROUTINES_OPERATION_VERSION,scheduleOperationDeclared} from './schedule-validators.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createIntentMount} from '../intents/mount.mjs';
import {intentFault} from '../intents/faults.mjs';
import {createScheduleIntentPreparer,SCHEDULE_INTENT_OPERATIONS} from '../intents/schedule-preparer.mjs';
import {createScheduleToolInterface} from './tool-interface.mjs';
import {createScheduleLifecycle} from './schedule-lifecycle.mjs';
import {createScheduleIntentReconciler} from './intent-reconciliation.mjs';
import {createRoutineReadConsentLifecycle} from './read-consent-lifecycle.mjs';
import {createRoutineConsentObservation,unobserved} from './consent-observation.mjs';
import {randomUUID} from 'node:crypto';
/** MR-04 renewal: the one operation this application stores in the schedule-owned management journal for a renewal
 *  decision. The journal stays cancel-only for cancel; this operation is the durable request/decision correlation. */
const RENEWAL_OPERATION='renew_routine_consent',RENEWAL_OPERATIONS=['schedule_task','update_scheduled_task'];
/** MR-04 renewal authorization: review and approval are metadata operations. They are authorized through the SAME context
 *  owner under the schedule's read operation, which admits no execution limits, no destination and no model budget; the
 *  generation fence is carried by the review digest and Core's own renewal check. */
const READ_AUTHORIZATION=Object.freeze({operation:'list_scheduled_tasks',request:Object.freeze({limit:20})});

const same=(a,b)=>hash(a)===hash(b),digest=/^[a-f0-9]{64}$/u,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const deny=(code='ACCESS_DENIED',outcome='NOT_DISPATCHED')=>{throw Object.assign(Error('ROUTINES_'+code),{code:'ROUTINES_'+code,outcome});};
// FAILED custody keeps the existing closed failure vocabulary. REFUSED is a definite denied preparation, not a transport outage.
const managementRefusal=code=>deny(code==='REFUSED'?'ACCESS_DENIED':code,'NOT_DISPATCHED');
/** MR-04 renewal: the exact reviewed facts of the owner's CURRENT unchanged intent. The immutable intent bytes come from
 * the schedule owner's own read selection (`readFiring`), never from a digest or a browser field. `review` is the closed
 * set an approval binds, so a substituted or foreign intent — or any moved generation, scope or limit — changes its
 * digest and is refused as stale instead of being renewed. */
function renewalFacts(firing,who,scheduleId){
 if(firing===null||firing===undefined)deny('STALE');
 const projection=data(firing.projection),intent=data(firing.intent),generation=firing.generation;
 if(!Number.isSafeInteger(generation)||generation<1||!intent||!projection||projection.scheduleId!==scheduleId||!same(projection.owner,who)||
  intent.generation!==generation||!RENEWAL_OPERATIONS.includes(intent.operation)||hash(intent.projection)!==hash(projection))deny('STALE');
 const scopes=data(intent.projection.scopes);
 if(!Array.isArray(scopes)||scopes.length<1||scopes.length>100||scopes.some(scope=>!scope||typeof scope!=='object'||scope.tenantId!==who.tenantId||typeof scope.policyRevision!=='string'||!scope.policyRevision))deny('STALE');
 const revisions=[...new Set(scopes.map(scope=>scope.policyRevision))];if(revisions.length!==1)deny('STALE');
 const limits={maxCostMicrousd:intent.projection.maxCostMicrousd,maxRuntimeSeconds:intent.projection.maxRuntimeSeconds,retryLimit:intent.projection.retryLimit};
 if(!Number.isSafeInteger(limits.maxCostMicrousd)||limits.maxCostMicrousd<1||!Number.isSafeInteger(limits.maxRuntimeSeconds)||limits.maxRuntimeSeconds<1||
  !Number.isSafeInteger(limits.retryLimit)||limits.retryLimit<0)deny('STALE');
 const review={scheduleId,generation,intentSha256:hash(intent),projectionSha256:hash(projection),scopesSha256:hash(scopes),limits};
 return {review,intent,intentId:intent.intentId,intentSha256:review.intentSha256,scopes,policyRevision:revisions[0],
  pins:{tenantId:who.tenantId,ownerActorId:who.actorId,scheduleId,generation,intentSha256:review.intentSha256,projectionSha256:review.projectionSha256}};
}
const managementFailureCode=error=>/(?:^|_)STALE$/u.test(error?.code)?'STALE':/(?:^|_)(?:REQUEST|INVALID_REQUEST)$/u.test(error?.code)?'INVALID_REQUEST':/(?:^|_)UNAVAILABLE$/u.test(error?.code)?'UNAVAILABLE':'REFUSED';
const mutation=operation=>{if(!SCHEDULE_INTENT_OPERATIONS.includes(operation))deny('INVALID_REQUEST');return operation;};
const principal=current=>current.kind==='routine-management'?current.principal:{tenantId:current.binding.tenantId,actorId:current.binding.actorId};
const sameCurrent=(a,b)=>a.kind==='routine-management'||b.kind==='routine-management'?a.kind===b.kind&&same(principal(a),principal(b))&&same(a.scopes,b.scopes)&&same(a.versions,b.versions):same(a.binding,b.binding);
export function createRoutinesService(configuration){
 const c=own(configuration,['contextOwner','journalStore','proposalReader','scheduleOwner','scheduleClient','workflowClient','scheduleNotFoundError','now','maxRequestMs'],['runCancellation','readConsents','log','retention','managementPreparations','consentObservation','consentRenewal']);
 const resolve=storageMethod(c.contextOwner,'resolve'),authorizeRequest=storageMethod(c.contextOwner,'authorizeRequest'),readProposal=storageMethod(c.proposalReader,'readProposal'),readPreparation=storageMethod(c.journalStore,'read'),readIntent=storageMethod(c.scheduleOwner,'readIntent'),readFiring=storageMethod(c.scheduleOwner,'readFiring');
 if(typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000)deny('INVALID_REQUEST');
 // Option B (lane RD): with the read-consent port the owner's approval also creates, resumes, pauses or revokes the routine's read
 // consent (read-consent-lifecycle.mjs); without it (option B off) nothing below changes.
 const readConsents=c.readConsents===undefined?null:createRoutineReadConsentLifecycle({readConsents:c.readConsents,scheduleOwner:c.scheduleOwner,now:c.now,...(c.log===undefined?{}:{log:c.log})});
 // MR-04 visibility: the truthful consent observation of the public list rows, over the schedule owner's OWN current
 // intent read (never a digest or a browser field) and Core's own stored consent. Absent the port, the list carries no
 // facet at all — never a fabricated absence. The attended renewal port is the same live-session Core wire E.
 const consents=c.consentObservation===undefined?null:createRoutineConsentObservation({observe:c.consentObservation,readFiring:storageMethod(c.scheduleOwner,'readFiring')});
 const renewConsent=c.consentRenewal===undefined?undefined:c.consentRenewal;
 function call(value){const v=own(value,['credential','request','deadlineMs'],['signal']);nativeSignal(v.signal);if(!Number.isSafeInteger(v.deadlineMs))deny('INVALID_REQUEST');return v;}
 function input(value,parse){try{const v=call(value);return {v,b:parse(v.request)};}catch{deny('INVALID_REQUEST');}}
 function life(v){return createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,c.now()+c.maxRequestMs),now:c.now,signal:v.signal,errorFactory:code=>Object.assign(Error(code),{code,outcome:'UNKNOWN'})});}
 function contextCall(v,body,l,extra={}){return {credential:v.credential,operation:body.operation,request:body.request,deadlineMs:Math.min(v.deadlineMs,c.now()+c.maxRequestMs),signal:l.signal,...extra};}
 const retention=c.retention===undefined?null:storageMethod(c.retention,'assertServable');
 async function serve(binding,signal){if(retention)await retention({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId});}
 const cancelRuns=c.runCancellation===undefined?undefined:storageMethod(c.runCancellation,'cancel');
 function tools(resolved){
  // Run cancellation is attended: it carries this request's own resolved session selection (never request data), from which a
  // Core-proof run control obtains the owner's live native session. Unattended callers have no such selection.
  const management=resolved.current.kind==='routine-management',attended=management?null:data({binding:resolved.current.binding,selectedClientId:resolved.current.selectedClientId});
  const runCancellation=management||cancelRuns===undefined?undefined:Object.freeze({cancel:call=>cancelRuns({...call,attended})});
  // Run-free schedule metadata is actor-owned. Schedule suppression is explicitly unsupported;
  // it must never be presented as a fabricated conversation's retention check.
  const authorize=async value=>{if(!management)await serve(resolved.current.binding,value.signal);const receipt=await resolved.authorize(value);if(!management)await serve(resolved.current.binding,value.signal);return receipt;};
  const scheduleOwner=management?Object.freeze({...c.scheduleOwner,list:(selection,check)=>c.scheduleOwner.list({...selection,scopes:resolved.current.scopes},check)}):c.scheduleOwner;
  const lifecycle=createScheduleLifecycle({scheduleOwner,scheduleClient:c.scheduleClient,workflowClient:c.workflowClient,authorize,clock:c.now,...(runCancellation===undefined?{}:{runCancellation})});
  return createScheduleToolInterface({lifecycle,validators,authorize,clock:c.now});
 }
 async function current(v,body,l){const r=await l.run(()=>authorizeRequest(contextCall(v,body,l)));l.limitDeadline(r.expiresAtMs);if(r.kind!=='routine-management')await l.run(signal=>serve(r.binding,signal));l.check();return r;}
 async function retained(v,body,l,auth){
  if(auth.kind==='routine-management'){
   if(!c.managementPreparations)deny('UNAVAILABLE');
   const row=await l.run(()=>c.managementPreparations.readProposal({...principal(auth),scopeSha256:hash({selectedClientId:auth.selectedClientId}),proposalId:body.proposalId},l.check));
   managementRetained(row,body,auth);l.check();return {row,proposal:row.outcome.proposal};
  }
  const row=await l.run(signal=>readProposal({tenantId:auth.binding.tenantId,proposalId:body.proposalId,intentSha256:body.intentSha256,signal}));
  if(row===null)deny('STALE');
  const proposal=row.outcome.result.proposal,release=row.outcome.release;
  if(row.key.actorId!==auth.binding.actorId||release.binding.actorId!==auth.binding.actorId||proposal.projection.owner.actorId!==auth.binding.actorId||
   row.record.operation.id!==body.operation||row.record.argumentsSha256!==hash(body.request)||proposal.proposalId!==body.proposalId||proposal.intentSha256!==body.intentSha256)deny();
  const granted=new Set(auth.scopes.map(hash));if(proposal.projection.scopes.some(s=>!granted.has(hash(s))))deny();
  await l.run(signal=>serve(release.binding,signal));l.check();return {row,proposal,release};
 }
 function decisionBody(raw,approval){
  const b=data(own(raw,['operation','request','proposalId','intentSha256',...(approval?['decision']:[])]));mutation(b.operation);validators.normalizeRequest(b.operation,b.request);
  if(b.operation==='cancel_scheduled_task'&&b.request.runs.length)deny('INVALID_REQUEST');
  if(!uuid.test(b.proposalId)||!digest.test(b.intentSha256)||approval&&b.decision!=='approved')deny('INVALID_REQUEST');return b;
 }
 function intent(row,body,tenantId){
  if(row===null)return null;const i=assertScheduleIntent(row.intent,tenantId);
  if(i.intentId!==body.proposalId||hash(i)!==body.intentSha256||row.intentSha256!==body.intentSha256||i.operation!==body.operation)deny('STALE');return i;
 }
 function acknowledged(i){return validateToolShape('ScheduleMutationOutput',{operation:i.operation,status:'acknowledged',receipt:{operation:i.operation,intentId:i.intentId,generation:i.generation,projection:i.projection,outcome:'ACKNOWLEDGED',physicalStopProven:false}});}
 function managementRetained(row,body,auth){
  if(!row||row.state==='PENDING')deny('UNKNOWN','UNKNOWN');if(row.state==='FAILED')managementRefusal(row.outcome.code);
  const request=validators.normalizeRequest(body.operation,body.request),p=row.outcome.proposal,record=row.record;
  if(row.key.tenantId!==auth.principal.tenantId||row.key.actorId!==auth.principal.actorId||record.operation!==body.operation||record.requestSha256!==hash({operation:body.operation,request})||
   !same(record.scopes,auth.scopes)||record.selectedClientId!==auth.selectedClientId||!same(record.versions,{...auth.versions,imageDigest:record.versions.imageDigest})||
   body.proposalId!==undefined&&(p.proposalId!==body.proposalId||p.intentSha256!==body.intentSha256))deny('STALE');
 }
 async function prepareManagement(v,b,l,auth){
  if(!c.managementPreparations)deny('UNAVAILABLE');
  const request=validators.normalizeRequest(b.operation,b.request),key={...principal(auth),scopeSha256:hash({selectedClientId:auth.selectedClientId}),requestId:b.requestId};
  const record={operation:b.operation,request,requestSha256:hash({operation:b.operation,request}),selectedClientId:auth.selectedClientId,scopes:auth.scopes,versions:auth.versions},claimId=randomUUID();
  const claimed=await l.run(()=>c.managementPreparations.claim({key,record,claimId},l.check));
  if(!claimed.claimed){managementRetained(claimed.row,b,auth);await current(v,b,l);l.check();return data(claimed.row.outcome);}
  let settled=false;
  try{
   // The durable request slot wins before the context allocates its proposal identity.
   const resolved=await l.run(()=>resolve(contextCall(v,b,l)));if(!sameCurrent(resolved.current,auth)||resolved.context.scheduleContext.approval!==null)deny();
   const proposal=await l.run(signal=>tools(resolved).execute({operation:b.operation,request:resolved.prepared.input,context:resolved.context,signal}));
   if(proposal.status!=='approval_required')deny('UNKNOWN','UNKNOWN');
   const result={status:'approval_required',proposal};await l.run(()=>c.managementPreparations.settle({key,claimId,state:'PREPARED',outcome:result},l.check));settled=true;
   const fresh=await current(v,b,l);if(!sameCurrent(fresh,auth))deny();l.check();return data(result);
  }catch(error){
   // This prepare-only phase cannot claim/dispatch a schedule or revoke consent.
   // Classify only its definite local admission refusals; never relabel a custody COMMIT or an effect outcome.
   const refused=error?.outcome==='NOT_DISPATCHED'||['SCHEDULE_CONTEXT_ACCESS_DENIED','SCHEDULE_CONTEXT_POLICY','SCHEDULE_CONTEXT_STALE','SCHEDULE_CONTEXT_REQUEST'].includes(error?.code);
   if(!settled&&refused){
    const code=managementFailureCode(error);
    try{await l.run(()=>c.managementPreparations.settle({key,claimId,state:'FAILED',outcome:{code}},l.check));}
    catch{deny('UNKNOWN','UNKNOWN');}
    managementRefusal(code);
   }
   throw error;
  }
 }
 return Object.freeze({
  /** Internal prepare-only facet for the SDK's existing intent journal. The caller owns delivery custody;
   * this facet uses the same current context and tool owner as the public prepare operation and never applies a schedule. */
  async prepareIntent({binding,...value}){
   const {v,b}=input(value,raw=>{const body=data(own(raw,['operation','request']));mutation(body.operation);validators.normalizeRequest(body.operation,body.request);
    if(body.operation==='cancel_scheduled_task'&&body.request.runs.length)deny('INVALID_REQUEST');return body;});
   const l=life(v);try{
    const auth=await current(v,b,l);if(!same(auth.binding,binding))deny();
    const resolved=await l.run(()=>resolve(contextCall(v,b,l)));if(!same(resolved.current.binding,binding))deny();
    const result=await createScheduleIntentPreparer({operation:b.operation,binding,tool:tools(resolved),resolveContext:async()=>resolved.context})
     .prepare({arguments:resolved.prepared.input,signal:l.signal});
    const fresh=await current(v,b,l);if(!same(fresh.binding,binding))deny();l.check();
    // Retain the exact request, including requested (not merely clamped) limits, for the user's later review/approval.
    return data({...result,request:b.request});
   }finally{l.close();}
  },
  async prepare(value){
   const {v,b}=input(value,raw=>{const body=data(own(raw,['requestId','operation','request']));mutation(body.operation);validators.normalizeRequest(body.operation,body.request);
    if(body.operation==='cancel_scheduled_task'&&body.request.runs.length)deny('INVALID_REQUEST');
    if(typeof body.requestId!=='string'||!/^[A-Za-z0-9._-]{1,128}$/u.test(body.requestId))deny('INVALID_REQUEST');return body;});
   const l=life(v);try{
    const auth=await current(v,b,l);if(auth.kind==='routine-management')return await prepareManagement(v,b,l,auth);
    const deliveryId='sdk:'+hash({protocol:'meri.routines.delivery/1',requestId:b.requestId,operation:b.operation});
    // Retained text is not an expired credential. Exact recovery is authorized by this request's fresh current context.
    const prior=await l.run(signal=>readPreparation({key:{tenantId:auth.binding.tenantId,actorId:auth.binding.actorId,conversationId:auth.binding.conversationId,deliveryId},signal}));
    if(prior!==null){
     // Exact replay is decided by the RECORDED delivery pin, never by this composition's current pin: a preparation the
     // previous producer retained under the retained 0.2.0 family is the same delivery, and the current-only gate that
     // replaced it refused a genuinely retained ordinary preparation before the family-pinned readers could admit it.
     // The recorded pin must be one the canonical family owner DECLARES — an exact pin, never a version shape and never
     // a range — the operation id and the request hash must match byte for byte, and the retained proposal is admitted
     // only by the family that recorded pin names (the journal and proposal readers select it; the retained family still
     // refuses a Work definition). An undeclared pin is stale here, before any proposal text is re-admitted.
     const recorded=prior.record.operation?.version;
     if(prior.record.operation?.id!==b.operation||!scheduleOperationDeclared(recorded)||prior.record.argumentsSha256!==hash(b.request))deny('STALE');
     if(prior.state==='PENDING'||prior.state==='UNKNOWN')deny('UNKNOWN','UNKNOWN');
     if(prior.state==='FAILED')throw intentFault(prior.outcome.code,'none');
     const p=prior.outcome.result.proposal;
     const saved=await retained(v,{...b,proposalId:p?.proposalId,intentSha256:p?.intentSha256},l,auth);
     if(!same(saved.row.outcome,prior.outcome)||saved.release.binding.conversationId!==auth.binding.conversationId)deny();
     await current(v,b,l);l.check();return data(saved.row.outcome.result);
    }
    // Resolve only after the durable claim. Exact replay allocates no replacement identity.
    // The delivery is recorded under the exact family pin this composition prepares under (the routines family's own
    // 0.3.0), so the journal, the intent port and the custody read select that one family from the recorded pin.
    const preparer={operation:{id:b.operation,version:ROUTINES_OPERATION_VERSION},owner:'schedule',binding:auth.binding,async prepare(input){
     let resolved;try{resolved=await l.run(()=>resolve(contextCall(v,b,l)));if(!same(resolved.current.binding,auth.binding))deny();}
     catch(error){throw intentFault(['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'REFUSED','none');}
     return createScheduleIntentPreparer({operation:b.operation,binding:auth.binding,version:ROUTINES_OPERATION_VERSION,tool:tools(resolved),resolveContext:async()=>resolved.context}).prepare({...input,arguments:resolved.prepared.input});
    }};
    const resultRelease={async check({selection,selectionSha256,signal,limitDeadline}){
     if(selectionSha256!==hash(selection)||!same(selection.binding,auth.binding)||selection.operation.id!==b.operation||selection.operation.version!==ROUTINES_OPERATION_VERSION||selection.deliveryId!==deliveryId||selection.argumentsSha256!==hash(b.request))deny();
     const fresh=await authorizeRequest({...contextCall(v,b,l),signal});if(!same(fresh.binding,auth.binding))deny();limitDeadline(fresh.expiresAtMs);
     return {authorized:true,selectionSha256,binding:fresh.binding,scopes:fresh.scopes,checkedAtMs:fresh.checkedAtMs,expiresAtMs:fresh.expiresAtMs};
    }};
    const mount=createIntentMount({binding:auth.binding,preparers:[preparer],journalStore:c.journalStore,resultRelease,now:c.now,limits:{maxRequestMs:c.maxRequestMs},enabled:true});
    return await l.run(signal=>mount.prepare({operation:preparer.operation,arguments:b.request,deliveryId,signal}));
   }finally{l.close();}
  },
  async approve(value){
   const {v,b}=input(value,raw=>decisionBody(raw,true)),l=life(v);let known=false;
   try{
    const auth=await current(v,b,l),saved=await retained(v,b,l,auth),row=await l.run(()=>readIntent({tenantId:principal(auth).tenantId,intentId:b.proposalId},l.check)),prior=intent(row,b,principal(auth).tenantId);
    if(prior){
     if(row.state!=='ACKNOWLEDGED')deny('UNKNOWN','UNKNOWN');known=true;
     const result=acknowledged(prior);await current(v,b,l);l.check();return result;
    }
    // The saved release deadline bounded the old HTTP read, not the lifetime of the exact proposal text.
    // Fresh policy/model/session checks below authorize this explicit approval; no old credential is renewed.
    const resolved=await l.run(()=>resolve(contextCall(v,b,l,{proposal:saved.proposal})));
    if(!sameCurrent(resolved.current,auth)||resolved.prepared.intentSha256!==b.intentSha256)deny();
    const at=c.now(),expires=Math.min(v.deadlineMs,at+c.maxRequestMs,resolved.current.expiresAtMs);
    const approval={proposalId:b.proposalId,commandSha256:b.intentSha256,decision:'approved',approver:principal(auth),policyRevision:auth.scopes[0].policyRevision,decidedAt:new Date(at).toISOString(),expiresAt:new Date(expires).toISOString()};
    // The read consent moves first, under this request's own session selection (never request data): a widening that fails refuses
    // the approval before anything is dispatched; a narrowing that fails is reported and the mutation proceeds.
    const consent=auth.kind==='routine-management'||readConsents===null?null:await l.run(signal=>readConsents.before({intent:resolved.prepared.intent,attended:{binding:resolved.current.binding,selectedClientId:resolved.current.selectedClientId},
     clientId:resolved.current.selectedClientId,policyRevision:auth.scopes[0].policyRevision,signal,deadlineMs:expires}));
    return await l.run(async signal=>{
     let result;
     try{result=await tools(resolved).execute({operation:b.operation,request:resolved.prepared.input,context:{scheduleContext:{...resolved.context.scheduleContext,approval}},signal});}
     catch(error){
      // Not dispatched: a consent created for this mutation is revoked (best effort). Acknowledged but withheld: the mutation is
      // durable, so its consent is recorded (best effort). Unknown: left for Core's own digest check.
      if(consent!==null&&error?.outcome==='NOT_DISPATCHED')await readConsents.abandon(consent,{signal,deadlineMs:expires});
      else if(consent!==null&&error?.outcome==='ACKNOWLEDGED_NOT_RELEASED')try{await readConsents.after({tenantId:auth.binding.tenantId,intent:resolved.prepared.intent,consent:consent.consent},l.check);}catch{}
      throw error;
     }
     known=result.status==='acknowledged';
     if(consent!==null&&known)await readConsents.after({tenantId:auth.binding.tenantId,intent:resolved.prepared.intent,consent:consent.consent},l.check);
     return result;
    });
   }catch(error){if(known)throw Object.assign(Error('ROUTINES_RESULT_NOT_RELEASED'),{code:'ROUTINES_ACCESS_DENIED',outcome:'ACKNOWLEDGED_NOT_RELEASED'});throw error;}finally{l.close();}
  },
  async list(value){
   // MR-04 visibility opt-in: `observation:'consent'` is a RECEIVING-BOUNDARY field, not a schedule tool argument. It is
   // read here, kept out of the tool's own closed request, and it only decides whether the facet is released — never
   // what is read, and never any authority. An unchanged body therefore stays the legacy request and is answered with
   // the exact legacy shape, byte for byte.
   const {v,b}=input(value,raw=>{const body=data(raw),observation=body.observation??null;
    if(observation!==null&&observation!=='consent')deny('INVALID_REQUEST');
    const {observation:opted,...request}=body;validators.normalizeRequest('list_scheduled_tasks',request);
    return {operation:'list_scheduled_tasks',request,observation:opted};}),l=life(v);
   try{
    const resolved=await l.run(()=>resolve(contextCall(v,b,l)));
    const result=await l.run(signal=>tools(resolved).execute({operation:b.operation,request:b.request,context:resolved.context,signal}));
    // MR-04 visibility: when the request opted in, every row the owner just listed carries its own observation of Core's
    // stored read consent for that row's exact current pins. `unknown` covers a refused/unavailable/malformed read, a
    // generation with no acknowledged intent to pin, and a service with no observation port at all; `absent` is only
    // ever Core's own statement. An expired observation stays separate from the projection's scheduling state and from
    // any unattended read that succeeded. The facet is released only after this request's own fresh current
    // scope/generation/retention authorization below, and a request that did not opt in is never given one.
    const page=b.observation!=='consent'?result.page:{...result.page,rows:await l.run(signal=>consents===null?
     result.page.rows.map(row=>({...row,consent:unobserved(row)})):
     consents.observe({rows:result.page.rows,principal:principal(resolved.current),signal,deadlineMs:Math.min(v.deadlineMs,c.now()+c.maxRequestMs),check:l.check}))};
    const fresh=await current(v,b,l);if(!sameCurrent(fresh,resolved.current))deny();l.check();
    return data({...result,page});
   }finally{l.close();}
  },
  /** MR-04 renewal review: the exact original routine intent, its scopes and limits, and the CURRENT consent condition,
   *  read fresh under this request's own current scope/generation/retention authorization. Read-only: it creates no
   *  consent, no schedule generation and no dispatch, and it admits no model budget. */
  async consentReview(value){
   const {v,b}=input(value,raw=>{const body=data(own(raw,['scheduleId']));if(!uuid.test(body.scheduleId))deny('INVALID_REQUEST');return body;}),l=life(v);
   try{
    const auth=await current(v,READ_AUTHORIZATION,l),who=principal(auth);
    const saved=renewalFacts(await l.run(()=>readFiring({tenantId:who.tenantId,scheduleId:b.scheduleId},l.check)),who,b.scheduleId);
    const consent=consents===null?null:await l.run(signal=>consents.one({principal:who,scheduleId:b.scheduleId,generation:saved.review.generation,signal,deadlineMs:Math.min(v.deadlineMs,c.now()+c.maxRequestMs),check:l.check}));
    const fresh=await current(v,READ_AUTHORIZATION,l);if(!sameCurrent(fresh,auth))deny();l.check();
    return data({status:'review_required',scheduleId:b.scheduleId,generation:saved.review.generation,intentSha256:saved.review.intentSha256,
     projectionSha256:saved.review.projectionSha256,scopesSha256:saved.review.scopesSha256,limits:saved.review.limits,intent:saved.intent,consent,reviewSha256:hash(saved.review)});
   }finally{l.close();}
  },
  /** MR-04 renewal approval: the owner's explicit CURRENT-ACCOUNT decision over exactly the review it was shown. The
   *  decision is claimed in the schedule-owned journal BEFORE Core is called, so the exact approval is durable: a retry
   *  after a lost Core ACK re-presents the SAME decision digest and Core's own replay keeps the first window instead of
   *  minting a second one. It never creates a first consent, never resumes a paused routine, never dispatches a schedule
   *  and never admits model budget — Core itself refuses a renewal with no stored consent. Until the journal accepts a
   *  renewal record this facet refuses UNAVAILABLE rather than approving without durable correlation. */
  async consentApprove(value){
   const {v,b}=input(value,raw=>{const body=data(own(raw,['scheduleId','reviewSha256','requestId','decision']));
    if(!uuid.test(body.scheduleId)||!digest.test(body.reviewSha256)||body.decision!=='approved'||typeof body.requestId!=='string'||!/^[A-Za-z0-9._-]{1,128}$/u.test(body.requestId))deny('INVALID_REQUEST');return body;}),l=life(v);
   try{
    if(renewConsent===undefined||c.managementPreparations===undefined||typeof c.managementPreparations.claim!=='function'||typeof c.managementPreparations.settle!=='function')deny('UNAVAILABLE');
    const auth=await current(v,READ_AUTHORIZATION,l),who=principal(auth),scopeSha256=hash({selectedClientId:auth.selectedClientId??null});
    const saved=renewalFacts(await l.run(()=>readFiring({tenantId:who.tenantId,scheduleId:b.scheduleId},l.check)),who,b.scheduleId);
    // The approval binds the review it was shown: a moved generation, scope, limit or intent refuses as stale.
    if(hash(saved.review)!==b.reviewSha256)deny('STALE');
    const key={...who,scopeSha256,requestId:b.requestId},claimId=randomUUID(),decidedAtMs=c.now(),expiresAtMs=Math.min(v.deadlineMs,decidedAtMs+c.maxRequestMs);
    const request={scheduleId:b.scheduleId,reviewSha256:b.reviewSha256,decision:'approved',decidedAtMs,expiresAtMs};
    // The SAME schedule-owned journal as a cancel preparation, with the SAME closed key set. The decision travels inside
    // `request`, so the reviewed digest and the decision instant are immutable in the row. `versions` is the attended
    // session's own current RuntimeVersions object when its receipt carries one and null when it does not.
    const record={operation:RENEWAL_OPERATION,request,requestSha256:hash({operation:RENEWAL_OPERATION,request}),selectedClientId:auth.selectedClientId??null,scopes:saved.scopes,versions:auth.versions??null};
    // The slot's identity is the STABLE reviewed decision, not this attempt's clock: an identical retry at a later clock
    // is admitted and reads back the FIRST durable decision byte for byte. A different review, scope or request id is a
    // different slot and refuses rather than minting a second decision.
    const claimed=await l.run(()=>c.managementPreparations.claim({key,claimId,record},l.check));
    const row=claimed.row,stored=row.record.request;
    if(row.state==='FAILED')managementRefusal(row.outcome.code);
    if(row.state==='PREPARED'){const fresh=await current(v,READ_AUTHORIZATION,l);if(!sameCurrent(fresh,auth))deny();l.check();return data({status:'renewed',...row.outcome.window});}
    // PENDING: this attempt, or an earlier attempt whose Core outcome is unknown. The durable row's OWN decision bytes
    // are re-presented exactly — never a re-minted clock — so Core's replay keeps the FIRST window for this approval.
    const approval={proposalId:saved.intentId,commandSha256:saved.intentSha256,decision:'approved',approver:who,policyRevision:saved.policyRevision,
     decidedAt:new Date(stored.decidedAtMs).toISOString(),expiresAt:new Date(stored.expiresAtMs).toISOString()};
    let window;
    try{
     const answer=await l.run(signal=>renewConsent({credential:v.credential,binding:auth.kind==='routine-management'?null:auth.binding,selectedClientId:auth.selectedClientId??null,
      tenantId:who.tenantId,ownerActorId:who.actorId,intent:saved.intent,intentSha256:saved.intentSha256,approval,deadlineMs:Math.min(v.deadlineMs,c.now()+c.maxRequestMs),signal}));
     window={state:answer.state,generation:answer.generation,policyRevision:answer.policyRevision,issuedAtMs:answer.issuedAtMs,expiresAtMs:answer.expiresAtMs,observedAtMs:answer.observedAtMs,idempotent:answer.idempotent};
    }catch(error){
     // Only a definite refusal of THIS first attempt is terminal: the slot had no earlier Core call, so no window can
     // exist. When the slot was already PENDING, a stale, expired or refused retry proves nothing about the earlier
     // attempt — the claim keeps its immutable decision and the caller reports UNKNOWN, never FAILED, until an
     // exact-decision read proves the outcome. A transport outage or a custody fault is left unresolved for the same reason.
     const code=managementFailureCode(error);
     // Only a DEFINITE refusal is terminal: either the client proved the request never left the process
     // (`dispatched === false` — a local envelope, session or receipt refusal) or Core's OWN received answer decided the
     // refusal (`received === true` — a returned 4xx status or a returned body that refuses). A dispatched call whose
     // answer was lost (deadline, cancel, malformed body, session rotated mid-call) or never arrived (transport outage)
     // proves nothing about whether Core acted, so the slot keeps its immutable decision and the caller reports UNKNOWN.
     // This deliberately replaces the old ROUTINES_CORE_ prefix test, which terminalised every Core-side verdict.
     const definite=error?.received===true||error?.dispatched===false;
     if(claimed.claimed&&definite&&code!=='UNAVAILABLE'){
      try{await l.run(()=>c.managementPreparations.settle({key,claimId:row.claimId,state:'FAILED',outcome:{code}},l.check));}catch{deny('UNKNOWN','UNKNOWN');}
      managementRefusal(code);
     }
     throw error;
    }
    await l.run(()=>c.managementPreparations.settle({key,claimId:row.claimId,state:'PREPARED',outcome:{status:'renewed',window}},l.check));
    const fresh=await current(v,READ_AUTHORIZATION,l);if(!sameCurrent(fresh,auth))deny();l.check();
    return data({status:'renewed',...window});
   }finally{l.close();}
  },
  async reconcile(value){
   const {v,b}=input(value,raw=>decisionBody(raw,false)),l=life(v);let known=false,acknowledgementStarted=false;try{
    const auth=await current(v,b,l);await retained(v,b,l,auth);
    // The existing reconciler only observes the exact old effect. Fresh current authority also gates its metadata acknowledgement.
    const owner={async readIntent(selection,check){await current(v,b,l);const row=await readIntent(selection,check);intent(row,b,principal(auth).tenantId);if(row?.state==='ACKNOWLEDGED')known=true;return row;},async acknowledgeReconciled(selection,check){await current(v,b,l);acknowledgementStarted=true;const receipt=await storageMethod(c.scheduleOwner,'acknowledgeReconciled')(selection,check);known=receipt.state==='ACKNOWLEDGED';return receipt;}};
    const reconciler=createScheduleIntentReconciler({scheduleOwner:owner,scheduleClient:c.scheduleClient,workflowClient:c.workflowClient,scheduleNotFoundError:c.scheduleNotFoundError,clock:c.now,maxRequestMs:Math.max(1,Math.min(c.maxRequestMs,v.deadlineMs-c.now()))});
    const result=await l.run(signal=>reconciler.reconcile({tenantId:principal(auth).tenantId,intentId:b.proposalId,signal}));known=result.outcome==='ACKNOWLEDGED';await current(v,b,l);l.check();return result;
   }catch(error){if(known)throw Object.assign(Error('ROUTINES_RESULT_NOT_RELEASED'),{code:'ROUTINES_ACCESS_DENIED',outcome:'ACKNOWLEDGED_NOT_RELEASED'});if(acknowledgementStarted)throw Object.assign(Error('ROUTINES_UNKNOWN'),{code:'ROUTINES_UNKNOWN',outcome:'UNRESOLVED'});throw error;}finally{l.close();}
  }
 });
}
