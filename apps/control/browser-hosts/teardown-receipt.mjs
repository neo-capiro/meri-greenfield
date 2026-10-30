/** This validates a receipt from the existing trusted native teardown owner.
 * It cannot authenticate arbitrary JSON or establish native/cloud absence. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {HOST_TEARDOWN_SCHEMA} from '../../worker/conversation/host/teardown.mjs';
export function verifiedTeardownReceipt(raw,record,nowMs){
 const fail=()=>{throw Object.assign(Error('BROWSER_HOST_TEARDOWN_REFUSED'),{code:'BROWSER_HOST_TEARDOWN_REFUSED'});};
 const r=data(own(raw,['schema','allocationSha256','bindingSha256','hostIdentitySha256','reason','startedAtMs',
  'browserEgress','bashEgress','processes','browserState','hostDestroy','hostAbsence','status']));
 if(!Number.isSafeInteger(nowMs)||nowMs<0||r.schema!==HOST_TEARDOWN_SCHEMA||r.allocationSha256!==hash(record.allocation)||r.bindingSha256!==hash(record.originalBinding)||
  r.hostIdentitySha256!==hash(record.hostIdentity)||!['conversation-end','cancelled','failed','revoked','lease-expired'].includes(r.reason)||
  !Number.isSafeInteger(r.startedAtMs)||r.startedAtMs<0||r.startedAtMs>nowMs||r.browserEgress!=='closed'||r.bashEgress!=='closed'||
  r.processes!=='exited'||r.browserState!=='disposed'||r.hostDestroy!=='requested'||r.hostAbsence!=='confirmed'||r.status!=='VERIFIED')fail();
 return r;
}
