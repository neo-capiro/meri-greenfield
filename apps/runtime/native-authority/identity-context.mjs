/** Thin join of native authority and the canonical current-run owner, with optional trusted selection. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {createApplicationContextAdapters,refusalDiagnostic} from '../../control/action-host/application-adapters/context-adapter.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {carryAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import {createRunCurrentAuthority,CURRENT_REUSE_MS,CURRENT_MAX_WAIT_MS} from './run-current-authority.mjs';
import {currentReceipt} from '../../control/action-host/application-adapters/current-receipt.mjs';
import {currentTurnTelemetry} from '../telemetry/turn-context.mjs';
export function createNativeIdentityContext(configuration){
 const {origin,currentOwner,commandContext,fetchImpl,now,limits,enabled=false,selectRun,admitInitialConversation}=own(configuration,['origin','currentOwner','commandContext','fetchImpl','now','limits'],['enabled','selectRun','admitInitialConversation']);
 const l=data(own(limits,['maxRequestMs','maxFactBytes'])),currentRun=storageMethod(currentOwner,'currentRun');
 const client=createCapiroApplicationAuthorityClient({origin,fetchImpl,now,enabled,limits:{maxRequestMs:l.maxRequestMs,maxResponseBytes:l.maxFactBytes}});
 const observations=new AsyncLocalStorage(),receipts=createRunCurrentAuthority({client,now});
 const refused=()=>{throw Error('APPLICATION_AUTHORITY_REFUSED');};
 const projectedIdentity=r=>data({principal:r.principal,identityRevision:r.identityRevision,checkedAtMs:now(),expiresAtMs:r.expiresAtMs});
 const projected={readIdentity:async call=>{const scope=observations.getStore();if(scope&&call.credential!==scope.credential)refused();return scope?projectedIdentity(await scope.read()):client.readIdentity(call);},readContext:async call=>{
  const scope=observations.getStore();if(!scope)return client.readContext(call);const r=await scope.read();
  if(call.credential!==scope.credential||call.conversationId!==r.conversationId||call.clientId!==r.selectedClientId)refused();
  return data({...projectedIdentity(r),identitySha256:call.identitySha256,conversationId:r.conversationId,selectedClientId:r.selectedClientId,contextRevision:r.contextRevision});
 }};
 const mapped=createApplicationContextAdapters({client:projected,currentRun,commandContext,now,limits:l,...(selectRun?{selectRun}:{}),...(admitInitialConversation?{admitInitialConversation}:{})});
 // One public code for every failure; a dependency that did not answer keeps its transient mark. The context adapter's refusal
 // step and owned reason code (fixed vocabularies) ride along for the session owner's refusal line only.
 const unavailable=cause=>{const error=Object.assign(Error('NATIVE_AUTHORITY_UNAVAILABLE'),{code:'NATIVE_AUTHORITY_UNAVAILABLE',status:503},refusalDiagnostic(cause));throw carryAuthorityUnavailable(cause,error);};
 return Object.freeze({
  /** The action session's one Core /current observation per issuance or recheck. A recheck of an issued session (`binding`) may
   * reuse that session's own receipt for up to 20 s; issuance is always fresh. */
  async withAuthority({credential,hints={},binding,sessionFence,fresh=false,signal,deadlineMs},operation){
   if(!enabled)unavailable();const conversationId=hints.conversationId??commandContext.binding.conversationId,clientId=hints.clientId??commandContext.clientResolution.clientId;
   const reusable=binding!==undefined;
   const readFresh=async()=>{currentTurnTelemetry()?.recordAuthority?.('fresh');return currentReceipt(await client.readCurrent({credential,conversationId,clientId,signal,deadlineMs:Math.min(deadlineMs,now()+CURRENT_MAX_WAIT_MS)}));};
   let receipt,sendStart=performance.now(),wallSend=now();
   if(!reusable)receipt=await readFresh();
   else receipt=await receipts.read({credential,binding,selectedClientId:clientId,sessionFence,fresh,signal,deadlineMs});
   if(receipt.principal.tenantId!==commandContext.binding.tenantId||receipt.principal.actorId!==commandContext.binding.actorId||receipt.conversationId!==conversationId||receipt.selectedClientId!==clientId||receipt.expiresAtMs<=now()||!reusable&&(receipt.checkedAtMs<wallSend||receipt.checkedAtMs>now()))unavailable();
   // Each canonical port recheck re-enters the age check; a slow local await cannot carry a 19.9 s receipt past 20 s.
   const read=async()=>{
    if(reusable)return receipt=await receipts.read({credential,binding,selectedClientId:clientId,sessionFence,signal,deadlineMs});
    if(signal?.aborted||now()>=deadlineMs||receipt.expiresAtMs<=now())unavailable();
    if(performance.now()-sendStart>=CURRENT_REUSE_MS){sendStart=performance.now();wallSend=now();receipt=await readFresh();if(receipt.checkedAtMs<wallSend||receipt.checkedAtMs>now())unavailable();}
    else currentTurnTelemetry()?.recordAuthority?.('reuse');
    return receipt;
   };
   return observations.run({read,credential},operation);
  },
  async readMembership(){const scope=observations.getStore();if(!scope)return undefined;const r=await scope.read();return data({tenantId:r.principal.tenantId,actorId:r.principal.actorId,status:'active',role:r.role,permissions:r.permissions,clientIds:r.clientIds,membershipRevision:r.membershipRevision,checkedAtMs:now(),expiresAtMs:r.expiresAtMs});},
  async verifyIdentity(call){if(!enabled)unavailable();try{return await mapped.verifyIdentity(call);}catch(error){unavailable(error);}},
  async resolveContext(call){if(!enabled)unavailable();try{return await mapped.resolveContext(call);}catch(error){unavailable(error);}},
  async resolveTransitionContext(call){if(!enabled)unavailable();try{return await mapped.resolveTransitionContext(call);}catch(error){unavailable(error);}},
 });
}
