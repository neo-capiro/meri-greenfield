/** PURE native-processing host identity, allocation and lifecycle wire contract. Shape validation only: it
 * grants no permission and performs no I/O. Control currentness/Core/lease admission stays in the app owner. */
import {own,data} from './commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256} from './validate.mjs';

export const NATIVE_LIFECYCLE_PATH='/v1/native-processing/lifecycle';
export const NATIVE_LIFECYCLE_SCHEMA='meri-native-host-lifecycle/1';
export const NATIVE_ABSENCE_SCHEMA='meri-d005-native-absence/1';
export const NATIVE_LIFECYCLE_ACTIONS=Object.freeze(['close','processes','observe']);
export const NATIVE_LIFECYCLE_MAX_MS=30000;
export const NATIVE_LIFECYCLE_BODY_BYTES=16384;
export const HOST_ALLOCATION_SCHEMA='meri-conversation-host-allocation/1';
export const D005_HOST_IDENTITY_SCHEMA='meri-d005-host-identity/1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const INSTANCE=/^i-[0-9a-f]{8,17}$/u;
const HEX=/^[0-9a-f]{64}$/u;
const DIGEST=/^sha256:[a-f0-9]{64}$/u;
const refuse=code=>{throw Object.assign(new Error(code),{code});};
const record=(value,required,optional=[])=>{try{return own(data(value),required,optional);}catch{refuse('HOST_BINDING_REFUSED');}};

/** Generic immutable allocation shape (purpose guard is applied by the caller). */
export function assertHostAllocationShape(value){
 const a=record(value,['schema','tenantId','conversationId','generation','hostId','imageDigest','leaseDeadlineMs'],['hostMode']);
 if(a.hostMode!==undefined&&a.hostMode!=='browser-only'&&a.hostMode!=='native-processing')refuse('HOST_BINDING_REFUSED');
 if(a.schema!==HOST_ALLOCATION_SCHEMA||typeof a.tenantId!=='string'||!a.tenantId||a.tenantId.length>128||
  typeof a.conversationId!=='string'||!UUID.test(a.conversationId)||typeof a.hostId!=='string'||!UUID.test(a.hostId)||
  typeof a.imageDigest!=='string'||!DIGEST.test(a.imageDigest)||!Number.isSafeInteger(a.generation)||a.generation<1||
  !Number.isSafeInteger(a.leaseDeadlineMs)||a.leaseDeadlineMs<1)refuse('HOST_BINDING_REFUSED');
 return Object.freeze(a);
}
export function assertNativeHostAllocation(value){
 const a=assertHostAllocationShape(value);
 if(a.hostMode!=='native-processing')refuse('HOST_BINDING_REFUSED');
 return a;
}
export function assertHostRunBindingPin(allocation,binding){
 const a=assertHostAllocationShape(allocation);
 let b;try{b=data(binding);validateShape('RunBinding',b);}catch{refuse('HOST_BINDING_REFUSED');}
 if(b.tenantId!==a.tenantId||b.conversationId!==a.conversationId)refuse('HOST_BINDING_REFUSED');
 return Object.freeze(b);
}
export function assertD005HostIdentityShape(value,binding,allocation){
 const a=assertHostAllocationShape(allocation),b=assertHostRunBindingPin(a,binding);
 let i;try{i=record(value,['schema','instanceId','bootId','conversationId','hostId']);}catch{refuse('HOST_IDENTITY_REFUSED');}
 if(i.schema!==D005_HOST_IDENTITY_SCHEMA||typeof i.instanceId!=='string'||!INSTANCE.test(i.instanceId)||
  typeof i.bootId!=='string'||!UUID.test(i.bootId)||i.conversationId!==b.conversationId||i.hostId!==a.hostId)
  refuse('HOST_IDENTITY_REFUSED');
 return Object.freeze(i);
}

/** Closed request: exactly schema/action/allocation/binding/hostIdentity; the protected image is ALWAYS required. */
export function nativeLifecycleRequest(raw,{config}={}){
 let r;try{r=own(data(raw),['schema','action','allocation','binding','hostIdentity']);}catch{refuse('NATIVE_LIFECYCLE_REFUSED');}
 if(r.schema!==NATIVE_LIFECYCLE_SCHEMA||!NATIVE_LIFECYCLE_ACTIONS.includes(r.action))refuse('NATIVE_LIFECYCLE_REFUSED');
 const trusted=config?.allocation,trustedBinding=config?.binding;
 if(trusted===undefined||trustedBinding===undefined)refuse('NATIVE_LIFECYCLE_CONFIGURATION');
 if(typeof config?.image?.digest!=='string'||!DIGEST.test(config.image.digest))refuse('NATIVE_LIFECYCLE_CONFIGURATION');
 const allocation=assertNativeHostAllocation(r.allocation);
 const binding=assertHostRunBindingPin(allocation,r.binding);
 const hostIdentity=assertD005HostIdentityShape(r.hostIdentity,binding,allocation);
 if(allocation.hostId!==trusted.hostId||allocation.generation!==trusted.generation||
  allocation.tenantId!==trusted.tenantId||allocation.conversationId!==trusted.conversationId||
  allocation.hostMode!=='native-processing'||allocation.hostMode!==trusted.hostMode||
  allocation.leaseDeadlineMs!==trusted.leaseDeadlineMs||
  hostIdentity.instanceId!==trusted.instanceId||hostIdentity.bootId!==trusted.bootId||
  binding.tenantId!==trusted.tenantId||binding.conversationId!==trusted.conversationId||
  allocation.imageDigest!==config.image.digest||
  canonicalSha256(binding)!==canonicalSha256(trustedBinding))refuse('NATIVE_LIFECYCLE_REFUSED');
 return Object.freeze({action:r.action,allocation,binding,hostIdentity});
}
export function nativeAbsenceRecord(value){
 let r;try{r=own(data(value),['schema','allocationSha256','bindingSha256','hostIdentitySha256','observedAtMs','scope',
  'cgroup','networkNamespace','status']);}catch{return null;}
 if(r.schema!==NATIVE_ABSENCE_SCHEMA||!HEX.test(r.allocationSha256)||!HEX.test(r.bindingSha256)||
  !HEX.test(r.hostIdentitySha256)||!Number.isSafeInteger(r.observedAtMs)||
  r.scope!=='native-processing-descendants'||r.cgroup!=='removed'||r.networkNamespace!=='removed'||
  r.status!=='absent')return null;
 return Object.freeze(r);
}

/** Closed remote close answer: status 'closed'|'unknown' (never {closed:true}), exact hashes and fresh time. */
export function nativeLifecycleCloseAnswer(value,{allocation,binding,hostIdentity,nowMs,maxFreshMs=30000}){
 let r;try{r=own(data(value),['schema','action','status','allocationSha256','bindingSha256','hostIdentitySha256','quiescedAtMs']);}catch{return null;}
 if(r.schema!==NATIVE_LIFECYCLE_SCHEMA||r.action!=='close'||!['closed','unknown'].includes(r.status)||
  r.allocationSha256!==canonicalSha256(allocation)||r.bindingSha256!==canonicalSha256(binding)||
  r.hostIdentitySha256!==canonicalSha256(hostIdentity)||!Number.isSafeInteger(r.quiescedAtMs)||
  r.quiescedAtMs>nowMs||r.quiescedAtMs<nowMs-maxFreshMs)return null;
 return Object.freeze(r);
}
