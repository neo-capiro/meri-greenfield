/** Core routines wires (capiro-backend PR #84 @32cf3ca7, docs/integration/MERI-ROUTINES-POLICY-AND-CANCELLATION-DRAFT.md; R0
 * meri-greenfield #121 6247017061). Both calls are ATTENDED: each carries the verified service identity
 * (`x-internal-service-secret`, Core ToolServiceSecretGuard) and the routine owner's own native bearer, resolved per call from the
 * live action session for the exact run and selected client (`nativeCredentialFor`, the RC1 option A relay: read-credential-relay.mjs
 * bound to the routines application's own sessions). No live session refuses; nothing falls back to another credential, and the
 * bearer is never cached past the call. The same session must still be live after Core answers.
 *
 * Wire A `policyCheck` is `context.policy.check` for apps/control/schedules/runtime-context.mjs `policy()`. Core answers exactly
 * the nine receipt members; this adapter re-checks that Core echoed the selection digest, binding, scopes and selected client,
 * that destination and limits are null for list/cancel, and that for create/update Core echoed `destinationReference` byte for
 * byte with `destinationId: 'meri-inbox'` and three integer limits (the allocation ceilings; runtime-context takes the min with
 * the request and the routine's own sealed allocation). Clocks: Meri stamps its OWN observation after the correlated fresh Core
 * answer (`checkedAtMs` = Meri now; `expiresAtMs` = Meri's pre-request instant + Core's lease length, ≤ 30 s, never past the
 * native session), so Core/Meri clock skew can neither extend nor backdate the receipt. policy() then validates it unchanged.
 *
 * Wire B `cancellationProof` asks Core for its proof that the owner approved stopping exactly these runs; the proof is verified
 * and consumed only by routines-run-control.mjs. Core answers only HTTP 200 JSON; every other answer refuses. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {SCHEDULED_MERI_INBOX_DESTINATION} from '../../control/schedules/scheduled-conversation-currentness.mjs';

export const ROUTINES_CORE_ROUTES=Object.freeze({policy:'/api/clio/routines/policy/check',cancellationProof:'/api/clio/routines/cancellation-proof'});
/** Core's receipt ceiling: Meri's own request bound (`maxRequestMs` ≤ 30000 across the routines owners). */
export const ROUTINE_RECEIPT_MAX_MS=30000;
const RECEIPT_KEYS=['authorized','selectionSha256','binding','scopes','selectedClientId','destinationResolution','limits','checkedAtMs','expiresAtMs'];
const LIMIT_KEYS=['maxCostMicrousd','maxRuntimeSeconds','retryLimit'],OPERATIONS=['schedule_task','update_scheduled_task','list_scheduled_tasks','cancel_scheduled_task'];
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const JWS=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const same=(a,b)=>hash(a)===hash(b),sha=value=>createHash('sha256').update(value).digest('hex');
const fault=code=>Object.assign(Error('ROUTINES_CORE_'+code),{code:'ROUTINES_CORE_'+code});
const refuse=code=>{throw fault(code);};
const owned=error=>typeof error?.code==='string'&&error.code.startsWith('ROUTINES_CORE_');
const tokenOf=bytes=>{const v=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;return v!==null&&TOKEN.test(v)?v:null;};

/** Service-secret getter: re-read per call (rotation without restart) and never equal, by digest, to a native candidate
 * credential file (Core #83: the marked control credential is accepted only at application-authority). Only digests are kept. */
export function createRoutinesServiceSecret(configuration){
 const c=own(configuration,['file','readSecret'],['reservedFiles']),reserved=data(c.reservedFiles??[]);
 if(typeof c.file!=='string'||!c.file||typeof c.readSecret!=='function'||types.isProxy(c.readSecret)||!Array.isArray(reserved)||reserved.some(path=>typeof path!=='string'||path===c.file))
  throw Object.assign(Error('ROUTINES_CONFIGURATION'),{code:'ROUTINES_CONFIGURATION'});
 let forbidden=null;
 return async function getServiceSecret(){
  try{
   if(forbidden===null){const digests=new Set();for(const path of reserved){const token=tokenOf(await c.readSecret(path));if(token===null)refuse('UNAVAILABLE');digests.add(sha(token));}forbidden=digests;}
   const token=tokenOf(await c.readSecret(c.file));if(token===null||forbidden.has(sha(token)))refuse('UNAVAILABLE');return token;
  }catch{refuse('UNAVAILABLE');}
 };
}

export function createRoutinesCoreClient(configuration){
 let c,origin,nativeCredentialFor;
 try{
  c=own(configuration,['origin','nativeCredentials','getServiceSecret','now'],['fetchImpl','maxRequestMs']);origin=retainedOrigin(c.origin);
  // The relay port (read-credential-relay.mjs) or the action-session owner itself: only its own `nativeCredentialFor` is borrowed.
  if(!c.nativeCredentials||typeof c.nativeCredentials!=='object'||types.isProxy(c.nativeCredentials))throw Error();
  const method=Object.getOwnPropertyDescriptor(c.nativeCredentials,'nativeCredentialFor');if(!method||!Object.hasOwn(method,'value'))throw Error();nativeCredentialFor=method.value;
  for(const fn of [nativeCredentialFor,c.getServiceSecret,c.now,c.fetchImpl??globalThis.fetch])if(typeof fn!=='function'||types.isProxy(fn))throw Error();
  if(c.maxRequestMs!==undefined&&(!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000))throw Error();
 }catch{throw Object.assign(Error('ROUTINES_CONFIGURATION'),{code:'ROUTINES_CONFIGURATION'});}
 const now=c.now,fetchImpl=c.fetchImpl??globalThis.fetch,maxRequestMs=c.maxRequestMs??10000;
 function session(raw){
  let s;try{s=data(own(raw,['binding','selectedClientId']));validateShape('RunBinding',s.binding);}catch{refuse('REQUEST');}
  if(typeof s.selectedClientId!=='string'||!UUID.test(s.selectedClientId))refuse('REQUEST');return s;
 }
 /** One live-session lookup: the exact run binding and selected client, a well-formed token, unexpired. */
 function bearer(selected,signal){
  let issued;try{issued=data(own(Reflect.apply(nativeCredentialFor,c.nativeCredentials,[{binding:selected.binding,selectedClientId:selected.selectedClientId,...(signal===undefined?{}:{signal})}]),['credential','expiresAtMs']));}catch{refuse('SESSION_UNAVAILABLE');}
  if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('SESSION_UNAVAILABLE');
  return issued;
 }
 async function post(route,{selected,body,signal,deadlineMs,maxResponseBytes}){
  let life,acquired;
  try{
   const began=now();if(!Number.isSafeInteger(began))refuse('UNAVAILABLE');
   life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs??Infinity,began+maxRequestMs),errorFactory:code=>fault(code)});
   const first=bearer(selected,signal);life.limitDeadline(first.expiresAtMs);
   const secret=await life.run(()=>c.getServiceSecret());
   if(typeof secret!=='string'||!TOKEN.test(secret)||secret===first.credential)refuse('UNAVAILABLE');
   // The secret read is an await: the same session must still be live (not expired, revoked or replaced).
   if(bearer(selected,signal).credential!==first.credential)refuse('SESSION_UNAVAILABLE');
   const started=now();
   acquired=await life.run(s=>{const pending=Promise.resolve(fetchImpl(origin+route,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:s,
    headers:{authorization:'Bearer '+first.credential,'x-internal-service-secret':secret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(body)}));
    pending.then(r=>{if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;});
   if(!(acquired instanceof Response)||types.isProxy(acquired))refuse('INVALID_RESULT');
   if(acquired.status!==200)refuse([400,401,403,409].includes(acquired.status)?'REFUSED':'UNAVAILABLE');
   const value=await readJsonResponse(acquired,{lifetime:life,maxResponseBytes});
   const last=bearer(selected,signal);if(last.credential!==first.credential)refuse('SESSION_UNAVAILABLE');life.check();
   return {value,started,sessionExpiresAtMs:Math.min(first.expiresAtMs,last.expiresAtMs)};
  }catch(error){throw owned(error)?error:fault(['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'UNAVAILABLE');}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}
 }
 /** Wire A. `{selection, selectionSha256, signal, limitDeadline}` → the exact nine-member receipt runtime-context policy() reads. */
 async function policyCheck(value){
  let v,selection,s,current;
  try{
   v=own(value,['selection','selectionSha256'],['signal','limitDeadline']);nativeSignal(v.signal);selection=data(v.selection);
   s=own(selection,['phase','operation','request','currentSchedule','proposal','current','scheduleBinding']);current=data(own(s.current,['binding','scopes','selectedClientId']));
  }catch{refuse('REQUEST');}
  if(v.selectionSha256!==hash(selection)||!OPERATIONS.includes(s.operation))refuse('REQUEST');
  const mutation=s.operation==='schedule_task'||s.operation==='update_scheduled_task',reference=mutation?s.request?.destinationReference:null;
  if(mutation&&typeof reference!=='string')refuse('REQUEST');
  const selected=session({binding:current.binding,selectedClientId:current.selectedClientId});
  const answer=await post(ROUTINES_CORE_ROUTES.policy,{selected,body:{selection,selectionSha256:v.selectionSha256},signal:v.signal,maxResponseBytes:65536});
  let r;try{r=data(own(answer.value,RECEIPT_KEYS));}catch{refuse('INVALID_RESULT');}
  if(r.authorized!==true||r.selectionSha256!==v.selectionSha256||!same(r.binding,current.binding)||!same(r.scopes,current.scopes)||r.selectedClientId!==current.selectedClientId)refuse('REFUSED');
  if(mutation){
   let d,l;try{d=own(r.destinationResolution,['reference','destinationId']);l=own(r.limits,LIMIT_KEYS);}catch{refuse('INVALID_RESULT');}
   if(d.reference!==reference||d.destinationId!==SCHEDULED_MERI_INBOX_DESTINATION)refuse('REFUSED');
   if(LIMIT_KEYS.some(key=>!Number.isSafeInteger(l[key])||l[key]<(key==='retryLimit'?0:1)))refuse('INVALID_RESULT');
  }else if(r.destinationResolution!==null||r.limits!==null)refuse('INVALID_RESULT');
  if(!Number.isSafeInteger(r.checkedAtMs)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=r.checkedAtMs||r.expiresAtMs-r.checkedAtMs>ROUTINE_RECEIPT_MAX_MS)refuse('INVALID_RESULT');
  const checkedAtMs=now(),expiresAtMs=Math.min(answer.started+(r.expiresAtMs-r.checkedAtMs),answer.sessionExpiresAtMs);
  if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<answer.started||expiresAtMs<=checkedAtMs)refuse('EXPIRED');
  return data({authorized:true,selectionSha256:r.selectionSha256,binding:r.binding,scopes:r.scopes,selectedClientId:r.selectedClientId,
   destinationResolution:r.destinationResolution,limits:r.limits,checkedAtMs,expiresAtMs});
 }
 /** Wire B. `{attended, intent, intentSha256, decision, targets, signal, deadlineMs}` → `{proof, jti}` (unverified here). */
 async function cancellationProof(value){
  let v,intent,decision,targets,selected;
  try{
   v=own(value,['attended','intent','intentSha256','decision','targets','deadlineMs'],['signal']);nativeSignal(v.signal);
   intent=data(v.intent);decision=data(v.decision);targets=data(v.targets);selected=session(v.attended);
  }catch{refuse('REQUEST');}
  const owner={tenantId:selected.binding.tenantId,actorId:selected.binding.actorId};
  if(!Number.isSafeInteger(v.deadlineMs)||v.intentSha256!==hash(intent)||intent?.operation!=='cancel_scheduled_task'||!same(intent.projection?.owner,owner)||
   !Array.isArray(targets)||targets.length<1||targets.length>32||new Set(targets.map(hash)).size!==targets.length)refuse('REQUEST');
  for(const target of targets){try{validateShape('RunBinding',target);}catch{refuse('REQUEST');}if(target.tenantId!==owner.tenantId||target.actorId!==owner.actorId)refuse('REQUEST');}
  const answer=await post(ROUTINES_CORE_ROUTES.cancellationProof,{selected,body:{intent,intentSha256:v.intentSha256,decision,targets},signal:v.signal,deadlineMs:v.deadlineMs,maxResponseBytes:16384});
  let r;try{r=data(own(answer.value,['proof','jti','expiresAtMs']));}catch{refuse('INVALID_RESULT');}
  if(typeof r.proof!=='string'||r.proof.length>8192||!JWS.test(r.proof)||typeof r.jti!=='string'||!UUID_V4.test(r.jti)||!Number.isSafeInteger(r.expiresAtMs))refuse('INVALID_RESULT');
  return data({proof:r.proof,jti:r.jti});
 }
 return Object.freeze({origin,policyCheck,cancellationProof});
}
