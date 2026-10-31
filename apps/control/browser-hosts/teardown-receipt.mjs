/** This validates a receipt from the existing trusted native teardown owner.
 * It cannot authenticate arbitrary JSON or establish native/cloud absence. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {HOST_TEARDOWN_SCHEMA} from '../../worker/conversation/host/teardown.mjs';
import {validateNativePhysicalEvidence} from '../../../packages/contracts/native-physical-absence.mjs';
const REGION=/^[a-z]{2}-[a-z]+-[0-9]$/u;
export function verifiedTeardownReceipt(raw,record,nowMs){
 const fail=()=>{throw Object.assign(Error('BROWSER_HOST_TEARDOWN_REFUSED'),{code:'BROWSER_HOST_TEARDOWN_REFUSED'});};
 // Placement is immutable allocator-owned data, included in allocationSha256.
 // A receipt cannot narrow the expected process scope by labeling itself.
 const mode=record.allocation.hostMode??'legacy';
 if(!['legacy','browser-only','native-processing'].includes(mode))fail();
 const browserOnly=mode==='browser-only',native=mode==='native-processing';
 const r=data(own(raw,['schema','allocationSha256','bindingSha256','hostIdentitySha256','reason','startedAtMs',
  'browserEgress','bashEgress','processes','browserState','hostDestroy','hostAbsence','status',
  ...(browserOnly||native?['processScope']:[]),...(native?['cgroup','networkNamespace']:[])],
  ['physicalEvidence','physicalProtocolVersion']));
 if(!Number.isSafeInteger(nowMs)||nowMs<0||r.schema!==HOST_TEARDOWN_SCHEMA||r.allocationSha256!==hash(record.allocation)||r.bindingSha256!==hash(record.originalBinding)||
  r.hostIdentitySha256!==hash(record.hostIdentity)||!['conversation-end','cancelled','failed','revoked','lease-expired'].includes(r.reason)||
  !Number.isSafeInteger(r.startedAtMs)||r.startedAtMs<0||r.startedAtMs>nowMs||
  r.processes!=='exited'||r.hostDestroy!=='requested'||r.hostAbsence!=='confirmed'||r.status!=='VERIFIED')fail();
 if(native){
  // The native coordinator's proof is distinct: no browser/Bash concerns, recursive native descendants exited,
  // owned cgroup and netns read back absent. It never claims a browser state or a legacy egress value.
  if(r.processScope!=='native-processing-descendants'||r.browserEgress!=='not-applicable'||
   r.bashEgress!=='not-applicable'||r.browserState!=='not-applicable'||r.cgroup!=='removed'||
   r.networkNamespace!=='removed')fail();
 }else if(r.browserEgress!=='closed'||r.bashEgress!==(browserOnly?'not-applicable':'closed')||
  browserOnly&&r.processScope!=='browser-host-descendants'||r.browserState!=='disposed')fail();
 if(native){
  // Native proof is mandatory and is validated by the same canonical protocol the producer is expected to emit.
  if(r.physicalProtocolVersion!==1) fail();
  try{validateNativePhysicalEvidence(r.physicalEvidence,{nowMs,instanceId:record.hostIdentity.instanceId,
   startedAtMs:r.startedAtMs});}catch{fail();}
 }
 return r;
}
