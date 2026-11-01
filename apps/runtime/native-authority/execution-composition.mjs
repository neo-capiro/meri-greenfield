import {createNoteIntentPreparer} from '../../control/intents/note-preparer.mjs';
import {createNoteClient} from './note-client.mjs';
import {createWatchPreparer} from '../../control/intents/watch-preparer.mjs';
import {createWatchCoreClient} from './watch-client.mjs';
import {createClientRecordPreparer} from '../../control/intents/client-record-preparer.mjs';
import {createClientRecordCoreClient} from './client-record-client.mjs';
import {createRelevancePreparer} from '../../control/intents/legiwatch-relevance-preparer.mjs';
import {createLegiwatchPreparer} from '../../control/intents/legiwatch-preparer.mjs';
import {createBizdevPreparer} from '../../control/intents/bizdev-preparer.mjs';
import {createLegiwatchCoreClient} from './legiwatch-client.mjs';
import {createBizdevCoreClient} from './bizdev-client.mjs';
import {createLegislativeDocumentPreparer} from '../../control/intents/legislative-document-preparer.mjs';
import {createLegislativeDocumentCoreClient} from './legislative-document-client.mjs';
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
import {documentIntentPreparersFor,officeIntentPreparersFor} from '../artifacts/intent-binding.mjs';
import {assertExecutionIdentity} from '../../control/conversations/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createNativeTaskPreparers} from './native-task-preparers.mjs';
import {createNativeMailPreparer} from './native-mail-preparer.mjs';
import {createResearchSharingPreparers} from '../../control/intents/research-sharing-preparer.mjs';
import {createResearchActionPreparers} from '../../control/intents/research-action-preparer.mjs';
import {createResearchActionCoreClient} from './research-action-client.mjs';
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
  /** The current transition authority of the execution `facts` describe, checked against them. */
  async function authority(facts,signal){
   const started=now();
   const current=data(own(await transitionAuthority.readCurrent({binding,scopes:facts.scopes,selectedClientId:facts.selectedClientId,policyRevision:facts.policyRevision,
    deadlineMs:Math.min(deadlineMs,facts.execution.expiresAtMs),signal}),['binding','scopes','selectedClientId','policyRevision','checkedAtMs','expiresAtMs']));
   if(!same(current.binding,binding)||!same(current.scopes,facts.scopes)||current.selectedClientId!==facts.selectedClientId||current.policyRevision!==facts.policyRevision||
    !Number.isSafeInteger(current.checkedAtMs)||current.checkedAtMs<started||current.checkedAtMs>now()||!Number.isSafeInteger(current.expiresAtMs)||current.expiresAtMs<=now())throw intentFault('ACCESS_DENIED');
   return {tenantId:binding.tenantId,actorId:binding.actorId,scopes:current.scopes,checkedAtMs:current.checkedAtMs,expiresAtMs:current.expiresAtMs};
  }
  async function currentRights({signal,policyRevision}){
   const current=await fresh(signal);
   if(policyRevision!==current.policyRevision)throw intentFault('ACCESS_DENIED');
   const rights=await authority(current,signal);
   await fresh(signal);
   return rights;
  }
  const first=await fresh(signal);
  // Availability is a description of composed preparers, but it still belongs to the same current authorized run: the execution
  // authenticated once above is the one whose current authority is read. Each preparation re-runs the full fresh/authority/fresh
  // check through `currentRights`, so nothing retained depends on authenticating again here.
  await authority(first,signal);
  const sharingCore=configuration.intents.core,nativeSharing=nativeCredentials&&sharingCore?createResearchSharingCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const nativeResearchAction=nativeCredentials&&sharingCore?createResearchActionCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const nativeLegiwatch=nativeCredentials&&sharingCore?createLegiwatchCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const nativeNote=nativeCredentials&&sharingCore?createNoteClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const nativeWatch=nativeCredentials&&sharingCore?createWatchCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const nativeLegislativeDocument=nativeCredentials&&sharingCore?createLegislativeDocumentCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const nativeBizdev=nativeCredentials&&sharingCore?createBizdevCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const nativeClientRecord=nativeCredentials&&sharingCore?createClientRecordCoreClient({origin:sharingCore.origin,now,maxRequestMs:configuration.limits.requestMs,...(fetchImpl?{fetchImpl}:{}),
   getServiceSecret:createRoutinesServiceSecret({file:sharingCore.serviceSecretFile,reservedFiles:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   reservedCredentials:createReservedCredentialDigests({files:routinesReservedSecretFiles(configuration),readSecret:async path=>(await import('../config.mjs')).readSecret(path)}),
   async getCredentials(selection){await fresh(selection.signal);return nativeCredentials.nativeCredentialFor({binding,selectedClientId:first.selectedClientId,signal:selection.signal});}}):null;
  const preparers=[...(nativeNote?[createNoteIntentPreparer({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeNote,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)})]:[]),...(nativeWatch?[createWatchPreparer({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeWatch,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)})]:[]),...(nativeLegislativeDocument?['prepare_legiwatch_briefing','save_legislative_research'].map(operation=>createLegislativeDocumentPreparer({operation,binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeLegislativeDocument,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)})):[]),...(nativeBizdev?[createBizdevPreparer({binding,scopes:first.scopes,client:nativeBizdev,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)})]:[]),...(nativeClientRecord?['create_client','update_client_profile'].map(operation=>createClientRecordPreparer({operation,binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeClientRecord,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)})):[]),...(nativeLegiwatch?[createLegiwatchPreparer({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeLegiwatch,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)}),createRelevancePreparer({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeLegiwatch,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)})]:[]),...routineIntentPreparersFor(context,{binding,selectedClientId:first.selectedClientId}),...await documentIntentPreparersFor(context,{binding,scopes:first.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,expiresAtMs:first.execution.expiresAtMs,
   async readCurrent({signal}){const rights=await currentRights({signal,policyRevision:first.policyRevision});return {binding,scopes:rights.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,checkedAtMs:rights.checkedAtMs,expiresAtMs:Math.min(rights.expiresAtMs,first.execution.expiresAtMs)};},
   clientResolution:{clientId:first.selectedClientId},signal}),
   ...(configuration.intents.core?[createNativeMailPreparer({pool,binding,scopes:first.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,expiresAtMs:first.execution.expiresAtMs,currentRights,now,maxRequestMs:configuration.limits.requestMs}),...createNativeTaskPreparers({pool,binding,scopes:first.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,
    expiresAtMs:first.execution.expiresAtMs,currentRights,now,maxRequestMs:configuration.limits.requestMs,...(resolveClient?{async resolveClientReference(value){await fresh(value.signal);const result=await resolveClient({...value,binding,selectedClientId:first.selectedClientId});await fresh(value.signal);return result;}}:{})})]:[]),
   ...(nativeSharing?createResearchSharingPreparers({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeSharing,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)}):[]),
   ...(nativeResearchAction?createResearchActionPreparers({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,client:nativeResearchAction,now,currentRights,policyRevision:first.policyRevision,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)}):[]),
   ...await officeIntentPreparersFor(context,{binding,scopes:first.scopes,selectedClientId:first.selectedClientId,policyRevision:first.policyRevision,currentRights,signal,deadlineMs:Math.min(deadlineMs,first.execution.expiresAtMs)}),
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
