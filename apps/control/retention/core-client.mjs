/** Fixed backend-only Core retention operations. No user or runner credential. */
import {own,data,fail,uuid,subject,instant} from './boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../action-application/http.mjs';

const version='meri.conversation-retention.v1',unavailable=()=>Object.assign(Error('RETENTION_AUTHORITY_UNAVAILABLE'),{code:'RETENTION_AUTHORITY_UNAVAILABLE'});
export function createCoreRetentionClient({origin,getServiceSecret,fetchImpl=fetch,now=Date.now,maxRequestMs=3000}){
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.search||url.hash||
    typeof getServiceSecret!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||
    !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>10000)fail('RETENTION_CONFIGURATION');
 async function call(operation,input,{signal,deadlineMs=now()+maxRequestMs}={}){
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+maxRequestMs),errorFactory:unavailable});let response;
  try{
   const secret=await life.run(signal=>getServiceSecret({signal}));
   if(typeof secret!=='string'||secret.length<16||secret.length>8192||/[\s\x00-\x1f\x7f]/u.test(secret))throw unavailable();
   response=await life.run(signal=>fetchImpl(origin+'/api/internal/conversation-retention/'+operation,{
    method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{'content-type':'application/json',accept:'application/json','accept-encoding':'identity','x-internal-service-secret':secret},body:JSON.stringify(input)}));
   if(!(response instanceof Response)||response.status!==200||response.redirected||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get('content-type')??'')||
      ![null,'identity'].includes(response.headers.get('content-encoding')))throw unavailable();
   const length=response.headers.get('content-length');if(length!==null&&(!/^[0-9]+$/u.test(length)||Number(length)>16384))throw unavailable();
   const result=await jsonBody({body:response.body,length:length===null?null:Number(length)},16384,life,life.check);life.check();return data(result);
  }finally{try{void response?.body?.cancel().catch(()=>{});}catch{}life.close();}
 }
 async function read(raw,options){
  const s=subject(raw);if(s.kind!=='conversation'||!s.ownerActorId)throw unavailable();const started=now();
  const r=own(await call('read',{tenantId:s.tenantId,conversationId:s.subjectId},options),
   ['version','identity','status','revision','trashedAt','restoreUntil','trashRequestId','checkedAtMs']);
  const i=own(r.identity,['tenantId','conversationId','ownerActorId','bootstrapRequestId','scope']),scope=own(i.scope,['kind','clientId']);
  uuid(i.bootstrapRequestId);
  if(r.version!==version||i.tenantId!==s.tenantId||i.conversationId!==s.subjectId||i.ownerActorId!==s.ownerActorId||
     !['active','archived','trashed'].includes(r.status)||typeof r.revision!=='string'||!/^(0|[1-9][0-9]{0,17})$/u.test(r.revision)||
     !Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started-5000||r.checkedAtMs>now()+5000)throw unavailable();
  if(scope.kind==='general'){if(scope.clientId!==null)throw unavailable();}else if(scope.kind==='client')uuid(scope.clientId);else throw unavailable();
  if(r.status!=='trashed'){if(r.trashRequestId!==null||r.trashedAt!==null||r.restoreUntil!==null)throw unavailable();return r;}
  uuid(r.trashRequestId);const at=instant(r.trashedAt),until=instant(r.restoreUntil);
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(until)||until-at!==30*86400000||r.revision==='0')throw unavailable();
  return r;
 }
 async function completion(operation,raw,trash,options){
  const s=subject(raw);if(s.kind!=='conversation'||!s.ownerActorId)throw unavailable();
  uuid(trash?.requestId);
  if(typeof trash?.revision!=='string'||!/^([1-9][0-9]{0,17})$/u.test(trash.revision)||
     !Number.isSafeInteger(trash.restoreUntilMs)||trash.restoreUntilMs>now())throw unavailable();
  const input={tenantId:s.tenantId,conversationId:s.subjectId,ownerActorId:s.ownerActorId,requestId:trash.requestId,revision:trash.revision,restoreUntilMs:trash.restoreUntilMs};
  const r=own(await call(operation,input,options),['version','tenantId','conversationId','requestId','revision','erased',...(operation==='finalize'?['replayed']:[])]);
  if(r.version!==version||r.tenantId!==input.tenantId||r.conversationId!==input.conversationId||r.requestId!==input.requestId||
     r.revision!==input.revision||typeof r.erased!=='boolean'||
     operation==='finalize'&&(r.erased!==true||typeof r.replayed!=='boolean'))throw unavailable();return r;
 }
 return Object.freeze({read,finalize:(raw,trash,options)=>completion('finalize',raw,trash,options),
  verify:async(raw,trash,options)=>(await completion('verify',raw,trash,options)).erased});
}
