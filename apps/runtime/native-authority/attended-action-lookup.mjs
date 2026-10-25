/** Attended action reads use the existing typed Core receiver and retained lookup owner. No execution allocation is created. */
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createActionItemsReadHandler} from '../../gateway/sources/action-items/handler.mjs';
import {createActionItemsHttpAdapter} from '../../gateway/sources/action-items/http-adapter.mjs';
import {createPostgresTaskLookupStore} from '../../control/task-lookup/postgres-results.mjs';
import {createTaskLookupDelivery} from '../../control/task-lookup/delivery.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
const same=(a,b)=>hash(a)===hash(b),operation={id:'actions.query',version:'0.2.0'},contract=resolveOperationContract(operation);
const runtimeReadSecret=async path=>(await import('../config.mjs')).readSecret(path);
export function createAttendedActionLookup({context,sessions,binding,scopes,selectedClientId,readCurrent,deadlineMs,transport={}}){
 const {configuration,pool,now}=context,{fetchImpl=fetch,readSecret=runtimeReadSecret}=transport;
 if(typeof selectedClientId!=='string'||configuration.reads?.enabled!==true||typeof configuration.reads.serviceSecretFile!=='string')throw intentFault('UNAVAILABLE');
 const policyRevision=scopes[0].policyRevision,subject={kind:'client',entityType:'client',entityIds:[selectedClientId],tenantId:binding.tenantId,actorId:binding.actorId,policyRevision,scopes,rosterVersionId:null};
 const sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))],limit=configuration.native.maxResponseBytes;
 const adapter=createActionItemsHttpAdapter({origin:configuration.agentcore?.identity.origin??configuration.intents.core.origin,now,fetchImpl,maxRequestMs:configuration.limits.requestMs,maxResponseBytes:limit,
  async getCredentials(call){
   const {input,signal,deadlineMs:cutoff,...echo}=call;
   if(!same(echo.binding,binding)||!same(echo.subject,subject)||echo.policyRevision!==policyRevision||!same(echo.sourceIds,sourceIds))throw intentFault('ACCESS_DENIED');
   await readCurrent(signal);const original=await sessions.nativeCredentialFor({binding,selectedClientId,signal});
   const serviceSecret=Buffer.from(await readSecret(configuration.reads.serviceSecretFile)).toString('utf8').trim();
   const current=await readCurrent(signal),live=await sessions.nativeCredentialFor({binding,selectedClientId,signal});
   if(original.credential!==live.credential)throw intentFault('ACCESS_DENIED');
   return {...echo,authorizationScheme:'Bearer',bearerToken:live.credential,serviceSecret,expiresAtMs:Math.min(cutoff,current.expiresAtMs,original.expiresAtMs,live.expiresAtMs)};
  }});
 const handler=createActionItemsReadHandler({adapter,now,newId:randomUUID});
 const lookup=createTaskLookupDelivery({store:createPostgresTaskLookupStore({pool}),clock:now,
  gateway:{async executeOwned(raw,_credential,_delivery,signal){
   const request=data(own(JSON.parse(raw),['operation','arguments']));if(!same(request.operation,operation))throw intentFault('INVALID_ARGUMENTS');
   const normalized=contract.normalizeInput(request.arguments,{binding,clientResolution:{reference:selectedClientId,clientId:selectedClientId}});
   const current=await readCurrent(signal);
   return handler({input:normalized.input,request:request.arguments,argumentsSha256:normalized.argumentsSha256,invocationId:randomUUID(),signal,
    authority:{binding,subject,policyRevision,scopes,sourceIds,deadlineMs:Math.min(deadlineMs,current.expiresAtMs),maxOutputBytes:limit,
     // This source field is inert correlation, not an execution identity or permission.
     executionSha256:hash({binding,scopes,selectedClientId})}});
  }},
  async authorize({binding:selection,signal}){
   if(!same(selection.current,binding)||!same(selection.scopes,scopes))throw intentFault('ACCESS_DENIED');
   if(selection.original){const original=selection.original.context;
    if(['tenantId','actorId','conversationId','runId'].some(k=>original.binding[k]!==binding[k])||original.selectedClientId!==selectedClientId||!same(original.scopes,scopes))throw intentFault('ACCESS_DENIED');}
   const current=await readCurrent(signal);return {authorized:true,bindingSha256:selection.bindingSha256,expiresAtMs:Math.min(deadlineMs,current.expiresAtMs)};
  }});
 const readContext={currentBinding:binding,scopes,deadlineMs};
 async function query({request,signal}){
  const lookupId=randomUUID(),resultReference=randomUUID(),requestId=randomUUID();
  const context={lookupId,resultReference,requestId,binding,scopes,selectedClientId,deadlineMs,
   deliveryJson:JSON.stringify({context:{binding},producer:{namespace:'standalone-actions',executionId:requestId},deliveryId:lookupId})};
  const stored=await lookup.lookup({request,context,credential:'attended-source-read',signal});
  let retained;try{retained=await lookup.read({resultReference:stored.resultReference,context:readContext,signal});}catch(error){throw Object.assign(error,{outcome:'RESULT_NOT_RELEASED'});}
  if(retained.resultSha256!==stored.resultSha256)throw intentFault('ACCESS_DENIED');return retained;
 }
 return {lookup,readContext,query};
}
