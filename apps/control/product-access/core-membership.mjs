/** Fixed Core membership transport composed with the canonical product gate. No cached identity, bearer or membership. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertAuthorityIdentityReceipt} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody} from '../action-application/http.mjs';
import {createMembershipGate} from './membership.mjs';
import {ProductError,asProductError,refuse} from './errors.mjs';
const path='/api/clio/application-authority/membership';
const getters=Object.fromEntries(['status','headers','body','redirected'].map(k=>[k,Object.getOwnPropertyDescriptor(Response.prototype,k).get]));
const credentialOk=v=>typeof v==='string'&&/^[A-Za-z0-9._~+/-]{1,8192}={0,2}$/u.test(v);
function cancel(response){try{if(response&&!types.isProxy(response)&&response instanceof Response){const body=getters.body.call(response);if(body)Promise.resolve(body.cancel()).catch(()=>{});}}catch{}}
export function createCoreMembershipGate(configuration){
 let origin,verifyIdentity,fetchImpl,now,limits;
 try{
  const c=own(configuration,['origin','identityContext','fetchImpl','now','limits']);
  limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));fetchImpl=c.fetchImpl;now=c.now;
  if(typeof c.origin!=='string'||typeof fetchImpl!=='function'||types.isProxy(fetchImpl)||typeof now!=='function'||types.isProxy(now))throw Error();
  const url=new URL(c.origin);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.origin!==c.origin)throw Error();
  origin=url.origin;verifyIdentity=storageMethod(c.identityContext,'verifyIdentity');
 }catch{refuse('PRODUCT_CONFIGURATION');}
 async function readMembership(value){
  let life,response;
  try{
   const call=own(value,['tenantId','actorId','credential','deadlineMs'],['signal']);nativeSignal(call.signal);
   if(!credentialOk(call.credential))refuse('UNAUTHENTICATED');
   const at=now();if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(call.deadlineMs))refuse('CONVERSATION_UNAVAILABLE');
   const deadlineMs=Math.min(call.deadlineMs,at+limits.maxRequestMs);
   life=createOperationLifetime({deadlineMs,now,signal:call.signal,errorFactory:code=>new ProductError(code)});
   response=await life.run(signal=>{
    const pending=Promise.resolve(fetchImpl(origin+path,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',
     headers:{authorization:'Bearer '+call.credential,'content-type':'application/json',accept:'application/json','accept-encoding':'identity','x-meri-deadline-at':String(deadlineMs)},body:'{}',signal}));
    // A raced-out fetch may settle later. It never releases a fact and its borrowed body is cancelled.
    pending.then(r=>{if(life.signal.aborted)cancel(r);},()=>{});return pending;
   });life.check();
   if(!response||types.isProxy(response)||!(response instanceof Response)||getters.redirected.call(response))refuse('CONVERSATION_UNAVAILABLE');
   const status=getters.status.call(response);
   if(status===401)refuse('UNAUTHENTICATED');if(status===403)refuse('ACCESS_DENIED');
   if(status===409)refuse('MEMBERSHIP_CHANGED');if(status===408)refuse('DEADLINE');
   if(status!==200)refuse('CONVERSATION_UNAVAILABLE');
   const headers=getters.headers.call(response),header=k=>Headers.prototype.get.call(headers,k),body=getters.body.call(response),length=header('content-length');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding'))||!body||
    length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>limits.maxFactBytes))refuse('CONVERSATION_UNAVAILABLE');
   const result=await jsonBody({body,length:length===null?null:Number(length)},limits.maxFactBytes,life,life.check);life.check();
   return result; // Shape, freshness, exact principal and rights remain owned by createMembershipGate.
  }catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE');}finally{cancel(response);life?.close();}
 }
 return createMembershipGate({now,limits,readMembership,async verifyToken(call){
  if(!credentialOk(call.credential))refuse('UNAUTHENTICATED');
  try{
   const receipt=assertAuthorityIdentityReceipt(await verifyIdentity(call));
   return {tenantId:receipt.principal.tenantId,actorId:receipt.principal.actorId,checkedAtMs:receipt.checkedAtMs,expiresAtMs:receipt.expiresAtMs};
  }catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE');}
 }});
}
