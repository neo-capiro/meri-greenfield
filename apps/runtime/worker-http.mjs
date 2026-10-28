import {productFailure} from '../control/product-access/errors.mjs';
/** Execution credential -> current canonical invocation -> existing conversation/lifecycle service. */
import {jsonBody} from '../control/action-application/http.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {isAuthorityUnavailable,markAuthorityUnavailable} from '../../packages/runtime/authority-availability.mjs';
import {validateShape} from '../../packages/contracts/validate.mjs';
import {assertRunOwnerRequest,same,runOwnerOperations} from '../../packages/contracts/runtime-0.2/validate.mjs';
import {fault} from './config.mjs';
import {assertExecutionIdentity} from '../control/conversations/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {taskControlPage} from '../control/conversations/lifecycle/service.mjs';
export function createWorkerRunApplication({execution,createService,configuration,retention,now=Date.now,turnTelemetry}){
 let withRelease;try{withRelease=retention===undefined?null:storageMethod(retention,'withRelease');if(configuration.retention!==undefined&&!withRelease)throw Error();}catch{throw fault('WORKER_RETENTION_CONFIGURATION');}
 if(typeof execution?.authenticate!=='function'||typeof createService!=='function')throw fault('WORKER_EXECUTION_CONFIGURATION');
 return Object.freeze({async handle(request){const operation=async()=>{let life,route;try{
  const url=new URL(request.url);route=/^\/internal\/conversations\/([a-z-]+)$/u.exec(url.pathname);if(!route||!Object.hasOwn(runOwnerOperations,route[1])||url.search)return Response.json({error:{code:'NOT_FOUND'}},{status:404});if(request.method!=='POST')return Response.json({error:{code:'METHOD_NOT_ALLOWED'}},{status:405});
  const capability=request.headers.get('authorization');if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(capability??''))throw fault('WORKER_AUTHORITY_REFUSED');if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw fault('WORKER_REQUEST_REFUSED');
  let deadlineMs=now()+configuration.limits.requestMs;life=createOperationLifetime({deadlineMs,now,signal:request.signal,errorFactory:fault});const length=request.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))throw fault('WORKER_REQUEST_REFUSED');
  const input=assertRunOwnerRequest(route[1],await jsonBody({body:request.body,length:length===null?null:Number(length)},configuration.limits.requestBytes,life,life.check)),credential=capability.slice(7);try{turnTelemetry?.bind(input.binding);}catch{}let pinned;
  async function fresh(){let value;try{value=await life.run(signal=>execution.authenticate({credential,binding:input.binding,signal}));}
   catch(error){const code=productFailure(error)?.code??error?.code;if(['STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN','EXECUTION_STORE_UNAVAILABLE','EXECUTION_STORE_COMMIT_UNKNOWN'].includes(code))markAuthorityUnavailable(error);throw error;}
   const identity=assertExecutionIdentity(value.execution);if(!same(identity.binding,input.binding)||!Array.isArray(value.scopes)||!value.scopes.length||value.scopes.length>100)throw fault('WORKER_AUTHORITY_REFUSED');
   for(const scope of value.scopes){validateShape('Scope',scope);if(scope.tenantId!==input.binding.tenantId||scope.policyRevision!==value.policyRevision)throw fault('WORKER_AUTHORITY_REFUSED');}
   const current={execution:identity,scopes:value.scopes,selectedClientId:value.selectedClientId,policyRevision:value.policyRevision};
   if(pinned&&!same(pinned,current))throw fault('WORKER_AUTHORITY_CHANGED');pinned??=current;deadlineMs=Math.min(deadlineMs,identity.expiresAtMs);life.limitDeadline(deadlineMs);return current;
  }
  await fresh();const service=await life.run(()=>createService({credential,binding:input.binding}));
  const method=route[1]==='next-controls'?taskControlPage:runOwnerOperations[route[1]];
  if(typeof service?.[method]!=='function')throw fault('WORKER_REQUEST_REFUSED');
  // Control polling uses the canonical journal's task reader under these two current execution checks.
  // Other operations retain their service observations; no user session or remote Core admission is minted here.
  const result=await life.run(signal=>service[method](route[1]==='next-controls'
   ?{binding:input.binding,scopes:pinned.scopes,selectedClientId:pinned.selectedClientId,after:input.after??0,signal}
   :{credential,...input,signal}));
  // Terminal publication consumes current-run authority. Acknowledge only the
  // canonical event the service committed and rechecked; no further work is admitted.
  if(route[1]==='publish'&&input.event.type==='run.status'&&['completed','failed','cancelled'].includes(input.event.data?.state)){
   validateShape('UIEvent',result);
   if(!same(result.binding,pinned.execution.binding)||!same(result.scopes,pinned.scopes)||
      !same({eventId:result.eventId,createdAt:result.createdAt,type:result.type,data:result.data},input.event))throw fault('WORKER_TERMINAL_RECEIPT_REFUSED');
  }else await fresh();
  life.check();
  if((route[1]==='load'||route[1]==='next-controls'||route[1]==='upload-source'||route[1]==='procedure-resolve')&&withRelease){
   const subject={tenantId:pinned.execution.binding.tenantId,kind:'conversation',subjectId:pinned.execution.binding.conversationId};
   // The final execution check is awaited: suppression must be rechecked under the
   // canonical serving lock and that lock must cover response serialization.
   return await life.run(signal=>withRelease([subject],async(fenceSignal,assertReleaseServable)=>{
    if(typeof assertReleaseServable!=='function')throw fault('WORKER_RETENTION_CONFIGURATION');
    life.check();fenceSignal.throwIfAborted();await assertReleaseServable(subject);life.check();fenceSignal.throwIfAborted();
    return Response.json(result,{headers:{'cache-control':'no-store'}});
   },{signal,deadlineMs}));
  }
  return Response.json(result,{headers:{'cache-control':'no-store'}});
 }catch(error){
  // A canonical execution-store lookup that did not answer decided nothing: 503 lets the runner replay an
  // idempotent call (native-client.mjs). Every refusal, mismatch and changed authority stays 403.
  if(route?.[1]==='record-usage'){const failure=productFailure(error);if(failure&&['SDK_USAGE_STORE_UNAVAILABLE','SDK_USAGE_COMMIT_UNKNOWN'].includes(failure.code))return Response.json({error:{code:failure.code,outcome:failure.outcome}},{status:503});}
  if(isAuthorityUnavailable(error))return Response.json({error:{code:'WORKER_AUTHORITY_UNAVAILABLE'}},{status:503});
  const code=life&&now()>=life.deadline()?'DEADLINE':life?.signal.aborted?'CANCELLED':['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'WORKER_REQUEST_REFUSED';return Response.json({error:{code}},{status:code==='WORKER_REQUEST_REFUSED'?403:408});}finally{life?.close();}};return turnTelemetry?turnTelemetry.provisional(operation):operation();}});
}
