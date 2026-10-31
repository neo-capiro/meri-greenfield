/** Fresh Core identity joined to the canonical durable conversation/run owner. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {createApplicationContextAdapters,refusalDiagnostic} from '../../control/action-host/application-adapters/context-adapter.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {carryAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
import {createRunCurrentAuthority,CURRENT_REUSE_MS,CURRENT_MAX_WAIT_MS} from './run-current-authority.mjs';
import {currentReceipt} from '../../control/action-host/application-adapters/current-receipt.mjs';
import {researchCurrentReceipt} from '../../control/action-host/application-adapters/research-current-receipt.mjs';
import {researchContextFields,researchContextFromCurrent,sameResearchContext} from '../../control/action-host/application-adapters/research-context.mjs';
import {currentTurnTelemetry} from '../telemetry/turn-context.mjs';
const receiptSkewMs=5000;
export function createNativeIdentityContext(configuration){
 const {origin,currentOwner,fetchImpl,now,limits,enabled=false,admitInitialConversation,selectBrowserConversation}=own(configuration,['origin','currentOwner','fetchImpl','now','limits','admitInitialConversation'],['enabled','selectBrowserConversation']);
 const l=data(own(limits,['maxRequestMs','maxFactBytes'])),currentRun=storageMethod(currentOwner,'currentRun');
 const client=createCapiroApplicationAuthorityClient({origin,fetchImpl,now,enabled,limits:{maxRequestMs:l.maxRequestMs,maxResponseBytes:l.maxFactBytes}});
 const observations=new AsyncLocalStorage(),receipts=createRunCurrentAuthority({client,now});
 const refused=()=>{throw Error('APPLICATION_AUTHORITY_REFUSED');};
 const projectedIdentity=r=>data({principal:r.principal,identityRevision:r.identityRevision,checkedAtMs:now(),expiresAtMs:r.expiresAtMs});
 const projected={readIdentity:async call=>{const scope=observations.getStore();if(scope&&call.credential!==scope.credential)refused();return scope?projectedIdentity(await scope.read()):client.readIdentity(call);},readContext:async call=>{
  const scope=observations.getStore();if(!scope)return client.readContext(call);if(scope.subject.scopeKind)refused();const r=await scope.read();
  if(call.credential!==scope.credential||call.conversationId!==r.conversationId||call.clientId!==r.selectedClientId)refused();
  return data({...projectedIdentity(r),identitySha256:call.identitySha256,conversationId:r.conversationId,selectedClientId:r.selectedClientId,contextRevision:r.contextRevision});
 },readCurrent:async call=>{
  const scope=observations.getStore();if(!scope)return client.readCurrent(call);const r=await scope.read();
  if(scope.subject.scopeKind)refused();
  if(call.credential!==scope.credential||call.conversationId!==r.conversationId||call.clientId!==r.selectedClientId)refused();
  return data({...r,checkedAtMs:now()});
 },readResearchCurrent:async call=>{
  const scope=observations.getStore();if(!scope)return client.readResearchCurrent(call);const r=await scope.read();
  if(scope.subject.scopeKind!=='research_portfolio'||call.credential!==scope.credential||call.conversationId!==r.conversationId||call.clientId!==null)refused();
  return data({...r,checkedAtMs:now()});
 }};
 const mapped=createApplicationContextAdapters({client:projected,currentRun,now,limits:l,admitInitialConversation:typeof admitInitialConversation==='function'?input=>{
  const scope=observations.getStore();return admitInitialConversation({...input,...(scope?{recheckActive:scope.readFresh}: {})});
 }:admitInitialConversation});
 const browserMapped=selectBrowserConversation===undefined?null:createApplicationContextAdapters({client:projected,currentRun,now,limits:l,admitInitialConversation:selectBrowserConversation});
 // One public code for every failure; a dependency that did not answer keeps its transient mark. The context adapter's refusal
 // step and owned reason code (fixed vocabularies) ride along for the session owner's refusal line only.
 const unavailable=cause=>{const error=Object.assign(Error('NATIVE_AUTHORITY_UNAVAILABLE'),{code:'NATIVE_AUTHORITY_UNAVAILABLE',status:503},refusalDiagnostic(cause));throw carryAuthorityUnavailable(cause,error);};
 return Object.freeze({
  /** The action session's one Core /current observation per issuance or recheck. A recheck of an issued session (`binding`) may
   * reuse that session's own receipt for up to 20 s; issuance is always fresh. */
  async withAuthority({credential,hints={},binding,sessionFence,fresh=false,signal,deadlineMs},operation){
   if(!enabled)unavailable();const conversationId=hints.conversationId,clientId=hints.clientId;
   if(typeof conversationId!=='string'||!Object.hasOwn(hints,'clientId'))unavailable();
   const subject=researchContextFields(hints),research=subject.scopeKind==='research_portfolio';if(research&&clientId!==null)unavailable();
   const reusable=binding!==undefined;
   const readFresh=async()=>{currentTurnTelemetry()?.recordAuthority?.('fresh');const receipt=(research?researchCurrentReceipt:currentReceipt)(await client[research?'readResearchCurrent':'readCurrent']({credential,conversationId,clientId,signal,deadlineMs:Math.min(deadlineMs,now()+CURRENT_MAX_WAIT_MS)}));if(research&&!sameResearchContext(subject,researchContextFromCurrent(receipt)))unavailable();return receipt;};
   let receipt,sendStart=performance.now(),wallSend=now();
   if(!reusable)receipt=await readFresh();
   else receipt=await receipts.read({credential,binding,selectedClientId:clientId,...subject,sessionFence,fresh,signal,deadlineMs});
   const principal=binding??receipt.principal;
   const sameContext=r=>r.principal.tenantId===principal.tenantId&&r.principal.actorId===principal.actorId&&r.conversationId===conversationId&&r.selectedClientId===clientId&&r.expiresAtMs>now();
   if(!sameContext(receipt)||!reusable&&(receipt.checkedAtMs<wallSend-receiptSkewMs||receipt.checkedAtMs>now()+receiptSkewMs))unavailable();
   // Each canonical port recheck re-enters the age check; a slow local await cannot carry a 19.9 s receipt past 20 s.
   const read=async()=>{
    if(reusable){receipt=await receipts.read({credential,binding,selectedClientId:clientId,...subject,sessionFence,signal,deadlineMs});if(!sameContext(receipt))unavailable();return receipt;}
    if(signal?.aborted||now()>=deadlineMs||receipt.expiresAtMs<=now())unavailable();
    if(performance.now()-sendStart>=CURRENT_REUSE_MS){sendStart=performance.now();wallSend=now();receipt=await readFresh();if(!sameContext(receipt)||receipt.checkedAtMs<wallSend-receiptSkewMs||receipt.checkedAtMs>now()+receiptSkewMs)unavailable();}
    else currentTurnTelemetry()?.recordAuthority?.('reuse');
    return receipt;
   };
   const verifyFresh=async()=>{const started=now(),latest=await readFresh();if(!sameContext(latest)||latest.checkedAtMs<started-receiptSkewMs||latest.checkedAtMs>now()+receiptSkewMs)unavailable();return latest;};
   return observations.run({read,readFresh:verifyFresh,credential,subject},operation);
  },
  async readMembership(){const scope=observations.getStore();if(!scope)return undefined;const r=await scope.read();return data({tenantId:r.principal.tenantId,actorId:r.principal.actorId,status:'active',role:r.role,permissions:r.permissions,clientIds:r.clientIds,membershipRevision:r.membershipRevision,checkedAtMs:now(),expiresAtMs:r.expiresAtMs});},
  async verifyIdentity(call){if(!enabled)unavailable();try{return await mapped.verifyIdentity(call);}catch(error){unavailable(error);}},
  async resolveContext(call){if(!enabled)unavailable();try{return await mapped.resolveContext(call);}catch(error){unavailable(error);}},
  ...(browserMapped?{async resolveBrowserContext(call){if(!enabled)unavailable();try{return await browserMapped.resolveContext(call);}catch(error){unavailable(error);}}}:{}),
  async resolveTransitionContext(call){if(!enabled)unavailable();try{return await mapped.resolveTransitionContext(call);}catch(error){unavailable(error);}},
 });
}
