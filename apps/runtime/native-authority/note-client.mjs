/** Finite attended Core saved-note route. Core owns proposal creation, the effect and the receipt: this client
 *  only carries the closed request and validates the finite envelope Core returns. No token custody, retry,
 *  decision route or result cache. */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {savedNoteValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
const prefix='/api/clio/tools',token=/^[\x21-\x7e]{1,8192}$/u;
const refuse=(code='UNAVAILABLE',effect='none')=>{throw intentFault(code,effect);};
const sha=value=>createHash('sha256').update(value).digest('hex');
export function createNoteClient({origin,getCredentials,getServiceSecret,reservedCredentials,now,fetchImpl=globalThis.fetch,maxRequestMs=10000}){
 origin=retainedOrigin(origin);
 if([getCredentials,getServiceSecret,reservedCredentials,now,fetchImpl].some(fn=>typeof fn!=='function'))refuse();
 async function call(selection,method,path,body,effect=false){
  const life=createOperationLifetime({now,signal:selection.signal,deadlineMs:Math.min(selection.deadlineMs??Infinity,now()+maxRequestMs),errorFactory:code=>intentFault(code)});
  let acquired,sent=false;
  try{
   const forbidden=await life.run(()=>reservedCredentials());
   const borrow=async()=>{
    const c=data(own(await getCredentials({...selection,signal:life.signal}),['credential','expiresAtMs']));
    if(typeof c.credential!=='string'||!token.test(c.credential)||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now()||forbidden.has(sha(c.credential)))refuse('ACCESS_DENIED');
    life.limitDeadline(c.expiresAtMs);return c;
   };
   const first=await borrow(),secret=await life.run(()=>getServiceSecret());
   if(typeof secret!=='string'||!token.test(secret)||secret===first.credential||forbidden.has(sha(secret)))refuse();
   if((await borrow()).credential!==first.credential)refuse('ACCESS_DENIED');
   sent=true;
   acquired=await life.run(signal=>fetchImpl(origin+path,{method,redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{authorization:'Bearer '+first.credential,'x-internal-service-secret':secret,'x-meri-deadline-at':String(life.deadline()),accept:'application/json','accept-encoding':'identity',...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
   if(acquired?.redirected)refuse('UNAVAILABLE',effect?'unknown':'none');
   if(![200,201].includes(acquired?.status))refuse([401,403].includes(acquired?.status)?'ACCESS_DENIED':[400,404,409,422].includes(acquired?.status)?'REFUSED':'UNAVAILABLE',effect?'unknown':'none');
   const response=acquired.status===201?new Response(responseBody(acquired),{status:200,headers:acquired.headers}):acquired;
   const value=data(await readJsonResponse(response,{lifetime:life,maxResponseBytes:32768}));
   if((await borrow()).credential!==first.credential)refuse('ACCESS_DENIED',effect?'unknown':'none');
   life.check();return value;
  }catch(error){throw intentFault(['ACCESS_DENIED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','REFUSED'].includes(error?.code)?error.code:'UNAVAILABLE',sent&&effect?'unknown':'none');}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life.close();}
 }
 return Object.freeze({
  /** One save, in the caller's current attended context. A save is a static PASS, so this is never an
   *  approval request: the envelope returns the recorded outcome (saved/withheld/blocked/unknown/failed). */
  async prepare({binding,selectedClientId,request,signal,deadlineMs}){
   let closed;
   try{closed=validators.request(request);}catch{refuse('INVALID_ARGUMENTS');}
   const context={conversationId:binding.conversationId,selectedClientId};
   const result=validators.coreResult(await call({binding,selectedClientId,signal,deadlineMs},'POST',prefix+'/prepare_note_action',{version:1,context,request:closed},true),closed);
   if(result.context.conversationId!==context.conversationId||result.context.selectedClientId!==selectedClientId)refuse('REFUSED','unknown');
   return result;
  },
 });
}
