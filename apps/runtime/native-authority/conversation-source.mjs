/** Current product access to one saved page; no execution credential or model call. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {ProductError,productFailure} from '../../control/product-access/errors.mjs';
import {assertNativeSourceEvent} from '../../../packages/contracts/conversation-sources/validate.mjs';
import {savedBillTextRequest,releaseBillTextPage} from '../../control/conversations/sources/bill-text.mjs';
import {savedHearingRequest,releaseHearingPage} from '../../control/conversations/sources/hearing-record.mjs';
import {HEARING_SOURCE_EVENT} from '../../../packages/contracts/conversation-sources/protocol.mjs';
const refuse=(code='SOURCE_REFERENCE_UNAVAILABLE')=>{throw new ProductError(code);};
export function createCoreConversationSourceReader({origin,getServiceSecret,fetchImpl=fetch,now=Date.now,maxRequestMs}){
 const url=new URL(origin);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||typeof getServiceSecret!=='function'||typeof fetchImpl!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 return Object.freeze({forRequest({credential,principal,signal,deadlineMs}){
  if(typeof credential!=='string'||!/^\S{1,8192}$/u.test(credential))refuse('UNAUTHENTICATED');
  return Object.freeze({async read(raw){
   const event=assertNativeSourceEvent(raw),b=event.binding;
   const hearing=event.type===HEARING_SOURCE_EVENT,operation=hearing?'search_committee_hearings':'read_bill_text',request=hearing?savedHearingRequest(event):savedBillTextRequest(event);
   if(b.tenantId!==principal.tenantId||b.actorId!==principal.actorId||event.scopes.some(s=>s.kind==='client'&&!principal.clientIds.includes(s.resourceId)))refuse('ACCESS_DENIED');
   if(hearing&&request.clientId!==null&&!principal.clientIds.includes(request.clientId))refuse('ACCESS_DENIED');
   const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+maxRequestMs),errorFactory:()=>new ProductError('SOURCE_REFERENCE_UNAVAILABLE')});let response;
   try{const secret=await life.run(()=>getServiceSecret());if(typeof secret!=='string'||!/^\S{1,8192}$/u.test(secret))refuse();
    response=await life.run(signal=>fetchImpl(new URL('/api/clio/tools/'+operation,origin),{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:`Bearer ${credential}`,'x-internal-service-secret':secret,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(request)}));
    if(response.status!==200)refuse(({401:'UNAUTHENTICATED',403:'ACCESS_DENIED',400:'SOURCE_REFERENCE_STALE',404:'SOURCE_REFERENCE_UNAVAILABLE'})[response.status]);
    if(response.redirected||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get('content-type')??''))refuse();
    const length=response.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))refuse();
    const result=await jsonBody({body:response.body,length:length===null?null:Number(length)},131072,life,life.check);life.check();return hearing?releaseHearingPage(event,result):releaseBillTextPage(event,result);
   }catch(error){if(productFailure(error))throw error;refuse();}
   finally{try{await response?.body?.cancel();}catch{}life.close();}
  }});
 }});
}
