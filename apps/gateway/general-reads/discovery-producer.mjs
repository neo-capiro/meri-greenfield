/** P1: per-run discovery grant for general reads (gate 4 of the read availability gates). Composed DISABLED by default.
 *
 * The grant lists the operations this run's actor may be shown: the run's own allocation ∩ the control's approved reads ∩ the
 * run capability policy (`createRunCapabilityPolicy.forRun`, which already folds platform maximum, tenant settings and the role
 * ceiling; `generalReads` and `readFamilies`). Every listed read requires only `tool.read`, so no further role table is
 * consulted. It is a coarse pre-filter: the per-call current authority (createCurrentToolAuthority: capability, business
 * decision for the exact operation, enabled sources) stays authoritative on every call. An empty list is a valid grant.
 * Shape is the runtime snapshot's `discovery`: {binding, policyRevision, operations, checkedAtMs, expiresAtMs}. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {allocation} from '../budget/tool-budget-binding.mjs';
import {READ_FAMILIES} from '../../worker/conversation/reads/families.mjs';
import {familyReads} from '../../worker/conversation/reads/availability.mjs';

const MAX_TTL_MS=60000,same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const fault=code=>Object.assign(Error(code),{code});
const refuse=(code='UNAVAILABLE')=>{throw fault(code);};
const key=op=>`${op.id}@${op.version}`;

/** One producer per run task. `capabilityPolicy` is the control's run capability policy producer (`forRun`). */
export function createGeneralReadDiscoveryProducer(configuration){
 const c=own(configuration,['binding','policyRevision','allocationJson','approvedReads','now'],['capabilityPolicy','enabled','ttlMs']);
 const enabled=c.enabled??false,ttlMs=c.ttlMs??MAX_TTL_MS,now=c.now,binding=data(c.binding);
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>MAX_TTL_MS||typeof c.policyRevision!=='string'||!c.policyRevision)refuse('GATEWAY_CONFIGURATION');
 validateShape('RunBinding',binding);
 const a=allocation(c.allocationJson),approved=data(c.approvedReads);
 if(!approved||approved.enabled!==true||!Array.isArray(approved.operations))refuse('GATEWAY_CONFIGURATION');
 if(enabled&&(typeof c.capabilityPolicy?.forRun!=='function'))refuse('GATEWAY_CONFIGURATION');
 const allocated=new Set(a.manifest.allowedOperations.map(key)),approvedKeys=new Set(approved.operations.map(key));
 const scheduleExpiresAtMs=Date.parse(a.schedule.expiresAt);
 async function readDiscoveryGrant(value){
  const v=own(value,['binding','policyRevision'],['signal']);nativeSignal(v.signal);
  if(!enabled)refuse();v.signal?.throwIfAborted();
  if(!same(v.binding,binding)||v.policyRevision!==c.policyRevision)refuse('ACCESS_DENIED');
  const policy=await c.capabilityPolicy.forRun({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,...(v.signal?{signal:v.signal}:{})});
  v.signal?.throwIfAborted();
  const families=policy?.generalReads===true&&Array.isArray(policy.readFamilies)?policy.readFamilies.filter(f=>Object.hasOwn(READ_FAMILIES,f)):[];
  const subset=Object.fromEntries(families.map(f=>[f,READ_FAMILIES[f]]));
  const operations=familyReads(subset).map(row=>({id:row.operation.id,version:row.operation.version}))
   .filter(op=>allocated.has(key(op))&&approvedKeys.has(key(op))).sort((x,y)=>key(x).localeCompare(key(y)));
  const at=now(),expiresAtMs=Math.min(at+ttlMs,scheduleExpiresAtMs);
  if(expiresAtMs<=at)refuse();
  return {binding,policyRevision:c.policyRevision,operations,checkedAtMs:at,expiresAtMs};
 }
 return Object.freeze({readDiscoveryGrant});
}
