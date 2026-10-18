/** Core client for run-bound read delegation (option B). Fixed routes at the configured Core origin, closed JSON bodies of at
 * most 16 KiB, bounded responses, no redirects, cookies or caching. Every call carries the verified service identity (the Core
 * tool service secret, re-read per call); Core refuses a delegation route or delegated target without it (dot 6246089074 #3).
 * Bearer use is fixed per route: attended create and consent changes that widen authority carry the user's LIVE session;
 * token issue and revoke carry only the service identity; delegated targets carry one single-use `CapiroMeriRead` token.
 * Tokens, bearers and secrets are never logged, cached or persisted here. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../../gateway/sources/json-response.mjs';
import {safeFailure} from '../../../gateway/dispatch/operation-result.mjs';
import {READ_DELEGATION_LIMITS,READ_DELEGATION_ROUTES,READ_TOKEN_SCHEME,delegationRoute,consentRoute,isReadToken} from './contract.mjs';

const refuse=code=>{throw nativeReadFault(code);};
const BEARER=/^[\x21-\x7e]{1,8192}$/u;
/** A failure after which the request may have reached Core without Meri seeing the answer (network, timeout, 5xx). */
const lost=new WeakSet();
export const responseLost=error=>error!==null&&typeof error==='object'&&lost.has(error);
/** A fault after which Core may have committed without Meri seeing the answer; only these are retried (as retries). */
export const lostResponseFault=code=>{const error=nativeReadFault(code);lost.add(error);return error;};
const lostFault=lostResponseFault;
const STATUS=new Map([[401,'UNAVAILABLE'],[403,'ACCESS_DENIED'],[409,'ACCESS_DENIED'],[410,'UNAVAILABLE'],[429,'RESOURCE_LIMIT']]);
export const bodyBytes=value=>Buffer.from(JSON.stringify(value),'utf8');
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function createReadDelegationCoreClient(configuration){
 const c=own(configuration,['now'],['origin','fetchImpl','getServiceSecret','enabled','maxRequestMs']),now=c.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??READ_DELEGATION_LIMITS.maxRequestMs;
 if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>READ_DELEGATION_LIMITS.maxRequestMs)refuse('CONFIGURATION');
 for(const name of ['fetchImpl','getServiceSecret'])if(c[name]!==undefined&&(typeof c[name]!=='function'||types.isProxy(c[name])))refuse('CONFIGURATION');
 const origin=c.origin===undefined?undefined:retainedOrigin(c.origin),available=Boolean(enabled&&origin&&c.fetchImpl&&c.getServiceSecret);
 /** One bounded POST. `authorization` is the complete header value or absent. Returns the parsed 2xx JSON. */
 async function post({path,body,authorization,serviceSecret,headers={},signal,deadlineMs,maxResponseBytes=READ_DELEGATION_LIMITS.maxResponseBytes}){
  let life,acquired;
  try{
   if(!available)refuse('UNAVAILABLE');nativeSignal(signal);if(signal?.aborted)refuse('CANCELLED');
   if(typeof path!=='string'||!path.startsWith('/api/clio/')||!Number.isSafeInteger(deadlineMs))refuse('INVALID_ARGUMENTS');
   const bytes=Buffer.isBuffer(body)?body:bodyBytes(body);if(bytes.length>READ_DELEGATION_LIMITS.maxBodyBytes)refuse('RESOURCE_LIMIT');
   const secret=serviceSecret??await c.getServiceSecret({path});if(typeof secret!=='string'||!BEARER.test(secret))refuse('UNAVAILABLE');
   if(authorization!==undefined&&(typeof authorization!=='string'||authorization.includes(secret)))refuse('UNAVAILABLE');
   const cutoff=Math.min(deadlineMs,now()+maxRequestMs);life=createOperationLifetime({now,deadlineMs:cutoff,signal,errorFactory:nativeReadFault});
   try{
    acquired=await life.run(signal=>{const pending=Promise.resolve(c.fetchImpl(origin+path,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{...(authorization===undefined?{}:{authorization}),'x-internal-service-secret':secret,'x-meri-deadline-at':String(cutoff),...headers,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:bytes}));
     pending.then(response=>{if(life.signal.aborted)try{cancelBody(responseBody(response));}catch{}},()=>{});return pending;});
   }catch(error){if(signal?.aborted)refuse('CANCELLED');throw lostFault(nativeReadFailureCode(error)==='DEADLINE'?'DEADLINE':'UNAVAILABLE');}
   const status=acquired.status;
   if(status>=500)throw lostFault('UNAVAILABLE');
   if(status<200||status>=300||acquired.redirected)refuse(STATUS.get(status)??'UNAVAILABLE');
   const response=status===200?acquired:new Response(responseBody(acquired),{status:200,headers:acquired.headers});
   try{return data(await readJsonResponse(response,{lifetime:life,maxResponseBytes}));}
   catch(error){if(signal?.aborted)refuse('CANCELLED');throw lostFault(nativeReadFailureCode(error)??(safeFailure(error).message==='DEADLINE'?'DEADLINE':'UNAVAILABLE'));}
  }catch(error){if(responseLost(error))throw error;throw nativeReadFault(nativeReadFailureCode(error)??(safeFailure(error).message==='INTERNAL_ERROR'?'UNAVAILABLE':safeFailure(error).message));}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}
 }
 const live=credential=>{if(typeof credential!=='string'||!BEARER.test(credential))refuse('UNAVAILABLE');return `Bearer ${credential}`;};
 const delegated=token=>{if(!isReadToken(token))refuse('UNAVAILABLE');return `${READ_TOKEN_SCHEME} ${token}`;};
 return Object.freeze({available,origin,
  /** Attended: the user's live session (the `sid` path, as `identity`). Unattended: service identity plus the consent. */
  create:async({request,liveCredential,signal,deadlineMs})=>post({path:READ_DELEGATION_ROUTES.create,body:request,...(request.mode==='attended'?{authorization:live(liveCredential)}:{}),signal,deadlineMs}),
  issueToken:async({delegationId,request,signal,deadlineMs})=>post({path:delegationRoute(delegationId,'tokens'),body:request,signal,deadlineMs}),
  revoke:async({delegationId,reason,signal,deadlineMs})=>post({path:delegationRoute(delegationId,'revocations'),body:{schemaVersion:1,reason},signal,deadlineMs}),
  /** A delegated target: the exact body bytes the token was issued for, and that token. */
  target:async({path,body,token,serviceSecret,headers,signal,deadlineMs,maxResponseBytes})=>post({path,body,authorization:delegated(token),serviceSecret,headers,signal,deadlineMs,maxResponseBytes}),
  createConsent:async({request,liveCredential,signal,deadlineMs})=>post({path:READ_DELEGATION_ROUTES.consents,body:request,authorization:live(liveCredential),signal,deadlineMs}),
  /** Narrowing (pause, revoke) needs only the service identity; resuming widens authority and needs a live login. */
  setConsentState:async({consentId,state,liveCredential,signal,deadlineMs})=>{
   if(!['paused','revoked','active'].includes(state))refuse('INVALID_ARGUMENTS');
   return post({path:consentRoute(consentId),body:{schemaVersion:1,state},...(state==='active'?{authorization:live(liveCredential)}:{}),signal,deadlineMs});
  },
 });
}
