/** Fixed native name/UUID selection; current grants and selector use-time binding stay with CONTROL. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertAuthorityIdentityReceipt} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {assertCorePrincipal,retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../../gateway/sources/json-response.mjs';
import {safeFailure} from '../../../gateway/dispatch/operation-result.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,SHA=/^[a-f0-9]{64}$/u;
export const CLIENT_REFERENCE_MAX_REQUEST_MS=3000;
const MAX_REQUEST_MS=CLIENT_REFERENCE_MAX_REQUEST_MS,MAX_RESPONSE_BYTES=4096,ROUTE='/api/clio/clients/check-ref';
const refuse=code=>{throw nativeReadFault(code);};
const referenceValid=value=>typeof value==='string'&&value.length<=80&&value.trim().length>0;
const failure=error=>{const code=nativeReadFailureCode(error)??safeFailure(error).message;return nativeReadFault(code==='INTERNAL_ERROR'?'UNAVAILABLE':code);};

/** Local observation only: no native issuer, resource revision, wall grant or inferred absence. */
export function assertNativeClientReferenceObservation(raw,{started,now,reference}){
 try{
  const v=data(own(raw,['principal','identityRevision','reference','clientId','checkedAtMs','expiresAtMs']));
  assertCorePrincipal(v.principal);const at=now();
  if(!Number.isSafeInteger(started)||started<0||!Number.isSafeInteger(started+MAX_REQUEST_MS)||!Number.isSafeInteger(at)||at<started||
   !referenceValid(reference)||v.reference!==reference||!SHA.test(v.identityRevision)||typeof v.clientId!=='string'||!UUID.test(v.clientId)||
   !Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||v.expiresAtMs>started+MAX_REQUEST_MS)refuse('ACCESS_DENIED');
  return v;
 }catch{throw nativeReadFault('ACCESS_DENIED');}
}

/** Identity / bounded native selection / identity. The borrowed authority client is never closed here. */
export function createClientReferenceReader(configuration){
 let c,ports,origin;
 try{
  c=own(configuration,['available','now','maxRequestMs'],['origin','fetchImpl','authorityClient']);
  if(typeof c.available!=='boolean'||typeof c.now!=='function'||types.isProxy(c.now)||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>MAX_REQUEST_MS)refuse('CONFIGURATION');
  origin=c.origin===undefined?undefined:retainedOrigin(c.origin);
  if(c.fetchImpl!==undefined&&(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)))refuse('CONFIGURATION');
  ports=c.authorityClient==null?null:own(c.authorityClient,['readIdentity'],['readContext']);
  if(ports&&(typeof ports.readIdentity!=='function'||types.isProxy(ports.readIdentity))||c.available&&(!origin||!c.fetchImpl||!ports))refuse('CONFIGURATION');
 }catch{throw nativeReadFault('CONFIGURATION');}
 const now=c.now;
 return async function readClientReference(raw){let life,acquired;try{
  if(!c.available)refuse('UNAVAILABLE');let call;
  try{call=own(raw,['credential','reference','deadlineMs'],['signal']);nativeSignal(call.signal);}catch{refuse('INVALID_ARGUMENTS');}
  if(typeof call.credential!=='string'||!/^\S{1,8192}$/u.test(call.credential)||!referenceValid(call.reference)||!Number.isSafeInteger(call.deadlineMs))refuse('INVALID_ARGUMENTS');
  if(call.signal?.aborted)refuse('CANCELLED');const began=now();
  if(!Number.isSafeInteger(began)||began<0||!Number.isSafeInteger(began+c.maxRequestMs))refuse('ACCESS_DENIED');
  let cutoff=Math.min(call.deadlineMs,began+c.maxRequestMs);
  life=createOperationLifetime({now,deadlineMs:cutoff,signal:call.signal,errorFactory:nativeReadFault});
  async function identify(){
   const started=now(),raw=await life.run(signal=>ports.readIdentity({credential:call.credential,deadlineMs:cutoff,signal}));let receipt;
   try{
    receipt=assertAuthorityIdentityReceipt(data(raw));assertCorePrincipal(receipt.principal);const at=now();
    if(!SHA.test(receipt.identityRevision)||!Number.isSafeInteger(at)||at<started||receipt.checkedAtMs<started||receipt.checkedAtMs>at||receipt.expiresAtMs<=at)refuse('ACCESS_DENIED');
   }catch{refuse('ACCESS_DENIED');}
   cutoff=Math.min(cutoff,receipt.expiresAtMs);life.limitDeadline(cutoff);return receipt;
  }
  const before=await identify();
  acquired=await life.run(signal=>{
   const pending=Promise.resolve(c.fetchImpl(origin+ROUTE,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+call.credential,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify({ref:call.reference}),signal}));
   pending.then(response=>{if(life.signal.aborted)try{cancelBody(responseBody(response));}catch{}},()=>{});return pending;
  });
  const body=responseBody(acquired);
  if(acquired.status<200||acquired.status>=300||acquired.redirected)refuse('UNAVAILABLE');
  // Nest POST normally returns201. Adapt status only, preserving the same bounded bytes/headers/stream.
  const response=acquired.status===200?acquired:new Response(body,{status:200,headers:acquired.headers});
  const result=data(await readJsonResponse(response,{lifetime:life,maxResponseBytes:MAX_RESPONSE_BYTES}));
  if(result?.ok===false){own(result,['ok','reason']);if(typeof result.reason!=='string')refuse('INVALID_RESULT');refuse('UNAVAILABLE');}
  own(result,['ok','clientId']);if(result.ok!==true||typeof result.clientId!=='string'||!UUID.test(result.clientId))refuse('INVALID_RESULT');
  const after=await identify();
  if(hash(before.principal)!==hash(after.principal)||before.identityRevision!==after.identityRevision)refuse('ACCESS_DENIED');
  life.check();
  return assertNativeClientReferenceObservation({principal:after.principal,identityRevision:after.identityRevision,reference:call.reference,clientId:result.clientId,checkedAtMs:Math.min(before.checkedAtMs,after.checkedAtMs),expiresAtMs:cutoff},{started:began,now,reference:call.reference});
 }catch(error){throw failure(error);}finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}};
}
