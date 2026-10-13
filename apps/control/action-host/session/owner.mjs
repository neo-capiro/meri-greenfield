/** Bounded process-local opaque sessions. Identity and current authorization belong to injected owners. */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const errors=new WeakSet();
export class ActionSessionError extends Error{constructor(code){super(code);this.name='ActionSessionError';this.code=code;errors.add(this);}}
const deny=(code='SESSION_REFUSED')=>{throw new ActionSessionError(code);};
// One minimal issuance wire owner, reused at construction and HTTP release.
export function assertActionSessionReceipt(value,at){
 const v=data(value);own(v,['credential','expiresAtMs','context']);own(v.context,['tenantId','actorId','conversationId','runId','selectedClientId']);
 if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||typeof v.credential!=='string'||!/^action_session_[A-Za-z0-9_-]{43}$/u.test(v.credential)||['tenantId','actorId'].some(k=>typeof v.context[k]!=='string'||!v.context[k]||v.context[k].length>256)||['conversationId','runId','selectedClientId'].some(k=>typeof v.context[k]!=='string'||!uuid.test(v.context[k]))||Buffer.byteLength(JSON.stringify(v))>4096)deny();
 return v;
}
export function createActionSessionOwner(configuration){
 const {mode,verifyIdentity,resolveContext,now=Date.now,limits}=own(configuration,['mode','verifyIdentity','resolveContext','limits'],['now']);
 const l=data(own(limits,['maxSessions','maxRequestMs','maxTtlMs','maxFactBytes']));
 if(mode!=='process-local'||typeof verifyIdentity!=='function'||typeof resolveContext!=='function'||typeof now!=='function'||Object.values(l).some(n=>!Number.isSafeInteger(n)||n<1)||l.maxSessions>1000||l.maxRequestMs>30000||l.maxTtlMs>300000||l.maxFactBytes>131072)deny('SESSION_CONFIGURATION');
 const sessions=new Map(),ids=new Map();let closed=false;
 function active(signal){const at=now();if(closed||signal?.aborted||!Number.isSafeInteger(at)||at<0)deny();return at;}
 function remove(r){sessions.delete(r.digest);ids.delete(r.sessionId);r.nativeCredential='';r.receipts.clear();}
 function valid(r,signal){const at=active(signal);if(!r||sessions.get(r.digest)!==r||ids.get(r.sessionId)!==r||r.expiresAtMs<=at) {if(r)remove(r);deny();}return at;}
 function release(r,t){t.check();if(valid(r,t.signal)>=t.deadline())deny();}
 function life(deadlineMs,signal){nativeSignal(signal);const at=active(signal);if(deadlineMs!==undefined&&!Number.isSafeInteger(deadlineMs))deny();let cutoff=Math.min(deadlineMs??at+l.maxRequestMs,at+l.maxRequestMs);const timer=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:()=>new ActionSessionError('SESSION_REFUSED')});return {...timer,deadline:()=>cutoff,limitDeadline(next){cutoff=Math.min(cutoff,next);timer.limitDeadline(cutoff);}};}
 function fact(value,keys,started,t){const v=data(value);own(v,keys);if(Buffer.byteLength(JSON.stringify(v))>l.maxFactBytes)deny();const at=active(t.signal);t.check();if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)deny();t.limitDeadline(v.expiresAtMs);return v;}
 function hints(value){const v=data(value);own(v,[],['conversationId','runId','clientId']);if(Object.values(v).some(x=>typeof x!=='string'||!uuid.test(x)))deny();return v;}
 async function resolve(nativeCredential,selected,t,record,ceiling=Infinity){
  let started=active(t.signal);const identity=fact(await t.run(signal=>verifyIdentity({credential:nativeCredential,signal,deadlineMs:t.deadline()})),['principal','identityRevision','checkedAtMs','expiresAtMs'],started,t);
  own(identity.principal,['tenantId','actorId']);if(Object.values(identity.principal).some(v=>typeof v!=='string'||!v||v.length>256)||typeof identity.identityRevision!=='string'||!identity.identityRevision||identity.identityRevision.length>256)deny();
  if(record)valid(record,t.signal);
  if(record&&(!same(identity.principal,record.identity.principal)||identity.identityRevision!==record.identity.identityRevision))deny();
  started=active(t.signal);const current=fact(await t.run(signal=>resolveContext({identity,identitySha256:canonicalSha256(identity),hints:selected,signal,deadlineMs:t.deadline()})),['identitySha256','binding','scopes','selectedClientId','contextRevision','checkedAtMs','expiresAtMs'],started,t);
  if(record)valid(record,t.signal);validateShape('RunBinding',current.binding);if(current.identitySha256!==canonicalSha256(identity)||current.binding.tenantId!==identity.principal.tenantId||current.binding.actorId!==identity.principal.actorId||typeof current.selectedClientId!=='string'||!uuid.test(current.selectedClientId)||typeof current.contextRevision!=='string'||!current.contextRevision||current.contextRevision.length>256||!Array.isArray(current.scopes)||!current.scopes.length||current.scopes.length>100)deny();
  for(const scope of current.scopes){validateShape('Scope',scope);if(scope.tenantId!==identity.principal.tenantId)deny();}
  if(new Set(current.scopes.map(canonicalSha256)).size!==current.scopes.length||!current.scopes.some(s=>s.kind==='client'&&s.resourceId.toLowerCase()===current.selectedClientId))deny();
  for(const key of ['conversationId','runId'])if(selected[key]!==undefined&&selected[key]!==current.binding[key])deny();if(selected.clientId!==undefined&&selected.clientId!==current.selectedClientId)deny();
  const context=data({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId,contextRevision:current.contextRevision});if(record&&!same(context,record.context))deny();
  const expiresAtMs=Math.min(identity.expiresAtMs,current.expiresAtMs,record?.expiresAtMs??ceiling);t.limitDeadline(expiresAtMs);active(t.signal);t.check();return {identity,context,expiresAtMs};
 }
 async function issue(value){const {identityCredential,hints:rawHints={},signal,deadlineMs}=own(value,['identityCredential'],['hints','signal','deadlineMs']);if(typeof identityCredential!=='string'||!identityCredential||identityCredential.length>8192||!/^\S+$/u.test(identityCredential))deny();const selected=hints(rawHints),t=life(deadlineMs,signal);let record;
  try{const started=active(t.signal);for(const r of sessions.values())if(r.expiresAtMs<=started)remove(r);if(sessions.size>=l.maxSessions)deny('SESSION_CAPACITY');const resolved=await resolve(identityCredential,selected,t,undefined,started+l.maxTtlMs);
   active(t.signal);t.check();if(sessions.size>=l.maxSessions)deny('SESSION_CAPACITY');const credential=`action_session_${randomBytes(32).toString('base64url')}`,sessionId=randomUUID();record={...resolved,digest:hash(credential),sessionId,sessionRevision:randomUUID(),nativeCredential:identityCredential,hints:selected,receipts:new Set()};sessions.set(record.digest,record);ids.set(sessionId,record);
   const b=record.context.binding,out=assertActionSessionReceipt({credential,expiresAtMs:record.expiresAtMs,context:{tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId,selectedClientId:record.context.selectedClientId}},active(t.signal));release(record,t);return out;
  }catch(error){if(record)remove(record);if(errors.has(error))throw error;deny();}finally{t.close();}
 }
 async function authenticateSession(value){const {credential,signal,deadlineMs}=own(value,['credential'],['signal','deadlineMs']);if(typeof credential!=='string'||!/^action_session_[A-Za-z0-9_-]{43}$/u.test(credential))deny();const r=sessions.get(hash(credential));valid(r,signal);const t=life(Math.min(deadlineMs??r.expiresAtMs,r.expiresAtMs),signal);
  try{const current=await resolve(r.nativeCredential,r.hints,t,r);valid(r,t.signal);r.expiresAtMs=current.expiresAtMs;const b=r.context.binding,out=data({principal:{sessionId:r.sessionId,tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId},sessionRevision:r.sessionRevision,checkedAtMs:active(t.signal),expiresAtMs:r.expiresAtMs});t.check();r.receipts.add(canonicalSha256(out));if(r.receipts.size>64)r.receipts.delete(r.receipts.values().next().value);release(r,t);return out;}catch{remove(r);deny();}finally{t.close();}
 }
 async function readCurrentState(value){const {authentication,signal,deadlineMs}=own(value,['authentication'],['signal','deadlineMs']),a=data(authentication);const r=ids.get(a.principal?.sessionId);valid(r,signal);if(!r.receipts.has(canonicalSha256(a)))deny();const t=life(Math.min(deadlineMs??r.expiresAtMs,r.expiresAtMs),signal);
  try{const current=await resolve(r.nativeCredential,r.hints,t,r);valid(r,t.signal);r.expiresAtMs=current.expiresAtMs;t.check();const out=data({authenticationSha256:canonicalSha256(a),binding:current.context.binding,scopes:current.context.scopes,selectedClientId:current.context.selectedClientId,checkedAtMs:active(t.signal),expiresAtMs:r.expiresAtMs});release(r,t);return out;}catch{remove(r);deny();}finally{t.close();}
 }
 return Object.freeze({issue,authenticateSession,readCurrentState,revoke(credential){if(typeof credential!=='string')deny();const r=sessions.get(hash(credential));if(r)remove(r);},close(){closed=true;for(const r of sessions.values())remove(r);},status:()=>data({mode,closed,sessions:sessions.size})});
}
