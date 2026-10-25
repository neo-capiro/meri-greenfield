/** Control-only saved-job transport. Core owns current consent, membership and each existing typed source handler. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
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
 return createSavedReadSource({binding,clientId,expiresAtMs:saved.effectExpiresAtMs,selector:{schemaVersion:1,generationJobId:saved.generationJobId},path:'/api/internal/objective-generation/reads',policyRevision,origin,getServiceSecret,fetchImpl,now,maxRequestMs,maxResponseBytes});
}
/** The routine owner supplies a canonical occurrence selection; Core re-joins it before every typed read. */
export function createRoutineReadSource({record,policyRevision,origin,getServiceSecret,fetchImpl=globalThis.fetch,now=Date.now,maxRequestMs=15000,maxResponseBytes=1048576}){
 const r=data(own(record,['binding','scopes','selectedClientId','policyRevision','scheduleId','occurrenceKey','generation','maxCostMicroUSD','expiresAtMs']));
 validateShape('RunBinding',r.binding);
 if(r.policyRevision!==policyRevision||!/^[a-f0-9]{64}$/u.test(r.occurrenceKey)||typeof r.scheduleId!=='string'||!Number.isSafeInteger(r.expiresAtMs))deny('GATEWAY_CONFIGURATION');
 return createSavedReadSource({binding:r.binding,clientId:r.selectedClientId,expiresAtMs:r.expiresAtMs,selector:{schemaVersion:1,tenantId:r.binding.tenantId,scheduleId:r.scheduleId,occurrenceKey:r.occurrenceKey,binding:r.binding},path:'/api/internal/routines/reads',policyRevision,origin,getServiceSecret,fetchImpl,now,maxRequestMs,maxResponseBytes});
}
function createSavedReadSource({binding,clientId,expiresAtMs,selector,path,policyRevision,origin,getServiceSecret,fetchImpl,now,maxRequestMs,maxResponseBytes}){
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
   context.subject.kind!==(clientId===null?'personal':'client')||context.subject.entityType!==(clientId===null?'user':'client')||hash(context.subject.entityIds)!==hash([clientId??binding.actorId]))deny('ACCESS_DENIED');
  const cutoff=Math.min(v.deadlineMs,expiresAtMs,now()+maxRequestMs);
  life=createDispatchLifetime({deadlineMs:cutoff,now,signal});
  const body=JSON.stringify({...selector,operation:v.operation,input:v.input,context});
  if(Buffer.byteLength(body,'utf8')>1048576)deny('RESOURCE_LIMIT');
  const secret=await life.run(signal=>getServiceSecret({signal}));
  if(typeof secret!=='string'||!/^[\x21-\x7e]{16,8192}$/u.test(secret))deny('UNAVAILABLE');
  response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(origin+path,{
   method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
   headers:{'x-internal-service-secret':secret,'x-meri-deadline-at':String(cutoff),'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body}));
   pending.then(r=>{if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;});
  const result=data(await readJsonResponse(response,{lifetime:life,maxResponseBytes}));life.check();return result;
 }catch(error){throw safeFailure(error);}finally{try{if(response)cancelBody(responseBody(response));}catch{}life?.close();}};
}
