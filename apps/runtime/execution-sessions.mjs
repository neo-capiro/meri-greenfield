/** Adapts an authenticated runtime execution to the existing conversation service.
 * The adapter lives for one private HTTP request. It grants no user action session.
 * Every service observation authenticates the current durable execution locally;
 * Core still owns user admission and every Capiro data/tool authorization. */
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';

const refused=()=>{throw Object.assign(Error('EXECUTION_AUTHORITY_REFUSED'),{code:'EXECUTION_AUTHORITY_REFUSED'});};

export function createExecutionSessions({execution,credential,binding,now=Date.now}){
 validateShape('RunBinding',binding);
 if(typeof execution?.authenticate!=='function'||typeof credential!=='string'||!credential)refused();
 const bindingHash=hash(binding),pending=new Map();
 return Object.freeze({
  async authenticateSession({credential:presented,signal,deadlineMs}){
   if(presented!==credential||pending.size>=32)refused();signal?.throwIfAborted();
   const current=await execution.authenticate({credential,binding,signal});signal?.throwIfAborted();
   if(hash(current.execution.binding)!==bindingHash)refused();
   const checkedAtMs=now(),expiresAtMs=Math.min(current.execution.expiresAtMs,deadlineMs??Number.MAX_SAFE_INTEGER);
   if(expiresAtMs<=checkedAtMs)refused();
   const authentication={principal:{tenantId:binding.tenantId,actorId:binding.actorId,
    conversationId:binding.conversationId,runId:binding.runId},observationId:randomUUID(),checkedAtMs,expiresAtMs};
   const authenticationSha256=hash(authentication);
   pending.set(authenticationSha256,{authenticationSha256,binding:structuredClone(binding),
    scopes:structuredClone(current.scopes),selectedClientId:current.selectedClientId,checkedAtMs,expiresAtMs});
   return authentication;
  },
  async readCurrentState({authentication,signal,deadlineMs}){
   signal?.throwIfAborted();const key=hash(authentication),current=pending.get(key);pending.delete(key);
   if(!current||current.expiresAtMs<=now()||deadlineMs!==undefined&&deadlineMs<=now())refused();
   return structuredClone(current);
  },
 });
}
