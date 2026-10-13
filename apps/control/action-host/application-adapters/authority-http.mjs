/** Concrete fixed-route transport for the proposed Capiro authority bridge. Import is inert. */
import {applicationAuthorityRoutes,assertAuthorityIdentityRequest,assertAuthorityContextRequest,assertAuthorityIdentityReceipt,assertAuthorityContextReceipt} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const refused=()=>{throw Error('APPLICATION_AUTHORITY_REFUSED');};
const getters=Object.fromEntries(['status','headers','body'].map(k=>[k,Object.getOwnPropertyDescriptor(Response.prototype,k).get]));
function cancel(response){try{if(response&&!types.isProxy(response)&&response instanceof Response){const body=getters.body.call(response);if(body)Promise.resolve(body.cancel()).catch(()=>{});}}catch{}}
export function createCapiroApplicationAuthorityClient(configuration){
 const {origin,fetchImpl,now,limits,enabled=false}=own(configuration,['origin','fetchImpl','now','limits'],['enabled']);
 const bound=data(own(limits,['maxRequestMs','maxResponseBytes']));
 if(typeof origin!=='string'||typeof fetchImpl!=='function'||typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(bound.maxRequestMs)||bound.maxRequestMs<1||bound.maxRequestMs>30000||!Number.isSafeInteger(bound.maxResponseBytes)||bound.maxResponseBytes<1||bound.maxResponseBytes>131072)refused();
 const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')refused();const base=url.origin;
 async function request(kind,value){
  const required=kind==='identity'?['credential','deadlineMs']:['credential','deadlineMs','identitySha256','conversationId','clientId'];
  const call=own(value,required,['signal']);nativeSignal(call.signal);
  if(!enabled||typeof call.credential!=='string'||!call.credential||call.credential.length>8192||!/^\S+$/u.test(call.credential)||!Number.isSafeInteger(call.deadlineMs))refused();
  const args=kind==='identity'?assertAuthorityIdentityRequest({}):assertAuthorityContextRequest({identitySha256:call.identitySha256,conversationId:call.conversationId,clientId:call.clientId});
  const at=now();if(!Number.isSafeInteger(at)||at<0)refused();const deadlineMs=Math.min(call.deadlineMs,at+bound.maxRequestMs);
  const life=createOperationLifetime({deadlineMs,now,signal:call.signal,errorFactory:()=>Error('APPLICATION_AUTHORITY_REFUSED')});
  let reader,response,acquired=false,complete=false;
  try{
   response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(`${base}${applicationAuthorityRoutes[kind]}`,{method:'POST',redirect:'error',headers:{authorization:`Bearer ${call.credential}`,'content-type':'application/json','accept':'application/json'},body:JSON.stringify(args),signal}));pending.then(r=>{if(life.signal.aborted)cancel(r);},()=>{});return pending;});acquired=true;life.check();
   if(!response||types.isProxy(response)||!(response instanceof Response))refused();
   const status=getters.status.call(response),headers=getters.headers.call(response),body=getters.body.call(response),header=k=>Headers.prototype.get.call(headers,k);
   if(status!==200||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding'))||!body)refused();
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>bound.maxResponseBytes))refused();
   reader=body.getReader();let count=0;const chunks=[];
   for(;;){const part=await life.run(()=>reader.read());life.check();if(part.done){complete=true;break;}if(!(part.value instanceof Uint8Array))refused();count+=part.value.byteLength;if(count>bound.maxResponseBytes)refused();chunks.push(part.value);}
   if(length!==null&&count!==Number(length))refused();const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));const result=(kind==='identity'?assertAuthorityIdentityReceipt:assertAuthorityContextReceipt)(parsed);life.check();if(call.signal?.aborted)refused();return result;
  }catch{refused();}finally{if(reader){if(!complete){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}try{reader.releaseLock();}catch{}}else if(acquired)cancel(response);life.close();}
 }
 return Object.freeze({readIdentity:call=>request('identity',call),readContext:call=>request('context',call)});
}
