/** CONTROL-only fixed native authority/issuer client. No ambient credential or service-secret fallback. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin,retainedRoutes,retainedOperation,assertCoreRetainedSelector,assertRetainedPrincipalEnvelope} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createCapiroApplicationAuthorityClient} from '../../../control/action-host/application-adapters/authority-http.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../../gateway/sources/json-response.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const TOKEN=/^\S{1,8192}$/u;
function bearerOf(value,now){
 if(typeof value==='string'){
  if(!TOKEN.test(value))throw nativeReadFault('UNAVAILABLE');
  return {credential:value,expiresAtMs:null}; // Legacy explicit caller; no claimed session expiry.
 }
 let bearer;try{bearer=own(value,['credential','expiresAtMs']);}catch{throw nativeReadFault('UNAVAILABLE');}
 if(typeof bearer.credential!=='string'||!TOKEN.test(bearer.credential)||
  !Number.isSafeInteger(bearer.expiresAtMs)||bearer.expiresAtMs<=now())throw nativeReadFault('UNAVAILABLE');
 return bearer;
}
export function createCoreRetainedAuthorityClient(configuration={}){
 const c=own(configuration,[],['origin','getNativeCredential','fetchImpl','now','maxRequestMs','enabled']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,enabled=c.enabled??false;
 if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)throw nativeReadFault('CONFIGURATION');
 const ready=Boolean(enabled&&c.origin&&c.getNativeCredential&&c.fetchImpl),origin=c.origin===undefined?undefined:retainedOrigin(c.origin);
 if(c.getNativeCredential!==undefined&&(typeof c.getNativeCredential!=='function'||types.isProxy(c.getNativeCredential))||c.fetchImpl!==undefined&&(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)))throw nativeReadFault('CONFIGURATION');
 const identity=ready?createCapiroApplicationAuthorityClient({origin,fetchImpl:c.fetchImpl,now,limits:{maxRequestMs,maxResponseBytes:16384},enabled:true}):null;
 // The existing client takes limits, not a competing default client timeout.
 async function request(kind,raw){let life,acquired;try{
  if(!ready)throw nativeReadFault('UNAVAILABLE');const v=own(raw,kind==='identity'?['deadlineMs']:kind==='resource'?['operation','selector','deadlineMs']:['operation','request','context','originalExpiresAtMs','deadlineMs'],['signal']);nativeSignal(v.signal);
  if(!Number.isSafeInteger(v.deadlineMs))throw nativeReadFault('INVALID_ARGUMENTS');const cutoff=Math.min(v.deadlineMs,now()+maxRequestMs);life=createOperationLifetime({now,deadlineMs:cutoff,signal:v.signal,errorFactory:nativeReadFault});
  const bearer=bearerOf(await life.run(signal=>c.getNativeCredential({signal,deadlineMs:cutoff})),now);
  const deadlineMs=bearer.expiresAtMs===null?cutoff:Math.min(cutoff,bearer.expiresAtMs);life.limitDeadline(deadlineMs);
  if(kind==='identity'){
   const receipt=await life.run(signal=>identity.readIdentity({credential:bearer.credential,signal,deadlineMs}));life.check();
   return bearer.expiresAtMs===null?receipt:data({...receipt,expiresAtMs:Math.min(receipt.expiresAtMs,bearer.expiresAtMs)});
  }
  const operation=retainedOperation(v.operation),body=kind==='resource'?assertCoreRetainedSelector(operation,v.selector):data({schemaVersion:1,request:v.request,context:v.context,
   originalExpiresAtMs:bearer.expiresAtMs===null?v.originalExpiresAtMs:Math.min(v.originalExpiresAtMs,deadlineMs)});
  const cap=kind==='resource'?8192:2097152,bodyJson=JSON.stringify(body);if(Buffer.byteLength(bodyJson,'utf8')>cap)throw nativeReadFault('RESOURCE_LIMIT');
  acquired=await life.run(signal=>{const pending=Promise.resolve(c.fetchImpl(origin+retainedRoutes[operation.id][kind==='resource'?'authority':'issuer'],{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+bearer.credential,'content-type':'application/json',accept:'application/json','accept-encoding':'identity','x-meri-deadline-at':String(deadlineMs)},body:bodyJson,signal}));pending.then(r=>{if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;});
  const result=data(await readJsonResponse(acquired,{lifetime:life,maxResponseBytes:kind==='resource'?16384:8192}));life.check();
  if(kind==='issue'){
   const envelope=assertRetainedPrincipalEnvelope(result);
   if(bearer.expiresAtMs!==null&&envelope.originalExpiresAtMs>deadlineMs)throw nativeReadFault('ACCESS_DENIED');
   return envelope;
  }
  if(bearer.expiresAtMs===null)return result;
  if(!Number.isSafeInteger(result.expiresAtMs))throw nativeReadFault('ACCESS_DENIED');
  return data({...result,expiresAtMs:Math.min(result.expiresAtMs,bearer.expiresAtMs)});
 }finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}}
 return Object.freeze({available:ready,readIdentity:raw=>request('identity',raw),readResource:raw=>request('resource',raw),issue:raw=>request('issue',raw)});
}
