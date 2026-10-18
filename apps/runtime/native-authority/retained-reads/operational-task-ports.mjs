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
export const OPERATIONAL_TASK_FAMILIES=Object.freeze(['operational-reads','action-items-complete']);

/** Returns a synchronous retainedTaskPorts slice. Its two families are merged by the
 * existing task composer with the other source owners' slices. */
export function createOperationalTaskPorts(configuration={}){
 const c=own(configuration,[],['coreOrigin','fetchImpl','now','enabled','familyIds']),enabled=c.enabled??false;
 if(typeof enabled!=='boolean')refuse();
 if(!enabled)return ()=>refuse();
 const familyIds=data(c.familyIds??OPERATIONAL_TASK_FAMILIES);
 if(!Array.isArray(familyIds)||!familyIds.length||new Set(familyIds).size!==familyIds.length||
  familyIds.some(id=>!OPERATIONAL_TASK_FAMILIES.includes(id)))refuse();
 if(typeof c.now!=='function'||types.isProxy(c.now)||typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl))refuse();
 const origin=retainedOrigin(c.coreOrigin);

 return function retainedTaskPorts(raw){
  const ports=own(raw,['task','getNativeCredentialWithExpiry','getServiceSecret'],['getNativeCredential','getToolCredential']);
  if([ports.getNativeCredentialWithExpiry,ports.getServiceSecret].some(fn=>typeof fn!=='function'||types.isProxy(fn)))refuse();
  if(ports.getToolCredential!==undefined&&(typeof ports.getToolCredential!=='function'||types.isProxy(ports.getToolCredential)))refuse();
  const task=own(ports.task,['binding','original','scopes','grant'],['pool','allocationJson','grantFactsJsons','grantId','taskArn',
   'issuanceFactsSha256','runRequestSha256','readCurrentEntry','currentOwner','sourceEnabled','limits','now','taskVerifier',
   'taskCapability','approvedReads','signal','allocation']);
  const binding=data(task.binding),original=data(task.original),scopes=data(task.scopes),grant=data(task.grant);
  validateShape('RunBinding',binding);
  if(!same(original.binding,binding)||!same(grant.binding,binding)||!Number.isSafeInteger(original.expiresAtMs)||
   original.expiresAtMs<=c.now()||!Array.isArray(scopes))refuse();
  for(const scope of scopes)validateShape('Scope',scope);
  function selectedClient(){
   if(scopes.length!==1)refuse();
   const scope=scopes[0];
   if(scope.kind!=='client'||scope.tenantId!==binding.tenantId||!scope.resourceId||
    scope.policyRevision!==grant.qualificationBinding?.policyRevision)refuse();
   return scope;
  }
  function active(deadlineMs,signal){
   nativeSignal(signal);
   if(signal?.aborted||!Number.isSafeInteger(deadlineMs)||!Number.isSafeInteger(c.now())||
    c.now()>=Math.min(deadlineMs,original.expiresAtMs))refuse();
  }
  function subjectFor(value){
   const scope=selectedClient();
   const subject=data(value);assertSubject(subject,binding);
   if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds[0]!==scope.resourceId||
    subject.policyRevision!==scope.policyRevision||!same(subject.scopes,scopes))refuse();
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
   const p=own(rawPins,['operation','sourceIdentity','binding','subject','policyRevision','sourceIds','argumentsSha256','deadlineMs','signal'],
    ['input','invocationId','target']);
   const operation=data(p.operation),required=requiredSources.get(operation.id),subject=subjectFor(p.subject),policyRevision=selectedClient().policyRevision;
   if(!required||!same(operation,{id:operation.id,version:'0.2.0'})||required.length!==1||
    !same(data(p.binding),binding)||!same(data(p.sourceIdentity),required[0])||
    !same(data(p.sourceIds),required.map(row=>row.sourceId))||p.policyRevision!==policyRevision||
    typeof p.argumentsSha256!=='string'||!/^[a-f0-9]{64}$/u.test(p.argumentsSha256))refuse();
   if(operation.id==='query_action_items'){
    // Option B's opaque per-call handle can never be used as an ordinary Bearer.
    // Its tool exchange is bound to the gateway's UNKNOWN reservation and the
    // adapter's exact original flat POST body, not the derived successor body.
    if(typeof ports.getToolCredential!=='function'||typeof p.invocationId!=='string'||
     !/^[A-Za-z0-9_-]{1,128}$/u.test(p.invocationId))refuse();
    if(p.input===undefined||p.target===undefined)refuse();
    const input=data(p.input),target=data(own(p.target,['method','path','bodySha256']));
    if(input?.clientId!==selectedClient().resourceId||canonicalSha256(input)!==p.argumentsSha256||
     target.method!=='POST'||target.path!=='/api/clio/tools/query_action_items'||
     typeof target.bodySha256!=='string'||!/^[a-f0-9]{64}$/u.test(target.bodySha256))refuse();
    active(p.deadlineMs,p.signal);
    let serviceSecret;try{serviceSecret=await ports.getServiceSecret({signal:p.signal,deadlineMs:p.deadlineMs,operation,
     requestSha256:p.argumentsSha256});}catch{refuse();}
    active(p.deadlineMs,p.signal);if(!token(serviceSecret))refuse();
    let handle;try{handle=own(await ports.getNativeCredentialWithExpiry({callKey:p.invocationId,signal:p.signal,
     deadlineMs:p.deadlineMs}),['credential','expiresAtMs']);}catch{refuse();}
    active(p.deadlineMs,p.signal);
    if(!token(handle.credential)||!Number.isSafeInteger(handle.expiresAtMs)||handle.expiresAtMs<=c.now()||
     serviceSecret===handle.credential)refuse();
    let issued;try{issued=await ports.getToolCredential({credential:handle.credential,operation,
     argumentsSha256:p.argumentsSha256,target,deadlineMs:p.deadlineMs,signal:p.signal});}catch{refuse();}
    active(p.deadlineMs,p.signal);
    if(issued===null)refuse();
    let credential;try{credential=own(issued,['bearerToken','authorizationScheme','expiresAtMs']);}catch{refuse();}
    const expiresAtMs=Math.min(original.expiresAtMs,p.deadlineMs,handle.expiresAtMs,credential.expiresAtMs);
    if(credential.authorizationScheme!=='CapiroMeriRead'||!token(credential.bearerToken)||
     credential.bearerToken===serviceSecret||credential.bearerToken===handle.credential||
     !Number.isSafeInteger(credential.expiresAtMs)||expiresAtMs<=c.now())refuse();
    return Object.freeze({operation,sourceIdentity:data(p.sourceIdentity),binding,subject,policyRevision,
     sourceIds:data(p.sourceIds),argumentsSha256:p.argumentsSha256,input,invocationId:p.invocationId,target,
     authorizationScheme:'CapiroMeriRead',bearerToken:credential.bearerToken,serviceSecret,expiresAtMs});
   }
   if(p.input!==undefined||p.invocationId!==undefined||p.target!==undefined)refuse();
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
  const available=Object.freeze({'operational-reads':family(originalCredentials),'action-items-complete':family(successorCredentials)});
  return Object.freeze({families:Object.freeze(Object.fromEntries(familyIds.map(id=>[id,available[id]])))});
 };
}
