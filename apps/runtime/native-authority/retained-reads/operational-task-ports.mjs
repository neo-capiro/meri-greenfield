/** Task-bound Core transport for the original task/action reads and their action successor.
 * The gateway retains current authority and budget; the existing source adapters own
 * the fixed Core routes, request bodies, response validation and receipt projection. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';

const refuse=()=>{throw nativeReadFault('UNAVAILABLE');};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const token=value=>typeof value==='string'&&/^[\x21-\x7e]{1,8192}$/u.test(value);
const references=Object.freeze(['query_tasks','query_action_items'].map(id=>Object.freeze({id,version:'0.2.0'})));
const requiredSources=new Map(references.map(ref=>[ref.id,resolveOperationContract(ref).descriptor.sourceRequirements]));

/** Returns a synchronous retainedTaskPorts slice. Its two families are merged by the
 * existing task composer with the other source owners' slices. */
export function createOperationalTaskPorts(configuration={}){
 const c=own(configuration,[],['coreOrigin','fetchImpl','now','enabled']),enabled=c.enabled??false;
 if(typeof enabled!=='boolean')refuse();
 if(!enabled)return ()=>refuse();
 if(typeof c.now!=='function'||types.isProxy(c.now)||typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl))refuse();
 const origin=retainedOrigin(c.coreOrigin);

 return function retainedTaskPorts(raw){
  const ports=own(raw,['task','getNativeCredentialWithExpiry','getServiceSecret'],['getNativeCredential']);
  if([ports.getNativeCredentialWithExpiry,ports.getServiceSecret].some(fn=>typeof fn!=='function'||types.isProxy(fn)))refuse();
  const task=own(ports.task,['binding','original','scopes','grant'],['pool','allocationJson','grantFactsJsons','grantId','taskArn',
   'issuanceFactsSha256','runRequestSha256','readCurrentEntry','currentOwner','sourceEnabled','limits','now','taskVerifier',
   'taskCapability','approvedReads','signal','allocation']);
  const binding=data(task.binding),original=data(task.original),scopes=data(task.scopes),grant=data(task.grant);
  validateShape('RunBinding',binding);
  if(!same(original.binding,binding)||!same(grant.binding,binding)||!Number.isSafeInteger(original.expiresAtMs)||
   original.expiresAtMs<=c.now()||!Array.isArray(scopes)||scopes.length!==1)refuse();
  const scope=scopes[0];validateShape('Scope',scope);
  if(scope.kind!=='client'||scope.tenantId!==binding.tenantId||!scope.resourceId||
   scope.policyRevision!==grant.qualificationBinding?.policyRevision)refuse();
  const clientId=scope.resourceId,policyRevision=scope.policyRevision;
  function active(deadlineMs,signal){
   nativeSignal(signal);
   if(signal?.aborted||!Number.isSafeInteger(deadlineMs)||!Number.isSafeInteger(c.now())||
    c.now()>=Math.min(deadlineMs,original.expiresAtMs))refuse();
  }
  function subjectFor(value){
   const subject=data(value);assertSubject(subject,binding);
   if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds[0]!==clientId||
    subject.policyRevision!==policyRevision||!same(subject.scopes,scopes))refuse();
   return subject;
  }
  async function currentCredentials(deadlineMs,signal,operation,requestSha256){
   active(deadlineMs,signal);
   const request=Object.freeze({signal,deadlineMs,operation,requestSha256});
   const readBearer=async()=>{
    let result;try{result=own(await ports.getNativeCredentialWithExpiry(request),['credential','expiresAtMs']);}
    catch{refuse();}
    if(!token(result.credential)||!Number.isSafeInteger(result.expiresAtMs)||result.expiresAtMs<=c.now())refuse();
    return result;
   };
   const first=await readBearer();active(deadlineMs,signal);
   let secret;try{secret=await ports.getServiceSecret({signal,deadlineMs,operation,requestSha256});}catch{refuse();}
   if(!token(secret)||secret===first.credential)refuse();
   active(deadlineMs,signal);
   // Secret rotation is an await. Require the same still-live session afterwards.
   const second=await readBearer();active(deadlineMs,signal);
   if(second.credential!==first.credential||secret===second.credential)refuse();
   const expiresAtMs=Math.min(original.expiresAtMs,deadlineMs,first.expiresAtMs,second.expiresAtMs);
   if(expiresAtMs<=c.now())refuse();
   return {bearerToken:second.credential,serviceSecret:secret,expiresAtMs};
  }
  async function originalCredentials(rawPins){
   const p=own(rawPins,['operation','sourceIdentity','binding','subject','policyRevision','sourceIds','argumentsSha256','deadlineMs','signal']);
   const operation=data(p.operation),required=requiredSources.get(operation.id),subject=subjectFor(p.subject);
   if(!required||!same(operation,{id:operation.id,version:'0.2.0'})||required.length!==1||
    !same(data(p.binding),binding)||!same(data(p.sourceIdentity),required[0])||
    !same(data(p.sourceIds),required.map(row=>row.sourceId))||p.policyRevision!==policyRevision||
    typeof p.argumentsSha256!=='string'||!/^[a-f0-9]{64}$/u.test(p.argumentsSha256))refuse();
   const credentials=await currentCredentials(p.deadlineMs,p.signal,operation,p.argumentsSha256);
   return Object.freeze({operation,sourceIdentity:data(p.sourceIdentity),binding,subject,policyRevision,
    sourceIds:data(p.sourceIds),argumentsSha256:p.argumentsSha256,...credentials});
  }
  async function successorCredentials(rawPins){
   const p=own(rawPins,['binding','subject','deadlineMs','signal']);
   subjectFor(p.subject);
   if(!same(data(p.binding),binding))refuse();
   const credentials=await currentCredentials(p.deadlineMs,p.signal,{id:'actions.query',version:'0.2.0'},null);
   return Object.freeze({binding,...credentials});
  }
  const family=getCredentials=>Object.freeze({origin,getCredentials,fetchImpl:c.fetchImpl});
  return Object.freeze({families:Object.freeze({
   'operational-reads':family(originalCredentials),
   'action-items-complete':family(successorCredentials)
  })});
 };
}
