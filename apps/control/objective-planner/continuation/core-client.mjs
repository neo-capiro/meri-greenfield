/** Actual fixed Core receiver client. Genuine transport credentials come only from the configured trusted owner; default disabled. */
import {types} from 'node:util';
import {own,data,fail,continuationWork,corePlannerRequest,corePlannerRequestSha256,creationObservation,OPERATION,APPLICATIONS_PATH} from './contract.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ProductError} from '../../product-access/errors.mjs';
import {jsonBody} from '../../action-application/http.mjs';
const getters=Object.fromEntries(['status','headers','body','redirected'].map(k=>[k,Object.getOwnPropertyDescriptor(Response.prototype,k).get]));
function cancel(response){try{if(response instanceof Response&&!types.isProxy(response))Promise.resolve(getters.body.call(response)?.cancel()).catch(()=>{});}catch{}}
export function createCoreCanonicalPlannerClient({origin,fetchImpl,authorization,enabled=false,now=Date.now,maxRequestMs=3000,maxFactBytes=1048576}){
 let base;try{base=new URL(origin);}catch{fail('CONFIGURATION');}
 if(base.protocol!=='https:'||base.pathname!=='/'||base.username||base.password||base.search||base.hash||typeof fetchImpl!=='function'||typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxFactBytes)||maxFactBytes<1||maxFactBytes>16777216)fail('CONFIGURATION');
 const available=()=>enabled&&typeof authorization?.readCredential==='function';
 async function request(mode,value){
  const {work:raw,deadlineMs,signal}=own(value,['work','deadlineMs'],['signal']),w=continuationWork(raw);nativeSignal(signal);if(!Number.isSafeInteger(deadlineMs))fail('CONFIGURATION');
  if(!available())return {kind:'unavailable'};
  let cutoff=Math.min(deadlineMs,now()+maxRequestMs);const life=createOperationLifetime({now,signal,deadlineMs:cutoff,errorFactory:()=>new ProductError('OBJECTIVE_PLANNER_CORE_UNKNOWN','UNKNOWN')});let response;
  async function credential(phase){const began=now(),a=data(own(await life.run(signal=>authorization.readCredential({operation:OPERATION,phase,work:w,requestSha256:corePlannerRequestSha256(w),signal,deadlineMs:cutoff})),['credential','actorUserId','tenantId','requestSha256','checkedAtMs','expiresAtMs']));
   if(typeof a.credential!=='string'||!/^\S{1,8192}$/u.test(a.credential)||a.actorUserId!==w.actorUserId||a.tenantId!==w.canonical.tenantId||a.requestSha256!==corePlannerRequestSha256(w)||!Number.isSafeInteger(a.checkedAtMs)||a.checkedAtMs<began||a.checkedAtMs>now()||!Number.isSafeInteger(a.expiresAtMs)||a.expiresAtMs<=now())fail('ACCESS_DENIED');
   cutoff=Math.min(cutoff,a.expiresAtMs);life.limitDeadline(cutoff);return a.credential;
  }
  try{
   const secret=await credential(mode),method=mode==='prepare'?'POST':'GET',body=mode==='prepare'?JSON.stringify(corePlannerRequest(w)):undefined;
   if(body&&Buffer.byteLength(body)>maxFactBytes)fail('INVALID_RECEIPT');
   response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(base.origin+APPLICATIONS_PATH+(mode==='read'?'/'+w.applicationRequestId:''),{method,redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+secret,accept:'application/json',...(body?{'content-type':'application/json'}:{})},...(body?{body}:{}),signal}));pending.then(r=>{if(life.signal.aborted)cancel(r);},()=>{});return pending;});life.check();
   if(!response||types.isProxy(response)||!(response instanceof Response)||getters.redirected.call(response))fail('INVALID_RECEIPT');
   // Denial/missing ACK is uncertainty. In particular404/503 never grants another prepare.
   if(getters.status.call(response)!==(method==='POST'?201:200))return {kind:'unavailable'};
   const headers=getters.headers.call(response),header=k=>Headers.prototype.get.call(headers,k),length=header('content-length');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding'))||length!==null&&!/^(0|[1-9][0-9]{0,15})$/u.test(length))fail('INVALID_RECEIPT');
   const raw=await jsonBody({body:getters.body.call(response),length:length===null?null:Number(length)},maxFactBytes,life,life.check),result=creationObservation(raw,w);
   // Read authority can be fresh after old consent expiry; never extend the write grant or substitute a model/budget lifetime.
   await credential('read');life.check();return result;
  }catch{return {kind:'unavailable'};}finally{cancel(response);life.close();}
 }
 return Object.freeze({available,inspect:value=>request('read',value),prepare:value=>request('prepare',value)});
}
