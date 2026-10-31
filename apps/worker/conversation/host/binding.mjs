/** Internal D005 host/run identity and currentness checks. A receipt is authoritative only when returned by an
 * authenticated, trusted control port. Shape validation here does not authenticate a caller or allocate a host. */
import {assertBrowserHandoff} from '../../../../packages/runtime/browser-custody.mjs';
import {validateShape,canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocationShape,assertNativeHostAllocation,assertHostRunBindingPin,assertD005HostIdentityShape}
 from '../../../../packages/contracts/native-lifecycle.mjs';

export const HOST_ALLOCATION_SCHEMA='meri-conversation-host-allocation/1';
export const D005_HOST_IDENTITY_SCHEMA='meri-d005-host-identity/1';
export const MAX_HOST_CURRENTNESS_MS=30000; // Source ceiling, not a reviewed product revocation SLO.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const INSTANCE=/^i-[0-9a-f]{8,17}$/u;
const IMAGE=/^sha256:[0-9a-f]{64}$/u;
const HEX=/^[0-9a-f]{64}$/u;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const record=(value,required,optional=[])=>{try{return own(data(value),required,optional);}catch{fail('HOST_BINDING_REFUSED');}};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);

/** One immutable allocation, for one tenant/conversation and one exact image. The control owner persists it. */
export function assertHostAllocation(value){return assertHostAllocationShape(value);}

/** The browser/SDK/Bash surfaces: a native-processing allocation is NEVER accepted as one of those
 * authorities. One purpose guard, reused by every existing path, instead of duplicated field checks. */
export function assertBrowserHostAllocation(value){
 const a=assertHostAllocation(value);
 if(a.hostMode==='native-processing')fail('HOST_BINDING_REFUSED');
 return a;
}
/** The explicit native-processing mode, and nothing else. */
export function assertNativeProcessingAllocation(value){return assertNativeHostAllocation(value);}
/** Pin the entire admitted RunBinding, including attempt, worker and writer fence. */
export function assertHostRunBinding(allocation,binding){return assertHostRunBindingPin(allocation,binding);}

/** Native identity for the pinned allocation. The trusted bootstrap owner, not run data, must establish these IDs. */
export function assertD005HostIdentity(value,binding,allocation){return assertD005HostIdentityShape(value,binding,allocation);}

/** Refuse a stale, mismatched or widened host run lease. `current` must come from the trusted control port, never from
 * a tool input or the run's own grant. `maxFreshMs` is a required deployment setting capped above. */
/** Native-processing closed receipt: identical freshness/pin rules, validated against the NATIVE allocation so a
 * processing host is never refused by the browser-only allocation guard (and browser work never uses this branch). */
export function assertNativeHostCurrent({allocation,binding,policySha256,current,nowMs,maxFreshMs}){
 const a=assertNativeProcessingAllocation(allocation),b=assertHostRunBinding(a,binding);
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!Number.isSafeInteger(maxFreshMs)||maxFreshMs<1||maxFreshMs>MAX_HOST_CURRENTNESS_MS||typeof policySha256!=='string'||!HEX.test(policySha256))fail('HOST_CURRENTNESS_REFUSED');
 let c,ca,cb;try{c=record(current,['allocation','binding','policySha256','phase','checkedAtMs','currentUntilMs']);
  ca=assertNativeProcessingAllocation(c.allocation);cb=data(c.binding);validateShape('RunBinding',cb);}catch{fail('HOST_CURRENTNESS_REFUSED');}
 if(!same(ca,a)||!same(cb,b)||c.policySha256!==policySha256||c.phase!=='active'||!Number.isSafeInteger(c.checkedAtMs)||
  !Number.isSafeInteger(c.currentUntilMs)||c.checkedAtMs>nowMs||c.checkedAtMs<nowMs-maxFreshMs||
  c.currentUntilMs<=nowMs||c.currentUntilMs>c.checkedAtMs+maxFreshMs||c.currentUntilMs>a.leaseDeadlineMs)fail('HOST_CURRENTNESS_REFUSED');
 return Object.freeze({currentUntilMs:c.currentUntilMs,checkedAtMs:c.checkedAtMs});
}
export function assertCurrentForAllocation(allocation){
 // Purpose selector for CALLERS that own both paths (the processing launcher). The browser wrapper itself stays
 // browser-only, so no browser/SDK/Bash surface can ever accept a native allocation.
 return allocation?.hostMode==='native-processing'?assertNativeHostCurrent:assertHostCurrent;
}
export function assertHostCurrent({allocation,binding,policySha256,current,nowMs,maxFreshMs}){
 const a=assertBrowserHostAllocation(allocation),b=assertHostRunBinding(a,binding);
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!Number.isSafeInteger(maxFreshMs)||maxFreshMs<1||maxFreshMs>MAX_HOST_CURRENTNESS_MS||typeof policySha256!=='string'||!HEX.test(policySha256))fail('HOST_CURRENTNESS_REFUSED');
 let c,ca,cb;try{c=record(current,['allocation','binding','policySha256','phase','checkedAtMs','currentUntilMs']);
  ca=assertBrowserHostAllocation(c.allocation);cb=data(c.binding);validateShape('RunBinding',cb);}catch{fail('HOST_CURRENTNESS_REFUSED');}
 if(!same(ca,a)||!same(cb,b)||c.policySha256!==policySha256||c.phase!=='active'||!Number.isSafeInteger(c.checkedAtMs)||!Number.isSafeInteger(c.currentUntilMs)||c.checkedAtMs>nowMs||c.checkedAtMs<nowMs-maxFreshMs||c.currentUntilMs<=nowMs||c.currentUntilMs>c.checkedAtMs+maxFreshMs||c.currentUntilMs>a.leaseDeadlineMs)fail('HOST_CURRENTNESS_REFUSED');
 return Object.freeze({currentUntilMs:c.currentUntilMs,checkedAtMs:c.checkedAtMs});
}
/** Browser physical currentness may carry the canonical logical successor. SDK
 * and Bash continue to use the closed ordinary receipt shape above. */
export function assertBrowserHostCurrent(input){
 let value;try{value=own(data(input.current),['allocation','binding','policySha256','phase','checkedAtMs','currentUntilMs'],['browserHandoff']);}catch{fail('HOST_CURRENTNESS_REFUSED');}
 const {browserHandoff,...base}=value,receipt=assertHostCurrent({...input,current:base});
 if(browserHandoff===undefined)return receipt;
 const handoff=assertBrowserHandoff(browserHandoff),custody=handoff.custody,source=input.binding;
 if(custody.hostId!==input.allocation.hostId||custody.generation!==input.allocation.generation||custody.policySha256!==input.policySha256||
  value.currentUntilMs>custody.expiresAtMs||custody.binding.writerFence<source.writerFence||
  ['tenantId','actorId','conversationId'].some(key=>custody.binding[key]!==source[key]))fail('HOST_CURRENTNESS_REFUSED');
 return Object.freeze({...receipt,browserHandoff:handoff});
}
