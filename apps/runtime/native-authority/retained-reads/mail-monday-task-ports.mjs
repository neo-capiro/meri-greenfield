/** Task-local bindings for the existing signed Core Monday and mail reads. The
 * gateway retains grants/budgets/release; Core owns board and mailbox access. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertNativeReadConfiguration,nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {familyOperations} from '../../../gateway/general-reads/registration.mjs';
import {signedRetainedSourceOperation} from '../../../gateway/sources/retained-reads/signed-source-operations.mjs';

export const MAIL_MONDAY_TASK_FAMILIES=Object.freeze(['client-knowledge-monday','mail']);
const refuse=code=>{throw nativeReadFault(code);};
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
const callable=value=>typeof value==='function'&&!types.isProxy(value);

/** No IO occurs during composition. `getSignedSourceCredentials` is the
 * composer's current run-bound relay, never a model or configuration token. */
export function createMailMondayTaskPorts(configuration){
 const c=own(configuration,['coreOrigin','fetchImpl','now','familyIds'],['mailContextPortsForTask']);
 const ids=data(c.familyIds);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||
   ids.some(id=>!MAIL_MONDAY_TASK_FAMILIES.includes(id))||!callable(c.fetchImpl)||!callable(c.now))refuse('CONFIGURATION');
 if(ids.includes('mail')&&!callable(c.mailContextPortsForTask))refuse('CONFIGURATION');
 const origin=retainedOrigin(c.coreOrigin),operations=ids.flatMap(familyOperations);
 if(operations.length!==ids.reduce((count,id)=>count+(id==='mail'?3:1),0)||
   operations.some(operation=>!signedRetainedSourceOperation(operation)))refuse('CONFIGURATION');
 const endpoints=Object.freeze(Object.fromEntries(ids.map(id=>[id,Object.freeze(Object.fromEntries(
  familyOperations(id).map(operation=>[operation.id,`${origin}/api/clio/tools/${operation.id}`])))])));
 return function mailMondayTaskPorts(raw){
  const ports=own(raw,['task','getSignedSourceCredentials']);
  if(!callable(ports.getSignedSourceCredentials))refuse('CONFIGURATION');
  // This task tuple was already admitted by the reads composer. Check the
  // transport-relevant facts again without copying a second admission owner.
  const task=own(ports.task,['binding','original','scopes','grant','approvedReads'],
   ['pool','allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256',
    'runRequestSha256','readCurrentEntry','currentOwner','sourceEnabled','limits','now',
    'taskVerifier','taskCapability','signal','allocation']);
  const binding=data(task.binding),original=data(task.original),scopes=data(task.scopes),grant=data(task.grant);
  validateShape('RunBinding',binding);nativeSignal(task.signal);
  if(!Array.isArray(scopes)||!scopes.length||scopes.length>100)refuse('UNAVAILABLE');
  scopes.forEach(scope=>validateShape('Scope',scope));
  const clients=scopes.filter(scope=>scope.kind==='client'),mailboxes=scopes.filter(scope=>scope.kind==='mailbox');
  if(clients.length!==1||new Set(scopes.map(canonicalSha256)).size!==scopes.length||
   scopes.some(scope=>!['client','mailbox'].includes(scope.kind))||
   (ids.includes('mail')?mailboxes.length===0:scopes.length!==1))refuse('UNAVAILABLE');
  const scope=clients[0];
  const stamp=c.now();
  if(scopes.some(current=>current.tenantId!==binding.tenantId||current.policyRevision!==scope.policyRevision)||!scope.resourceId||
    !same(original.binding,binding)||!same(grant.binding,binding)||
    grant.qualificationBinding?.policyRevision!==scope.policyRevision||
    !Number.isSafeInteger(stamp)||stamp<0||!Number.isSafeInteger(original.expiresAtMs)||
    original.expiresAtMs<=stamp||task.signal?.aborted)refuse('UNAVAILABLE');
  const approved=assertNativeReadConfiguration(task.approvedReads);
  if(approved.enabled!==true||operations.some(operation=>!approved.operations.some(op=>same(op,operation))))refuse('UNAVAILABLE');
  let contextPorts;
  if(ids.includes('mail')){
   // Mailbox scopes must already be part of this admitted task. A callback
   // cannot infer them from a folder, thread, mailbox or client selector.
   let context,retained;
   try{
    context=c.mailContextPortsForTask(Object.freeze({binding,clientId:scope.resourceId,scopes,
     policyRevision:scope.policyRevision,expiresAtMs:original.expiresAtMs,
     ...(task.signal===undefined?{}:{signal:task.signal})}));
    if(types.isPromise(context)){
     Promise.prototype.then.call(context,()=>{},()=>{});refuse('CONFIGURATION');
    }
    if(types.isProxy(context))refuse('CONFIGURATION');
    retained=own(context,['loadPrevious','retain']);
   }catch{refuse('CONFIGURATION');}
   if(!callable(retained.loadPrevious)||!callable(retained.retain))refuse('CONFIGURATION');
   contextPorts=Object.freeze({mailContextPorts:Object.freeze({
    loadPrevious:request=>retained.loadPrevious.call(context,request),
    retain:request=>retained.retain.call(context,request),
   })});
  }
  const families=Object.freeze(Object.fromEntries(ids.map(id=>[id,Object.freeze({endpoints:endpoints[id],
   getCredentials:ports.getSignedSourceCredentials,fetchImpl:c.fetchImpl,
   maxRequestMs:approved.maxExecuteMs,maxResponseBytes:approved.maxResponseBytes})])));
  return Object.freeze({families,...(contextPorts?{contextPorts}:{})});
 };
}
