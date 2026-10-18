/** Per-task composition for the three retained Core reads. The accepted task and live
 * native bearer come from the reads composer; this module borrows their owners and
 * creates no process-wide authority, connection, credential, or network request. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOperationIds,retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createRetainedReadControl} from './runtime.mjs';
import {createRetainedDelegatedTransport} from './source-transport.mjs';

const refuse=code=>{throw nativeReadFault(code);};

/** Returns a synchronous `retainedTaskPorts` slice for reads-composer. The caller
 * merges its two families and retained context with the other retained owners. */
export function createCoreRetainedTaskPorts(configuration={}){
 const c=own(configuration,[],['coreOrigin','recipients','issuerId','keyId','publicKeyJwk','fetchImpl','now','enabled']);
 const enabled=c.enabled??false;
 if(typeof enabled!=='boolean')refuse('CONFIGURATION');
 if(!enabled)return ()=>refuse('UNAVAILABLE');
 if(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)||typeof c.now!=='function'||types.isProxy(c.now)||
  typeof c.issuerId!=='string'||!c.issuerId||typeof c.keyId!=='string'||!c.keyId||!c.publicKeyJwk||!c.recipients)refuse('CONFIGURATION');
 const coreOrigin=retainedOrigin(c.coreOrigin),recipients=data(own(c.recipients,retainedOperationIds));
 for(const origin of Object.values(recipients))retainedOrigin(origin);
 if(recipients.get_research_portfolio!==recipients.get_research_portfolio_changes)refuse('CONFIGURATION');

 return function retainedTaskPorts(raw){
  const ports=own(raw,['task','getNativeCredentialWithExpiry'],['getNativeCredential','getServiceSecret']);
  if(typeof ports.getNativeCredentialWithExpiry!=='function'||types.isProxy(ports.getNativeCredentialWithExpiry))refuse('CONFIGURATION');
  const task=own(ports.task,['pool','binding','original','taskVerifier','taskCapability'],[
   'allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256','runRequestSha256','scopes','readCurrentEntry',
   'currentOwner','sourceEnabled','limits','now','approvedReads','signal','allocation','grant']);
  const original=own(task.original,['binding','expiresAtMs'],['executionKey','executionId','planSha256','versions']);
  if(typeof task.pool?.connect!=='function'||typeof task.taskVerifier?.verify!=='function'||
   typeof task.taskCapability!=='string'||!task.taskCapability||canonicalSha256(task.binding)!==canonicalSha256(original.binding)||
   !Number.isSafeInteger(original.expiresAtMs)||original.expiresAtMs<=c.now())refuse('UNAVAILABLE');
  // The source slice must retain the action-session expiry. The older string-only
  // callback remains available to other composed families but is never used here.
  const currentBearer=async request=>{
   const issued=await ports.getNativeCredentialWithExpiry(request);
   let bearer;try{bearer=own(issued,['credential','expiresAtMs']);}
   catch{refuse('UNAVAILABLE');}
   if(typeof bearer.credential!=='string'||!/^\S{1,8192}$/u.test(bearer.credential)||
    !Number.isSafeInteger(bearer.expiresAtMs)||bearer.expiresAtMs<=c.now())refuse('UNAVAILABLE');
   return Object.freeze(bearer);
  };
  const control=createRetainedReadControl({binding:task.binding,expiresAtMs:original.expiresAtMs,
   store:createPostgresConversationStore({pool:task.pool,now:c.now}),taskVerifier:task.taskVerifier,
   taskCapability:task.taskCapability,coreOrigin,getNativeCredential:currentBearer,
   fetchImpl:c.fetchImpl,issuerId:c.issuerId,keyId:c.keyId,publicKeyJwk:c.publicKeyJwk,recipients,now:c.now,enabled:true});
  if(!control.available)refuse('UNAVAILABLE');
  const researchOrigin=recipients.get_research_portfolio,floridaOrigin=recipients.get_florida_budget_project;
  const family=origin=>Object.freeze({origin,delegatedTransport:createRetainedDelegatedTransport({origin,getCredentials:control.getCredentials,now:c.now,fetchImpl:c.fetchImpl})});
  return Object.freeze({families:Object.freeze({'research-portfolio':family(researchOrigin),'florida-budget':family(floridaOrigin)}),
   contextPorts:Object.freeze({retainedContextPorts:control.retainedContextPorts})});
 };
}
