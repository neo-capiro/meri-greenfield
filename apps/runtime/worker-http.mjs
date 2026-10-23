import {productFailure} from '../control/product-access/errors.mjs';
/** Task capability -> current native identity -> existing opaque session -> canonical service. */
import {jsonBody} from '../control/action-application/http.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {isAuthorityUnavailable} from '../../packages/runtime/authority-availability.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {assertRunOwnerRequest,same,runOwnerOperations} from '../../packages/contracts/runtime-0.2/validate.mjs';
import {fault} from './config.mjs';
import {createNativeTaskAuthority} from './native-authority/task-authority.mjs';
import {issuedCurrentState} from '../control/action-host/session/owner.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {taskControlPage} from '../control/conversations/lifecycle/service.mjs';
export function createWorkerRunApplication({service,sessions,native,configuration,retention,now=Date.now,turnTelemetry}){
 let withRelease;try{withRelease=retention===undefined?null:storageMethod(retention,'withRelease');if(configuration.retention!==undefined&&!withRelease)throw Error();}catch{throw fault('WORKER_RETENTION_CONFIGURATION');}
 const authority=createNativeTaskAuthority({native,enabled:true,now,maxRequestMs:configuration.limits.requestMs});
 const issueCurrent=issuedCurrentState(sessions);
 return Object.freeze({async handle(request){const operation=async()=>{let life,session,route;try{
  const url=new URL(request.url);route=/^\/internal\/conversations\/([a-z-]+)$/u.exec(url.pathname);if(!route||!Object.hasOwn(runOwnerOperations,route[1])||url.search)return Response.json({error:{code:'NOT_FOUND'}},{status:404});if(request.method!=='POST')return Response.json({error:{code:'METHOD_NOT_ALLOWED'}},{status:405});
  const capability=request.headers.get('authorization');if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(capability??''))throw fault('WORKER_AUTHORITY_REFUSED');if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw fault('WORKER_REQUEST_REFUSED');
  let deadlineMs=now()+configuration.limits.requestMs;life=createOperationLifetime({deadlineMs,now,signal:request.signal,errorFactory:fault});const length=request.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))throw fault('WORKER_REQUEST_REFUSED');
  const input=assertRunOwnerRequest(route[1],await jsonBody({body:request.body,length:length===null?null:Number(length)},configuration.limits.requestBytes,life,life.check)),inputSha256=canonicalSha256(input);try{turnTelemetry?.bind(input.binding);}catch{}let pinned;
  async function fresh(){const value=await life.run(signal=>authority.verify({capability:capability.slice(7),binding:input.binding,operation:route[1],inputSha256,signal}));const identity={binding:value.binding,scopes:value.scopes,selectedClientId:value.selectedClientId,policyRevision:value.policyRevision};if(pinned&&!same(pinned,identity))throw fault('WORKER_AUTHORITY_CHANGED');pinned??=identity;deadlineMs=Math.min(deadlineMs,value.expiresAtMs);life.limitDeadline(deadlineMs);return value;}
  const authorization=await fresh();let result;
  // A runner's control page is a read of its own run's durable controls. The task verify before and after it proves the admitted
  // grant and capability, the current task run, and the owner's Core identity and context (Core refuses both without an active
  // tenant membership, the standard_user role and access to this client and conversation). It skips the opaque session, whose
  // extra membership admission/rechecks only pin role, permission and client-list revisions; every effect still goes through it.
  if(route[1]==='next-controls'){if(typeof service[taskControlPage]!=='function')throw fault('WORKER_REQUEST_REFUSED');
   result=await life.run(signal=>service[taskControlPage]({binding:pinned.binding,scopes:pinned.scopes,selectedClientId:pinned.selectedClientId,after:input.after??0,signal}));}
  // The new session is only cross-checked against the task authority here; the service observes it again (as a separate pair for
  // every effect) immediately before it reads or writes. The registered owner hands back what its issuance resolve just observed
  // (identity, membership admission, context, membership recheck); a plain session port issues and then observes the session.
  else{const issue={identityCredential:authorization.identityCredential,hints:{conversationId:input.binding.conversationId,runId:input.binding.runId,clientId:authorization.selectedClientId}};let current;
  if(issueCurrent)({receipt:session,current}=await life.run(signal=>issueCurrent({...issue,signal})));
  else{session=await life.run(signal=>sessions.issue({...issue,signal}));const authentication=await life.run(signal=>sessions.authenticateSession({credential:session.credential,signal}));current=await life.run(signal=>sessions.readCurrentState({authentication,signal}));}
  if(!same(current.binding,pinned.binding)||!same(current.scopes,pinned.scopes)||current.selectedClientId!==pinned.selectedClientId)throw fault('WORKER_AUTHORITY_CHANGED');
  await fresh();result=await life.run(signal=>service[runOwnerOperations[route[1]]]({credential:session.credential,...input,signal}));}
  await fresh();life.check();
  if((route[1]==='load'||route[1]==='next-controls')&&withRelease){
   const subject={tenantId:pinned.binding.tenantId,kind:'conversation',subjectId:pinned.binding.conversationId};
   // The final task check is awaited: suppression must be rechecked under the
   // canonical serving lock and that lock must cover response serialization.
   return await life.run(signal=>withRelease([subject],async(fenceSignal,assertReleaseServable)=>{
    if(typeof assertReleaseServable!=='function')throw fault('WORKER_RETENTION_CONFIGURATION');
    life.check();fenceSignal.throwIfAborted();await assertReleaseServable(subject);life.check();fenceSignal.throwIfAborted();
    return Response.json(result,{headers:{'cache-control':'no-store'}});
   },{signal,deadlineMs}));
  }
  return Response.json(result,{headers:{'cache-control':'no-store'}});
 }catch(error){
  // An authority dependency (Core/Clerk, the task verifier) that did not answer decided nothing: 503 lets the runner replay an
  // idempotent call (native-client.mjs). Every refusal, mismatch and changed authority stays 403.
  if(route?.[1]==='record-usage'){const failure=productFailure(error);if(failure&&['SDK_USAGE_STORE_UNAVAILABLE','SDK_USAGE_COMMIT_UNKNOWN'].includes(failure.code))return Response.json({error:{code:failure.code,outcome:failure.outcome}},{status:503});}
  if(isAuthorityUnavailable(error))return Response.json({error:{code:'WORKER_AUTHORITY_UNAVAILABLE'}},{status:503});
  const code=['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'WORKER_REQUEST_REFUSED';return Response.json({error:{code}},{status:code==='WORKER_REQUEST_REFUSED'?403:408});}finally{if(session)sessions.revoke(session.credential);life?.close();}};return turnTelemetry?turnTelemetry.provisional(operation):operation();}});
}
