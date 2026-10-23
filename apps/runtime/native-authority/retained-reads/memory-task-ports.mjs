import {conversationScopeMatches} from '../../../../packages/contracts/conversation-scope.mjs';
/** Task-local wiring for the two selected-client memory reads. Core owns the
 * canonical page and proposal sources; the gateway owns current authorization,
 * UNKNOWN reservation, continuation and final release. No token is issued here. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertNativeReadConfiguration,nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {familyOperations} from '../../../gateway/general-reads/registration.mjs';
import {signedRetainedSourceOperation} from '../../../gateway/sources/retained-reads/signed-source-operations.mjs';

export const MEMORY_TASK_FAMILIES=Object.freeze(['client-knowledge-memory','memory-proposals']);
const refuse=code=>{throw nativeReadFault(code);};
const expected=Object.freeze({
 'client-knowledge-memory':Object.freeze({id:'search_memory',version:'0.2.0'}),
 'memory-proposals':Object.freeze({id:'memory.list_own_proposals',version:'0.2.0'}),
});
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);

/** The caller supplies only the installed families and its already validated
 * task tuple. A proposal continuation additionally needs an explicit durable,
 * task-scoped context owner; this repository currently has only test fixtures. */
export function createMemoryTaskPorts(configuration){
 const c=own(configuration,['coreOrigin','fetchImpl','now','familyIds'],['memoryContextPortsForTask']);
 const ids=data(c.familyIds);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||
  ids.some(id=>!MEMORY_TASK_FAMILIES.includes(id)))refuse('CONFIGURATION');
 if(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)||
  typeof c.now!=='function'||types.isProxy(c.now))refuse('CONFIGURATION');
 if(ids.includes('memory-proposals')&&
  (typeof c.memoryContextPortsForTask!=='function'||types.isProxy(c.memoryContextPortsForTask)))refuse('CONFIGURATION');
 const origin=retainedOrigin(c.coreOrigin);
 for(const id of ids){
  const operations=familyOperations(id);
  if(operations.length!==1||!same(operations[0],expected[id])||!signedRetainedSourceOperation(operations[0]))refuse('CONFIGURATION');
 }
 return function memoryTaskPorts(raw){
  const ports=own(raw,['task','getSignedSourceCredentials'],['getMemoryEligibilityCredentials']);
  if(typeof ports.getSignedSourceCredentials!=='function'||types.isProxy(ports.getSignedSourceCredentials)||
   ids.includes('client-knowledge-memory')&&
    (typeof ports.getMemoryEligibilityCredentials!=='function'||types.isProxy(ports.getMemoryEligibilityCredentials)))refuse('CONFIGURATION');
  // The reads composer supplies its already validated full task tuple. Accept
  // those transport facts without letting them redefine this selected client.
  const task=own(ports.task,['binding','original','scopes','grant','approvedReads'],
   ['pool','allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256',
    'runRequestSha256','readCurrentEntry','currentOwner','sourceEnabled','limits','now',
    'taskVerifier','taskCapability','signal','allocation']);
  const binding=data(task.binding),original=data(task.original),scopes=data(task.scopes),grant=data(task.grant);
  validateShape('RunBinding',binding);
  const scope=Array.isArray(scopes)&&scopes.length===1?scopes[0]:null;
  if(scope===null)refuse('UNAVAILABLE');
  validateShape('Scope',scope);
  const general=conversationScopeMatches(scopes,binding,null,scope.policyRevision);
  if(general&&ids.includes('memory-proposals'))refuse('UNAVAILABLE');
  if(!general&&scope.kind!=='client'||scope.tenantId!==binding.tenantId||!scope.resourceId||
   !same(original.binding,binding)||!same(grant.binding,binding)||
   grant.qualificationBinding?.policyRevision!==scope.policyRevision||
   !Number.isSafeInteger(original.expiresAtMs)||original.expiresAtMs<=c.now())refuse('UNAVAILABLE');
  const approved=assertNativeReadConfiguration(task.approvedReads);
  if(approved.enabled!==true||ids.some(id=>!approved.operations.some(op=>same(op,expected[id]))))refuse('UNAVAILABLE');
  const shared=Object.freeze({getCredentials:ports.getSignedSourceCredentials,fetchImpl:c.fetchImpl,
   maxRequestMs:approved.maxExecuteMs,maxResponseBytes:approved.maxResponseBytes});
  const families={};
  if(ids.includes('client-knowledge-memory'))families['client-knowledge-memory']=Object.freeze({...shared,
   endpoints:Object.freeze({search_memory:`${origin}/api/clio/tools/search_memory`}),
   getEligibilityCredentials:ports.getMemoryEligibilityCredentials});
  if(ids.includes('memory-proposals'))families['memory-proposals']=Object.freeze({...shared,origin});
  let contextPorts;
  if(ids.includes('memory-proposals')){
   let context,memoryContextPorts;
   try{
    context=c.memoryContextPortsForTask(Object.freeze({binding,clientId:scope.resourceId,
     policyRevision:scope.policyRevision,expiresAtMs:original.expiresAtMs,
     ...(task.signal===undefined?{}:{signal:task.signal})}));
    if(types.isPromise(context)||types.isProxy(context))refuse('CONFIGURATION');
    memoryContextPorts=own(context,['loadPrevious','retain']);
   }catch{refuse('CONFIGURATION');}
   if(typeof memoryContextPorts.loadPrevious!=='function'||types.isProxy(memoryContextPorts.loadPrevious)||
    typeof memoryContextPorts.retain!=='function'||types.isProxy(memoryContextPorts.retain))refuse('CONFIGURATION');
   contextPorts=Object.freeze({memoryContextPorts:Object.freeze({
    loadPrevious:request=>memoryContextPorts.loadPrevious.call(context,request),
    retain:request=>memoryContextPorts.retain.call(context,request),
   })});
  }
  return Object.freeze({families:Object.freeze(families),...(contextPorts?{contextPorts}:{})});
 };
}
