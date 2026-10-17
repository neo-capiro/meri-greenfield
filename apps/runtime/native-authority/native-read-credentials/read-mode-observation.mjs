/** Fixed native chat-mode observation. Current grants and producer consumption remain separate owners. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertAuthorityIdentityReceipt} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {MODE_READ_OPERATIONS} from '../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {assertCorePrincipal,retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../../gateway/sources/json-response.mjs';
import {safeFailure} from '../../../gateway/dispatch/operation-result.mjs';

export const READ_MODE_MAX_REQUEST_MS=3000;
const MAX_RESPONSE_BYTES=4096,ROUTE='/api/clio/application-authority/read-mode-observation',SHA=/^[a-f0-9]{64}$/u;
const MODES=new Set(['off','shadow','enforce']),token=value=>typeof value==='string'&&/^[\x21-\x7e]{1,8192}$/u.test(value);
const refuse=code=>{throw nativeReadFault(code);},same=(a,b)=>hash(a)===hash(b);
const failure=error=>{const code=nativeReadFailureCode(error)??safeFailure(error).message;return nativeReadFault(code==='INTERNAL_ERROR'?'UNAVAILABLE':code);};
function operationRef(raw){
 const operation=data(own(raw,['id','version']));
 if(operation.version!=='0.2.0'||!MODE_READ_OPERATIONS.includes(operation.id))refuse('INVALID_ARGUMENTS');
 return operation;
}

/** Closed local projection, without a server-issued grant, revision, credential or wall permission. */
export function assertNativeReadModeObservation(raw,{started,now,operation,requestSha256,deadlineMs}){
 try{
  const v=data(own(raw,['principal','identityRevision','operation','requestSha256','evidenceAccuracyMode','checkedAtMs','expiresAtMs'])),expected=operationRef(operation);
  assertCorePrincipal(v.principal);operationRef(v.operation);const at=now();
  if(!Number.isSafeInteger(started)||started<0||!Number.isSafeInteger(at)||at<started||!Number.isSafeInteger(deadlineMs)||deadlineMs<=at||
   typeof requestSha256!=='string'||!SHA.test(requestSha256)||v.requestSha256!==requestSha256||!same(v.operation,expected)||
   typeof v.identityRevision!=='string'||!SHA.test(v.identityRevision)||!MODES.has(v.evidenceAccuracyMode)||
   !Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||v.expiresAtMs>deadlineMs)refuse('ACCESS_DENIED');
  return v;
 }catch{throw nativeReadFault('ACCESS_DENIED');}
}

/** Identity / bounded mode POST / identity. Borrowed authority ports are never disposed here. */
export function createReadModeObservationReader(configuration){
 let c,ports,origin;
 try{
  c=own(configuration,['available','now','maxRequestMs'],['origin','fetchImpl','authorityClient']);
  if(typeof c.available!=='boolean'||typeof c.now!=='function'||types.isProxy(c.now)||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>READ_MODE_MAX_REQUEST_MS)refuse('CONFIGURATION');
  origin=c.origin===undefined?undefined:retainedOrigin(c.origin);
  if(c.fetchImpl!==undefined&&(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)))refuse('CONFIGURATION');
  ports=c.authorityClient==null?null:own(c.authorityClient,['readIdentity'],['readContext']);
  if(ports&&(typeof ports.readIdentity!=='function'||types.isProxy(ports.readIdentity))||c.available&&(!origin||!c.fetchImpl||!ports))refuse('CONFIGURATION');
 }catch{throw nativeReadFault('CONFIGURATION');}
 const now=c.now;
 return async function readModeObservation(raw){let life,acquired;try{
  if(!c.available)refuse('UNAVAILABLE');let call,operation;
  try{call=own(raw,['credential','serviceSecret','operation','requestSha256','deadlineMs'],['signal']);nativeSignal(call.signal);operation=operationRef(call.operation);}catch{refuse('INVALID_ARGUMENTS');}
  if(!token(call.credential)||!token(call.serviceSecret)||typeof call.requestSha256!=='string'||!SHA.test(call.requestSha256)||!Number.isSafeInteger(call.deadlineMs))refuse('INVALID_ARGUMENTS');
  if(call.signal?.aborted)refuse('CANCELLED');const began=now();
  if(!Number.isSafeInteger(began)||began<0||!Number.isSafeInteger(began+c.maxRequestMs))refuse('ACCESS_DENIED');
  let cutoff=Math.min(call.deadlineMs,began+c.maxRequestMs);
  life=createOperationLifetime({now,deadlineMs:cutoff,signal:call.signal,errorFactory:nativeReadFault});
  async function identify(){
   const started=now(),raw=await life.run(signal=>ports.readIdentity({credential:call.credential,deadlineMs:cutoff,signal}));let receipt;
   try{
    receipt=assertAuthorityIdentityReceipt(data(raw));assertCorePrincipal(receipt.principal);const at=now();
    if(typeof receipt.identityRevision!=='string'||!SHA.test(receipt.identityRevision)||!Number.isSafeInteger(at)||at<started||receipt.checkedAtMs<started||receipt.checkedAtMs>at||receipt.expiresAtMs<=at)refuse('ACCESS_DENIED');
   }catch{refuse('ACCESS_DENIED');}
   cutoff=Math.min(cutoff,receipt.expiresAtMs);life.limitDeadline(cutoff);return receipt;
  }
  const before=await identify();
  acquired=await life.run(signal=>{
   const pending=Promise.resolve(c.fetchImpl(origin+ROUTE,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+call.credential,'x-internal-service-secret':call.serviceSecret,'x-meri-deadline-at':String(cutoff),'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify({operation,requestSha256:call.requestSha256}),signal}));
   pending.then(response=>{if(life.signal.aborted)try{cancelBody(responseBody(response));}catch{}},()=>{});return pending;
  });
  const body=responseBody(acquired);
  if(acquired.status<200||acquired.status>=300||acquired.redirected)refuse('UNAVAILABLE');
  const response=acquired.status===200?acquired:new Response(body,{status:200,headers:acquired.headers});
  const rawResult=await readJsonResponse(response,{lifetime:life,maxResponseBytes:MAX_RESPONSE_BYTES});let result;
  try{
   result=data(own(rawResult,['operation','requestSha256','principal','surface','evidenceAccuracyMode']));
   operationRef(result.operation);assertCorePrincipal(result.principal);
   if(result.surface!=='chat'||!MODES.has(result.evidenceAccuracyMode))refuse('INVALID_RESULT');
  }catch{refuse('INVALID_RESULT');}
  if(!same(result.operation,operation)||result.requestSha256!==call.requestSha256||!same(result.principal,before.principal))refuse('ACCESS_DENIED');
  const after=await identify();
  if(!same(before.principal,after.principal)||before.identityRevision!==after.identityRevision)refuse('ACCESS_DENIED');
  life.check();
  // The HTTP window is a transport budget, not a new lease for the enum. Existing native identity and caller bounds own fact expiry.
  return assertNativeReadModeObservation({principal:after.principal,identityRevision:after.identityRevision,operation,requestSha256:call.requestSha256,evidenceAccuracyMode:result.evidenceAccuracyMode,checkedAtMs:Math.min(before.checkedAtMs,after.checkedAtMs),expiresAtMs:Math.min(call.deadlineMs,before.expiresAtMs,after.expiresAtMs)},{started:began,now,operation,requestSha256:call.requestSha256,deadlineMs:call.deadlineMs});
 }catch(error){throw failure(error);}finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}};
}
