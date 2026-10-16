/** Trusted control-side composition over one existing task verifier and canonical gateway. */
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion,assertNativeReadConfiguration,assertNativeReadRequest,assertNativeReadResponse,assertNativeReadTaskAssertion,assertNativeReadSnapshot,nativeReadFault,nativeReadFailureCode} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {safeFailure} from '../../gateway/dispatch/operation-result.mjs';
import {READ_FAMILIES} from '../../worker/conversation/reads/families.mjs';
const same=(a,b)=>hash(a)===hash(b),deny=code=>{throw nativeReadFault(code);};
const stableTask=({authorizationDecisionId,checkedAtMs,expiresAtMs,...facts})=>facts;
const stableSnapshot=s=>({installation:{...s.installation,checkedAtMs:0,expiresAtMs:0},discovery:{...s.discovery,checkedAtMs:0,expiresAtMs:0}});
const deferred=new Set(catalog.originals.filter(o=>o.disposition==='deferred').map(o=>o.id));
export function createNativeReadsOwner(configuration){
 const c=own(configuration,['binding','approvedReads'],['taskVerifier','gateway','allocationSha256','policyRevision','scopes','now']),binding=data(c.binding),config=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads),now=c.now??Date.now;
 validateShape('RunBinding',binding);if(typeof now!=='function')deny('CONFIGURATION');const ready=Boolean(config?.enabled&&c.taskVerifier&&c.gateway&&c.allocationSha256&&c.policyRevision&&c.scopes);
 const verify=ready?storageMethod(c.taskVerifier,'verify'):null,availability=ready?storageMethod(c.gateway,'readAvailability'):null,execute=ready?storageMethod(c.gateway,'execute'):null,scopes=ready?data(c.scopes):null;
 async function handle(operation,raw,capability,signal,operationDeadlineMs){let life,dispatched=false;try{
  if(!ready)deny('UNAVAILABLE');nativeSignal(signal);const op='runner/reads/'+operation,request=assertNativeReadRequest(op,raw),inputSha256=hash(request),started=now();if(!same(request.binding,binding))deny('ACCESS_DENIED');if(Buffer.byteLength(JSON.stringify(request),'utf8')>config.maxRequestBytes)deny('RESOURCE_LIMIT');
  if(operationDeadlineMs!==undefined&&!Number.isSafeInteger(operationDeadlineMs))deny('INVALID_ARGUMENTS');const deadlineMs=Math.min(operationDeadlineMs??Infinity,started+(operation==='execute'?config.maxExecuteMs:3000));life=createOperationLifetime({now,deadlineMs,signal,errorFactory:nativeReadFault});
  let initial,authorityExpiry=deadlineMs;
  async function task(){const began=now(),a=assertNativeReadTaskAssertion(await life.run(signal=>verify({capability,binding,operation:op,inputSha256,signal,deadlineMs})),{binding,operation:op,inputSha256,started:began,now});
   if(a.allocationSha256!==c.allocationSha256||a.policyRevision!==c.policyRevision||!same(a.scopes,scopes)||initial&&!same(stableTask(a),stableTask(initial)))deny('ACCESS_DENIED');initial??=a;authorityExpiry=Math.min(authorityExpiry,a.expiresAtMs);life.limitDeadline(authorityExpiry);return a;}
  async function snapshot(){const s=assertNativeReadSnapshot(await life.run(signal=>availability({signal})),{binding,policyRevision:c.policyRevision,now});if(s.installation.baseCatalogSha256!==hash(catalog))deny('UNAVAILABLE');life.limitDeadline(Math.min(s.installation.expiresAtMs,s.discovery.expiresAtMs));return s;}
  function eligible(s){const installed=new Set(s.installation.operations.map(hash)),discovered=new Set(s.discovery.operations.map(hash)),client=scopes.some(s=>s.kind==='client');return config.operations.filter(op=>{
   const {descriptor,binding:contract}=resolveOperationContract(op),family=READ_FAMILIES[contract?.group];return family&&descriptor.sideEffect==='none'&&descriptor.approvalBoundary==='none'&&!deferred.has(op.id)&&!deferred.has(op.id.replaceAll('.','_'))&&installed.has(hash(op))&&discovered.has(hash(op))&&(client||family.clientScope!=='required'&&!family.requiredClientOperations?.includes(op.id));});}
  await task();const before=await snapshot();let result;
  if(operation==='execute'){
   if(request.installationId!==before.installation.installationId||request.executionCatalogSha256!==before.installation.executionCatalogSha256||!eligible(before).some(op=>same(op,request.operation)))deny('UNAVAILABLE');
   await task();dispatched=true;result=await life.run(signal=>execute({operation:request.operation,arguments:request.arguments,deliveryId:request.deliveryId,signal}));
   if(typeof result!=='string'||Buffer.byteLength(result,'utf8')>config.maxResponseBytes)deny('INVALID_RESULT');
  }
  await task();const after=await snapshot();if(!same(stableSnapshot(before),stableSnapshot(after)))deny('UNAVAILABLE');await task();life.check();const checkedAtMs=now(),expiresAtMs=Math.min(authorityExpiry,after.installation.expiresAtMs,after.discovery.expiresAtMs);
  const common={schemaVersion,binding,inputSha256,policyRevision:c.policyRevision,allocationSha256:c.allocationSha256,checkedAtMs,expiresAtMs};
  const response=operation==='execute'?{...common,operation:request.operation,deliveryId:request.deliveryId,installationId:request.installationId,executionCatalogSha256:request.executionCatalogSha256,resultJson:result,resultSha256:hash(data(JSON.parse(result))),outputBytes:Buffer.byteLength(result,'utf8')}:{...common,installation:{...after.installation,operations:eligible(after)},discovery:{...after.discovery,operations:eligible(after)}};
  return assertNativeReadResponse(op,response,{request,started,now,policyRevision:c.policyRevision,allocationSha256:c.allocationSha256,maxResponseBytes:config.maxResponseBytes});
 }catch(error){const code=nativeReadFailureCode(error),gateway=safeFailure(error).message;throw nativeReadFault(code??(gateway!=='INTERNAL_ERROR'?gateway:dispatched?'BUDGET_UNCERTAIN':'UNAVAILABLE'));}finally{life?.close();}}
 return Object.freeze({handle});
}
