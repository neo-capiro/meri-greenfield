/** Current-membership gate for product surfaces. It correlates two injected trusted owners on every call and caches nothing:
 * the native identity verifier (Clerk session → tenant/actor) and Core's authoritative membership source. A removed, suspended or
 * changed membership therefore denies new requests, results awaiting release and stored action sessions (through `verifyIdentity`).
 * This module decides no business rights; it only admits a principal that Core currently reports as an active member. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {ROLE_NAME} from '../../worker/conversation/capabilities/policy-resolution.mjs';
import {ProductError,asProductError,refuse} from './errors.mjs';
import {UUID,closed,text} from './shape.mjs';
const PERMISSION=/^[a-z][a-z0-9_.-]{0,63}$/u;
const IDENTITY=['tenantId','actorId'];
const TIMES=['checkedAtMs','expiresAtMs'];
const MEMBERSHIP=[...IDENTITY,'status','role','permissions','clientIds','membershipRevision',...TIMES];
export const MEMBERSHIP_STATUSES=Object.freeze(['active','suspended','removed']);
/** Frozen principal shape; `clientIds` and `permissions` are sorted, unique and lower-case. */
function principalFrom(m){
 return Object.freeze({tenantId:m.tenantId,actorId:m.actorId,role:m.role,permissions:Object.freeze([...m.permissions].sort()),
  clientIds:Object.freeze([...m.clientIds].sort()),membershipRevision:m.membershipRevision});
}
export function createMembershipGate(options){
 const {verifyToken,readMembership,now,limits}=closedPorts(options);
 /** One bounded lifetime per call; `deadline()` is the current cutoff (caller deadline ∧ maxRequestMs ∧ every receipt expiry). */
 const life=(deadlineMs,signal)=>{const at=now();let cutoff=Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:at+limits.maxRequestMs,at+limits.maxRequestMs);
  const t=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:code=>new ProductError(code)});
  return Object.freeze({...t,deadline:()=>cutoff,limitDeadline(next){t.limitDeadline(next);cutoff=Math.min(cutoff,next);}});};
 /** Freshness and size of one port receipt; publishes its expiry into the lifetime. */
 function fact(raw,keys,started,lifetime){
  if(Buffer.byteLength(JSON.stringify(raw??null))>limits.maxFactBytes)refuse('ACCESS_DENIED');
  const v=closed(raw,keys,[],'ACCESS_DENIED'),at=now();lifetime.check();
  if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)refuse('ACCESS_DENIED');
  lifetime.limitDeadline(v.expiresAtMs);return v;
 }
 /** Core's current membership for exactly this identity; anything but an active member refuses. */
 async function membershipOf(identity,lifetime){
  const started=now();
  const m=fact(await lifetime.run(signal=>readMembership({tenantId:identity.tenantId,actorId:identity.actorId,signal,deadlineMs:lifetime.deadline()})),MEMBERSHIP,started,lifetime);
  if(m.tenantId!==identity.tenantId||m.actorId!==identity.actorId||!MEMBERSHIP_STATUSES.includes(m.status)||!text(m.membershipRevision,1,256)||typeof m.role!=='string'||!ROLE_NAME.test(m.role)||
   !Array.isArray(m.permissions)||m.permissions.length>64||new Set(m.permissions).size!==m.permissions.length||m.permissions.some(p=>typeof p!=='string'||!PERMISSION.test(p))||
   !Array.isArray(m.clientIds)||m.clientIds.length>4096||new Set(m.clientIds).size!==m.clientIds.length||m.clientIds.some(c=>typeof c!=='string'||!UUID.test(c)))refuse('ACCESS_DENIED');
  // Removal and suspension are explicit current facts from Core; neither is inferred from a missing row.
  if(m.status!=='active')refuse('MEMBERSHIP_REVOKED');
  return m;
 }
 async function admitWithin(credential,lifetime){
  if(typeof credential!=='string'||!credential||credential.length>8192)refuse('UNAUTHENTICATED');
  const started=now();
  const identity=fact(await lifetime.run(signal=>verifyToken({credential,signal,deadlineMs:lifetime.deadline()})),[...IDENTITY,...TIMES],started,lifetime);
  if(!IDENTITY.every(k=>text(identity[k],1,128)))refuse('ACCESS_DENIED');
  const m=await membershipOf(identity,lifetime);lifetime.check();
  return {principal:principalFrom(m),expiresAtMs:Math.min(identity.expiresAtMs,m.expiresAtMs)};
 }
 return Object.freeze({
  /** New access: verify the native credential, then require an active current membership. */
  async admit({credential,signal,deadlineMs}){
   const lifetime=life(deadlineMs,signal);
   try{return await admitWithin(credential,lifetime);}catch(error){throw asProductError(error,'ACCESS_DENIED');}finally{lifetime.close();}
  },
  /** Stored or pending access: the same member must still be active at the same membership revision before anything is released. */
  async recheck({principal,signal,deadlineMs}){
   const lifetime=life(deadlineMs,signal);
   try{
    const m=await membershipOf({tenantId:principal.tenantId,actorId:principal.actorId},lifetime);
    if(canonicalSha256(principalFrom(m))!==canonicalSha256(principal))refuse('MEMBERSHIP_CHANGED');
    return principal;
   }catch(error){throw asProductError(error,'ACCESS_DENIED');}finally{lifetime.close();}
  },
  /** Identity port for the existing action-session owner. Its identityRevision is the membership revision, and the owner rechecks
   * it on every use, so removing or changing a membership refuses and discards stored action sessions. */
  async verifyIdentity({credential,signal,deadlineMs}){
   const lifetime=life(deadlineMs,signal);
   try{const {principal,expiresAtMs}=await admitWithin(credential,lifetime);
    return Object.freeze({principal:Object.freeze({tenantId:principal.tenantId,actorId:principal.actorId}),identityRevision:canonicalSha256(principal),checkedAtMs:now(),expiresAtMs});
   }catch(error){throw asProductError(error,'ACCESS_DENIED');}finally{lifetime.close();}
  },
 });
 function closedPorts(value){
  const o=value??{};const {verifyToken,readMembership,now,limits}=o;
  if(Object.keys(o).some(k=>!['verifyToken','readMembership','now','limits'].includes(k))||typeof verifyToken!=='function'||typeof readMembership!=='function'||typeof now!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
  const l=limits??{};
  if(!Number.isSafeInteger(l.maxRequestMs)||l.maxRequestMs<1||l.maxRequestMs>30000||!Number.isSafeInteger(l.maxFactBytes)||l.maxFactBytes<1||l.maxFactBytes>262144)throw new ProductError('PRODUCT_CONFIGURATION');
  return {verifyToken,readMembership,now,limits:Object.freeze({maxRequestMs:l.maxRequestMs,maxFactBytes:l.maxFactBytes})};
 }
}
