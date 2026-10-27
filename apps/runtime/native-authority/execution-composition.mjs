import {createLegiwatchPreparer} from '../../control/intents/legiwatch-preparer.mjs';
import {createLegiwatchCoreClient} from './legiwatch-client.mjs';
/** Native intent preparation uses the active SDK execution and current Core authority. */
import {types} from 'node:util';
import {memoryIntentPreparersFor} from '../product-ports/memory.mjs';
import {routineIntentPreparersFor} from '../routines-intents.mjs';
import {createNativeTaskClientResolver} from './task-client-reference.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createIntentMount} from '../../control/intents/mount.mjs';
import {createPostgresIntentJournalStore} from '../../control/intents/postgres-journal.mjs';
import {createIntentResultReleaseAuthority} from '../../control/intents/result-release-authority.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {documentIntentPreparersFor} from '../artifacts/intent-binding.mjs';
import {assertExecutionIdentity} from '../../control/conversations/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createNativeTaskPreparers} from './native-task-preparers.mjs';
import {createResearchSharingPreparers} from '../../control/intents/research-sharing-preparer.mjs';
import {createResearchSharingCoreClient} from './research-sharing-client.mjs';
import {createRoutinesServiceSecret} from './routines-core-client.mjs';
import {routinesReservedSecretFiles} from './routines-configuration.mjs';
import {createReservedCredentialDigests} from './approval-forwarder.mjs';
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const same=(a,b)=>hash(a)===hash(b);
const configurationFault=()=>intentFault('INTENT_CONFIGURATION');
/** Native preparation uses the active AgentCore execution and the same fresh Core transition authority as
 * conversation continuation. It does not issue command grants or install the retired prepared-run allocation. */
export function createAgentCoreIntentResolver({context,execution,transitionAuthority,nativeCredentials,fetchImpl}){
 const {configuration,pool,now}=context;
 if(!ordinary(execution?.authenticate)||!ordinary(transitionAuthority?.readCurrent))throw configurationFault();
 const resolveClient=nativeCredentials&&configuration.intents?.core?createNativeTaskClientResolver({origin:configuration.intents.core.origin,nativeCredentials,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{})}):null;
 return async function resolveRun({binding,credential,signal,deadlineMs}){
  if(configuration.sourceEnabled!==true||configuration.intents?.enabled!==true)throw intentFault('UNAVAILABLE');
  validateShape('RunBinding',binding);let pinned;
  async function fresh(signal){
   let current;try{current=await execution.authenticate({binding,credential,signal});}catch{throw intentFault('ACCESS_DENIED');}
   const identity=assertExecutionIdentity(current.execution);
   if(!same(identity.binding,binding)||['completed','failed','cancelled'].includes(current.state)||identity.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');
   assertNativeConversationScope({binding,scopes:current.scopes,selectedClientId:current.selectedClientId});
   const facts=data({execution:identity,scopes:current.scopes,selectedClientId:current.selectedClientId,policyRevision:current.policyRevision});
   if(pinned&&!same(pinned,facts))throw intentFault('ACCESS_DENIED');pinned??=facts;
   return facts;
  }
  async function currentRights({signal,policyRevision}){
   const first=await fresh(signal),started=now();
   if(policyRevision!==first.policyRevision)throw intentFault('ACCESS_DENIED');
   const current=data(own(await transitionAuthority.readCurrent({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,policyRevision,
    deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs),signal}),['binding','scopes','selectedClientId','policyRevision','checkedAtMs','expiresAtMs']));
   if(!same(current.binding,binding)||!same(current.scopes,first.scopes)||current.selectedClientId!==first.selectedClientId||current.policyRevision!==policyRevision||
    !Number.isSafeInteger(current.checkedAtMs)||current.checkedAtMs<started||current.checkedAtMs>now()||!Number.isSafeInteger(current.expiresAtMs)||current.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');
   await fresh(signal);
   return {tenantId:binding.tenantId,actorId:binding.actorId,scopes:current.scopes,checkedAtMs:current.checkedAtMs,expiresAtMs:current.expiresAtMs};
  }
  const first=await fresh(signal);
  // Availability is a description of composed preparers, but it still belongs to the same current authorized run.
  await currentRights({signal,policyRevision:first.policyRevision});
  const sharingCore=configuration.intents.core,nativeSharing=nativeCredentials&&sharingCore?createResearchSharingCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const nativeLegiwatch=nativeCredentials&&sharingCore?createLegiwatchCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const preparers=[...(nativeLegiwatch?[createLegiwatchPreparer({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeLegiwatch,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)})]:[]),...routineIntentPreparersFor(context,{binding,selectedClientId:first.selectedClientId}),...documentIntentPreparersFor(context,{binding,scopes:first.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,expiresAtMs:first.execution.expiresAtMs,
   async readCurrent({signal}){const rights=await currentRights({signal,policyRevision:first.policyRevision});return {binding,scopes:rights.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,checkedAtMs:rights.checkedAtMs,expiresAtMs:Math.min(rights.expiresAtMs,first.execution.expiresAtMs)};},
   clientResolution:{clientId:first.selectedClientId},signal}),
   ...(configuration.intents.core?[...createNativeTaskPreparers({pool,binding,scopes:first.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,
    expiresAtMs:first.execution.expiresAtMs,currentRights,now,maxRequestMs:configuration.limits.requestMs,...(resolveClient?{async resolveClientReference(value){await fresh(value.signal);const result=await resolveClient({...value,binding,selectedClientId:first.selectedClientId});await fresh(value.signal);return result;}}:{})})]:[]),
   ...(nativeSharing?createResearchSharingPreparers({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeSharing,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)}):[]),
   ...(configuration.memory?.enabled?memoryIntentPreparersFor(context,{binding,scopes:first.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,signal,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs),
    async readCurrent({signal}){const rights=await currentRights({signal,policyRevision:first.policyRevision});return {binding,scopes:rights.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,checkedAtMs:rights.checkedAtMs,expiresAtMs:Math.min(rights.expiresAtMs,first.execution.expiresAtMs)};}}):[])];
  if(!preparers.length)throw intentFault('UNAVAILABLE');
  return createIntentMount({binding,preparers,journalStore:createPostgresIntentJournalStore({pool}),now,
   limits:{maxRequestMs:configuration.limits.requestMs},enabled:true,
   resultRelease:createIntentResultReleaseAuthority({binding,now,currentRights,async currentRun(_binding,{signal}){
    const current=await fresh(signal);return JSON.stringify({binding,policyRevision:current.policyRevision,deadlineMs:current.execution.expiresAtMs,checkedAtMs:now()});
   }})});
 };
}
