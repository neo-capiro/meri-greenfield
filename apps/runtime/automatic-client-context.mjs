/** Control-only client. The runner never receives the Core service secret or native user bearer. */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../control/action-application/http.mjs';
import {assertAutomaticClientContext,AUTOMATIC_CONTEXT_MAX_BYTES} from '../worker/conversation/automatic-client-context.mjs';
const fail=()=>{throw Object.assign(Error('AUTOMATIC_CONTEXT_UNAVAILABLE'),{code:'AUTOMATIC_CONTEXT_UNAVAILABLE'});};
export function createAutomaticClientContextReader({origin,getServiceSecret,fetchImpl=globalThis.fetch,now=Date.now,maxRequestMs}){
 const url=new URL('/api/clio/client-context/automatic',origin);
 if(url.protocol!=='https:'||url.username||url.password||typeof fetchImpl!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail();
 return Object.freeze({async read({binding,selectedClientId,credential,signal,deadlineMs}){
  if(selectedClientId===null)return null;
  if(typeof credential!=='string'||!credential||typeof getServiceSecret!=='function')fail();
  const started=now(),life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,started+maxRequestMs),errorFactory:()=>Object.assign(Error('AUTOMATIC_CONTEXT_UNAVAILABLE'),{code:'AUTOMATIC_CONTEXT_UNAVAILABLE'})});
  try{
   const secret=await life.run(signal=>getServiceSecret({signal}));if(typeof secret!=='string'||!secret||secret.length>8192)fail();
   const r=await life.run(signal=>fetchImpl(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{authorization:`Bearer ${credential}`,'x-internal-service-secret':secret,'x-meri-deadline-at':String(life.deadline()),accept:'application/json','content-type':'application/json'},
    body:JSON.stringify({schemaVersion:1,clientId:selectedClientId})}));
   if(r.status!==200||r.redirected||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(r.headers.get('content-type')??'')){await r.body?.cancel();fail();}
   const length=r.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length)){await r.body?.cancel();fail();}
   const packet=assertAutomaticClientContext(await jsonBody({body:r.body,length:length===null?null:Number(length)},AUTOMATIC_CONTEXT_MAX_BYTES,life,life.check),{binding,selectedClientId});
   if(Date.parse(packet.readWindow.startedAt)<started||Date.parse(packet.readWindow.completedAt)>now())fail();
   return packet;
  }finally{life.close();}
 }});
}
