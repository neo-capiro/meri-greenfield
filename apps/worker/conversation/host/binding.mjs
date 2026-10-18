/** Internal D005 host/run identity and currentness checks. A receipt is authoritative only when returned by an
 * authenticated, trusted control port. Shape validation here does not authenticate a caller or allocate a host. */
import {validateShape,canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';

export const HOST_ALLOCATION_SCHEMA='meri-conversation-host-allocation/1';
export const D005_HOST_IDENTITY_SCHEMA='meri-d005-host-identity/1';
export const MAX_HOST_CURRENTNESS_MS=30000; // Source ceiling, not a reviewed product revocation SLO.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const INSTANCE=/^i-[0-9a-f]{8,17}$/u;
const IMAGE=/^sha256:[0-9a-f]{64}$/u;
const HEX=/^[0-9a-f]{64}$/u;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const record=(value,required)=>{try{return own(data(value),required);}catch{fail('HOST_BINDING_REFUSED');}};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);

/** One immutable allocation, for one tenant/conversation and one exact image. The control owner persists it. */
export function assertHostAllocation(value){
 const a=record(value,['schema','tenantId','conversationId','generation','hostId','imageDigest','leaseDeadlineMs']);
 if(a.schema!==HOST_ALLOCATION_SCHEMA||typeof a.tenantId!=='string'||!a.tenantId||a.tenantId.length>128||typeof a.conversationId!=='string'||!UUID.test(a.conversationId)||typeof a.hostId!=='string'||!UUID.test(a.hostId)||typeof a.imageDigest!=='string'||!IMAGE.test(a.imageDigest)||!Number.isSafeInteger(a.generation)||a.generation<1||!Number.isSafeInteger(a.leaseDeadlineMs)||a.leaseDeadlineMs<1)fail('HOST_BINDING_REFUSED');
 return Object.freeze(a);
}

/** Pin the entire admitted RunBinding, including attempt, worker and writer fence. */
export function assertHostRunBinding(allocation,binding){
 const a=assertHostAllocation(allocation);
 let b;try{b=data(binding);validateShape('RunBinding',b);}catch{fail('HOST_BINDING_REFUSED');}
 if(b.tenantId!==a.tenantId||b.conversationId!==a.conversationId)fail('HOST_BINDING_REFUSED');
 return Object.freeze(b);
}

/** Native identity for the pinned allocation. The trusted bootstrap owner, not run data, must establish these IDs. */
export function assertD005HostIdentity(value,binding,allocation){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 let i;try{i=record(value,['schema','instanceId','bootId','conversationId','hostId']);}catch{fail('HOST_IDENTITY_REFUSED');}
 if(i.schema!==D005_HOST_IDENTITY_SCHEMA||typeof i.instanceId!=='string'||!INSTANCE.test(i.instanceId)||typeof i.bootId!=='string'||!UUID.test(i.bootId)||i.conversationId!==b.conversationId||i.hostId!==a.hostId)fail('HOST_IDENTITY_REFUSED');
 return Object.freeze(i);
}

/** Refuse a stale, mismatched or widened host run lease. `current` must come from the trusted control port, never from
 * a tool input or the run's own grant. `maxFreshMs` is a required deployment setting capped above. */
export function assertHostCurrent({allocation,binding,policySha256,current,nowMs,maxFreshMs}){
 const a=assertHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!Number.isSafeInteger(maxFreshMs)||maxFreshMs<1||maxFreshMs>MAX_HOST_CURRENTNESS_MS||typeof policySha256!=='string'||!HEX.test(policySha256))fail('HOST_CURRENTNESS_REFUSED');
 let c,ca,cb;try{c=record(current,['allocation','binding','policySha256','phase','checkedAtMs','currentUntilMs']);
  ca=assertHostAllocation(c.allocation);cb=data(c.binding);validateShape('RunBinding',cb);}catch{fail('HOST_CURRENTNESS_REFUSED');}
 if(!same(ca,a)||!same(cb,b)||c.policySha256!==policySha256||c.phase!=='active'||!Number.isSafeInteger(c.checkedAtMs)||!Number.isSafeInteger(c.currentUntilMs)||c.checkedAtMs>nowMs||c.checkedAtMs<nowMs-maxFreshMs||c.currentUntilMs<=nowMs||c.currentUntilMs>c.checkedAtMs+maxFreshMs||c.currentUntilMs>a.leaseDeadlineMs)fail('HOST_CURRENTNESS_REFUSED');
 return Object.freeze({currentUntilMs:c.currentUntilMs,checkedAtMs:c.checkedAtMs});
}
export const assertBrowserHostCurrent=assertHostCurrent;
