/** Bounded process-local opaque sessions. Identity and current authorization belong to injected owners. */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {types} from 'node:util';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {markAuthorityUnavailable,isAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const transitionKeys=['controlId','intent','inputSha256','sourceBinding','targetBinding','scopes','selectedClientId','policyRevision','admissionReceiptId','retirementReceiptId','checkpointId','checkpointSha256','sourceRequestSha256','contextSha256','targetSessionId','resumeSessionAt'];
const transitionFactKeys=[...transitionKeys,'state','admissionExpiresAtMs','retirementExpiresAtMs','targetExpiresAtMs','checkedAtMs','expiresAtMs'];
const transitionHash=v=>canonicalSha256(Object.fromEntries(transitionKeys.map(k=>[k,v[k]])));
const errors=new WeakSet();
// Private owner capability only: no facts are retained here and the strict public session port stays unchanged.
const currentReaders=new WeakMap();
/** Trusted load composition: each call to the reader performs one complete fresh observation. */
export const authenticatedCurrentState=owner=>currentReaders.get(owner);
const currentIssuers=new WeakMap();
const runBorrowers=new WeakMap();
/** Trusted in-process borrowing only. The caller must still authenticate/recheck; borrowing grants no authority. */
export const borrowedRunSession=owner=>runBorrowers.get(owner);
/** Trusted per-request composition (worker HTTP): issuance plus the binding, scopes and selected client its own complete resolve
 * just observed, so the caller can compare them without resolving the new session again. */
export const issuedCurrentState=owner=>currentIssuers.get(owner);
export class ActionSessionError extends Error{constructor(code){super(code);this.name='ActionSessionError';this.code=code;errors.add(this);}}
const deny=(code='SESSION_REFUSED')=>{throw new ActionSessionError(code);};
const REFUSAL_STEPS=new Set(['input','identity','membership-admit','context-preflight','initial-binding','run-select','current-run','context','membership-recheck','capacity','release']);
const REFUSAL_CODE=/^(?:SESSION|APPLICATION_CONTEXT|NATIVE_AUTHORITY|INITIAL_BINDING|INITIAL_RUN_BINDING|NEXT_RUN|NEXT_TURN|PREPARED_NEXT_RUN|PREPARED_CANDIDATE)_[A-Z0-9_]{1,48}$/u;
/** One line per refused issuance or recheck: the step it reached and an owned constant code. Never an identifier, credential or
 * message. At most `burst` lines per window; the first suppressed line in a window says so once. */
export function createSessionRefusalDiagnostics({write=line=>process.stderr.write(line),now=Date.now,burst=20,windowMs=60000}={}){
 let windowStart=-Infinity,count=0,suppressed=false;
 return (step,error)=>{try{const at=now();if(at-windowStart>=windowMs){windowStart=at;count=0;suppressed=false;}
  if(count>=burst){if(!suppressed){suppressed=true;write('CONTROL_SESSION_DIAGNOSTICS_SUPPRESSED\n');}return;}count++;
  const e=error!==null&&typeof error==='object'&&!types.isProxy(error)?error:{};   // never a trap on a hostile rejection
  const reason=[e.reason,e.code].find(code=>typeof code==='string'&&REFUSAL_CODE.test(code))??'REFUSED',where=REFUSAL_STEPS.has(e.step)?e.step:REFUSAL_STEPS.has(step)?step:'input';
  write(`CONTROL_SESSION_REFUSED step=${where} code=${reason}\n`);}catch{}};
}
// One minimal issuance wire owner, reused at construction and HTTP release.
export function assertActionSessionReceipt(value,at){
 const v=data(value);own(v,['credential','expiresAtMs','context']);own(v.context,['tenantId','actorId','conversationId','runId','selectedClientId']);
 if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||typeof v.credential!=='string'||!/^action_session_[A-Za-z0-9_-]{43}$/u.test(v.credential)||['tenantId','actorId'].some(k=>typeof v.context[k]!=='string'||!v.context[k]||v.context[k].length>256)||['conversationId','runId','selectedClientId'].some(k=>typeof v.context[k]!=='string'||!uuid.test(v.context[k]))||Buffer.byteLength(JSON.stringify(v))>4096)deny();
 return v;
}
export function createActionSessionOwner(configuration){
 const {mode,verifyIdentity,resolveContext,now=Date.now,limits,readTransition,resolveTransitionContext,membership,withAuthority,refusals=createSessionRefusalDiagnostics()}=own(configuration,['mode','verifyIdentity','resolveContext','limits'],['now','readTransition','resolveTransitionContext','membership','withAuthority','refusals']);
 const l=data(own(limits,['maxSessions','maxRequestMs','maxTtlMs','maxFactBytes']));
 if(mode!=='process-local'||typeof verifyIdentity!=='function'||typeof resolveContext!=='function'||typeof now!=='function'||Object.values(l).some(n=>!Number.isSafeInteger(n)||n<1)||l.maxSessions>1000||l.maxRequestMs>30000||l.maxTtlMs>300000||l.maxFactBytes>131072)deny('SESSION_CONFIGURATION');
 if(typeof refusals!=='function')deny('SESSION_CONFIGURATION');
 if(withAuthority!==undefined&&typeof withAuthority!=='function')deny('SESSION_CONFIGURATION');
 if((readTransition!==undefined||resolveTransitionContext!==undefined)&&(typeof readTransition!=='function'||typeof resolveTransitionContext!=='function'))deny('SESSION_CONFIGURATION');
 const member=membership===undefined?null:own(membership,['admit','recheck']);
 if(member!==null&&Object.values(member).some(method=>typeof method!=='function'))deny('SESSION_CONFIGURATION');
 const sessions=new Map(),ids=new Map(),credentials=new WeakMap();let closed=false;
 function active(signal){const at=now();if(closed||signal?.aborted||!Number.isSafeInteger(at)||at<0)deny();return at;}
 function remove(r){sessions.delete(r.digest);ids.delete(r.sessionId);credentials.delete(r);r.nativeCredential='';r.receipts.clear();}
 function valid(r,signal){const at=active(signal);if(!r||sessions.get(r.digest)!==r||ids.get(r.sessionId)!==r||r.expiresAtMs<=at) {if(r)remove(r);deny();}return at;}
 function release(r,t){t.check();valid(r,t.signal);t.check();}
 // A recheck re-verifies exactly the bound run: it names that conversation and run, so selection can never move or reserve a successor.
 function boundHints(r){return data({...r.hints,conversationId:r.context.binding.conversationId,runId:r.context.binding.runId});}
 function life(deadlineMs,signal){
  nativeSignal(signal);const at=active(signal);if(deadlineMs!==undefined&&!Number.isSafeInteger(deadlineMs))deny();let cutoff=Math.min(deadlineMs??at+l.maxRequestMs,at+l.maxRequestMs),requestCancellation;
  const timer=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:code=>{
   // Running out of this request's time is an owner that did not answer, not a refusal. Session expiry is decided by valid().
   if(code==='DEADLINE'&&!signal?.aborted)return markAuthorityUnavailable(new ActionSessionError('SESSION_AUTHORITY_UNAVAILABLE'));
   const error=new ActionSessionError('SESSION_REFUSED');if(code==='CANCELLED'&&signal?.aborted)requestCancellation??=error;return error;}});
  // Only this lifetime's winning caller cancellation can preserve a shared session.
  // A later caller abort cannot disguise an upstream refusal or an owner deadline.
  return {...timer,deadline:()=>cutoff,isRequestCancellation:error=>requestCancellation!==undefined&&signal?.aborted&&error===requestCancellation&&timer.signal.reason===error,limitDeadline(next){cutoff=Math.min(cutoff,next);timer.limitDeadline(cutoff);}};
 }
 // A definitive refusal removes the session. An identity, membership or context owner that did not answer (deadline, network,
 // 408/429/5xx) refuses only this request: the record keeps its pins and an expiry that only shortens, and every later request
 // must complete a fresh recheck before anything is released. An expired or removed record is still refused definitively.
 function rejectRecheck(record,t,error,progress){
  if(!t.isRequestCancellation(error))refusals(progress?.step,error);
  if(t.isRequestCancellation(error)){try{valid(record);}catch{remove(record);}deny();}
  if(isAuthorityUnavailable(error)){valid(record);throw markAuthorityUnavailable(new ActionSessionError('SESSION_AUTHORITY_UNAVAILABLE'));}
  remove(record);deny();
 }
 function fact(value,keys,started,t){const v=data(value);own(v,keys);if(Buffer.byteLength(JSON.stringify(v))>l.maxFactBytes)deny();const at=active(t.signal);t.check();if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)deny();t.limitDeadline(v.expiresAtMs);return v;}
 function hints(value){const v=data(value);own(v,[],['conversationId','runId','clientId']);if(Object.values(v).some(x=>typeof x!=='string'||!uuid.test(x)))deny();return v;}
 // The membership owner is independent of Core's native /identity and /context
 // receipt join. Keep the original identity bytes for that join and pin only the
 // admitted membership principal beside the opaque session.
 function memberFact(raw,identity,selectedClientId){
  const p=data(own(raw,['tenantId','actorId','role','permissions','clientIds','membershipRevision']));
  if(p.tenantId!==identity.principal.tenantId||p.actorId!==identity.principal.actorId||
   typeof p.membershipRevision!=='string'||!p.membershipRevision||p.membershipRevision.length>256||
   typeof p.role!=='string'||!p.role||!Array.isArray(p.permissions)||
   p.permissions.length>64||p.permissions.some(value=>typeof value!=='string')||
   !Array.isArray(p.clientIds)||p.clientIds.length>4096||
   p.clientIds.some(value=>typeof value!=='string'||!uuid.test(value))||new Set(p.clientIds).size!==p.clientIds.length||
   selectedClientId!==undefined&&!p.clientIds.includes(selectedClientId))deny();
  return p;
 }
 async function admitMember(credential,identity,t){
  const receipt=data(own(await t.run(signal=>member.admit({credential,signal,deadlineMs:t.deadline()})),['principal','expiresAtMs']));
  const p=memberFact(receipt.principal,identity);
  if(!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=active(t.signal))deny();
  t.limitDeadline(receipt.expiresAtMs);return {principal:p,expiresAtMs:receipt.expiresAtMs};
 }
 async function recheckMember(principal,credential,identity,t,selectedClientId,record){
  try{
   const current=memberFact(await t.run(signal=>member.recheck({principal,credential,signal,deadlineMs:t.deadline()})),identity,selectedClientId);
   if(!same(current,principal))deny();return current;
  }catch(error){if(t.isRequestCancellation(error)||isAuthorityUnavailable(error))throw error;if(record&&!t.signal.aborted)remove(record);deny();}
 }
 async function resolve(nativeCredential,selected,t,record,ceiling=Infinity,progress={},fresh=false){
  const observe=()=>resolveFacts(nativeCredential,selected,t,record,ceiling,progress);
  return withAuthority?t.run(signal=>withAuthority({credential:nativeCredential,hints:selected,...(record?{binding:record.context.binding,sessionFence:record.sessionId+':'+record.sessionRevision}:{}),fresh:!record||fresh,signal,deadlineMs:t.deadline()},observe)):observe();
 }
 async function resolveFacts(nativeCredential,selected,t,record,ceiling=Infinity,progress={}){
  progress.step='identity';let started=active(t.signal);const identity=fact(await t.run(signal=>verifyIdentity({credential:nativeCredential,signal,deadlineMs:t.deadline()})),['principal','identityRevision','checkedAtMs','expiresAtMs'],started,t);
  own(identity.principal,['tenantId','actorId']);if(Object.values(identity.principal).some(v=>typeof v!=='string'||!v||v.length>256)||typeof identity.identityRevision!=='string'||!identity.identityRevision||identity.identityRevision.length>256)deny();
  if(record)valid(record,t.signal);
  if(record&&(!same(identity.principal,record.identity.principal)||identity.identityRevision!==record.identity.identityRevision))deny();
  progress.step='membership-admit';const membershipAdmission=member&&!record?await admitMember(nativeCredential,identity,t):undefined;
  const membershipPrincipal=member?(record?record.membershipPrincipal:membershipAdmission.principal):undefined;
  progress.step='membership-recheck';if(member&&record)await recheckMember(membershipPrincipal,nativeCredential,identity,t,record.context.selectedClientId,record);
  progress.step='context';started=active(t.signal);const current=fact(await t.run(signal=>resolveContext({identityCredential:nativeCredential,identity,identitySha256:canonicalSha256(identity),hints:selected,signal,deadlineMs:t.deadline()})),['identitySha256','binding','scopes','selectedClientId','contextRevision','checkedAtMs','expiresAtMs'],started,t);
  if(record)valid(record,t.signal);validateShape('RunBinding',current.binding);if(current.identitySha256!==canonicalSha256(identity)||current.binding.tenantId!==identity.principal.tenantId||current.binding.actorId!==identity.principal.actorId||typeof current.selectedClientId!=='string'||!uuid.test(current.selectedClientId)||typeof current.contextRevision!=='string'||!current.contextRevision||current.contextRevision.length>256||!Array.isArray(current.scopes)||!current.scopes.length||current.scopes.length>100)deny();
  for(const scope of current.scopes){validateShape('Scope',scope);if(scope.tenantId!==identity.principal.tenantId)deny();}
  if(new Set(current.scopes.map(canonicalSha256)).size!==current.scopes.length||!current.scopes.some(s=>s.kind==='client'&&s.resourceId.toLowerCase()===current.selectedClientId))deny();
  for(const key of ['conversationId','runId'])if(selected[key]!==undefined&&selected[key]!==current.binding[key])deny();if(selected.clientId!==undefined&&selected.clientId!==current.selectedClientId)deny();
  progress.step='membership-recheck';if(member)await recheckMember(membershipPrincipal,nativeCredential,identity,t,current.selectedClientId,record);
  progress.step='context';const context=data({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId,contextRevision:current.contextRevision});if(record&&!same(context,record.context))deny();progress.step='release';
  const expiresAtMs=Math.min(identity.expiresAtMs,current.expiresAtMs,record?.expiresAtMs??ceiling,membershipAdmission?.expiresAtMs??Infinity);t.limitDeadline(expiresAtMs);active(t.signal);t.check();return {identity,context,expiresAtMs,...(member?{membershipPrincipal}:{})};
 }
 async function issue(value,{relayEligible,withCurrent}){const {identityCredential,hints:rawHints={},signal,deadlineMs}=own(value,['identityCredential'],['hints','signal','deadlineMs']);if(typeof identityCredential!=='string'||!identityCredential||identityCredential.length>8192||!/^\S+$/u.test(identityCredential))deny();const selected=hints(rawHints),t=life(deadlineMs,signal),progress={step:'capacity'};let record;
  try{const started=active(t.signal);for(const r of sessions.values())if(r.expiresAtMs<=started)remove(r);if(sessions.size>=l.maxSessions)deny('SESSION_CAPACITY');const resolved=await resolve(identityCredential,selected,t,undefined,started+l.maxTtlMs,progress);
   progress.step='capacity';active(t.signal);t.check();if(sessions.size>=l.maxSessions)deny('SESSION_CAPACITY');progress.step='release';const credential=`action_session_${randomBytes(32).toString('base64url')}`,sessionId=randomUUID();record={...resolved,relayEligible,digest:hash(credential),sessionId,sessionRevision:randomUUID(),nativeCredential:identityCredential,hints:selected,receipts:new Set()};sessions.set(record.digest,record);ids.set(sessionId,record);
   credentials.set(record,credential);
   const b=record.context.binding,out=assertActionSessionReceipt({credential,expiresAtMs:record.expiresAtMs,context:{tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId,selectedClientId:record.context.selectedClientId}},active(t.signal));release(record,t);
   return withCurrent?data({receipt:out,current:{binding:b,scopes:record.context.scopes,selectedClientId:record.context.selectedClientId,checkedAtMs:active(t.signal),expiresAtMs:record.expiresAtMs}}):out;
  }catch(error){if(record)remove(record);if(!t.isRequestCancellation(error))refusals(progress.step,error);if(errors.has(error))throw error;
   // An owner that did not answer refuses only this issuance, as it does a recheck. The issuance route still answers 401
   // (http.mjs); worker-http answers 503 so the runner can replay an idempotent call.
   if(isAuthorityUnavailable(error))throw markAuthorityUnavailable(new ActionSessionError('SESSION_AUTHORITY_UNAVAILABLE'));deny();}finally{t.close();}
 }
 function currentReceipt(r,authentication,current,t){return data({authenticationSha256:canonicalSha256(authentication),binding:current.context.binding,scopes:current.context.scopes,selectedClientId:current.context.selectedClientId,checkedAtMs:active(t.signal),expiresAtMs:r.expiresAtMs});}
 async function authenticate(value,includeCurrent){const {credential,signal,deadlineMs}=own(value,['credential'],['signal','deadlineMs']);if(typeof credential!=='string'||!/^action_session_[A-Za-z0-9_-]{43}$/u.test(credential))deny();const r=sessions.get(hash(credential));valid(r,signal);const t=life(Math.min(deadlineMs??r.expiresAtMs,r.expiresAtMs),signal);
  const progress={};try{const current=await resolve(r.nativeCredential,boundHints(r),t,r,Infinity,progress,true);valid(r,t.signal);r.expiresAtMs=current.expiresAtMs;const b=r.context.binding,authentication=data({principal:{sessionId:r.sessionId,tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId},sessionRevision:r.sessionRevision,checkedAtMs:active(t.signal),expiresAtMs:r.expiresAtMs});t.check();r.receipts.add(canonicalSha256(authentication));if(r.receipts.size>64)r.receipts.delete(r.receipts.values().next().value);
   const out=includeCurrent?data({authentication,current:currentReceipt(r,authentication,current,t)}):authentication;release(r,t);return out;
  }catch(error){rejectRecheck(r,t,error,progress);}finally{t.close();}
 }
 const authenticateSession=value=>authenticate(value,false);
 async function readCurrentState(value){const {authentication,signal,deadlineMs}=own(value,['authentication'],['signal','deadlineMs']),a=data(authentication);const r=ids.get(a.principal?.sessionId);valid(r,signal);if(!r.receipts.has(canonicalSha256(a)))deny();const t=life(Math.min(deadlineMs??r.expiresAtMs,r.expiresAtMs),signal);
  const progress={};try{const current=await resolve(r.nativeCredential,boundHints(r),t,r,Infinity,progress);valid(r,t.signal);r.expiresAtMs=current.expiresAtMs;t.check();const out=currentReceipt(r,a,current,t);release(r,t);return out;}catch(error){rejectRecheck(r,t,error,progress);}finally{t.close();}
 }
 async function verifyTransition(value){
  let t,r;try{
   const v=own(value,['credential','controlId','sourceBinding','targetBinding','admissionReceiptId','retirementReceiptId','purpose'],['signal','deadlineMs']),{credential,signal,deadlineMs,...raw}=v,input=data(raw);
   nativeSignal(signal);if(deadlineMs!==undefined&&!Number.isSafeInteger(deadlineMs))deny();
   if(!readTransition||typeof credential!=='string'||!/^action_session_[A-Za-z0-9_-]{43}$/u.test(credential)||!['dispatch-start','dispatch-continued','commit-applied','receipt-readback'].includes(input.purpose))deny();
   validateShape('RunBinding',input.sourceBinding);validateShape('RunBinding',input.targetBinding);
   for(const id of [input.controlId,input.admissionReceiptId,...(input.retirementReceiptId===null?[]:[input.retirementReceiptId])])if(typeof id!=='string'||!uuid.test(id))deny();
   r=sessions.get(hash(credential));valid(r,signal);if(!same(input.sourceBinding,r.context.binding))deny();
   const revision=r.sessionRevision,sourceContext=r.context,originalIdentity=r.identity,nativeCredential=r.nativeCredential;
   t=life(Math.min(deadlineMs??r.expiresAtMs,r.expiresAtMs),signal);
   if(withAuthority)await t.run(signal=>withAuthority({credential:nativeCredential,hints:boundHints(r),binding:sourceContext.binding,sessionFence:r.sessionId+':'+r.sessionRevision,fresh:true,signal,deadlineMs:t.deadline()},()=>undefined));
   const check=()=>{valid(r,t.signal);if(r.sessionRevision!==revision||r.context!==sourceContext||r.identity!==originalIdentity||r.nativeCredential!==nativeCredential)deny();t.limitDeadline(r.expiresAtMs);t.check();};
   let identity;try{
    const started=active(t.signal);identity=fact(await t.run(signal=>verifyIdentity({credential:nativeCredential,signal,deadlineMs:t.deadline()})),['principal','identityRevision','checkedAtMs','expiresAtMs'],started,t);check();
    own(identity.principal,['tenantId','actorId']);if(!same(identity.principal,originalIdentity.principal)||identity.identityRevision!==originalIdentity.identityRevision)deny();
   }catch{if(!t.signal.aborted)remove(r);else try{valid(r);}catch{}deny();}
   if(member)await recheckMember(r.membershipPrincipal,nativeCredential,identity,t,sourceContext.selectedClientId,r);
   async function transition(){
    const started=active(t.signal),p=fact(await t.run(signal=>readTransition({sourceBinding:sourceContext.binding,controlId:input.controlId,signal,deadlineMs:t.deadline()})),transitionFactKeys,started,t);check();
    validateShape('RunBinding',p.sourceBinding);validateShape('RunBinding',p.targetBinding);
    if(!same(p.sourceBinding,input.sourceBinding)||!same(p.targetBinding,input.targetBinding)||p.controlId!==input.controlId||p.admissionReceiptId!==input.admissionReceiptId||p.retirementReceiptId!==input.retirementReceiptId||!['resume','fork'].includes(p.intent)||p.state!==(input.purpose==='receipt-readback'?'APPLIED':'DISPATCHING')||input.purpose==='dispatch-continued'&&p.intent!=='resume')deny();
    const b=p.targetBinding,s=p.sourceBinding;
    if(b.tenantId!==s.tenantId||b.actorId!==s.actorId||b.runId===s.runId||b.attemptId===s.attemptId||b.workerId===s.workerId||p.intent==='resume'&&(b.conversationId!==s.conversationId||b.writerFence<=s.writerFence)||p.intent==='fork'&&b.conversationId===s.conversationId||!same(p.scopes,sourceContext.scopes)||p.selectedClientId!==sourceContext.selectedClientId||p.scopes.some(scope=>scope.policyRevision!==p.policyRevision))deny();
    for(const id of [p.controlId,p.admissionReceiptId,p.checkpointId,...(p.resumeSessionAt===null?[]:[p.resumeSessionAt])])if(typeof id!=='string'||!uuid.test(id))deny();
    for(const digest of [p.inputSha256,p.checkpointSha256,p.sourceRequestSha256,p.contextSha256])if(typeof digest!=='string'||!/^[a-f0-9]{64}$/u.test(digest))deny();
    if(p.intent==='resume'?(p.targetSessionId!==null||typeof p.retirementReceiptId!=='string'||!uuid.test(p.retirementReceiptId)):(p.retirementReceiptId!==null||p.retirementExpiresAtMs!==null||typeof p.targetSessionId!=='string'||!uuid.test(p.targetSessionId)))deny();
    for(const deadline of [p.admissionExpiresAtMs,p.targetExpiresAtMs,...(p.intent==='resume'?[p.retirementExpiresAtMs]:[])]){if(!Number.isSafeInteger(deadline)||deadline<=active(t.signal))deny();t.limitDeadline(deadline);}
    check();return p;
   }
   const before=await transition(),started=active(t.signal);
   let current;try{
    current=fact(await t.run(signal=>resolveTransitionContext({identityCredential:nativeCredential,identity,identitySha256:canonicalSha256(identity),sourceContext,transition:before,signal,deadlineMs:t.deadline()})),['identitySha256','binding','scopes','selectedClientId','contextRevision','checkedAtMs','expiresAtMs'],started,t);check();
    validateShape('RunBinding',current.binding);if(current.identitySha256!==canonicalSha256(identity)||!same(current.binding,before.targetBinding)||!same(current.scopes,sourceContext.scopes)||current.selectedClientId!==sourceContext.selectedClientId||typeof current.contextRevision!=='string'||!current.contextRevision||current.contextRevision.length>256)deny();
   }catch{if(!t.signal.aborted)remove(r);else try{valid(r);}catch{}deny();}
   const after=await transition();if(transitionHash(before)!==transitionHash(after))deny();check();
   if(member){await recheckMember(r.membershipPrincipal,nativeCredential,identity,t,sourceContext.selectedClientId,r);check();}
   const result=data({checkedAtMs:active(t.signal),expiresAtMs:t.deadline(),transitionSha256:transitionHash(after)});release(r,t);return result;
  }catch{deny();}finally{t?.close();}
 }
 /** Live-session read relay (RC1 option A; dot's source ack 6245772555). Returns the native credential held by the freshest live
  * action session whose context names exactly this run (tenant, actor, conversation, run) and this selected client, for read
  * calls only. The credential stays in this process: it is never persisted or logged, an expired, revoked or closed session
  * refuses, and every read still re-verifies identity and membership at Core with it. Session records never hold the marked
  * control credential, and no credential is minted here. Unattended runs have no live session, so their reads refuse. */
 function nativeCredentialFor(input){
  const v=own(input,['binding','selectedClientId'],['signal']);nativeSignal(v.signal);const at=active(v.signal);
  const b=data(v.binding);if(b===null||typeof b!=='object'||Array.isArray(b))deny();
  const keys=['tenantId','actorId','conversationId','runId'];if(keys.some(k=>typeof b[k]!=='string'||!b[k])||!uuid.test(b.conversationId)||!uuid.test(b.runId)||typeof v.selectedClientId!=='string'||!uuid.test(v.selectedClientId))deny();
  let best=null;
  for(const r of sessions.values()){const c=r.context.binding;if(r.relayEligible!==true||r.expiresAtMs<=at||!r.nativeCredential||keys.some(k=>c?.[k]!==b[k])||r.context.selectedClientId!==v.selectedClientId)continue;if(best===null||r.expiresAtMs>best.expiresAtMs)best=r;}
  if(best===null)deny('SESSION_UNAVAILABLE');valid(best,v.signal);
  return Object.freeze({credential:best.nativeCredential,expiresAtMs:best.expiresAtMs});
 }
 const owner=Object.freeze({issue:value=>issue(value,{relayEligible:true,withCurrent:false}),issueDerived:value=>issue(value,{relayEligible:false,withCurrent:false}),authenticateSession,readCurrentState,verifyTransition,nativeCredentialFor,revoke(credential){if(typeof credential!=='string')deny();const r=sessions.get(hash(credential));if(r)remove(r);},close(){closed=true;for(const r of sessions.values())remove(r);},status:()=>data({mode,closed,sessions:sessions.size})});
 runBorrowers.set(owner,input=>{
  const {binding,selectedClientId,signal}=own(input,['binding','selectedClientId'],['signal']);validateShape('RunBinding',binding);nativeSignal(signal);const at=active(signal);
  let best;for(const r of sessions.values())if(r.relayEligible===true&&r.expiresAtMs>at&&same(r.context.binding,binding)&&r.context.selectedClientId===selectedClientId&&(!best||r.expiresAtMs>best.expiresAtMs))best=r;
  if(!best)deny('SESSION_UNAVAILABLE');valid(best,signal);const b=best.context.binding;
  return assertActionSessionReceipt({credential:credentials.get(best),expiresAtMs:best.expiresAtMs,context:{tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId,selectedClientId:best.context.selectedClientId}},at);
 });
 currentReaders.set(owner,value=>authenticate(value,true));currentIssuers.set(owner,value=>issue(value,{relayEligible:true,withCurrent:true}));return owner;
}
