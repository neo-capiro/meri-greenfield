/** Core P-INT-10 approval forwarder, Meri side (dot PR #121 6247464370 item 6; Core b7c6e9cf `apps/api/src/meri/native-approvals/*`).
 *
 * Serves the three native approval operations the intents owners call through the fixed provider RPC seam
 * (`apps/control/intents/native-approvals.mjs` `createNativeIntentApprovals({call})`), so the candidate's local native app
 * (which has no `approval/*` handler) is never asked:
 *  - `approval/record`   -> POST {origin}/api/clio/approvals/native/record   {proposal,decision,approver,binding}
 *  - `approval/decision` -> POST {origin}/api/clio/approvals/native/decision {proposalId,commandSha256,binding}
 *  - `approval/read`     -> Meri's own custody of the PREPARED proposal (the intent journal reader); Core has no read route.
 *  - `approval/revoke`   -> POST {origin}/api/clio/approvals/native/revoke   {proposalId,commandSha256,approver,binding}
 *                           (lane RD): the approver revokes their own approval; afterwards `approval/decision` answers `revoked:true`.
 * Bodies and receipts cross byte for byte (Core's controller mirrors the provider operations); HTTP 200 only.
 *
 * Authority. Every Core call carries BOTH the approver's own native bearer and the verified service identity
 * (`x-internal-service-secret`, Core ToolServiceSecretGuard), as Core's `NativeApprovalService` requires (`record` also checks
 * approver == authenticated user == binding actor). The bearer is resolved per call from the live action session for the exact
 * run and selected client of the proposal (`nativeCredentials.nativeCredentialFor`, the read-credential relay bound to control's
 * own action-session owner): no live approver session refuses ACCESS_DENIED before any request, nothing falls back to another
 * credential, the same session must still be live after Core answers, and the bearer is never cached past the call. The marked
 * control credential (and every native candidate credential file) is refused by digest; a service-only call does not exist.
 *
 * Binding. `record` and `decision` first bind the request to Meri's own retained proposal (`readProposal`: the intent journal's
 * read-only custody under the binding's tenant, actor and conversation); a proposal Meri never prepared, a different command
 * digest or another run is ACCESS_DENIED. The selected client is the proposal's single client scope.
 *
 * Receipt. Core's `checkedAtMs` is never trusted: Meri stamps its OWN clock after the correlated fresh answer (decision for the
 * same proposal and command digest, the required approver, the proposal's policy revision). A repeat `record` for the same
 * (proposalId, decision) is coalesced in flight and otherwise idempotent at Core (the stored decision is answered, never a
 * second or flipped one; `approval.mjs` refuses a mismatch). Failures are the closed intent codes (`faults.mjs`): UNAVAILABLE,
 * ACCESS_DENIED, REFUSED (Core 400/409), INVALID_ARGUMENTS, DEADLINE, CANCELLED, with `effect: 'none'` before the request left
 * and `'unknown'` after (a decision may have been recorded).
 *
 * `getCredentials({tenantId,actorId,purpose:'approval.execution',binding})` is the `core` owner port of
 * `native-authority/execution-composition.mjs` (`{origin,getCredentials}`) over the same relay and secret.
 * Construction is inert: no secret read, request or RPC. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape,assertProposalIntegrity} from '../../../packages/contracts/validate.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {intentFault,INTENT_FAILURE_CODES} from '../../control/intents/faults.mjs';
export const CORE_APPROVAL_ROUTES=Object.freeze({record:'/api/clio/approvals/native/record',decision:'/api/clio/approvals/native/decision',revoke:'/api/clio/approvals/native/revoke'});
export const APPROVAL_FORWARDER_OPERATIONS=Object.freeze(['approval/record','approval/decision','approval/read','approval/revoke']);
const STABLE=['tenantId','actorId','conversationId','runId'];
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,HEX64=/^[a-f0-9]{64}$/u;
const sha=value=>createHash('sha256').update(value).digest('hex'),same=(a,b)=>hash(a)===hash(b);
const faults=new WeakSet();
const fault=(code,effect='none')=>{const e=intentFault(INTENT_FAILURE_CODES.includes(code)?code:'UNAVAILABLE',effect);faults.add(e);return e;};
const refuse=(code,effect)=>{throw fault(code,effect);};
const configuration=()=>{throw Object.assign(Error('APPROVAL_FORWARDER_CONFIGURATION'),{code:'APPROVAL_FORWARDER_CONFIGURATION'});};
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const tokenOf=bytes=>{const v=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;return v!==null&&TOKEN.test(v)?v:null;};
const stable=b=>Object.freeze(Object.fromEntries(STABLE.map(k=>[k,b[k]])));
/** The digests of the native candidate's own credential files (identity, task, control, proxy): a bearer or secret equal to any of
 * them is refused. Read lazily once, then kept as digests only; an unreadable file keeps every call refused. */
export function createReservedCredentialDigests({files,readSecret}){
 const reserved=data(files);if(!Array.isArray(reserved)||reserved.some(path=>typeof path!=='string'||!path)||!ordinary(readSecret))configuration();
 let digests=null;
 return async function reservedDigests(){
  if(digests!==null)return digests;
  const set=new Set();for(const path of reserved){let token;try{token=tokenOf(await readSecret(path));}catch{token=null;}if(token===null)refuse('UNAVAILABLE');set.add(sha(token));}
  digests=set;return digests;
 };
}
/** Late binding of control's action-session owner into a forwarder's credential relay, keyed by the exact frozen product-port
 * context (as `artifacts/session-binding.mjs` does for documents). The family registers; trusted assembly binds once. */
const binders=new WeakMap();
export function registerApprovalSessionBinder(context,bind){
 if(context===null||typeof context!=='object'||!ordinary(bind)||binders.has(context))configuration();
 binders.set(context,bind);
}
export function bindApprovalSessions(context,sessions){
 if(context===null||typeof context!=='object')configuration();
 const bind=binders.get(context);if(bind===undefined)return false;bind(sessions);return true;
}
export function createCoreApprovalForwarder(options){
 let c,origin,nativeCredentialFor;
 try{
  c=own(options,['origin','nativeCredentials','getServiceSecret','now'],['readProposal','selectedClientId','reservedCredentials','fetchImpl','maxRequestMs','maxResponseBytes']);origin=retainedOrigin(c.origin);
  if(!c.nativeCredentials||typeof c.nativeCredentials!=='object'||types.isProxy(c.nativeCredentials))throw Error();
  const method=Object.getOwnPropertyDescriptor(c.nativeCredentials,'nativeCredentialFor');if(!method||!Object.hasOwn(method,'value'))throw Error();nativeCredentialFor=method.value;
  for(const fn of [nativeCredentialFor,c.getServiceSecret,c.now,c.fetchImpl??globalThis.fetch,c.readProposal??(()=>{}),c.reservedCredentials??(()=>{})])if(!ordinary(fn))throw Error();
  if(c.selectedClientId!==undefined&&(typeof c.selectedClientId!=='string'||!UUID.test(c.selectedClientId)))throw Error();
  if(c.maxRequestMs!==undefined&&(!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000))throw Error();
  if(c.maxResponseBytes!==undefined&&(!Number.isSafeInteger(c.maxResponseBytes)||c.maxResponseBytes<1||c.maxResponseBytes>1048576))throw Error();
 }catch{configuration();}
 const now=c.now,fetchImpl=c.fetchImpl??globalThis.fetch,maxRequestMs=c.maxRequestMs??10000,maxResponseBytes=c.maxResponseBytes??131072,reservedDigests=c.reservedCredentials??(async()=>new Set());
 const pending=new Map();
 function lifetime(signal,deadlineMs){
  nativeSignal(signal);const began=now();if(!Number.isSafeInteger(began)||deadlineMs!==undefined&&!Number.isSafeInteger(deadlineMs))refuse('INVALID_ARGUMENTS');
  const timer=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs??Infinity,began+maxRequestMs),errorFactory:code=>fault(code,'none')});
  let cutoff=Math.min(deadlineMs??Infinity,began+maxRequestMs);
  return {...timer,began,deadline:()=>cutoff,limitDeadline(next){cutoff=Math.min(cutoff,next);timer.limitDeadline(cutoff);}};
 }
 /** One live-session lookup: the exact run (stable keys) and selected client, a well-formed unexpired token. */
 function bearer(selected,signal,effect='none'){
  let issued;try{issued=data(own(Reflect.apply(nativeCredentialFor,c.nativeCredentials,[{binding:selected.binding,selectedClientId:selected.selectedClientId,...(signal===undefined?{}:{signal})}]),['credential','expiresAtMs']));}catch{refuse('ACCESS_DENIED',effect);}
  if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('ACCESS_DENIED',effect);
  return issued;
 }
 /** The attended Core call: reserved digests, bearer, secret, the same bearer again, POST, bounded JSON, the same bearer after. */
 async function post(life,route,{selected,body}){
  let acquired,sent=false;
  try{
   const forbidden=await life.run(()=>reservedDigests());
   const first=bearer(selected,life.signal);if(forbidden.has(sha(first.credential)))refuse('ACCESS_DENIED');life.limitDeadline(first.expiresAtMs);
   let secret;try{secret=await life.run(()=>c.getServiceSecret());}catch(error){if(faults.has(error))throw error;refuse('UNAVAILABLE');}
   if(typeof secret!=='string'||!TOKEN.test(secret)||secret===first.credential||forbidden.has(sha(secret)))refuse('UNAVAILABLE');
   // The secret read is an await: the same session must still be live (not expired, revoked or replaced).
   if(bearer(selected,life.signal).credential!==first.credential)refuse('ACCESS_DENIED');
   const started=now();sent=true;
   acquired=await life.run(s=>{const request=Promise.resolve(fetchImpl(origin+route,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:s,
    headers:{authorization:'Bearer '+first.credential,'x-internal-service-secret':secret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(body)}));
    request.then(r=>{if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return request;});
   if(!(acquired instanceof Response)||types.isProxy(acquired))refuse('UNAVAILABLE','unknown');
   // Core refused before recording (4xx): no effect. Anything else after the request left may have recorded a decision.
   if(acquired.status!==200)refuse([401,403].includes(acquired.status)?'ACCESS_DENIED':[400,404,409,422].includes(acquired.status)?'REFUSED':'UNAVAILABLE',[401,403,400,404,409,422].includes(acquired.status)?'none':'unknown');
   let value;try{value=data(await readJsonResponse(acquired,{lifetime:life,maxResponseBytes}));}catch(error){if(faults.has(error))throw error;refuse('UNAVAILABLE','unknown');}
   const last=bearer(selected,life.signal,'unknown');if(last.credential!==first.credential)refuse('ACCESS_DENIED','unknown');life.check();
   return {value,started,sessionExpiresAtMs:Math.min(first.expiresAtMs,last.expiresAtMs)};
  }catch(error){
   if(faults.has(error))throw ['DEADLINE','CANCELLED'].includes(error.code)&&sent?fault(error.code,'unknown'):error;
   throw fault('UNAVAILABLE',sent?'unknown':'none');
  }finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}}
 }
 /** Meri's own retained PREPARED proposal for this id under the binding's tenant, actor and conversation (never disclosed otherwise). */
 async function custody(life,binding,proposalId){
  if(c.readProposal===undefined)refuse('UNAVAILABLE');
  let p;try{p=await life.run(signal=>c.readProposal({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,proposalId,signal}));}
  catch(error){if(faults.has(error))throw error;refuse('UNAVAILABLE');}
  if(p===null||p===undefined)refuse('ACCESS_DENIED');
  try{p=data(p);assertProposalIntegrity(p);}catch{refuse('UNAVAILABLE');}
  if(p.proposalId!==proposalId||['tenantId','actorId','conversationId'].some(k=>p.command.binding[k]!==binding[k]))refuse('ACCESS_DENIED');
  return p;
 }
 /** The proposal's one client scope (the live session is bound to it) and its single policy revision. */
 function selectedClient(p){
  const scopes=p.command.scopes,clients=scopes.filter(s=>s?.kind==='client');
  if(!Array.isArray(scopes)||!scopes.length||clients.length!==1||typeof clients[0].resourceId!=='string'||!UUID.test(clients[0].resourceId)||new Set(scopes.map(s=>s.policyRevision)).size!==1||scopes.some(s=>s.tenantId!==p.command.binding.tenantId))refuse('ACCESS_DENIED');
  if(c.selectedClientId!==undefined&&clients[0].resourceId!==c.selectedClientId)refuse('ACCESS_DENIED');
  return {id:clients[0].resourceId,policyRevision:scopes[0].policyRevision};
 }
 function receipt(raw,{nullable,effect}){
  let v;try{v=data(own(raw,['decision','checkedAtMs','revoked']));}catch{refuse('UNAVAILABLE',effect);}
  if(typeof v.revoked!=='boolean'||!Number.isSafeInteger(v.checkedAtMs))refuse('UNAVAILABLE',effect);
  if(v.decision===null){if(!nullable)refuse('UNAVAILABLE',effect);return v;}
  try{validateShape('ApprovalDecision',v.decision);}catch{refuse('UNAVAILABLE',effect);}
  return v;
 }
 async function record(value){
  const {signal,deadlineMs,...raw}=own(value,['proposal','decision','approver','binding'],['signal','deadlineMs']);nativeSignal(signal);
  let v;try{v=data(raw);assertProposalIntegrity(v.proposal);own(v.approver,['tenantId','actorId']);validateShape('RunBinding',v.binding);}catch{refuse('INVALID_ARGUMENTS');}
  if(v.decision!=='approved'&&v.decision!=='rejected')refuse('INVALID_ARGUMENTS');
  const p=v.proposal,b=p.command.binding;
  // Core records only for the authenticated approver who is the required approver and the conversation owner (binding actor).
  if(!same(v.approver,p.requiredApprover)||v.approver.tenantId!==b.tenantId||v.approver.actorId!==b.actorId||!same(v.binding,b))refuse('ACCESS_DENIED');
  const client=selectedClient(p),key=`${p.proposalId}:${v.decision}`,inflight=pending.get(key);
  if(inflight)return inflight;
  const work=(async()=>{
   const life=lifetime(signal,deadlineMs);
   try{
    const retained=await custody(life,b,p.proposalId);if(!same(retained,p))refuse('ACCESS_DENIED');
    const answer=await post(life,CORE_APPROVAL_ROUTES.record,{selected:{binding:stable(b),selectedClientId:client.id},body:{proposal:p,decision:v.decision,approver:v.approver,binding:v.binding}});
    const r=receipt(answer.value,{nullable:false,effect:'unknown'}),d=r.decision;
    if(d.proposalId!==p.proposalId||d.commandSha256!==p.commandSha256||!same(d.approver,v.approver)||d.policyRevision!==client.policyRevision)refuse('UNAVAILABLE','unknown');
    const checkedAtMs=now();if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<answer.started)refuse('UNAVAILABLE','unknown');
    return data({decision:d,checkedAtMs,revoked:r.revoked});
   }finally{life.close();pending.delete(key);}
  })();
  pending.set(key,work);return work;
 }
 /** The approver revokes their own recorded approval (Core `POST .../native/revoke`: the approver's native bearer plus the service
  * identity; append-only under the proposal lock, idempotent). Bound to Meri custody like `record`; the receipt must answer
  * `revoked:true` for the same proposal, command digest, approver and policy revision. Nothing here is automatic: a run ending
  * never revokes (Core needs the approver's live bearer). Core's native approval contract requires the exact revoke body
  * `{proposalId,commandSha256,approver,binding}`. */
 async function revoke(value){
  const {signal,deadlineMs,...raw}=own(value,['proposalId','commandSha256','approver','binding'],['signal','deadlineMs']);nativeSignal(signal);
  let v;try{v=data(raw);own(v.approver,['tenantId','actorId']);validateShape('RunBinding',v.binding);}catch{refuse('INVALID_ARGUMENTS');}
  if(typeof v.proposalId!=='string'||!UUID.test(v.proposalId)||typeof v.commandSha256!=='string'||!HEX64.test(v.commandSha256))refuse('INVALID_ARGUMENTS');
  // Only the required approver, who is the conversation owner, holds the live session this call is made with.
  if(v.approver.tenantId!==v.binding.tenantId||v.approver.actorId!==v.binding.actorId)refuse('ACCESS_DENIED');
  const key=`${v.proposalId}:revoke`,inflight=pending.get(key);
  if(inflight)return inflight;
  const work=(async()=>{
   const life=lifetime(signal,deadlineMs);
   try{
    const p=await custody(life,v.binding,v.proposalId);
    if(p.commandSha256!==v.commandSha256||!same(v.approver,p.requiredApprover)||STABLE.some(k=>p.command.binding[k]!==v.binding[k]))refuse('ACCESS_DENIED');
    const client=selectedClient(p);
    const answer=await post(life,CORE_APPROVAL_ROUTES.revoke,{selected:{binding:stable(p.command.binding),selectedClientId:client.id},body:{proposalId:v.proposalId,commandSha256:v.commandSha256,approver:v.approver,binding:v.binding}});
    const r=receipt(answer.value,{nullable:false,effect:'unknown'}),d=r.decision;
    if(r.revoked!==true||d.proposalId!==v.proposalId||d.commandSha256!==v.commandSha256||!same(d.approver,v.approver)||d.policyRevision!==client.policyRevision)refuse('UNAVAILABLE','unknown');
    const checkedAtMs=now();if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<answer.started)refuse('UNAVAILABLE','unknown');
    return data({decision:d,checkedAtMs,revoked:true});
   }finally{life.close();pending.delete(key);}
  })();
  pending.set(key,work);return work;
 }
 async function decision(value){
  const {signal,deadlineMs,...raw}=own(value,['proposalId','commandSha256','binding'],['signal','deadlineMs']);nativeSignal(signal);
  let v;try{v=data(raw);validateShape('RunBinding',v.binding);}catch{refuse('INVALID_ARGUMENTS');}
  if(typeof v.proposalId!=='string'||!UUID.test(v.proposalId)||typeof v.commandSha256!=='string'||!HEX64.test(v.commandSha256))refuse('INVALID_ARGUMENTS');
  const life=lifetime(signal,deadlineMs);
  try{
   const p=await custody(life,v.binding,v.proposalId);
   // Callers name the original, a fresh executor attempt or the current run: the stable keys must be the proposal's.
   if(p.commandSha256!==v.commandSha256||STABLE.some(k=>p.command.binding[k]!==v.binding[k]))refuse('ACCESS_DENIED');
   const client=selectedClient(p);
   const answer=await post(life,CORE_APPROVAL_ROUTES.decision,{selected:{binding:stable(p.command.binding),selectedClientId:client.id},body:{proposalId:v.proposalId,commandSha256:v.commandSha256,binding:v.binding}});
   const r=receipt(answer.value,{nullable:true,effect:'none'}),d=r.decision;
   if(d!==null&&(d.proposalId!==v.proposalId||d.commandSha256!==v.commandSha256||d.policyRevision!==client.policyRevision||!same(d.approver,p.requiredApprover)))refuse('UNAVAILABLE');
   const checkedAtMs=now();if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<answer.started)refuse('UNAVAILABLE');
   return data({decision:d,checkedAtMs,revoked:r.revoked});
  }finally{life.close();}
 }
 async function read(value){
  const {signal,...raw}=own(value,['proposalId','binding','scopes'],['signal']);nativeSignal(signal);
  let v;try{v=data(raw);validateShape('RunBinding',v.binding);}catch{refuse('INVALID_ARGUMENTS');}
  if(typeof v.proposalId!=='string'||!UUID.test(v.proposalId)||!Array.isArray(v.scopes))refuse('INVALID_ARGUMENTS');
  const life=lifetime(signal);
  try{
   const p=await custody(life,v.binding,v.proposalId);
   if(p.command.binding.runId!==v.binding.runId||!same(p.command.scopes,v.scopes))refuse('ACCESS_DENIED');selectedClient(p);
   return p;
  }finally{life.close();}
 }
 /** The `core` credentials port of the execution issuance (`createCoreExecutionIssuance.getCredentials`): the attended approver's
  * live bearer for the proposal's run and the configured selected client, plus the service secret, never the control token. */
 async function getCredentials(value){
  const {signal,deadlineMs,...raw}=own(value,['tenantId','actorId','purpose','binding'],['signal','deadlineMs']);nativeSignal(signal);
  let v;try{v=data(raw);validateShape('RunBinding',v.binding);}catch{refuse('INVALID_ARGUMENTS');}
  if(v.purpose!=='approval.execution'||v.binding.tenantId!==v.tenantId||v.binding.actorId!==v.actorId||c.selectedClientId===undefined)refuse('ACCESS_DENIED');
  const life=lifetime(signal,deadlineMs),selected={binding:stable(v.binding),selectedClientId:c.selectedClientId};
  try{
   const forbidden=await life.run(()=>reservedDigests());
   const first=bearer(selected,life.signal);if(forbidden.has(sha(first.credential)))refuse('ACCESS_DENIED');
   let secret;try{secret=await life.run(()=>c.getServiceSecret());}catch(error){if(faults.has(error))throw error;refuse('UNAVAILABLE');}
   if(typeof secret!=='string'||!TOKEN.test(secret)||secret===first.credential||forbidden.has(sha(secret)))refuse('UNAVAILABLE');
   const last=bearer(selected,life.signal);if(last.credential!==first.credential)refuse('ACCESS_DENIED');life.check();
   return data({tenantId:v.tenantId,actorId:v.actorId,bearerToken:first.credential,serviceSecret:secret,expiresAtMs:Math.min(first.expiresAtMs,last.expiresAtMs)});
  }finally{life.close();}
 }
 /** The provider RPC seam `call(operation,input,{signal})` for `createNativeIntentApprovals`; other operations are UNAVAILABLE. */
 async function call(operation,input,options={}){
  const {signal,deadlineMs}=own(options,[],['signal','deadlineMs']);
  const extra={...(signal===undefined?{}:{signal}),...(deadlineMs===undefined?{}:{deadlineMs})};
  if(operation==='approval/record')return record({...own(input,['proposal','decision','approver','binding']),...extra});
  if(operation==='approval/decision')return decision({...own(input,['proposalId','commandSha256','binding']),...extra});
  if(operation==='approval/read')return read({...own(input,['proposalId','binding','scopes']),...(signal===undefined?{}:{signal})});
  if(operation==='approval/revoke')return revoke({...own(input,['proposalId','commandSha256','approver','binding']),...extra});
  refuse('UNAVAILABLE');
 }
 return Object.freeze({origin,operations:APPROVAL_FORWARDER_OPERATIONS,call,record,decision,read,revoke,getCredentials,
  /** The intents decision ports over Core (the shapes `approval.mjs` and the lifecycle read). */
  async readDecision(value){const v=await decision(value);return v.revoked?null:v.decision;},
  async getCurrent(value){const v=await decision(value);if(v.decision===null)throw Object.assign(Error('COMMAND_APPROVAL_REFUSED'),{code:'COMMAND_APPROVAL_REFUSED'});return JSON.stringify(v);}});
}
