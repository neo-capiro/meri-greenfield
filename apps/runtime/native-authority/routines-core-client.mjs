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
import {markAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {SCHEDULED_MERI_INBOX_DESTINATION} from '../../control/schedules/scheduled-conversation-currentness.mjs';

export const ROUTINES_CORE_ROUTES=Object.freeze({policy:'/api/clio/routines/policy/check',managementCurrent:'/api/clio/routines/management/current',managementPolicy:'/api/clio/routines/management/policy/check',cancellationProof:'/api/clio/routines/cancellation-proof',unattendedGrant:'/api/clio/routines/unattended-grant',current:'/api/internal/routines/current',reads:'/api/internal/routines/reads',consentObservation:'/api/internal/routines/consent',consentRenewal:'/api/clio/routines/consent/renew'});
const FIRE_PHASES=['before_admission','before_start','before_stop'],HEX64=/^[a-f0-9]{64}$/u;
/** MR-04 wire D answer, closed: the exact eleven members `meri-routine-consent-observation.ts` answers with. */
const CONSENT_STATES=['active','expired','revoked','absent'],CONSENT_CAUSES=['revocation','membership','client-scope'];
const CONSENT_OBSERVATION_KEYS=['schemaVersion','state','pinsMatched','observedAtMs','generation','consentGeneration','issuedAtMs','expiresAtMs','scopeCount','cause','rightsSha256'];
/** MR-04 wire E answer, closed: `meri-routines.service.ts` consentRenew's own eight members. */
const CONSENT_RENEWAL_KEYS=['schemaVersion','state','generation','policyRevision','issuedAtMs','expiresAtMs','observedAtMs','idempotent'];
/** A renewal re-issues the saved read consent; it is never a cancellation. */
const RENEWAL_OPERATIONS=['schedule_task','update_scheduled_task'];
/** Core's receipt ceiling: Meri's own request bound (`maxRequestMs` ≤ 30000 across the routines owners). */
export const ROUTINE_RECEIPT_MAX_MS=30000;
const RECEIPT_KEYS=['authorized','selectionSha256','binding','scopes','selectedClientId','destinationResolution','limits','checkedAtMs','expiresAtMs'];
const LIMIT_KEYS=['maxCostMicrousd','maxRuntimeSeconds','retryLimit'],OPERATIONS=['schedule_task','update_scheduled_task','list_scheduled_tasks','cancel_scheduled_task'];
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const JWS=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const same=(a,b)=>hash(a)===hash(b),sha=value=>createHash('sha256').update(value).digest('hex');
/** A fault carries the client's own custody evidence: `dispatched` is true once the request has actually been issued, and
 * `received` is true only when Core's own answer decided the verdict. A caller that holds a durable slot must treat a
 * dispatched-but-undecided fault as unresolved (UNKNOWN), never as a definite refusal. */
const fault=(code,evidence)=>Object.assign(Error('ROUTINES_CORE_'+code),{code:'ROUTINES_CORE_'+code,dispatched:evidence?.dispatched===true,received:evidence?.received===true});
const refuse=(code,evidence)=>{throw fault(code,evidence);};
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
 let c,origin,nativeCredentialFor,managementCredentialFor;
 try{
  c=own(configuration,['origin','getServiceSecret','now'],['nativeCredentials','managementCredentials','fetchImpl','maxRequestMs']);origin=retainedOrigin(c.origin);
  // The relay port (read-credential-relay.mjs) or the action-session owner itself: only its own `nativeCredentialFor` is borrowed.
  // Absent (the schedule worker has no sessions), the attended wires refuse and only the service-identity wire C is reachable.
  if(c.nativeCredentials!==undefined){
   if(!c.nativeCredentials||typeof c.nativeCredentials!=='object'||types.isProxy(c.nativeCredentials))throw Error();
   const method=Object.getOwnPropertyDescriptor(c.nativeCredentials,'nativeCredentialFor');if(!method||!Object.hasOwn(method,'value'))throw Error();nativeCredentialFor=method.value;
  }
  if(c.managementCredentials!==undefined){const port=own(c.managementCredentials,['nativeCredentialFor']);managementCredentialFor=port.nativeCredentialFor;if(typeof managementCredentialFor!=='function'||types.isProxy(managementCredentialFor))throw Error();}
  for(const fn of [nativeCredentialFor??(()=>{}),c.getServiceSecret,c.now,c.fetchImpl??globalThis.fetch])if(typeof fn!=='function'||types.isProxy(fn))throw Error();
  if(c.maxRequestMs!==undefined&&(!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000))throw Error();
 }catch{throw Object.assign(Error('ROUTINES_CONFIGURATION'),{code:'ROUTINES_CONFIGURATION'});}
 const now=c.now,fetchImpl=c.fetchImpl??globalThis.fetch,maxRequestMs=c.maxRequestMs??10000;
 function session(raw){
  let s;try{s=data(own(raw,['binding','selectedClientId']));validateShape('RunBinding',s.binding);}catch{refuse('REQUEST');}
  if(s.selectedClientId!==null&&(typeof s.selectedClientId!=='string'||!UUID.test(s.selectedClientId)))refuse('REQUEST');return s;
 }
 /** One live-session lookup: the exact run binding and selected client, a well-formed token, unexpired. */
 function bearer(selected,signal){
  if(selected.bootstrapCredential!==undefined){if(typeof selected.bootstrapCredential!=='string'||!TOKEN.test(selected.bootstrapCredential))refuse('REQUEST');return {credential:selected.bootstrapCredential,expiresAtMs:Number.MAX_SAFE_INTEGER};}
  if(selected.managementAuthentication!==undefined){
   let issued;try{if(!managementCredentialFor)throw Error();issued=data(own(managementCredentialFor({authentication:selected.managementAuthentication,signal}),['credential','expiresAtMs']));}catch{refuse('SESSION_UNAVAILABLE');}
   if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('SESSION_UNAVAILABLE');return issued;
  }
  if(nativeCredentialFor===undefined)refuse('SESSION_UNAVAILABLE');
  let issued;try{issued=data(own(Reflect.apply(nativeCredentialFor,c.nativeCredentials,[{binding:selected.binding,selectedClientId:selected.selectedClientId,...(signal===undefined?{}:{signal})}]),['credential','expiresAtMs']));}catch{refuse('SESSION_UNAVAILABLE');}
  if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('SESSION_UNAVAILABLE');
  return issued;
 }
 async function post(route,{selected,body,signal,deadlineMs,maxResponseBytes}){
  let life,acquired,dispatched=false;
  try{
   const began=now();if(!Number.isSafeInteger(began))refuse('UNAVAILABLE');
   // The lifetime's own faults carry the same dispatch evidence: a deadline that trips after the request was issued
   // must not look like a pre-dispatch local refusal.
   life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs??Infinity,began+maxRequestMs),errorFactory:code=>fault(code,{dispatched})});
   // `selected === null` is the service-identity-only call (wire C): no user bearer exists for an unattended occurrence.
   const first=selected===null?null:bearer(selected,signal);if(first)life.limitDeadline(first.expiresAtMs);
   const secret=await life.run(()=>c.getServiceSecret());
   if(typeof secret!=='string'||!TOKEN.test(secret)||secret===first?.credential)refuse('UNAVAILABLE');
   // The secret read is an await: the same session must still be live (not expired, revoked or replaced).
   if(first&&bearer(selected,signal).credential!==first.credential)refuse('SESSION_UNAVAILABLE');
   const started=now();
   // Everything below this line is DISPATCHED: from here on a fault without a received verdict says nothing about
   // whether Core acted, and a durable caller must keep its slot unresolved rather than record a refusal.
   dispatched=true;
   acquired=await life.run(s=>{const pending=Promise.resolve(fetchImpl(origin+route,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:s,
    headers:{...(first?{authorization:'Bearer '+first.credential}:{}),'x-internal-service-secret':secret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(body)}));
    pending.then(r=>{if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;});
   if(!(acquired instanceof Response)||types.isProxy(acquired))refuse('INVALID_RESULT',{dispatched:true});
   if(acquired.status!==200){const decided=[400,401,403,409].includes(acquired.status);refuse(decided?'REFUSED':'UNAVAILABLE',{dispatched:true,received:decided});}
   const value=await readJsonResponse(acquired,{lifetime:life,maxResponseBytes});
   const last=first?bearer(selected,signal):null;if(first&&last.credential!==first.credential)refuse('SESSION_UNAVAILABLE',{dispatched:true});life.check();
   return {value,started,sessionExpiresAtMs:first?Math.min(first.expiresAtMs,last.expiresAtMs):Infinity};
  }catch(error){throw owned(error)?error:fault(['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'UNAVAILABLE',{dispatched});}
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
 function managementCurrentShape(value){
  const r=data(own(value,['kind','principal','scopes','selectedClientId','membershipRevision','contextRevision']));validateShape('Identity',r.principal);
  if(r.kind!=='routine-management'||!Array.isArray(r.scopes)||r.scopes.length!==1||r.selectedClientId!==null&&!UUID.test(r.selectedClientId)||!HEX64.test(r.membershipRevision)||!HEX64.test(r.contextRevision))refuse('INVALID_RESULT');
  const scope=r.scopes[0];validateShape('Scope',scope);
  if(scope.tenantId!==r.principal.tenantId||scope.kind!==(r.selectedClientId===null?'private-user':'client')||scope.resourceId!==(r.selectedClientId??r.principal.actorId)||
   r.contextRevision!==hash({kind:r.kind,principal:r.principal,scopes:r.scopes,selectedClientId:r.selectedClientId,membershipRevision:r.membershipRevision}))refuse('INVALID_RESULT');return r;
 }
 function managementTimes(r,answer){
  if(!Number.isSafeInteger(r.checkedAtMs)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=r.checkedAtMs||r.expiresAtMs-r.checkedAtMs>ROUTINE_RECEIPT_MAX_MS)refuse('INVALID_RESULT');
  const checkedAtMs=now(),expiresAtMs=Math.min(answer.started+r.expiresAtMs-r.checkedAtMs,answer.sessionExpiresAtMs);
  if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<answer.started||expiresAtMs<=checkedAtMs)refuse('EXPIRED');return {checkedAtMs,expiresAtMs};
 }
 /** Initial management admission uses the actual signed-in bearer. It never asks for or resolves a run. */
 async function managementCurrent(value){
  let v;try{v=own(value,['credential','clientId','policyRevision','deadlineMs'],['signal']);nativeSignal(v.signal);
   if(v.clientId!==null&&!UUID.test(v.clientId)||typeof v.policyRevision!=='string'||!v.policyRevision||v.policyRevision.length>256||!Number.isSafeInteger(v.deadlineMs))throw Error();
  }catch{refuse('REQUEST');}
  const answer=await post(ROUTINES_CORE_ROUTES.managementCurrent,{selected:{bootstrapCredential:v.credential},body:{clientId:v.clientId,policyRevision:v.policyRevision},signal:v.signal,deadlineMs:v.deadlineMs,maxResponseBytes:16384}).catch(error=>{if(['ROUTINES_CORE_UNAVAILABLE','ROUTINES_CORE_DEADLINE'].includes(error?.code))markAuthorityUnavailable(error);throw error;});
  try{const r=data(own(answer.value,['kind','principal','scopes','selectedClientId','membershipRevision','contextRevision','checkedAtMs','expiresAtMs'])),{checkedAtMs,expiresAtMs,...raw}=r,current=managementCurrentShape(raw);
   if(current.selectedClientId!==v.clientId||current.scopes[0].policyRevision!==v.policyRevision)refuse('REFUSED');return data({...current,...managementTimes(r,answer)});
  }catch(error){throw owned(error)?error:fault('INVALID_RESULT');}
 }
 /** The exact fresh management session relays the bearer only for this closed list/future-cancellation policy. */
 async function managementPolicyCheck(value){
  let v,s,current;try{v=own(value,['selection','selectionSha256','authentication'],['signal','limitDeadline']);nativeSignal(v.signal);s=data(own(v.selection,['phase','operation','request','currentSchedule','proposal','current','scheduleBinding']));current=managementCurrentShape(s.current);
   const a=data(v.authentication);if(a.kind!=='routine-management'||a.principal.tenantId!==current.principal.tenantId||a.principal.actorId!==current.principal.actorId||v.selectionSha256!==hash(s)||
    !(s.operation==='list_scheduled_tasks'||s.operation==='cancel_scheduled_task'&&['pause','delete'].includes(s.request.mode)&&s.request.running==='leave'&&Array.isArray(s.request.runs)&&s.request.runs.length===0))throw Error();
  }catch{refuse('REQUEST');}
  const answer=await post(ROUTINES_CORE_ROUTES.managementPolicy,{selected:{managementAuthentication:v.authentication},body:{selection:s,selectionSha256:v.selectionSha256},signal:v.signal,maxResponseBytes:65536});
  try{const r=data(own(answer.value,['authorized','selectionSha256','current','destinationResolution','limits','checkedAtMs','expiresAtMs']));
   if(r.authorized!==true||r.selectionSha256!==v.selectionSha256||!same(r.current,current)||r.destinationResolution!==null||r.limits!==null)refuse('REFUSED');
   return data({...r,...managementTimes(r,answer)});
  }catch(error){throw owned(error)?error:fault('INVALID_RESULT');}
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
 /** Wire C (unattended, D016-A item 5; Core route proposed, absent at 32cf3ca7 → UNAVAILABLE). Service identity only: Core answers
  * from the owner's stored signed-in consent and current membership, never from a user bearer. Returns `{grant, jti, requestedAtMs}`;
  * the grant is verified and bound by routines-firing-authority.mjs. 403 (no consent, paused/deleted, membership or scope change)
  * is REFUSED; a missing route, 5xx or malformed answer is UNAVAILABLE. */
 async function unattendedGrant(value){
  let v;try{const {signal,...rest}=own(value,['tenantId','ownerActorId','scheduleId','generation','intentSha256','projectionSha256','occurrenceKey','phase','deadlineMs'],['signal']);nativeSignal(signal);v={...data(rest),signal};}catch{refuse('REQUEST');}
  if(typeof v.tenantId!=='string'||!v.tenantId||typeof v.ownerActorId!=='string'||!v.ownerActorId||!UUID.test(v.scheduleId)||!Number.isSafeInteger(v.generation)||v.generation<1||
   [v.intentSha256,v.projectionSha256,v.occurrenceKey].some(d=>typeof d!=='string'||!HEX64.test(d))||!FIRE_PHASES.includes(v.phase)||!Number.isSafeInteger(v.deadlineMs))refuse('REQUEST');
  const {signal,deadlineMs,...body}=v;
  const answer=await post(ROUTINES_CORE_ROUTES.unattendedGrant,{selected:null,body,signal,deadlineMs,maxResponseBytes:16384});
  let r;try{r=data(own(answer.value,['grant','jti','expiresAtMs']));}catch{refuse('INVALID_RESULT');}
  if(typeof r.grant!=='string'||r.grant.length>8192||!JWS.test(r.grant)||typeof r.jti!=='string'||!UUID_V4.test(r.jti)||!Number.isSafeInteger(r.expiresAtMs))refuse('INVALID_RESULT');
  return data({grant:r.grant,jti:r.jti,requestedAtMs:answer.started});
 }
 /** Current native execution authority is selector-only and service-authenticated. Core owns
  * the canonical occurrence/execution/consent joins and current membership/client wall. */
 async function current(value){
  let v;try{const {signal,...rest}=own(value,['binding','scheduleId','occurrenceKey','deadlineMs'],['signal']);nativeSignal(signal);v={...data(rest),signal};validateShape('RunBinding',v.binding);}catch{refuse('REQUEST');}
  if(!UUID.test(v.scheduleId)||!HEX64.test(v.occurrenceKey)||!Number.isSafeInteger(v.deadlineMs))refuse('REQUEST');
  const answer=await post(ROUTINES_CORE_ROUTES.current,{selected:null,body:{schemaVersion:1,tenantId:v.binding.tenantId,scheduleId:v.scheduleId,occurrenceKey:v.occurrenceKey,binding:v.binding},signal:v.signal,deadlineMs:v.deadlineMs,maxResponseBytes:1048576});
  let r;try{r=data(own(answer.value,['schemaVersion','tenantId','actorId','clerkUserId','tenantSlug','role','scheduleId','occurrenceKey','generation','consentId','binding','scopes','clientIds','policyRevision','limits','checkedAtMs','effectExpiresAtMs']));
   r.scopes.forEach(s=>validateShape('Scope',s));own(r.limits,LIMIT_KEYS);
  }catch{refuse('INVALID_RESULT');}
  if(r.schemaVersion!==1||!same(r.binding,v.binding)||r.tenantId!==v.binding.tenantId||r.actorId!==v.binding.actorId||r.scheduleId!==v.scheduleId||r.occurrenceKey!==v.occurrenceKey||
   !Number.isSafeInteger(r.generation)||r.generation<1||!UUID.test(r.consentId)||['clerkUserId','tenantSlug','role','policyRevision'].some(k=>typeof r[k]!=='string'||!r[k])||
   !Array.isArray(r.scopes)||!r.scopes.length||r.scopes.some(s=>s.tenantId!==r.tenantId||s.policyRevision!==r.policyRevision)||
   !Array.isArray(r.clientIds)||r.clientIds.length>4096||r.clientIds.some(id=>!UUID.test(id))||new Set(r.clientIds).size!==r.clientIds.length||
   LIMIT_KEYS.some(k=>!Number.isSafeInteger(r.limits[k])||r.limits[k]<(k==='retryLimit'?0:1))||
   !Number.isSafeInteger(r.checkedAtMs)||!Number.isSafeInteger(r.effectExpiresAtMs)||r.effectExpiresAtMs<=r.checkedAtMs||r.effectExpiresAtMs<=now())refuse('INVALID_RESULT');
  return data({...r,checkedAtMs:now()});
 }
 /** Wire D (MR-04 visibility half). The private read of Core's own stored routine read consent for the exact pins the
  * caller already holds (`POST /api/internal/routines/consent`, InternalServiceGuard). Service identity ONLY
  * (`selected: null`): no user bearer exists for this read, none is resolved, and Core answers from its own rows under
  * its own database clock. The caller's fresh current scope/generation/retention authorization is the routines
  * application's, never this adapter's. A missing route, 5xx, 403 or malformed answer refuses, so the caller reports
  * an unknown rather than a fabricated absent consent. `pinsMatched: false` is passed through untouched: it is Core's
  * own statement that no stored row pins this request, which the caller must re-read, never read as `absent`. */
 async function consentObservation(value){
  let v;try{const {signal,...rest}=own(value,['tenantId','ownerActorId','scheduleId','generation','intentSha256','projectionSha256','deadlineMs'],['signal']);nativeSignal(signal);v={...data(rest),signal};}catch{refuse('REQUEST');}
  if(typeof v.tenantId!=='string'||!v.tenantId||typeof v.ownerActorId!=='string'||!v.ownerActorId||!UUID.test(v.scheduleId)||
   !Number.isSafeInteger(v.generation)||v.generation<1||[v.intentSha256,v.projectionSha256].some(d=>typeof d!=='string'||!HEX64.test(d))||!Number.isSafeInteger(v.deadlineMs))refuse('REQUEST');
  const {signal,deadlineMs,...body}=v;
  const answer=await post(ROUTINES_CORE_ROUTES.consentObservation,{selected:null,body:{schemaVersion:1,...body},signal,deadlineMs,maxResponseBytes:16384});
  let r;try{r=data(own(answer.value,CONSENT_OBSERVATION_KEYS));}catch{refuse('INVALID_RESULT',{dispatched:true});}
  const maybe=(key,ok)=>r[key]===null||Number.isSafeInteger(r[key])&&ok(r[key]);
  if(r.schemaVersion!==1||!CONSENT_STATES.includes(r.state)||typeof r.pinsMatched!=='boolean'||!Number.isSafeInteger(r.observedAtMs)||r.observedAtMs<0||r.generation!==v.generation||
   !maybe('consentGeneration',x=>x>=1)||!maybe('issuedAtMs',()=>true)||!maybe('expiresAtMs',()=>true)||!maybe('scopeCount',x=>x>=0)||
   (r.cause!==null&&!CONSENT_CAUSES.includes(r.cause))||(r.rightsSha256!==null&&(typeof r.rightsSha256!=='string'||!HEX64.test(r.rightsSha256)))||
   (r.state==='active'&&(r.pinsMatched!==true||r.rightsSha256===null||r.expiresAtMs===null||r.consentGeneration===null))||
   (r.state!=='active'&&r.rightsSha256!==null))refuse('INVALID_RESULT',{dispatched:true});
  return data(r);
 }
 /** Wire E (MR-04 renewal). The attended re-issue of the saved read consent for the owner's CURRENT UNCHANGED intent
  * (`POST /api/clio/routines/consent/renew`, ToolServiceSecretGuard + the current signed-in tenant context).
  * The caller supplies the IMMUTABLE INTENT BYTES it holds in the schedule owner's custody plus the fresh approval it
  * holds in its own durable custody; this adapter builds the exact wire-A `before_claim` envelope Core's canonical
  * `routineConsentEvent` consumes VERBATIM (it re-decides the intent/approval identity, the projection digests, the
  * scope equality, the single policy revision, the limits ceiling and the approval's own decision window), and it never
  * reconstructs an intent from digests. The proposal carries the intent-derived operation/proposalId/intentSha256/
  * projection; the instruction text and the request policy are not in the schedule owner's custody and are not part of
  * Core's consent binding, so they are sent as null rather than invented. `selected` is the same live-session selection
  * wire A uses (the owner's native bearer for the exact run, or the management session's own bearer). */
 async function consentRenewal(value){
  let v,selected,intent,approval;try{
   const {signal,...rest}=own(value,['tenantId','ownerActorId','intent','intentSha256','approval','deadlineMs'],['binding','selectedClientId','managementAuthentication','signal']);nativeSignal(signal);v={...data(rest),signal};
   intent=data(v.intent);approval=data(own(v.approval,['proposalId','commandSha256','decision','decidedAt','expiresAt','approver','policyRevision']));
   if(v.managementAuthentication!==undefined)selected={managementAuthentication:data(v.managementAuthentication)};
   else{validateShape('RunBinding',v.binding);selected=session({binding:v.binding,selectedClientId:v.selectedClientId});}
  }catch{refuse('REQUEST');}
  const owner={tenantId:v.tenantId,actorId:v.ownerActorId},projection=intent?.projection;
  if(typeof v.tenantId!=='string'||!v.tenantId||typeof v.ownerActorId!=='string'||!v.ownerActorId||!RENEWAL_OPERATIONS.includes(intent?.operation)||
   !UUID.test(intent?.intentId)||!Number.isSafeInteger(intent?.generation)||intent.generation<1||!projection||!UUID.test(projection.scheduleId)||
   !same(projection.owner,owner)||v.intentSha256!==hash(intent)||v.binding!==undefined&&(v.binding.tenantId!==owner.tenantId||v.binding.actorId!==owner.actorId)||
   !same(approval.approver,owner)||approval.proposalId!==intent.intentId||approval.commandSha256!==v.intentSha256||approval.decision!=='approved'||
   typeof approval.policyRevision!=='string'||!approval.policyRevision||!Number.isSafeInteger(v.deadlineMs))refuse('REQUEST');
  const decidedAt=typeof approval.decidedAt==='string'?Date.parse(approval.decidedAt):NaN,expiresAt=typeof approval.expiresAt==='string'?Date.parse(approval.expiresAt):NaN;
  if(!Number.isSafeInteger(decidedAt)||!Number.isSafeInteger(expiresAt)||decidedAt>now()||expiresAt<=now()||decidedAt>=expiresAt)refuse('REQUEST');
  const proposal={operation:intent.operation,status:'approval_required',proposalId:intent.intentId,intentSha256:v.intentSha256,taskInstruction:null,projection,policy:null,cancel:null};
  const call={intent,approval,callerIdentity:owner,deadlineMs:v.deadlineMs};
  const selection={phase:'before_claim',operation:intent.operation,proposal,scheduleBinding:{...call,bindingSha256:hash(call)}};
  const answer=await post(ROUTINES_CORE_ROUTES.consentRenewal,{selected,body:{schemaVersion:1,selection},signal:v.signal,deadlineMs:v.deadlineMs,maxResponseBytes:16384});
  let r;try{r=data(own(answer.value,CONSENT_RENEWAL_KEYS));}catch{refuse('INVALID_RESULT',{dispatched:true});}
  if(r.schemaVersion!==1||!(r.state==='active'||r.state==='expired')||r.generation!==intent.generation||typeof r.policyRevision!=='string'||!r.policyRevision||
   typeof r.idempotent!=='boolean'||!Number.isSafeInteger(r.issuedAtMs)||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=r.issuedAtMs||
   !Number.isSafeInteger(r.observedAtMs)||(r.state==='active')!==(r.expiresAtMs>r.observedAtMs))refuse('INVALID_RESULT',{dispatched:true});
  return data(r);
 }
 return Object.freeze({origin,attended:nativeCredentialFor!==undefined,policyCheck,managementCurrent,managementPolicyCheck,cancellationProof,unattendedGrant,current,consentObservation,consentRenewal});
}
