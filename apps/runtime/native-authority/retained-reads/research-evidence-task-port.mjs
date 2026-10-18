/** Per-task source port for Core's existing, user-authenticated Portfolio evidence GETs.
 * The gateway owns current authority and budget; Core owns the current Portfolio grant. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertSubject} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';

const OPERATION=Object.freeze({id:'get_research_evidence',version:'0.2.0'});
const TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const refuse=code=>{throw nativeReadFault(code);};
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);

/** Synchronous `retainedTaskPorts` slice. Disabled configuration stays inert. */
export function createResearchEvidenceTaskPorts(configuration={}){
 const c=own(configuration,[],['coreOrigin','fetchImpl','now','maxRequestMs','maxResponseBytes','enabled']);
 if(c.enabled!==undefined&&typeof c.enabled!=='boolean')refuse('CONFIGURATION');
 if(c.enabled!==true)return ()=>refuse('UNAVAILABLE');
 if(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)||typeof c.now!=='function'||types.isProxy(c.now)||
    !Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000||
    !Number.isSafeInteger(c.maxResponseBytes)||c.maxResponseBytes<1||c.maxResponseBytes>16777216)refuse('CONFIGURATION');
 const origin=retainedOrigin(c.coreOrigin);

 return function retainedTaskPorts(raw){
  const ports=own(raw,['task','getNativeCredentialWithExpiry'],['getNativeCredential','getServiceSecret']);
  if(typeof ports.getNativeCredentialWithExpiry!=='function'||types.isProxy(ports.getNativeCredentialWithExpiry))refuse('CONFIGURATION');
  const task=own(ports.task,['binding','original','scopes','taskCapability','sourceEnabled','approvedReads','grant'],[
   'pool','allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256','runRequestSha256',
   'readCurrentEntry','currentOwner','limits','now','taskVerifier','signal','allocation']);
  const original=own(task.original,['binding','expiresAtMs'],['executionKey','executionId','planSha256','versions']);
  // The reads composer passed a taskTuple, which validates the full approved
  // read configuration. This slice checks only the fields it consumes.
  const scopes=data(task.scopes),reads=data(task.approvedReads),grant=data(task.grant);
  try {validateShape('RunBinding',task.binding);scopes.forEach(scope=>validateShape('Scope',scope));}
  catch {refuse('UNAVAILABLE');}
  const client=scopes.length===1&&scopes[0].kind==='client'?scopes[0]:null;
  if(task.sourceEnabled!==true||reads.enabled!==true||!Array.isArray(reads.operations)||
     !reads.operations.some(operation=>same(operation,OPERATION)))refuse('UNAVAILABLE');
  if(!Number.isSafeInteger(reads.maxExecuteMs)||reads.maxExecuteMs<1||
     !Number.isSafeInteger(reads.maxResponseBytes)||reads.maxResponseBytes<1)refuse('UNAVAILABLE');
  if(typeof task.taskCapability!=='string'||!TOKEN.test(task.taskCapability)||
     !client||!UUID.test(client.resourceId)||client.tenantId!==task.binding.tenantId||
     typeof client.policyRevision!=='string'||!client.policyRevision||
     !same(grant.binding,task.binding)||grant.qualificationBinding?.policyRevision!==client.policyRevision)refuse('UNAVAILABLE');
  if(!same(original.binding,task.binding)||!Number.isSafeInteger(original.expiresAtMs)||
     original.expiresAtMs<=c.now())refuse('UNAVAILABLE');
  const binding=data(task.binding),maxRequestMs=Math.min(c.maxRequestMs,reads.maxExecuteMs),
   maxResponseBytes=Math.min(c.maxResponseBytes,reads.maxResponseBytes);

  async function getCredentials(rawRequest){
   let request,subject;
   try {
    request=own(rawRequest,['binding','subject','deadlineMs'],['signal']);
    subject=data(request.subject);assertSubject(subject,binding);
   } catch {refuse('ACCESS_DENIED');}
   const at=c.now();
   if(!Number.isSafeInteger(at)||at>=original.expiresAtMs||!same(request.binding,binding)||
      subject.kind!=='entity'||subject.entityType!=='research-portfolio'||subject.entityIds.length!==1||
      !UUID.test(subject.entityIds[0])||subject.rosterVersionId!==null||subject.policyRevision!==client.policyRevision||
      !same(subject.scopes,scopes)||
      !Number.isSafeInteger(request.deadlineMs)||request.deadlineMs<=at||
      request.signal!==undefined&&(types.isProxy(request.signal)||!(request.signal instanceof AbortSignal)||request.signal.aborted))refuse('ACCESS_DENIED');
   const expiry=Math.min(original.expiresAtMs,request.deadlineMs);
   const issued=await ports.getNativeCredentialWithExpiry(Object.freeze({binding,selectedClientId:client.resourceId,
    portfolioId:subject.entityIds[0],subject,deadlineMs:expiry,...(request.signal===undefined?{}:{signal:request.signal})}));
   let bearer;try {bearer=own(issued,['credential','expiresAtMs']);}catch {refuse('UNAVAILABLE');}
   const fresh=c.now(),expiresAtMs=Math.min(expiry,bearer.expiresAtMs);
   if(typeof bearer.credential!=='string'||!TOKEN.test(bearer.credential)||
      !Number.isSafeInteger(bearer.expiresAtMs)||!Number.isSafeInteger(fresh)||expiresAtMs<=fresh)refuse('UNAVAILABLE');
   return Object.freeze({binding,bearerToken:bearer.credential,expiresAtMs});
  }
  return Object.freeze({families:Object.freeze({'research-portfolio-evidence':Object.freeze({
   origin,getCredentials,fetchImpl:c.fetchImpl,now:c.now,maxRequestMs,maxResponseBytes})})});
 };
}
