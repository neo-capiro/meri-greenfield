/** Private fixed task transport. Current authority remains inside the control owner. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertSelectedRequest} from '../../../packages/contracts/runtime-0.2/selected.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {fault} from '../config.mjs';
export function createSelectedTaskApplication(configuration){
 const c=own(configuration,['controller','now','limits'],['sourceEnabled']);if(typeof c.controller?.handle!=='function'||typeof c.now!=='function'||typeof(c.sourceEnabled??false)!=='boolean')throw fault('SELECTED_HTTP_CONFIGURATION');
 const limits=own(c.limits,['requestMs','requestBytes']);if(!Number.isSafeInteger(limits.requestMs)||limits.requestMs<1||limits.requestMs>30000||!Number.isSafeInteger(limits.requestBytes)||limits.requestBytes<1||limits.requestBytes>2097152)throw fault('SELECTED_HTTP_CONFIGURATION');
 return Object.freeze({async handle(request){let life;try{const url=new URL(request.url),route=/^\/internal\/conversations\/selected\/(prepare|read|finish|publish)$/u.exec(url.pathname);
  if(!route||url.search)return Response.json({error:{code:'NOT_FOUND'}},{status:404});if(request.method!=='POST')return Response.json({error:{code:'METHOD_NOT_ALLOWED'}},{status:405});if(c.sourceEnabled!==true)return Response.json({error:{code:'UNAVAILABLE'}},{status:503});
  const authorization=request.headers.get('authorization');if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(authorization??''))throw fault('SELECTED_AUTHORITY_REFUSED');
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding'))throw fault('SELECTED_HTTP_REFUSED');
  const length=request.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))throw fault('SELECTED_HTTP_REFUSED');
  life=createOperationLifetime({deadlineMs:c.now()+limits.requestMs,now:c.now,signal:request.signal,errorFactory:fault});
  const input=assertSelectedRequest(route[1],await jsonBody({body:request.body,length:length===null?null:Number(length)},limits.requestBytes,life,life.check));
  const output=await life.run(signal=>c.controller.handle(route[1],input,authorization.slice(7),signal));life.check();return Response.json(output,{headers:{'cache-control':'no-store'}});
 }catch(error){const code=['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'SELECTED_REQUEST_REFUSED';return Response.json({error:{code}},{status:code==='SELECTED_REQUEST_REFUSED'?403:408});}finally{life?.close();}}});
}
