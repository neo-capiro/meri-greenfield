/** Fixed-route Core transport for the artifact current-authority wire (POST /api/clio/application-authority/artifact). HTTPS origin
 * only, no redirect, no ambient credentials, no retry, no cache and no IO at construction. Each call sends the caller's native bearer
 * (RC1 option A: the user's live action-session token, resolved per call) plus the verified service identity header, and answers a
 * receipt only after a fresh, correlated, bounded Core response:
 *  - correlation: a fresh UUIDv4 `observationId` per call, echoed by Core; a replayed or cached body cannot match;
 *  - clock (dot, PR #121 6246551969 point 2): Meri's own observation instant after the response is read is the receipt's local
 *    `checkedAtMs` (so it always lies in [started, now]); Core's checkedAtMs/expiresAtMs are used only as a lifetime (their difference,
 *    at most 60 s) counted from Meri's pre-send instant, so transit time and clock skew can only shorten it.
 * Refusals carry closed codes (artifactAuthorityStatusCode); bodies, bearers and secrets never appear in an error. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {ARTIFACT_AUTHORITY_CONTRACT,ARTIFACT_AUTHORITY_ROUTE,MAX_RECEIPT_BYTES,assertArtifactAuthorityRequest,assertArtifactAuthorityReceipt,
 artifactAuthorityStatusCode,isArtifactAuthorityError,refuse,ArtifactAuthorityError} from './core-authority-wire.mjs';

const TOKEN=/^[\x21-\x7e]{1,8192}$/u,MAX_REQUEST_MS=10000;
/** A bare https origin (no path, credentials, query or fragment). */
export function artifactAuthorityOrigin(raw){
 let url;try{url=new URL(raw);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 if(typeof raw!=='string'||url.protocol!=='https:'||url.origin!==raw||url.username||url.password||url.search||url.hash||url.pathname!=='/')refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 return raw;
}
const lifeCode=code=>['DEADLINE','CANCELLED'].includes(code)?code:'UNAVAILABLE';

export function createCoreArtifactAuthorityClient(configuration){
 let c;try{c=own(configuration,['origin','fetchImpl','now'],['maxRequestMs','newObservationId']);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const origin=artifactAuthorityOrigin(c.origin),maxRequestMs=c.maxRequestMs??3000,newObservationId=c.newObservationId??randomUUID,{fetchImpl,now}=c;
 if(typeof fetchImpl!=='function'||types.isProxy(fetchImpl)||typeof now!=='function'||types.isProxy(now)||typeof newObservationId!=='function'||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>MAX_REQUEST_MS)refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 const url=new URL(ARTIFACT_AUTHORITY_ROUTE,origin).href;
 /** `{bearer, serviceSecret, request:{conversationId, clientId, intent, requestSha256}, deadlineMs, signal?}` ->
  * frozen `{receipt, request, startedAtMs, observedAtMs, localExpiresAtMs}`. */
 async function read(value){
  let life,acquired;
  try{
   let call;try{call=own(value,['bearer','serviceSecret','request','deadlineMs'],['signal']);nativeSignal(call.signal);}catch{refuse('ACCESS_DENIED');}
   if(!TOKEN.test(call.bearer??'')||!TOKEN.test(call.serviceSecret??'')||call.bearer===call.serviceSecret||!Number.isSafeInteger(call.deadlineMs))refuse('ACCESS_DENIED');
   let selected;try{selected=own(call.request,['conversationId','clientId','intent','requestSha256']);}catch{refuse('ACCESS_DENIED');}
   const request=assertArtifactAuthorityRequest({contract:ARTIFACT_AUTHORITY_CONTRACT,observationId:newObservationId(),...selected});
   if(call.signal?.aborted)refuse('CANCELLED');
   const startedAtMs=now();if(!Number.isSafeInteger(startedAtMs)||startedAtMs<0)refuse('UNAVAILABLE');
   const cutoff=Math.min(call.deadlineMs,startedAtMs+maxRequestMs);if(cutoff<=startedAtMs)refuse('DEADLINE');
   life=createOperationLifetime({deadlineMs:cutoff,now,signal:call.signal,errorFactory:code=>new ArtifactAuthorityError(lifeCode(code))});
   const response=await life.run(signal=>{
    const pending=Promise.resolve(fetchImpl(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:`Bearer ${call.bearer}`,'x-internal-service-secret':call.serviceSecret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},
     body:JSON.stringify(request)}));
    pending.then(r=>{acquired=r;if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;
   });
   acquired=response;
   if(!response||types.isProxy(response)||!(response instanceof Response))refuse('UNAVAILABLE');
   if(response.status!==200||response.redirected)refuse(response.redirected?'UNAVAILABLE':artifactAuthorityStatusCode(response.status));
   let parsed;try{parsed=await readJsonResponse(response,{lifetime:life,maxResponseBytes:MAX_RECEIPT_BYTES});}catch(error){if(isArtifactAuthorityError(error))throw error;refuse('ACCESS_DENIED');}
   const receipt=assertArtifactAuthorityReceipt(parsed,request);life.check();
   const observedAtMs=now();if(!Number.isSafeInteger(observedAtMs)||observedAtMs<startedAtMs)refuse('ACCESS_DENIED');
   const localExpiresAtMs=startedAtMs+(receipt.expiresAtMs-receipt.checkedAtMs);if(localExpiresAtMs<=observedAtMs)refuse('ACCESS_DENIED');
   return Object.freeze({receipt,request,startedAtMs,observedAtMs,localExpiresAtMs});
  }catch(error){if(isArtifactAuthorityError(error))throw error;refuse('UNAVAILABLE');}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}
 }
 return Object.freeze({origin,route:ARTIFACT_AUTHORITY_ROUTE,read});
}
