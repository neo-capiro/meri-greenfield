/** Per-task relay into the existing run delegation. The gateway has already made the
 * UNKNOWN reservation before a signed source adapter asks for these credentials.
 * This module issues neither a grant nor a credential of its own. */
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {signedRetainedSourceOperation} from '../../gateway/sources/retained-reads/signed-source-operations.mjs';

const SHA=/^[a-f0-9]{64}$/u,CALL_KEY=/^[A-Za-z0-9_-]{1,128}$/u,TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const refuse=code=>{throw nativeReadFault(code);};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const sha=bytes=>createHash('sha256').update(bytes,'utf8').digest('hex');
const withContext=new Set(['read_monday_client_boards','get_client_context','read_client_documents','resolve_entity','find_contacts','search_memory']);
const MEMORY=Object.freeze({id:'search_memory',version:'0.2.0'});
const MEMORY_HELPER_PATH='/api/clio/tools/search_memory_eligibility';

/** `getCredentials` for the exact signed source adapters. A missing Option B
 * delegation, task selection, or current Monday mapping refuses before source Fetch. */
export function createRetainedReadCredentialRelay({task,nativeCredentials,getServiceSecret,now}){
 if(typeof now!=='function'||typeof getServiceSecret!=='function'||
   typeof nativeCredentials?.getNativeCredential!=='function'||
   nativeCredentials.toolCredential!==undefined&&typeof nativeCredentials.toolCredential!=='function')refuse('CONFIGURATION');
 const binding=data(task.binding),scopes=data(task.scopes),grant=data(task.grant),original=data(task.original);
 validateShape('RunBinding',binding);
 const selected=Array.isArray(scopes)&&scopes.length===1&&scopes[0]?.kind==='client'?scopes[0]:null;
 if(selected)try{validateShape('Scope',selected);}catch{refuse('UNAVAILABLE');}
 if(!selected||selected.tenantId!==binding.tenantId||!same(original.binding,binding)||
   grant.qualificationBinding?.policyRevision!==selected.policyRevision||
   !Number.isSafeInteger(original.expiresAtMs)||original.expiresAtMs<=now())refuse('UNAVAILABLE');
 const policyRevision=selected.policyRevision,clientId=selected.resourceId;
 const allocated=new Set(task.allocation.manifest.allowedOperations.map(op=>`${op.id}@${op.version}`));
 const approved=new Set(task.approvedReads.operations.map(op=>`${op.id}@${op.version}`));
 const runSignal=task.signal===undefined?nativeCredentials.stopSignal:
   nativeCredentials.stopSignal===undefined?task.signal:AbortSignal.any([task.signal,nativeCredentials.stopSignal]);
 const active=(deadlineMs,signal)=>{
  nativeSignal(signal);
  if(signal?.aborted||runSignal?.aborted||!Number.isSafeInteger(deadlineMs)||
    !Number.isSafeInteger(now())||now()>=Math.min(deadlineMs,original.expiresAtMs))refuse('UNAVAILABLE');
 };
 async function getCredentials(raw){
  let p;
  try{p=own(raw,['operation','input','metadata','argumentsSha256','requestSha256','binding','subject','policyRevision',
   'sourceIds','invocationId','deadlineMs','target','correlationSha256','signal'],['normalizationContext']);
   nativeSignal(p.signal);}catch{refuse('ACCESS_DENIED');}
  active(p.deadlineMs,p.signal);
  const operation=data(own(p.operation,['id','version'])),id=`${operation.id}@${operation.version}`;
  if(!signedRetainedSourceOperation(operation)||!allocated.has(id)||!approved.has(id)||
    typeof p.invocationId!=='string'||!CALL_KEY.test(p.invocationId)||
    !same(p.binding,binding)||p.policyRevision!==policyRevision||
    [p.argumentsSha256,p.requestSha256,p.correlationSha256].some(value=>typeof value!=='string'||!SHA.test(value))||
    Object.hasOwn(p,'normalizationContext')!==withContext.has(operation.id))refuse('ACCESS_DENIED');
  const subject=data(p.subject);try{assertSubject(subject,binding);}catch{refuse('ACCESS_DENIED');}
  // The selected client is a current task fact. An unrelated or personal scope
  // cannot become a client grant by echoing it in the correlation header.
  if(!same(subject.scopes,scopes)||subject.policyRevision!==policyRevision||subject.kind==='personal'||
    subject.kind==='client'&&subject.entityIds[0]!==clientId)refuse('ACCESS_DENIED');
  const input=data(p.input),metadata=data(p.metadata),sources=data(p.sourceIds);
  const required=[...new Set(resolveOperationContract(operation).descriptor.sourceRequirements.map(source=>source.sourceId))];
  if(!input||typeof input!=='object'||Array.isArray(input)||!Array.isArray(sources)||
    !same([...sources].sort(),required.sort())||
    Object.hasOwn(input,'clientId')&&input.clientId!==clientId||
    operation.id==='memory.list_own_proposals'&&metadata!==null||
    operation.id==='search_memory'&&(!same(metadata,{sourceConnected:false,authoritative:false,
      currentPolicyQualified:false,cursorAuthenticated:false,absenceEvidence:false})||
      !same(p.normalizationContext,{tenantId:binding.tenantId,userId:binding.actorId}))||
    operation.id==='actions.query'&&
      (input.mode!=='client_scoped'||input.selection?.clientId!==clientId||metadata!==null)||
    canonicalSha256(input)!==p.argumentsSha256||
    canonicalSha256({input,metadata})!==p.requestSha256)refuse('ACCESS_DENIED');
  const target=data(own(p.target,['method','path','bodySha256']));
  if(target.method!=='POST'||target.path!==`/api/clio/tools/${operation.id}`||
    target.bodySha256!==sha(JSON.stringify({input,metadata})))refuse('ACCESS_DENIED');
  const normalizationContext=operation.id==='find_contacts'||!withContext.has(operation.id)?null:data(p.normalizationContext);
  const correlation=canonicalize({binding,subject,policyRevision,normalizationContext});
  if(typeof correlation!=='string'||Buffer.byteLength(correlation,'utf8')>8192||
    sha(correlation)!==p.correlationSha256)refuse('ACCESS_DENIED');
  // No current managed-board-mapping producer is connected to this task owner.
  // A token alone cannot prove the Monday board wall.
  if(operation.id==='read_monday_client_boards')refuse('UNAVAILABLE');
  if(typeof nativeCredentials.toolCredential!=='function')refuse('UNAVAILABLE');
  const signal=p.signal===undefined?runSignal:runSignal===undefined?p.signal:AbortSignal.any([p.signal,runSignal]);
  let serviceSecret;try{serviceSecret=await getServiceSecret();}catch{refuse('UNAVAILABLE');}
  active(p.deadlineMs,signal);if(typeof serviceSecret!=='string'||!TOKEN.test(serviceSecret))refuse('UNAVAILABLE');
  const handle=await nativeCredentials.getNativeCredential({binding,callKey:p.invocationId,deadlineMs:p.deadlineMs,signal});
  active(p.deadlineMs,signal);
  let issued;try{issued=own(handle,['credential','expiresAtMs']);}catch{refuse('UNAVAILABLE');}
  if(!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('UNAVAILABLE');
  const token=await nativeCredentials.toolCredential({credential:issued.credential,operation,argumentsSha256:p.argumentsSha256,
   target,correlationSha256:p.correlationSha256,deadlineMs:p.deadlineMs,signal});
  active(p.deadlineMs,signal);
  if(token===null)refuse('UNAVAILABLE');
  let credential;try{credential=own(token,['bearerToken','authorizationScheme','expiresAtMs']);}catch{refuse('UNAVAILABLE');}
  const expiresAtMs=Math.min(issued.expiresAtMs,credential.expiresAtMs,p.deadlineMs,original.expiresAtMs);
  if(credential.authorizationScheme!=='CapiroMeriRead'||typeof credential.bearerToken!=='string'||!TOKEN.test(credential.bearerToken)||
    credential.bearerToken===serviceSecret||!Number.isSafeInteger(credential.expiresAtMs)||expiresAtMs<=now())refuse('UNAVAILABLE');
  return Object.freeze({operation,argumentsSha256:p.argumentsSha256,metadata,
   ...(Object.hasOwn(p,'normalizationContext')?{normalizationContext:data(p.normalizationContext)}:{}),
   requestSha256:p.requestSha256,binding,subject,policyRevision,sourceIds:sources,invocationId:p.invocationId,
   authorizationScheme:'CapiroMeriRead',target,correlationSha256:p.correlationSha256,
   bearerToken:credential.bearerToken,serviceSecret,expiresAtMs});
 }
 /** A second, helper-only token for the already consumed memory page. The
  * opaque Core proof is never treated as an authority fact by Meri; Core checks
  * its signature and parent JTI against the original UNKNOWN reservation. */
 async function getMemoryEligibilityCredentials(raw){
  let p;
  try{p=own(raw,['operation','input','metadata','normalizationContext','argumentsSha256','requestSha256',
   'binding','subject','policyRevision','sourceIds','invocationId','deadlineMs','target','correlationSha256',
   'pageProof','pageBodySha256','pageRequestSha256','resultSha256','recordsSha256','bodyJson','signal']);
   nativeSignal(p.signal);}catch{refuse('ACCESS_DENIED');}
  active(p.deadlineMs,p.signal);
  const operation=data(own(p.operation,['id','version'])),id=`${operation.id}@${operation.version}`;
  if(!same(operation,MEMORY)||!allocated.has(id)||!approved.has(id)||
    typeof p.invocationId!=='string'||!CALL_KEY.test(p.invocationId)||
    !same(p.binding,binding)||p.policyRevision!==policyRevision||
    [p.argumentsSha256,p.requestSha256,p.pageBodySha256,p.pageRequestSha256,
     p.resultSha256,p.recordsSha256,p.correlationSha256].some(value=>typeof value!=='string'||!SHA.test(value))||
    typeof p.pageProof!=='string'||!TOKEN.test(p.pageProof)||
    typeof p.bodyJson!=='string'||Buffer.byteLength(p.bodyJson,'utf8')>16384)refuse('ACCESS_DENIED');
  const subject=data(p.subject),input=data(p.input),metadata=data(p.metadata),sources=data(p.sourceIds);
  try{assertSubject(subject,binding);}catch{refuse('ACCESS_DENIED');}
  const required=[...new Set(resolveOperationContract(operation).descriptor.sourceRequirements.map(source=>source.sourceId))];
  if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds[0]!==clientId||
    subject.policyRevision!==policyRevision||!same(subject.scopes,scopes)||
    input?.clientId!==clientId||
    !same(p.normalizationContext,{tenantId:binding.tenantId,userId:binding.actorId})||
    !same(metadata,{sourceConnected:false,authoritative:false,currentPolicyQualified:false,
      cursorAuthenticated:false,absenceEvidence:false})||
    !Array.isArray(sources)||!same([...sources].sort(),required.sort())||
    canonicalSha256(input)!==p.argumentsSha256||
    canonicalSha256({input,metadata})!==p.requestSha256||
    p.pageRequestSha256!==p.requestSha256||
    p.pageBodySha256!==sha(JSON.stringify({input,metadata})))refuse('ACCESS_DENIED');
  const target=data(own(p.target,['method','path','bodySha256']));
  if(target.method!=='POST'||target.path!==MEMORY_HELPER_PATH||target.bodySha256!==sha(p.bodyJson))refuse('ACCESS_DENIED');
  let body;
  try{body=data(JSON.parse(p.bodyJson));}catch{refuse('ACCESS_DENIED');}
  const expected={operation,input,metadata,normalizationContext:p.normalizationContext,
   argumentsSha256:p.argumentsSha256,requestSha256:p.requestSha256,binding,subject,
   policyRevision,sourceIds:sources,resultSha256:p.resultSha256,records:body.records,deadlineMs:p.deadlineMs};
  if(!Array.isArray(body.records)||body.records.length>3||
    canonicalSha256(body.records)!==p.recordsSha256||!same(body,expected))refuse('ACCESS_DENIED');
  const correlation=canonicalize({binding,subject,policyRevision,normalizationContext:p.normalizationContext});
  if(typeof correlation!=='string'||Buffer.byteLength(correlation,'utf8')>8192||
    sha(correlation)!==p.correlationSha256)refuse('ACCESS_DENIED');
  if(typeof nativeCredentials.memoryEligibilityCredential!=='function')refuse('UNAVAILABLE');
  const signal=p.signal===undefined?runSignal:runSignal===undefined?p.signal:AbortSignal.any([p.signal,runSignal]);
  let serviceSecret;try{serviceSecret=await getServiceSecret();}catch{refuse('UNAVAILABLE');}
  active(p.deadlineMs,signal);if(typeof serviceSecret!=='string'||!TOKEN.test(serviceSecret))refuse('UNAVAILABLE');
  const handle=await nativeCredentials.getNativeCredential({binding,callKey:p.invocationId,deadlineMs:p.deadlineMs,signal});
  active(p.deadlineMs,signal);
  let issued;try{issued=own(handle,['credential','expiresAtMs']);}catch{refuse('UNAVAILABLE');}
  if(!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('UNAVAILABLE');
  const token=await nativeCredentials.memoryEligibilityCredential({credential:issued.credential,operation,
    argumentsSha256:p.argumentsSha256,pageBodySha256:p.pageBodySha256,pageRequestSha256:p.pageRequestSha256,
    resultSha256:p.resultSha256,recordsSha256:p.recordsSha256,correlationSha256:p.correlationSha256,
    pageProof:p.pageProof,target,deadlineMs:p.deadlineMs,signal});
  active(p.deadlineMs,signal);
  if(token===null)refuse('UNAVAILABLE');
  let credential;try{credential=own(token,['bearerToken','authorizationScheme','expiresAtMs']);}catch{refuse('UNAVAILABLE');}
  const expiresAtMs=Math.min(issued.expiresAtMs,credential.expiresAtMs,p.deadlineMs,original.expiresAtMs);
  if(credential.authorizationScheme!=='CapiroMeriRead'||typeof credential.bearerToken!=='string'||
    !TOKEN.test(credential.bearerToken)||credential.bearerToken===serviceSecret||
    !Number.isSafeInteger(credential.expiresAtMs)||expiresAtMs<=now())refuse('UNAVAILABLE');
  return Object.freeze({operation,argumentsSha256:p.argumentsSha256,metadata,
   normalizationContext:data(p.normalizationContext),requestSha256:p.requestSha256,binding,subject,
   policyRevision,sourceIds:sources,invocationId:p.invocationId,target,correlationSha256:p.correlationSha256,
   pageProof:p.pageProof,pageBodySha256:p.pageBodySha256,pageRequestSha256:p.pageRequestSha256,
   resultSha256:p.resultSha256,recordsSha256:p.recordsSha256,
   authorizationScheme:'CapiroMeriRead',bearerToken:credential.bearerToken,serviceSecret,expiresAtMs});
 }
 return Object.assign(getCredentials,{getMemoryEligibilityCredentials});
}
