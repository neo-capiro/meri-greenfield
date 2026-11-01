/** Concrete fixed-route transport for the Capiro authority bridge. Import is inert. */
import {applicationAuthorityRoutes,assertAuthorityIdentityRequest,assertAuthorityContextRequest,assertAuthorityIdentityReceipt,assertAuthorityContextReceipt} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {markAuthorityUnavailable,isUnavailableStatus} from '../../../../packages/runtime/authority-availability.mjs';
import {currentRequest,currentReceipt} from './current-receipt.mjs';
import {researchCurrentRequest,researchCurrentReceipt} from './research-current-receipt.mjs';
const refused=()=>{throw Error('APPLICATION_AUTHORITY_REFUSED');};
const unavailable=()=>{throw markAuthorityUnavailable(Error('APPLICATION_AUTHORITY_UNAVAILABLE'));};
const getters=Object.fromEntries(['status','headers','body','redirected'].map(k=>[k,Object.getOwnPropertyDescriptor(Response.prototype,k).get]));
function cancel(response){try{if(response&&!types.isProxy(response)&&response instanceof Response){const body=getters.body.call(response);if(body)Promise.resolve(body.cancel()).catch(()=>{});}}catch{}}
export function createCapiroApplicationAuthorityClient(configuration){
 const {origin,fetchImpl,now,limits,enabled=false}=own(configuration,['origin','fetchImpl','now','limits'],['enabled']);
 const bound=data(own(limits,['maxRequestMs','maxResponseBytes']));
 if(typeof origin!=='string'||typeof fetchImpl!=='function'||typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(bound.maxRequestMs)||bound.maxRequestMs<1||bound.maxRequestMs>30000||!Number.isSafeInteger(bound.maxResponseBytes)||bound.maxResponseBytes<1||bound.maxResponseBytes>131072)refused();
 const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')refused();const base=url.origin;
 async function request(kind,value){
  const isCurrent=kind==='current'||kind==='researchCurrent';
  const required=kind==='identity'?['credential','deadlineMs']:['credential','deadlineMs',...(isCurrent?[]:['identitySha256']),'conversationId','clientId'];
  const call=own(value,required,isCurrent?['signal','expect']:['signal']);nativeSignal(call.signal);
  if(!enabled||typeof call.credential!=='string'||!call.credential||call.credential.length>8192||!/^\S+$/u.test(call.credential)||!Number.isSafeInteger(call.deadlineMs))refused();
  const args=kind==='identity'?assertAuthorityIdentityRequest({}):isCurrent?(kind==='researchCurrent'?researchCurrentRequest:currentRequest)({conversationId:call.conversationId,clientId:call.clientId,...(call.expect===undefined?{}:{expect:call.expect})}):assertAuthorityContextRequest({identitySha256:call.identitySha256,conversationId:call.conversationId,clientId:call.clientId});
  const at=now();if(!Number.isSafeInteger(at)||at<0)refused();const deadlineMs=Math.min(call.deadlineMs,at+bound.maxRequestMs);
  // Core did not answer: this request's own budget ran out, the network or body failed, or Core reported 408/429/5xx.
  // A caller cancellation is never that, and no answer is ever served from it.
  let unanswered=false;const noAnswer=error=>{unanswered||=!call.signal?.aborted;throw error;};
  const life=createOperationLifetime({deadlineMs,now,signal:call.signal,errorFactory:code=>{if(code==='DEADLINE'&&!call.signal?.aborted)unanswered=true;return Error('APPLICATION_AUTHORITY_REFUSED');}});
  let reader,response,acquired=false,complete=false,answeredStatus;
  try{
   response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(`${base}${isCurrent?'/api/clio/application-authority/current':applicationAuthorityRoutes[kind]}`,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:`Bearer ${call.credential}`,'content-type':'application/json','accept':'application/json'},body:JSON.stringify(args),signal}));pending.then(r=>{if(life.signal.aborted)cancel(r);},()=>{});return pending.catch(noAnswer);});acquired=true;life.check();
   if(!response||types.isProxy(response)||!(response instanceof Response))refused();
   const status=getters.status.call(response),headers=getters.headers.call(response),body=getters.body.call(response),header=k=>Headers.prototype.get.call(headers,k);
   answeredStatus=status;
   if(isUnavailableStatus(status)){unanswered=true;refused();}
   if(status!==200||getters.redirected.call(response)||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding'))||!body)refused();
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>bound.maxResponseBytes))refused();
   reader=body.getReader();let count=0;const chunks=[];
   for(;;){const part=await life.run(()=>reader.read().catch(noAnswer));life.check();if(part.done){complete=true;break;}if(!(part.value instanceof Uint8Array))refused();count+=part.value.byteLength;if(count>bound.maxResponseBytes)refused();chunks.push(part.value);}
   if(length!==null&&count!==Number(length))refused();const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));const result=(kind==='identity'?assertAuthorityIdentityReceipt:kind==='researchCurrent'?researchCurrentReceipt:kind==='current'?currentReceipt:assertAuthorityContextReceipt)(parsed);
   if(kind==='researchCurrent'&&result.conversationId!==args.conversationId)refused();
   if(isCurrent&&args.expect&&Object.entries(args.expect).some(([key,value])=>result[key]!==value))throw Object.assign(Error('APPLICATION_AUTHORITY_REFUSED'),{status:409});life.check();if(call.signal?.aborted)refused();return result;
  }catch(cause){if(isCurrent){const ownStatus=cause!==null&&typeof cause==='object'&&!types.isProxy(cause)?Object.getOwnPropertyDescriptor(cause,'status')?.value:undefined;const status=unanswered?503:[401,403,409].includes(answeredStatus)?answeredStatus:ownStatus;const error=Object.assign(Error(unanswered?'APPLICATION_AUTHORITY_UNAVAILABLE':'APPLICATION_AUTHORITY_REFUSED'),{status});throw unanswered?markAuthorityUnavailable(error):error;}if(unanswered)unavailable();refused();}finally{if(reader){if(!complete){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}try{reader.releaseLock();}catch{}}else if(acquired)cancel(response);life.close();}
 }
 return Object.freeze({readIdentity:call=>request('identity',call),readContext:call=>request('context',call),readCurrent:call=>request('current',call),readResearchCurrent:call=>request('researchCurrent',call)});
}
