/** Foreground routines over the canonical preparation journal, native context and approved schedule lifecycle.
 * Explicit human approval is derived here; stored proposals and replay keys never confer authority. Resources are borrowed. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {scheduleToolValidators as validators,validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertScheduleIntent} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createIntentMount} from '../intents/mount.mjs';
import {intentFault} from '../intents/faults.mjs';
import {createScheduleIntentPreparer,SCHEDULE_INTENT_OPERATIONS} from '../intents/schedule-preparer.mjs';
import {createScheduleToolInterface} from './tool-interface.mjs';
import {createScheduleLifecycle} from './schedule-lifecycle.mjs';
import {createScheduleIntentReconciler} from './intent-reconciliation.mjs';
import {createRoutineReadConsentLifecycle} from './read-consent-lifecycle.mjs';

const same=(a,b)=>hash(a)===hash(b),digest=/^[a-f0-9]{64}$/u,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const deny=(code='ACCESS_DENIED',outcome='NOT_DISPATCHED')=>{throw Object.assign(Error('ROUTINES_'+code),{code:'ROUTINES_'+code,outcome});};
const mutation=operation=>{if(!SCHEDULE_INTENT_OPERATIONS.includes(operation))deny('INVALID_REQUEST');return operation;};
export function createRoutinesService(configuration){
 const c=own(configuration,['contextOwner','journalStore','proposalReader','scheduleOwner','scheduleClient','workflowClient','scheduleNotFoundError','now','maxRequestMs'],['runCancellation','readConsents','log']);
 const resolve=storageMethod(c.contextOwner,'resolve'),authorizeRequest=storageMethod(c.contextOwner,'authorizeRequest'),readProposal=storageMethod(c.proposalReader,'readProposal'),readIntent=storageMethod(c.scheduleOwner,'readIntent');
 if(typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000)deny('INVALID_REQUEST');
 // Option B (lane RD): with the read-consent port the owner's approval also creates, resumes, pauses or revokes the routine's read
 // consent (read-consent-lifecycle.mjs); without it (option B off) nothing below changes.
 const readConsents=c.readConsents===undefined?null:createRoutineReadConsentLifecycle({readConsents:c.readConsents,scheduleOwner:c.scheduleOwner,now:c.now,...(c.log===undefined?{}:{log:c.log})});
 function call(value){const v=own(value,['credential','request','deadlineMs'],['signal']);nativeSignal(v.signal);if(!Number.isSafeInteger(v.deadlineMs))deny('INVALID_REQUEST');return v;}
 function input(value,parse){try{const v=call(value);return {v,b:parse(v.request)};}catch{deny('INVALID_REQUEST');}}
 function life(v){return createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,c.now()+c.maxRequestMs),now:c.now,signal:v.signal,errorFactory:code=>Object.assign(Error(code),{code,outcome:'UNKNOWN'})});}
 function contextCall(v,body,l,extra={}){return {credential:v.credential,operation:body.operation,request:body.request,deadlineMs:Math.min(v.deadlineMs,c.now()+c.maxRequestMs),signal:l.signal,...extra};}
 const cancelRuns=c.runCancellation===undefined?undefined:storageMethod(c.runCancellation,'cancel');
 function tools(resolved){
  // Run cancellation is attended: it carries this request's own resolved session selection (never request data), from which a
  // Core-proof run control obtains the owner's live native session. Unattended callers have no such selection.
  const attended=data({binding:resolved.current.binding,selectedClientId:resolved.current.selectedClientId});
  const runCancellation=cancelRuns===undefined?undefined:Object.freeze({cancel:call=>cancelRuns({...call,attended})});
  const lifecycle=createScheduleLifecycle({scheduleOwner:c.scheduleOwner,scheduleClient:c.scheduleClient,workflowClient:c.workflowClient,authorize:resolved.authorize,clock:c.now,...(runCancellation===undefined?{}:{runCancellation})});
  return createScheduleToolInterface({lifecycle,validators,authorize:resolved.authorize,clock:c.now});
 }
 async function current(v,body,l){const r=await l.run(()=>authorizeRequest(contextCall(v,body,l)));l.limitDeadline(r.expiresAtMs);l.check();return r;}
 async function retained(v,body,l,auth){
  const row=await l.run(signal=>readProposal({tenantId:auth.binding.tenantId,proposalId:body.proposalId,intentSha256:body.intentSha256,signal}));
  if(row===null)deny('STALE');
  const proposal=row.outcome.result.proposal,release=row.outcome.release;
  if(row.key.actorId!==auth.binding.actorId||release.binding.actorId!==auth.binding.actorId||proposal.projection.owner.actorId!==auth.binding.actorId||
   row.record.operation.id!==body.operation||row.record.argumentsSha256!==hash(body.request)||proposal.proposalId!==body.proposalId||proposal.intentSha256!==body.intentSha256)deny();
  const granted=new Set(auth.scopes.map(hash));if(proposal.projection.scopes.some(s=>!granted.has(hash(s))))deny();
  return {row,proposal,release};
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
 function acknowledged(i){return validateShape('ScheduleMutationOutput',{operation:i.operation,status:'acknowledged',receipt:{operation:i.operation,intentId:i.intentId,generation:i.generation,projection:i.projection,outcome:'ACKNOWLEDGED',physicalStopProven:false}});}
 return Object.freeze({
  async prepare(value){
   const {v,b}=input(value,raw=>{const body=data(own(raw,['requestId','operation','request']));mutation(body.operation);validators.normalizeRequest(body.operation,body.request);
    if(body.operation==='cancel_scheduled_task'&&body.request.runs.length)deny('INVALID_REQUEST');
    if(typeof body.requestId!=='string'||!/^[A-Za-z0-9._-]{1,128}$/u.test(body.requestId))deny('INVALID_REQUEST');return body;});
   const l=life(v);try{
    const auth=await current(v,b,l),deliveryId='sdk:'+hash({protocol:'meri.routines.delivery/1',requestId:b.requestId,operation:b.operation});
    // Resolve only after the durable claim. Exact replay allocates no replacement identity.
    const preparer={operation:{id:b.operation,version:'0.2.0'},owner:'schedule',binding:auth.binding,async prepare(input){
     let resolved;try{resolved=await l.run(()=>resolve(contextCall(v,b,l)));if(!same(resolved.current.binding,auth.binding))deny();}
     catch(error){throw intentFault(['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'REFUSED','none');}
     return createScheduleIntentPreparer({operation:b.operation,binding:auth.binding,tool:tools(resolved),resolveContext:async()=>resolved.context}).prepare({...input,arguments:resolved.prepared.input});
    }};
    const resultRelease={async check({selection,selectionSha256,signal,limitDeadline}){
     if(selectionSha256!==hash(selection)||!same(selection.binding,auth.binding)||selection.operation.id!==b.operation||selection.operation.version!=='0.2.0'||selection.deliveryId!==deliveryId||selection.argumentsSha256!==hash(b.request))deny();
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
    const auth=await current(v,b,l),saved=await retained(v,b,l,auth),row=await l.run(()=>readIntent({tenantId:auth.binding.tenantId,intentId:b.proposalId},l.check)),prior=intent(row,b,auth.binding.tenantId);
    if(prior){
     if(row.state!=='ACKNOWLEDGED')deny('UNKNOWN','UNKNOWN');known=true;
     const result=acknowledged(prior);await current(v,b,l);l.check();return result;
    }
    if(saved.release.expiresAtMs<=c.now())deny('STALE');l.limitDeadline(saved.release.expiresAtMs);
    const resolved=await l.run(()=>resolve(contextCall(v,b,l,{proposal:saved.proposal})));
    if(!same(resolved.current.binding,auth.binding)||resolved.prepared.intentSha256!==b.intentSha256)deny();
    const at=c.now(),expires=Math.min(v.deadlineMs,at+c.maxRequestMs,saved.release.expiresAtMs,resolved.current.expiresAtMs);
    const approval={proposalId:b.proposalId,commandSha256:b.intentSha256,decision:'approved',approver:{tenantId:auth.binding.tenantId,actorId:auth.binding.actorId},policyRevision:auth.scopes[0].policyRevision,decidedAt:new Date(at).toISOString(),expiresAt:new Date(expires).toISOString()};
    // The read consent moves first, under this request's own session selection (never request data): a widening that fails refuses
    // the approval before anything is dispatched; a narrowing that fails is reported and the mutation proceeds.
    const consent=readConsents===null?null:await l.run(signal=>readConsents.before({intent:resolved.prepared.intent,attended:{binding:resolved.current.binding,selectedClientId:resolved.current.selectedClientId},
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
   const {v,b}=input(value,raw=>{const request=data(raw);validators.normalizeRequest('list_scheduled_tasks',request);return {operation:'list_scheduled_tasks',request};}),l=life(v);
   try{const resolved=await l.run(()=>resolve(contextCall(v,b,l)));return await l.run(signal=>tools(resolved).execute({operation:b.operation,request:b.request,context:resolved.context,signal}));}finally{l.close();}
  },
  async reconcile(value){
   const {v,b}=input(value,raw=>decisionBody(raw,false)),l=life(v);let known=false,acknowledgementStarted=false;try{
    const auth=await current(v,b,l);await retained(v,b,l,auth);
    // The existing reconciler only observes the exact old effect. Fresh current authority also gates its metadata acknowledgement.
    const owner={async readIntent(selection,check){await current(v,b,l);const row=await readIntent(selection,check);intent(row,b,auth.binding.tenantId);if(row?.state==='ACKNOWLEDGED')known=true;return row;},async acknowledgeReconciled(selection,check){await current(v,b,l);acknowledgementStarted=true;const receipt=await storageMethod(c.scheduleOwner,'acknowledgeReconciled')(selection,check);known=receipt.state==='ACKNOWLEDGED';return receipt;}};
    const reconciler=createScheduleIntentReconciler({scheduleOwner:owner,scheduleClient:c.scheduleClient,workflowClient:c.workflowClient,scheduleNotFoundError:c.scheduleNotFoundError,clock:c.now,maxRequestMs:Math.max(1,Math.min(c.maxRequestMs,v.deadlineMs-c.now()))});
    const result=await l.run(signal=>reconciler.reconcile({tenantId:auth.binding.tenantId,intentId:b.proposalId,signal}));known=result.outcome==='ACKNOWLEDGED';await current(v,b,l);l.check();return result;
   }catch(error){if(known)throw Object.assign(Error('ROUTINES_RESULT_NOT_RELEASED'),{code:'ROUTINES_ACCESS_DENIED',outcome:'ACKNOWLEDGED_NOT_RELEASED'});if(acknowledgementStarted)throw Object.assign(Error('ROUTINES_UNKNOWN'),{code:'ROUTINES_UNKNOWN',outcome:'UNRESOLVED'});throw error;}finally{l.close();}
  }
 });
}
