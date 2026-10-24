/** Control-only saved-job transport. Core owns current consent, membership and each existing typed source handler. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertObjectiveRunStartRecord} from '../objective-source/run-starts.mjs';
import {assertSubject,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createDispatchLifetime} from '../../gateway/dispatch/dispatch-lifetime.mjs';
import {readJsonResponse,cancelBody,responseBody} from '../../gateway/sources/json-response.mjs';
import {deny,safeFailure} from '../../gateway/dispatch/operation-result.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
const auxiliary=new Set(['job.resolveClientReference','job.readMode','job.readMailboxes','job.readResearchEvidenceSource','search_memory_eligibility']);
const operations=new Map(catalog.operations.map(({operation})=>[operation.id,operation]));

export function createObjectiveReadSource({record,policyRevision,origin,getServiceSecret,fetchImpl=globalThis.fetch,now=Date.now,maxRequestMs=15000,maxResponseBytes=1048576}){
 const saved=assertObjectiveRunStartRecord(record),binding=saved.binding,clientId=saved.selection.sourceAdmission.canonical.clientId;
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||typeof getServiceSecret!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||
  typeof policyRevision!=='string'||!policyRevision||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
 return async function readSource(raw){let life,response;try{
  const {signal,...fields}=own(raw,['operation','input','context','deadlineMs'],['signal']),v=data(fields);nativeSignal(signal);
  if(typeof v.operation!=='string'||!Number.isSafeInteger(v.deadlineMs))deny('INVALID_ARGUMENTS');
  if(!auxiliary.has(v.operation)){
   const operation=operations.get(v.operation);if(!operation)deny('INVALID_ARGUMENTS');
   const contract=resolveOperationContract(operation);
   if(contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none')deny('ACCESS_DENIED');
  }
  const context=own(v.context,['binding','subject','policyRevision','normalizationContext']);
  try{assertSubject(context.subject,binding);}catch{deny('ACCESS_DENIED');}
  if(hash(context.binding)!==hash(binding)||context.policyRevision!==policyRevision||context.subject.policyRevision!==policyRevision||
   context.subject.kind!=='client'||context.subject.entityType!=='client'||hash(context.subject.entityIds)!==hash([clientId]))deny('ACCESS_DENIED');
  const cutoff=Math.min(v.deadlineMs,saved.effectExpiresAtMs,now()+maxRequestMs);
  life=createDispatchLifetime({deadlineMs:cutoff,now,signal});
  const body=JSON.stringify({schemaVersion:1,generationJobId:saved.generationJobId,operation:v.operation,input:v.input,context});
  if(Buffer.byteLength(body,'utf8')>1048576)deny('RESOURCE_LIMIT');
  const secret=await life.run(signal=>getServiceSecret({signal}));
  if(typeof secret!=='string'||!/^[\x21-\x7e]{16,8192}$/u.test(secret))deny('UNAVAILABLE');
  response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(origin+'/api/internal/objective-generation/reads',{
   method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
   headers:{'x-internal-service-secret':secret,'x-meri-deadline-at':String(cutoff),'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body}));
   pending.then(r=>{if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;});
  const result=data(await readJsonResponse(response,{lifetime:life,maxResponseBytes}));life.check();return result;
 }catch(error){throw safeFailure(error);}finally{try{if(response)cancelBody(responseBody(response));}catch{}life?.close();}};
}
