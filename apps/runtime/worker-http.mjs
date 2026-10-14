/** Task capability -> current native identity -> existing opaque session -> canonical service. */
import {jsonBody} from '../control/action-application/http.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {assertRunOwnerRequest,same,runOwnerOperations} from '../../packages/contracts/runtime-0.2/validate.mjs';
import {fault} from './config.mjs';
import {createNativeTaskAuthority} from './native-authority/task-authority.mjs';
export function createWorkerRunApplication({service,sessions,native,configuration,now=Date.now}){
 const authority=createNativeTaskAuthority({native,enabled:true,now,maxRequestMs:configuration.limits.requestMs});
 return Object.freeze({async handle(request){let life,session;try{
  const url=new URL(request.url),route=/^\/internal\/conversations\/([a-z-]+)$/u.exec(url.pathname);if(!route||!Object.hasOwn(runOwnerOperations,route[1])||url.search)return Response.json({error:{code:'NOT_FOUND'}},{status:404});if(request.method!=='POST')return Response.json({error:{code:'METHOD_NOT_ALLOWED'}},{status:405});
  const capability=request.headers.get('authorization');if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(capability??''))throw fault('WORKER_AUTHORITY_REFUSED');if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw fault('WORKER_REQUEST_REFUSED');
  life=createOperationLifetime({deadlineMs:now()+configuration.limits.requestMs,now,signal:request.signal,errorFactory:fault});const length=request.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))throw fault('WORKER_REQUEST_REFUSED');
  const input=assertRunOwnerRequest(route[1],await jsonBody({body:request.body,length:length===null?null:Number(length)},configuration.limits.requestBytes,life,life.check)),inputSha256=canonicalSha256(input);let pinned;
  async function fresh(){const value=await life.run(signal=>authority.verify({capability:capability.slice(7),binding:input.binding,operation:route[1],inputSha256,signal}));const identity={binding:value.binding,scopes:value.scopes,selectedClientId:value.selectedClientId,policyRevision:value.policyRevision};if(pinned&&!same(pinned,identity))throw fault('WORKER_AUTHORITY_CHANGED');pinned??=identity;life.limitDeadline(value.expiresAtMs);return value;}
  const authorization=await fresh();session=await life.run(signal=>sessions.issue({identityCredential:authorization.identityCredential,hints:{conversationId:input.binding.conversationId,runId:input.binding.runId,clientId:authorization.selectedClientId},signal}));
  const auth=await life.run(signal=>sessions.authenticateSession({credential:session.credential,signal})),current=await life.run(signal=>sessions.readCurrentState({authentication:auth,signal}));if(!same(current.binding,pinned.binding)||!same(current.scopes,pinned.scopes)||current.selectedClientId!==pinned.selectedClientId)throw fault('WORKER_AUTHORITY_CHANGED');
  await fresh();const result=await life.run(signal=>service[runOwnerOperations[route[1]]]({credential:session.credential,...input,signal}));await fresh();life.check();return Response.json(result,{headers:{'cache-control':'no-store'}});
 }catch(error){const code=['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'WORKER_REQUEST_REFUSED';return Response.json({error:{code}},{status:code==='WORKER_REQUEST_REFUSED'?403:408});}finally{if(session)sessions.revoke(session.credential);life?.close();}}});
}
